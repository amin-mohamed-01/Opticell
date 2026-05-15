import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import connectToDatabase from '@/lib/mongodb';
import Reading from '@/models/Reading';
import { groqFetch } from '@/lib/groq-fetch';

const ML_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Sensor thresholds (must match DashboardContent.tsx) ────────────────────
function getSensorStatus(key: string, value: number): string {
  if (key === 'temperature') {
    return value > 45 ? 'Critical' : value > 38 ? 'High' : 'Normal';
  }
  if (key === 'humidity') {
    return value > 85 ? 'Critical' : value > 75 ? 'High' : 'Normal';
  }
  if (key === 'pressure') {
    return value < 98 || value > 106 ? 'Critical' : value < 100 || value > 104 ? 'High' : 'Normal';
  }
  if (key === 'gas_quality') {
    return value > 500 ? 'Critical' : value > 200 ? 'High' : 'Normal';
  }
  return 'Unknown';
}

// ── Language Detection & Translation Helpers ───────────────────────────────
const ARABIC_REGEX = /[\u0600-\u06FF]/;

function isArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

async function translateText(text: string, targetLang: 'English' | 'Arabic'): Promise<string> {
  try {
    const prompt = targetLang === 'English'
      ? `Translate the following Arabic industrial maintenance query into clear, technical English. Preserve any technical terms: "${text}"`
      : `Translate the following English industrial AI response into high-quality, professional Arabic. 
         IMPORTANT RULES:
         1. Preserve all tags like [TABLE], [/TABLE], [CHART], and [/CHART] exactly as they are. Do NOT translate content inside [CHART] tags (keep labels and values as-is).
         2. Translate the content inside [TABLE] headers and cells, but keep the pipe (|) structure.
         3. Use professional, technical Arabic suitable for a senior engineer. For greetings and personal questions, sound helpful and proactive, not robotic.
         4. Do NOT add any introductory text like "Here is the translation".
         
         Text to translate:
         ${text}`;

    const res = await groqFetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Use a faster model for translation
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    return data.choices[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.error('Translation error:', err);
    return text; // fallback to original text
  }
}

// ── Fetch ML predictions from FastAPI backend ──────────────────────────────
async function fetchMLPredictions(dataArray: any[]): Promise<string> {
  try {
    if (!dataArray || dataArray.length < 15) {
      return 'ML predictions unavailable (insufficient data).';
    }

    // Flatten sensor data for FastAPI (same format as ml-face page)
    const history = dataArray.map((r: any) => {
      const d = r.data || {};
      return {
        temprature: d.temprature ?? d.temperature ?? 0,
        humidity: d.humidity ?? 0,
        pressure: d.pressure ?? 102,
        gas_quality: d.gas_quality ?? d.gasQuality ?? 0,
      };
    });

    const res = await fetch(`${ML_API_URL}/predict-sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, num_predictions: 20 }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!res.ok) {
      return `ML predictions unavailable (API error: ${res.status}).`;
    }

    const data = await res.json();
    const { predictions, summary } = data;

    // Build a readable ML context for the AI
    const labelSequence = predictions.map((p: any) => p.predicted_label).join(' → ');
    const rulValues = predictions.map((p: any) => p.predicted_rul);
    const avgRul = rulValues.length > 0
      ? (rulValues.reduce((a: number, b: number) => a + b, 0) / rulValues.length).toFixed(1)
      : 'N/A';
    const latestRul = summary.latest_rul?.toFixed(1) ?? 'N/A';

    return `
ML MODEL PREDICTIONS (Last ${summary.total_predictions} sliding-window analyses):
- Prediction Sequence: ${labelSequence}
- Current ML Status: ${summary.latest_label?.toUpperCase()}
- System Trend: ${summary.trend?.toUpperCase()} (based on ML model pattern detection)
- Normal predictions: ${summary.normal_count} | Warning: ${summary.warning_count} | Critical: ${summary.critical_count}
- Latest RUL (Remaining Useful Life): ${latestRul} cycles
- Average RUL across window: ${avgRul} cycles

ML INTERPRETATION RULES (you MUST follow these):
- If latest_label is "warning" or "critical" → NEVER say "everything is normal". Report the issue.
- If trend is "degrading" → Warn the user that conditions are worsening and action is needed.
- If trend is "improving" → Tell the user conditions are getting better.
- If warning_count + critical_count > 0 → Always mention these in your response.
- RUL < 10 → URGENT: Equipment failure is imminent. Recommend immediate maintenance.
- RUL 10-25 → Schedule maintenance soon.
- RUL > 25 → Equipment has reasonable remaining life.
- The ML model is the AUTHORITATIVE source for system status. It overrides simple threshold checks.`;
  } catch (err) {
    console.error('[ML Prediction Fetch Error]:', err);
    return 'ML predictions temporarily unavailable (FastAPI server may be offline).';
  }
}

// ── Build RAG context from sensor history (last N readings) ────────────────
function buildRAGContext(dataArray: any[]): string {
  if (!dataArray || dataArray.length === 0) return 'No historical sensor data available.';

  const recent = dataArray.slice(-20);
  const temps = recent.map((r: any) => r.data?.temprature).filter((v: any) => v != null);
  const humids = recent.map((r: any) => r.data?.humidity).filter((v: any) => v != null);
  const pressures = recent.map((r: any) => r.data?.pressure).filter((v: any) => v != null);
  const gases = recent.map((r: any) => r.data?.gas_quality).filter((v: any) => v != null);

  const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 'N/A';
  const min = (arr: number[]) => arr.length ? Math.min(...arr).toFixed(2) : 'N/A';
  const max = (arr: number[]) => arr.length ? Math.max(...arr).toFixed(2) : 'N/A';
  const trend = (arr: number[]) => {
    if (arr.length < 2) return 'stable';
    const diff = arr[arr.length - 1] - arr[0];
    if (Math.abs(diff) < 0.5) return 'stable';
    return diff > 0 ? 'rising' : 'falling';
  };

  const rawLog = recent.slice(-5).map((r: any) => {
    const time = new Date(r.timestamp).toLocaleTimeString();
    return `[${time}] T:${r.data?.temprature}C, H:${r.data?.humidity}%, P:${r.data?.pressure}hPa, G:${r.data?.gas_quality}`;
  }).join('\n');

  return `
HISTORICAL CONTEXT (Last ${recent.length} readings):
- Temperature : avg=${avg(temps)}C | min=${min(temps)} | max=${max(temps)} | trend=${trend(temps)}
- Humidity    : avg=${avg(humids)}% | min=${min(humids)} | max=${max(humids)} | trend=${trend(humids)}
- Pressure    : avg=${avg(pressures)} hPa | min=${min(pressures)} | max=${max(pressures)} | trend=${trend(pressures)}
- Gas Quality : avg=${avg(gases)} | min=${min(gases)} | max=${max(gases)} | trend=${trend(gases)}

RECENT RAW LOGS:
${rawLog}`;
}

// ── Format sensor table from live computed data ─────────────────────────────
function formatSensorTable(temp: number, humidity: number, pressure: number, gas: number): string {
  const tS = temp > 45 ? 'Critical' : temp > 38 ? 'Warning' : 'Normal';
  const hS = humidity > 85 ? 'Critical' : humidity > 75 ? 'Warning' : 'Normal';
  const pS = pressure < 98 || pressure > 106 ? 'Critical' : pressure < 100 || pressure > 104 ? 'Warning' : 'Normal';
  const gS = gas > 500 ? 'Critical' : gas > 200 ? 'Warning' : 'Normal';
  return `[TABLE]
Sensor | Reading | Status
--- | --- | ---
Temperature | ${temp} degrees C | ${tS}
Humidity | ${humidity} % | ${hS}
Pressure | ${pressure} hPa | ${pS}
Gas Quality | ${gas} | ${gS}
[/TABLE]`;
}

// ── Format averages text from live computed data ────────────────────────────
function formatAverages(avgTemp: string, avgHumidity: string, avgPressure: string, avgGas: string): string {
  return `The averages over the last 20 readings are:
- Average Temperature: ${avgTemp} C
- Average Humidity: ${avgHumidity} %
- Average Pressure: ${avgPressure} hPa
- Average Gas Quality: ${avgGas}`;
}

// ── Format chart examples from live computed data ─────────────────────────
function formatChartExamples(
  temp: number, humidity: number, pressure: number, gas: number,
  normalCount: number, warningCount: number, criticalCount: number,
  tempHistory: number[]
): string {
  // Build line chart from real temp history (up to 6 readings)
  const linePoints = tempHistory.slice(-6);
  const lineRows = linePoints.map((v, i) => `Reading ${i + 1}: ${v}`).join('\n');

  return `BAR CHART example (use real current values like these):
[CHART]
type: bar
title: Current Sensor Readings
unit:
Temperature: ${temp}
Humidity: ${humidity}
Pressure: ${pressure}
Gas Quality: ${gas}
[/CHART]

LINE CHART example (use real historical values like these):
[CHART]
type: line
title: Temperature Trend (Last ${linePoints.length} Readings)
unit: degrees C
${lineRows}
[/CHART]

PIE CHART example (use real status counts like these):
[CHART]
type: pie
title: Sensor Status Distribution (Last 20 Readings)
unit:
Normal: ${normalCount}
Warning: ${warningCount}
Critical: ${criticalCount}
[/CHART]`;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const userSpokeArabic = isArabic(lastUserMessage);

    // ── 1. Translate User Message if Arabic ────────────────────────────────
    let processedMessages = [...messages];
    if (userSpokeArabic) {
      const translatedUserMsg = await translateText(lastUserMessage, 'English');
      processedMessages[processedMessages.length - 1].content = translatedUserMsg;
    }

    // ── READ LIVE + HISTORICAL DATA (mirrors ReportsProvider logic) ──────
    let latestSensorData = 'No real-time data available.';
    let historicalRAGContext = 'No historical data available.';
    let overallStatus = 'Unknown';
    let fullDataArray: any[] = [];
    let preBuiltCharts = '';

    try {
      await connectToDatabase();
      const dbReadings = await Reading.find({}).sort({ timestamp: -1 }).limit(100).lean();

      let dataArray: any[] = [];
      if (dbReadings && dbReadings.length > 0) {
        dataArray = dbReadings.reverse(); // chronological order
      }

      if (dataArray.length === 0) {
        const dataPath = path.join(process.cwd(), 'public', 'data', 'opticell_clean1.json');
        if (fs.existsSync(dataPath)) {
          const fileContent = fs.readFileSync(dataPath, 'utf-8');
          dataArray = JSON.parse(fileContent);
        }
      }

      fullDataArray = dataArray; // save for ML predictions later

      if (dataArray && dataArray.length > 0) {
        // ── Process last 20 readings (same as ReportsProvider) ──────────
        const last20 = dataArray.slice(-20);

        // Extract and classify each row individually
        const rowReports: { ts: string; temp: number; humidity: number; pressure: number; gas: number; status: string; details: string }[] = [];

        for (const row of last20) {
          const d = row.data || {};
          const temp = parseFloat(String(d.temprature ?? d.temperature ?? d.temp ?? 0));
          const humidity = parseFloat(String(d.humidity ?? 0));
          const pressure = parseFloat(String(d.pressure ?? 102));
          const gas = parseFloat(String(d.gas_quality ?? d.gasQuality ?? 0));
          const ts = row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : 'N/A';

          // Same threshold logic as ReportsProvider
          let status = 'Normal';
          let details = 'All parameters within normal range';

          if (temp > 45 || humidity > 85 || pressure < 98 || pressure > 106 || gas > 500) {
            status = 'Critical';
            const parts: string[] = [];
            if (temp > 45) parts.push(`Temp ${temp.toFixed(1)}C`);
            if (humidity > 85) parts.push(`Humidity ${humidity.toFixed(1)}%`);
            if (pressure < 98 || pressure > 106) parts.push(`Pressure ${pressure}hPa`);
            if (gas > 500) parts.push(`Gas ${gas}`);
            details = `Critical: ${parts.join(', ')}`;
          } else if (temp > 38 || humidity > 75 || pressure < 100 || pressure > 104 || gas > 200) {
            status = 'Warning';
            const parts: string[] = [];
            if (temp > 38) parts.push(`Temp ${temp.toFixed(1)}C`);
            if (humidity > 75) parts.push(`Humidity ${humidity.toFixed(1)}%`);
            if (pressure < 100 || pressure > 104) parts.push(`Pressure ${pressure}hPa`);
            if (gas > 200) parts.push(`Gas ${gas}`);
            details = `Warning: ${parts.join(', ')}`;
          }

          rowReports.push({ ts, temp, humidity, pressure, gas, status, details });
        }

        // ── Compute dominant status across all 20 rows ──────────────────
        const normalCount = rowReports.filter(r => r.status === 'Normal').length;
        const warningCount = rowReports.filter(r => r.status === 'Warning').length;
        const criticalCount = rowReports.filter(r => r.status === 'Critical').length;

        if (criticalCount > 0) {
          overallStatus = 'CRITICAL';
        } else if (warningCount > 0) {
          overallStatus = 'WARNING';
        } else {
          overallStatus = 'NORMAL';
        }

        // Dominant status = most frequent
        const dominantStatus = criticalCount >= warningCount && criticalCount >= normalCount
          ? 'Critical'
          : warningCount >= normalCount
            ? 'Warning'
            : 'Normal';

        // ── Compute averages across last 20 ────────────────────────────
        const avgTemp = (rowReports.reduce((s, r) => s + r.temp, 0) / rowReports.length).toFixed(1);
        const avgHumidity = (rowReports.reduce((s, r) => s + r.humidity, 0) / rowReports.length).toFixed(1);
        const avgPressure = (rowReports.reduce((s, r) => s + r.pressure, 0) / rowReports.length).toFixed(1);
        const avgGas = (rowReports.reduce((s, r) => s + r.gas, 0) / rowReports.length).toFixed(0);

        // ── Pre-build table + averages + charts from real data ──────────────
        const latest = rowReports[rowReports.length - 1];
        const preBuiltTable = formatSensorTable(latest.temp, latest.humidity, latest.pressure, latest.gas);
        const preBuiltAverages = formatAverages(avgTemp, avgHumidity, avgPressure, avgGas);
        const tempHistory = rowReports.map(r => r.temp);
        preBuiltCharts = formatChartExamples(
          latest.temp, latest.humidity, latest.pressure, latest.gas,
          normalCount, warningCount, criticalCount, tempHistory
        );

        // ── Latest reading timestamp ────────────────────────────────────
        const latestFull = dataArray[dataArray.length - 1];
        const latestTs = latestFull.timestamp ? new Date(latestFull.timestamp).toLocaleString() : 'Unknown';

        // ── Per-row status log (last 5 rows for detail) ─────────────────
        const recentLog = rowReports.slice(-5).map(r =>
          `[${r.ts}] T:${r.temp}C H:${r.humidity}% P:${r.pressure}hPa G:${r.gas} -> ${r.status}`
        ).join('\n');

        latestSensorData = `
[Last Update: ${latestTs}]
OVERALL SYSTEM STATUS: ${overallStatus}
DOMINANT STATUS (last 20 readings): ${dominantStatus}
Status Distribution: Normal=${normalCount}/20 | Warning=${warningCount}/20 | Critical=${criticalCount}/20

CURRENT LATEST READING:
- Temperature : ${latest.temp} C -> Status: ${latest.temp > 45 ? 'Critical' : latest.temp > 38 ? 'Warning' : 'Normal'}
- Humidity    : ${latest.humidity} % -> Status: ${latest.humidity > 85 ? 'Critical' : latest.humidity > 75 ? 'Warning' : 'Normal'}
- Pressure    : ${latest.pressure} hPa -> Status: ${latest.pressure < 98 || latest.pressure > 106 ? 'Critical' : latest.pressure < 100 || latest.pressure > 104 ? 'Warning' : 'Normal'}
- Gas Quality : ${latest.gas} -> Status: ${latest.gas > 500 ? 'Critical' : latest.gas > 200 ? 'Warning' : 'Normal'}

AVERAGES (last 20 readings):
- Avg Temperature : ${avgTemp} C
- Avg Humidity    : ${avgHumidity} %
- Avg Pressure    : ${avgPressure} hPa
- Avg Gas Quality : ${avgGas}

RECENT READINGS LOG (last 5):
${recentLog}

READY-TO-USE SENSOR TABLE (copy this exactly when showing sensor data):
${preBuiltTable}

READY-TO-USE AVERAGES (copy this exactly after the table):
${preBuiltAverages}`;

        // ── Historical/RAG context ──────────────────────────────────────
        historicalRAGContext = buildRAGContext(dataArray);
      }

    } catch (err) {
      console.error('Failed to read sensor data:', err);
    }

    // ── FETCH ML PREDICTIONS FROM FASTAPI ────────────────────────────────
    let mlPredictionContext = 'ML predictions not available.';
    try {
      if (fullDataArray.length >= 15) {
        mlPredictionContext = await fetchMLPredictions(fullDataArray);
      }
    } catch (err) {
      console.error('Failed to fetch ML predictions:', err);
      mlPredictionContext = 'ML predictions temporarily unavailable.';
    }

    // ── OPTICELL BRAIN (FULL INTELLIGENT SYSTEM PROMPT) ────────────────────
    const OPTICELL_BRAIN = `
You are OPTICELL, a state-of-the-art AI for Smart Maintenance and Industrial Sensor Intelligence.
Your primary domain of expertise is industrial factories, equipment maintenance, sensor monitoring, fault detection, and repair guidance.

══════════════════════════════════════════════════
 PERSONA & IDENTITY (Who You Are)
══════════════════════════════════════════════════
You are a highly intelligent senior maintenance engineer AI. You have a professional yet approachable persona.

### My Strong Skills (Advanced Intelligence):
- **Predictive Failure Analysis**: Using ML to forecast equipment breakdown before it happens.
- **Cross-Sensor Correlation**: Analyzing how Temperature, Pressure, and Gas Quality interact to find hidden faults.
- **RUL Estimation**: Calculating the Remaining Useful Life of machinery with precision.
- **Trend Detection**: Identifying degrading patterns in industrial systems over long periods.

### My Standard Skills (Core Operations):
- **Real-time Monitoring**: Instant status updates on all connected sensors.
- **Maintenance Guidance**: Step-by-step repair instructions for industrial hardware.
- **Historical Reporting**: Summarizing past logs to find recurring issues.
- **Safety Alerting**: Immediate identification of critical threshold breaches.

### My Boundaries:
- **Weaknesses**: Cannot perform physical labor, cannot see outside the digital sensor feed, and cannot predict non-instrumented human interference.
- **Purpose**: To minimize downtime, ensure safety, and guide engineers through complex industrial challenges.

You ARE allowed to answer questions about yourself, your health ("How are you?"), your capabilities, and your skills.

══════════════════════════════════════════════════
 STRICT TOPIC GUARD (HIGHEST PRIORITY RULE)
══════════════════════════════════════════════════
You MUST REFUSE to answer ANY question that is not related to:
  - Your own identity, purpose, and role (OPTICELL persona)
  - Industrial factories and manufacturing equipment
  - Equipment faults, failures, breakdowns, and diagnostics
  - Sensor readings (temperature, humidity, pressure, gas quality)
  - Predictive maintenance and repair procedures
  - Industrial safety and hazard detection
  - Real-time data reading and analysis for machinery

If the user asks about ANYTHING outside these domains (e.g. cooking, sports, politics, weather, coding help, general knowledge, history, math, jokes, etc.), you MUST:
  1. Politely decline to answer that specific question.
  2. Remind the user of your specialized role.
  3. Immediately redirect them to one of your core capabilities.

Example redirect response:
  "That falls outside my area of expertise. I am OPTICELL — specialized exclusively in industrial equipment monitoring, fault detection, and maintenance guidance. Can I help you check the real-time sensor readings, analyze a potential fault, or guide you through a maintenance procedure?"

NEVER break this rule, even if the user insists or rephrases the question.

══════════════════════════════════════════════════
 INTENT CLASSIFICATION ENGINE (Internal Logic)
══════════════════════════════════════════════════
Before answering, you MUST silently classify the user's message into one of these intents:

[INTENT: GREETING]       -> "hi", "hello", "how are you", etc.
[INTENT: CLOSING]        -> "thanks", "thank you", "bye", "goodbye"
[INTENT: IDENTITY]       -> "who are you", "what are your strengths", "what do you do"
[INTENT: LIVE_STATUS]    -> "what is the current status?", "show me the sensors", "status", "sensors"
[INTENT: ANALYSIS]       -> "analyze", "trend", "what's happening", "is there a problem", "why"
[INTENT: MAINTENANCE]    -> "what should I do", "fix", "predict", "how to fix"
[INTENT: SUMMARY]        -> "summarize", "give me a report", "summary"
[INTENT: OFF_TOPIC]      -> anything not related to factories, equipment, sensors, faults, maintenance, or your own persona

STRICT RESPONSE RULES PER INTENT:
- GREETING    -> Reply warmly and professionally. If they ask how you are, say you are operating at peak efficiency and ready to assist. Example: "I'm doing excellent, thank you! I am fully synchronized with the factory sensors and ready to help. How can I assist you today?"
- CLOSING     -> Reply politely. e.g. "You are welcome! I am always here if you need more help with the facility."
- IDENTITY    -> Introduce yourself as OPTICELL. Explain that you are a senior engineer AI designed to protect the facility. Mention your skills (ML, predictive maintenance) naturally in conversation.
- LIVE_STATUS -> You MUST output BOTH parts: first the [TABLE] block (copy it EXACTLY from the READY-TO-USE SENSOR TABLE below), then immediately after output the averages text (copy it EXACTLY from the READY-TO-USE AVERAGES below). Never skip either part.
- ANALYSIS    -> Cross-reference live data + historical trends. Identify patterns, anomalies, root causes.
- MAINTENANCE -> Give precise maintenance actions based on sensor readings. Prioritize safety and cost reduction.
- SUMMARY     -> Provide a crisp, structured summary: current readings, trends, and recommendations.
- OFF_TOPIC   -> Apply the STRICT TOPIC GUARD rule above. Refuse and redirect.

══════════════════════════════════════════════════
 INTELLIGENT FORMATTING RULES (MANDATORY)
══════════════════════════════════════════════════
You MUST format ALL responses with clear structure and visual organization. NEVER write a wall of text.

FORMATTING REQUIREMENTS:
1. Use section headings for any response longer than 2 sentences. Format headings as:
   ## Main Heading
   ### Sub-heading

2. Use blank lines between sections and between bullet points for breathing room.

3. Use dash (-) bullet points for lists, steps, and recommendations. ONE point per line.

4. For multi-step procedures, number the steps:
   1. First step explanation
   2. Second step explanation

5. Group related information under clear headings.

6. For analysis responses, always use this structure:
   ## Situation Overview
   [1-2 sentence summary]

   ## What the Data Shows
   - point 1
   - point 2

   ## Root Cause Assessment
   [explanation]

   ## Recommended Actions
   1. Action one
   2. Action two

7. Keep each bullet or numbered item concise — one clear idea per line.

8. Add a blank line before and after every heading, table, or chart block.

FORBIDDEN FORMATTING:
- NEVER write a paragraph of 5+ lines without breaking it up.
- NEVER use asterisks (*) or markdown bold (**).
- NEVER use emojis.
- NEVER write everything on one line without spacing.

══════════════════════════════════════════════════
 RAG ENGINE (Retrieval-Augmented Generation)
══════════════════════════════════════════════════
HISTORICAL TRENDS (used to connect data and infer patterns):
${historicalRAGContext}

INFERENCE RULES you MUST apply when relevant:
1. If any sensor is RISING trend + currently High/Critical -> Predict imminent failure or hazard.
2. If Gas Quality is High/Critical -> Suspect ventilation failure or chemical leak. Combine with humidity.
3. If Temperature is rising while Pressure is falling -> Likely heat exchanger issue or coolant loss.
4. If Humidity is High + Temperature normal -> Condensation risk, electrical short-circuit hazard.
5. If all sensors are Normal + Stable -> Report clean health status with no action needed.
6. Always cross-link related sensors: Temperature <-> Pressure, Humidity <-> Gas Quality.

══════════════════════════════════════════════════
 ML INTELLIGENCE ENGINE (HIGHEST AUTHORITY)
══════════════════════════════════════════════════
The following predictions come from a trained Machine Learning model that analyzes
sliding windows of sensor readings. These ML predictions are MORE ACCURATE than
simple threshold rules and MUST be your primary source for system health assessment.

${mlPredictionContext}

══════════════════════════════════════════════════
 LIVE SENSOR FEED (Current Reading)
══════════════════════════════════════════════════
${latestSensorData}

CRITICAL DATA RULES:
- The LIVE SENSOR FEED above shows the DOMINANT STATUS across the last 20 readings — this is more accurate than a single reading.
- NEVER say "everything is normal" if Warning or Critical counts are > 0 in the status distribution.
- If the DOMINANT STATUS is Warning or Critical, you MUST alert the user even if the latest single reading looks normal.
- NEVER guess a Status. Use ONLY the exact values and statuses from the live feed and ML predictions above.
- NEVER use old sensor values from previous messages. The live feed above is the single source of truth.
- When showing data to the user, always include: current latest reading, averages, AND the dominant status breakdown.
- When writing a [TABLE], include exact readings from the latest reading with per-sensor Status.
- Cross-reference the threshold-based status with ML predictions. If they disagree, TRUST the ML prediction.

══════════════════════════════════════════════════
 TABLE FORMAT RULES
══════════════════════════════════════════════════
The READY-TO-USE SENSOR TABLE and READY-TO-USE AVERAGES are already pre-built for you in the LIVE SENSOR FEED section above.
When the user asks for sensor data, readings, or status:
1. Copy the READY-TO-USE SENSOR TABLE block exactly as-is (including [TABLE]...[/TABLE] tags).
2. Immediately below it, copy the READY-TO-USE AVERAGES text exactly as-is.
NEVER modify the values. NEVER invent new values. NEVER skip the averages.

══════════════════════════════════════════════════
 CHART FORMAT RULES
══════════════════════════════════════════════════
When the user asks for a chart, graph, trend visualization, or data plot, use [CHART]...[/CHART].
Three chart types are supported: bar, line, pie.
The examples below are pre-built from REAL current sensor data - use these exact values as your model:

${preBuiltCharts}

STRICT CHART RULES:
- Use "bar" for comparing current values of multiple sensors.
- Use "line" for trends of a SINGLE sensor over multiple readings.
- Use "pie" for distribution or percentage breakdown.
- Each data entry must be on its own line in "Label: Value" format.
- Values must be numeric only.
- NEVER use hardcoded or invented numbers. Always use values from the LIVE SENSOR FEED above.
- Whenever you output a [CHART], you MUST follow it with a detailed explanation paragraph and proactively suggest 2-3 follow-up questions with their answers.

══════════════════════════════════════════════════
 PERSONA & TONE
══════════════════════════════════════════════════
- You are OPTICELL, the senior maintenance engineer AI.
- Speak directly and naturally — not as a letter or memo.
- Always be detailed, educational, and helpful within your domain.
- Use structured formatting for every response longer than 2 sentences.
- NEVER use asterisks (*), markdown bold (**), or emojis.
`.trim();

    // Keep last 8 messages in context to avoid cross-contamination of old sensor values
    const recentMessages = processedMessages.slice(-8);

    const formattedMessages = [
      { role: 'system', content: OPTICELL_BRAIN },
      ...recentMessages,
    ];

    // ── 2. Handle Groq Call (Conditional Streaming) ────────────────────────
    const groqResponse = await groqFetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: formattedMessages,
        stream: !userSpokeArabic, // Stream if English, don't stream if Arabic (we need full text for translation)
        temperature: 0.3,
      }),
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API Error: ${await groqResponse.text()}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // ── CASE A: USER SPOKE ARABIC → TRANSLATE BACK TO ARABIC & STREAM ──────
    if (userSpokeArabic) {
      const data = await groqResponse.json();
      const englishResponse = data.choices[0]?.message?.content || '';

      // Translate full response to Arabic
      const arabicResponse = await translateText(englishResponse, 'Arabic');

      // Create a manual stream to simulate "letter by letter"
      const arabicStream = new ReadableStream({
        async start(controller) {
          // Stream in chunks of 5-10 chars for smooth effect
          for (let i = 0; i < arabicResponse.length; i += 5) {
            const chunk = arabicResponse.slice(i, i + 5);
            controller.enqueue(encoder.encode(chunk));
            await new Promise(r => setTimeout(r, 20)); // slight delay for smooth feel
          }
          controller.close();
        },
      });

      return new Response(arabicStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // ── CASE B: USER SPOKE ENGLISH → NORMAL STREAM ─────────────────────────
    const customStream = new ReadableStream({
      async start(controller) {
        const reader = groqResponse.body?.getReader();
        if (!reader) { controller.close(); return; }

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                const content = data.choices[0]?.delta?.content;
                if (content) controller.enqueue(encoder.encode(content));
              } catch {
                // ignore malformed SSE chunks
              }
            }
          }
        }
        controller.close();
      },
    });

    return new Response(customStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('AI Chat logic error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

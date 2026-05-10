import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import connectToDatabase from '@/lib/mongodb';
import Reading from '@/models/Reading';

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

// ── Build RAG context from sensor history (last N readings) ────────────────
function buildRAGContext(dataArray: any[]): string {
  if (!dataArray || dataArray.length === 0) return 'No historical sensor data available.';

  // Take last 20 readings for trend analysis
  const recent = dataArray.slice(-20);
  const temps = recent.map(r => r.data?.temprature).filter(v => v != null);
  const humids = recent.map(r => r.data?.humidity).filter(v => v != null);
  const pressures = recent.map(r => r.data?.pressure).filter(v => v != null);
  const gases = recent.map(r => r.data?.gas_quality).filter(v => v != null);

  const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 'N/A';
  const min = (arr: number[]) => arr.length ? Math.min(...arr).toFixed(2) : 'N/A';
  const max = (arr: number[]) => arr.length ? Math.max(...arr).toFixed(2) : 'N/A';
  const trend = (arr: number[]) => {
    if (arr.length < 2) return 'stable';
    const diff = arr[arr.length - 1] - arr[0];
    if (Math.abs(diff) < 0.5) return 'stable';
    return diff > 0 ? 'rising' : 'falling';
  };

  const rawLog = recent.slice(-5).map(r => {
    const time = new Date(r.timestamp).toLocaleTimeString();
    return `[${time}] T:${r.data?.temprature}°C, H:${r.data?.humidity}%, P:${r.data?.pressure}hPa, G:${r.data?.gas_quality}`;
  }).join('\n');

  return `
HISTORICAL CONTEXT (Last ${recent.length} readings):
- Temperature : avg=${avg(temps)}°C | min=${min(temps)} | max=${max(temps)} | trend=${trend(temps)}
- Humidity    : avg=${avg(humids)}% | min=${min(humids)} | max=${max(humids)} | trend=${trend(humids)}
- Pressure    : avg=${avg(pressures)} hPa | min=${min(pressures)} | max=${max(pressures)} | trend=${trend(pressures)}
- Gas Quality : avg=${avg(gases)} | min=${min(gases)} | max=${max(gases)} | trend=${trend(gases)}

RECENT RAW LOGS (Use these if user asks for last N seconds/readings):
${rawLog}`;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // ── READ LIVE + HISTORICAL DATA ─────────────────────────────────────────
    let latestSensorData = 'No real-time data available.';
    let historicalRAGContext = 'No historical data available.';
    let overallStatus = 'Unknown';

    try {
      await connectToDatabase();
      const dbReadings = await Reading.find({}).sort({ timestamp: -1 }).limit(100).lean();
      
      let dataArray: any[] = [];
      if (dbReadings && dbReadings.length > 0) {
        dataArray = dbReadings.reverse();
      }

      if (dataArray.length === 0) {
        const dataPath = path.join(process.cwd(), 'public', 'data', 'opticell_clean1.json');
        if (fs.existsSync(dataPath)) {
          const fileContent = fs.readFileSync(dataPath, 'utf-8');
          dataArray = JSON.parse(fileContent);
        }
      }

      if (dataArray && dataArray.length > 0) {
          // ── Latest reading ──────────────────────────────────────────────
          const latest = dataArray[dataArray.length - 1];
          const dat = latest.data || {};
          const ts = latest.timestamp ? new Date(latest.timestamp).toLocaleString() : 'Unknown';

          const tStatus = dat.temprature != null ? getSensorStatus('temperature', dat.temprature) : 'N/A';
          const hStatus = dat.humidity != null ? getSensorStatus('humidity', dat.humidity) : 'N/A';
          const pStatus = dat.pressure != null ? getSensorStatus('pressure', dat.pressure) : 'N/A';
          const gStatus = dat.gas_quality != null ? getSensorStatus('gas_quality', dat.gas_quality) : 'N/A';

          const allStatuses = [tStatus, hStatus, pStatus, gStatus];
          overallStatus = allStatuses.includes('Critical') ? 'CRITICAL'
            : allStatuses.includes('High') ? 'WARNING'
              : 'NORMAL';

          latestSensorData = `
[Last Update: ${ts}] | Overall System: ${overallStatus}
- Temperature : ${dat.temprature ?? 'N/A'} °C  -> Status: ${tStatus}
- Humidity    : ${dat.humidity ?? 'N/A'} %   -> Status: ${hStatus}
- Pressure    : ${dat.pressure ?? 'N/A'} hPa -> Status: ${pStatus}
- Gas Quality : ${dat.gas_quality ?? 'N/A'}     -> Status: ${gStatus}`;

          // ── Historical/RAG context ──────────────────────────────────────
          historicalRAGContext = buildRAGContext(dataArray);
        }
    } catch (err) {
      console.error('Failed to read sensor data:', err);
    }

    // ── OPTICELL BRAIN (FULL INTELLIGENT SYSTEM PROMPT) ────────────────────
    const OPTICELL_BRAIN = `
You are OPTICELL, a state-of-the-art AI for Smart Maintenance and Industrial Sensor Intelligence.
Your role: monitor equipment in real-time, detect anomalies, predict failures, connect data patterns, and give actionable engineering advice.

══════════════════════════════════════════════════
 INTENT CLASSIFICATION ENGINE (Internal Logic)
══════════════════════════════════════════════════
Before answering, you MUST silently classify the user's message into one of these intents:

[INTENT: GREETING]       → "hi", "hello", "hey", etc.
[INTENT: CLOSING]        → "thanks", "thank you", "bye", "goodbye"
[INTENT: IDENTITY]       → "who are you", "what is your name"
[INTENT: LIVE_STATUS]    → "what is the current status?", "show me the sensors", "status", "sensors"
[INTENT: ANALYSIS]       → "analyze", "trend", "what's happening", "is there a problem", "why"
[INTENT: MAINTENANCE]    → "what should I do", "fix", "predict", "how to fix"
[INTENT: SUMMARY]        → "summarize", "give me a report", "summary"
[INTENT: GENERAL_CHAT]   → casual conversation, off-topic (cooking, jokes, etc.)

STRICT RESPONSE RULES PER INTENT:
- GREETING       → Reply briefly and naturally. e.g. "Hello! How can I help you with Opticell today?" - Do NOT mention sensors.
- CLOSING        → Reply politely. e.g. "You're welcome! I'm always here if you need more help with the facility."
- IDENTITY       → Introduce yourself. e.g. "I'm OPTICELL, a state-of-the-art AI for Smart Maintenance. My expertise is monitoring the facility."
- LIVE_STATUS    → Show the sensor table using [TABLE] format with exact Status values from the live feed.
- ANALYSIS       → Cross-reference live data + historical trends. Identify patterns, anomalies, root causes. Use bullets.
- MAINTENANCE    → Give precise maintenance actions based on sensor readings. Prioritize safety and cost reduction.
- SUMMARY        → Provide a crisp, structured summary of the system state: current readings, trends, and recommendations.
- GENERAL_CHAT   → Politely decline and redirect to maintenance: "My expertise is smart maintenance. How can I help you with the facility?"

══════════════════════════════════════════════════
 RAG ENGINE (Retrieval-Augmented Generation)
══════════════════════════════════════════════════
HISTORICAL TRENDS (used to connect data and infer patterns):
${historicalRAGContext}

INFERENCE RULES you MUST apply when relevant:
1. If any sensor is RISING trend + currently High/Critical → Predict imminent failure or hazard.
2. If Gas Quality is High/Critical → Suspect ventilation failure or chemical leak. Combine with humidity.
3. If Temperature is rising while Pressure is falling → Likely heat exchanger issue or coolant loss.
4. If Humidity is High + Temperature normal → Condensation risk, electrical short-circuit hazard.
5. If all sensors are Normal + Stable → Report clean health status with no action needed.
6. Always cross-link related sensors: Temperature ↔ Pressure, Humidity ↔ Gas Quality.

══════════════════════════════════════════════════
 LIVE SENSOR FEED (Current Reading)
══════════════════════════════════════════════════
${latestSensorData}

CRITICAL DATA RULES:
- NEVER show a [TABLE] or sensor data unless the user's intent is LIVE_STATUS, or they explicitly ask to see the raw data numbers. For ANALYSIS or MAINTENANCE, just provide the advice without dumping the table at the end.
- NEVER guess a Status. You MUST copy the exact Status label (Normal / High / Critical) from the live feed above.
- NEVER use old sensor values from previous messages in this conversation. The live feed above is the single source of truth.
- When writing a [TABLE], always include all 4 sensors with their exact readings and exact Status labels.

══════════════════════════════════════════════════
 TABLE FORMAT RULES
══════════════════════════════════════════════════
When a table is required, use this exact format (system auto-renders it):
[TABLE]
Sensor | Reading | Status
--- | --- | ---
Temperature | 22.7 °C | Normal
Humidity | 41.9 % | Normal
Pressure | 102 hPa | Normal
Gas Quality | 131 | Normal
[/TABLE]

══════════════════════════════════════════════════
 CHART FORMAT RULES
══════════════════════════════════════════════════
When the user asks for a chart, graph, trend visualization, or data plot, use [CHART]...[/CHART].
Three chart types are supported: bar, line, pie.

BAR CHART example (comparing sensor readings side by side):
[CHART]
type: bar
title: Current Sensor Readings
unit: 
Temperature: 22.7
Humidity: 41.9
Pressure: 102.0
Gas Quality: 131
[/CHART]

LINE CHART example (showing a trend of one sensor over time):
[CHART]
type: line
title: Temperature Trend (Last 6 Readings)
unit: °C
Reading 1: 21.5
Reading 2: 22.1
Reading 3: 23.0
Reading 4: 24.5
Reading 5: 25.2
Reading 6: 26.0
[/CHART]

PIE CHART example (showing distribution or percentage breakdown):
[CHART]
type: pie
title: Sensor Status Distribution
unit: 
Normal: 2
Warning: 1
Critical: 1
[/CHART]

STRICT CHART RULES:
- Use "bar" for comparing current values of multiple sensors.
- Use "line" for showing trends of a SINGLE sensor over multiple readings/time.
- Use "pie" for showing distribution or percentage breakdown (e.g. status counts, proportions).
- Each data entry must be on its own line in "Label: Value" format.
- Values must be numeric only (no units in the value field, use the unit: line).
- Combine [CHART] with [TABLE] and your analysis for a full status report.
- If the user says "pie chart", "pie graph", "donut", or "distribution chart", always use type: pie.
- If the user says "line chart", "linear chart", "trend", or "over time", use type: line.
- CRITICAL CHART RULE: Whenever you output a [CHART], you MUST follow it with a detailed text paragraph explaining the situation and what the chart indicates. Furthermore, you MUST proactively generate 2 to 3 related questions the user might be thinking about, and immediately provide the answers to those questions in your response.

══════════════════════════════════════════════════
 THINKING & REASONING (The "3-5 Second Pause")
══════════════════════════════════════════════════
Before you output anything, manually pause and review the user's intent. Take your time to ensure your formatting is 100% compliant. If the user asks about danger, only use dash (-) bullets, absolutely no asterisks.

══════════════════════════════════════════════════
 PERSONA & TONE
══════════════════════════════════════════════════
- Speak like a highly intelligent, proactive, and talkative senior maintenance engineer.
- DO NOT format your responses as letters, emails, or memos. Speak directly in natural chat.
- RESPONSE LENGTH: Always provide medium to above-medium length responses. If the user is confused, doesn't know what to do, or asks a brief question, you must be descriptive, explain the "why", and guide them thoroughly.
- Use bullet points (-) for multi-step reasoning or recommendations.
- STRICT RULE: NEVER use the asterisk character (*) or markdown bold (**). Always use dashes (-) for bullet points.
- DO NOT use emojis (system strips them).
- DO NOT add empty filler phrases, but DO ensure your response is extremely detailed, educational, and helpful.
`.trim();

    // Keep last 8 messages in context to avoid cross-contamination of old sensor values
    const recentMessages = messages.slice(-8);

    const formattedMessages = [
      { role: 'system', content: OPTICELL_BRAIN },
      ...recentMessages,
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: formattedMessages,
        stream: true,
        temperature: 0.3, // Lower temperature for factual accuracy
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API Error: ${await response.text()}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const customStream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
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

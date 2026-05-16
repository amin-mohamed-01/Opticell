import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import connectToSaveDatabase from '@/lib/mongodb-save';
import mongoose from 'mongoose';
import { groqFetch } from '@/lib/groq-fetch';
import { getDb } from '@/lib/postgres';

const ML_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Helper: CORS Headers ──────────────────────────────────────────────────
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
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
         1. Preserve all tags like [TABLE], [/TABLE], [CHART], and [/CHART] exactly as they are. Do NOT translate content inside [CHART] tags.
         2. Use professional, technical Arabic suitable for a senior engineer.
         3. Do NOT add any introductory text.
         
         Text to translate:
         ${text}`;

    const res = await groqFetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    return data.choices[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
}

// ── Fetch ML Predictions ───────────────────────────────────────────────────
async function fetchMLPredictions(dataArray: any[]): Promise<string> {
  try {
    if (!dataArray || dataArray.length < 15) return 'ML predictions unavailable (insufficient data).';
    const history = dataArray.map((r: any) => ({
      temprature: r.data?.temprature ?? r.data?.temperature ?? 0,
      humidity: r.data?.humidity ?? 0,
      pressure: r.data?.pressure ?? 102,
      gas_quality: r.data?.gas_quality ?? r.data?.gasQuality ?? 0,
    }));
    const res = await fetch(`${ML_API_URL}/predict-sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, num_predictions: 20 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return 'ML predictions unavailable.';
    const data = await res.json();
    const { summary } = data;
    return `
ML STATUS: ${summary.latest_label?.toUpperCase()}
- System Trend: ${summary.trend?.toUpperCase()}
- RUL (Remaining Useful Life): ${summary.latest_rul?.toFixed(1)} cycles.
- Patterns: Normal=${summary.normal_count} | Warning=${summary.warning_count} | Critical=${summary.critical_count}.`;
  } catch { return 'ML predictions temporarily unavailable.'; }
}

// ── Fetch Maintenance Reports (PostgreSQL) ──────────────────────────────────
async function fetchMaintenanceReports(): Promise<string> {
  try {
    const pool = getDb();
    const result = await pool.query(`
      SELECT mr.id, mr.status, mr.priority, mr.human_review, mr.created_at
      FROM maintenance_report mr
      ORDER BY mr.created_at DESC
      LIMIT 5
    `);
    if (result.rows.length === 0) return 'No human maintenance reports recorded.';
    return result.rows.map(r =>
      `Report #${r.id} [${r.status.toUpperCase()} | ${r.priority.toUpperCase()}]: ${r.human_review} (${new Date(r.created_at).toLocaleDateString()})`
    ).join('\n');
  } catch (err) {
    console.error('Postgres Fetch Error:', err);
    return 'Could not retrieve maintenance reports from database.';
  }
}

// ── Format sensor table ─────────────────────────────────────────────────────
function formatSensorTable(temp: number, hum: number, press: number, gas: number): string {
  const tS = temp > 45 ? 'Critical' : temp > 38 ? 'Warning' : 'Normal';
  const hS = hum > 85 ? 'Critical' : hum > 75 ? 'Warning' : 'Normal';
  const pS = press < 98 || press > 106 ? 'Critical' : press < 100 || press > 104 ? 'Warning' : 'Normal';
  const gS = gas > 500 ? 'Critical' : gas > 200 ? 'Warning' : 'Normal';
  return `[TABLE]\nSensor | Reading | Status\n--- | --- | ---\nTemperature | ${temp}C | ${tS}\nHumidity | ${hum}% | ${hS}\nPressure | ${press}hPa | ${pS}\nGas Quality | ${gas} | ${gS}\n[/TABLE]`;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function POST(req: Request) {
  try {
    const { message, messages } = await req.json();
    const history = messages || [{ role: 'user', content: message }];
    const lastUserMessage = history[history.length - 1]?.content || '';
    const userSpokeArabic = isArabic(lastUserMessage);

    // 1. Translate if Arabic
    if (userSpokeArabic) {
      const translated = await translateText(lastUserMessage, 'English');
      history[history.length - 1].content = translated;
    }

    // 2. Fetch Context (Mongo + Postgres + ML)
    let sensorData = 'No sensor data.';
    let mlContext = 'ML context unavailable.';
    let table = '';

    try {
      const connection = await connectToSaveDatabase();
      const UploadSchema = new mongoose.Schema({}, { strict: false, collection: 'uploads', versionKey: false });
      const UploadModel = connection.models.Upload || connection.model('Upload', UploadSchema);
      
      const dbReadings = await UploadModel.find({}).sort({ _uploadedAt: -1 }).limit(20).lean();

      if (dbReadings.length > 0) {
        const latest = dbReadings[0] as any;
        const d = latest.data || {};
        sensorData = `Latest Sensors: Temp=${d.temprature ?? d.temperature ?? 0}C, Hum=${d.humidity ?? 0}%, Press=${d.pressure ?? 102}hPa, Gas=${d.gas_quality ?? 0}.`;
        table = formatSensorTable(d.temprature ?? d.temperature ?? 0, d.humidity ?? 0, d.pressure ?? 102, d.gas_quality ?? 0);
        mlContext = await fetchMLPredictions([...dbReadings].reverse());
      }
    } catch (err) {
      console.error('External Chat Mongo Error:', err);
    }

    const reportsContext = await fetchMaintenanceReports();

    // 3. Build Prompt
    const systemPrompt = `You are OPTICELL, a senior Industrial Maintenance AI.
Current Sensor Status: ${sensorData}
ML Prediction Context: ${mlContext}
Recent Human Reports: ${reportsContext}

STRICT PERSONA RULES:
- Provide professional, technical guidance.
- If asked for status, always output this table: ${table}
- Refuse non-industrial questions. Redirect to maintenance.
- Never use emojis. Use structured markdown.`;

    // 4. Call Groq
    const groqResponse = await groqFetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-8)],
        stream: !userSpokeArabic,
        temperature: 0.3,
      }),
    });

    if (!groqResponse.ok) throw new Error(`Groq API Error: ${await groqResponse.text()}`);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Case A: Arabic Response (Translate then stream)
    if (userSpokeArabic) {
      const data = await groqResponse.json();
      const engResp = data.choices[0]?.message?.content || '';
      const araResp = await translateText(engResp, 'Arabic');

      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < araResp.length; i += 5) {
            controller.enqueue(encoder.encode(araResp.slice(i, i + 5)));
            await new Promise(r => setTimeout(r, 20));
          }
          controller.close();
        },
      });
      return new Response(stream, { headers: { ...getCorsHeaders(), 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // Case B: English Response (Direct stream)
    const stream = new ReadableStream({
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
            if (line.trim().startsWith('data: ') && line.trim() !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.trim().slice(6));
                const content = data.choices[0]?.delta?.content;
                if (content) controller.enqueue(encoder.encode(content));
              } catch { }
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, { headers: { ...getCorsHeaders(), 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}



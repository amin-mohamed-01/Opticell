import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import connectToDatabase from '@/lib/mongodb';
import Reading from '@/models/Reading';

const ML_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Helper: CORS Headers ──────────────────────────────────────────────────
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── Sensor thresholds ──────────────────────────────────────────────────────
function getSensorStatus(key: string, value: number): string {
  if (key === 'temperature') return value > 45 ? 'Critical' : value > 38 ? 'High' : 'Normal';
  if (key === 'humidity') return value > 85 ? 'Critical' : value > 75 ? 'High' : 'Normal';
  if (key === 'pressure') return value < 98 || value > 106 ? 'Critical' : value < 100 || value > 104 ? 'High' : 'Normal';
  if (key === 'gas_quality') return value > 500 ? 'Critical' : value > 200 ? 'High' : 'Normal';
  return 'Unknown';
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
    });
    if (!res.ok) return 'ML predictions unavailable.';
    const data = await res.json();
    return `ML Status: ${data.summary.latest_label?.toUpperCase()} | RUL: ${data.summary.latest_rul?.toFixed(1)} cycles.`;
  } catch { return 'ML predictions temporarily unavailable.'; }
}

// ── Build Context ──────────────────────────────────────────────────────────
async function getOpticellContext() {
  let sensorData = 'No data available.';
  try {
    await connectToDatabase();
    const dbReadings = await Reading.find({}).sort({ timestamp: -1 }).limit(20).lean();
    if (dbReadings && dbReadings.length > 0) {
      const latest = dbReadings[0] as any;
      const d = latest.data || {};
      sensorData = `Current Sensors: Temp=${d.temprature ?? 0}C, Hum=${d.humidity ?? 0}%, Press=${d.pressure ?? 102}hPa, Gas=${d.gas_quality ?? 0}.`;
    }
  } catch (err) { console.error('Context build failed:', err); }
  return sensorData;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function POST(req: Request) {
  try {
    const { message, messages } = await req.json();
    
    // Prepare conversation history
    const history = messages || [{ role: 'user', content: message }];
    if (!history[history.length - 1].content) {
        return NextResponse.json({ error: 'Missing message content' }, { status: 400, headers: getCorsHeaders() });
    }

    // 1. Get Live Data
    const context = await getOpticellContext();

    // 2. Define Persona
    const systemPrompt = `You are OPTICELL, an expert Industrial Maintenance AI. 
Current Facility Status: ${context}
Provide professional, detailed guidance on sensor monitoring and equipment maintenance. 
If asked off-topic questions, politely redirect to industrial maintenance.`;

    // 3. Call Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API Error: ${errText}`);
    }

    const data = await response.json();
    const answer = data.choices[0]?.message?.content;

    return NextResponse.json({
      success: true,
      answer,
      timestamp: new Date().toISOString(),
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('External Chat Error:', error);
    return NextResponse.json({ 
      error: 'Failed to process chat', 
      details: error.message 
    }, { status: 500, headers: getCorsHeaders() });
  }
}

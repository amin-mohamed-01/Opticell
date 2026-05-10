import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { runMultiAgentPipeline } from "@/lib/langgraph/multiAgentGraph";
import type { ChatMessage, SSEEvent } from "@/lib/langgraph/types";
import connectToDatabase from "@/lib/mongodb";
import Reading from "@/models/Reading";


const REQUEST_TIMEOUT_MS = 120_000;

function getSensorStatus(key: string, value: number): string {
  if (key === "temperature") return value > 45 ? "Critical" : value > 38 ? "High" : "Normal";
  if (key === "humidity") return value > 85 ? "Critical" : value > 75 ? "High" : "Normal";
  if (key === "pressure") return value < 98 || value > 106 ? "Critical" : value < 100 || value > 104 ? "High" : "Normal";
  if (key === "gas_quality") return value > 500 ? "Critical" : value > 200 ? "High" : "Normal";
  return "Unknown";
}

async function buildSensorContext(): Promise<string> {
  let dataArray: any[] = [];
  try {
    await connectToDatabase();
    const readings = await Reading.find({}).sort({ timestamp: -1 }).limit(100).lean();
    if (readings && readings.length > 0) {
      // Reverse to get chronological order (oldest first, latest at the end)
      dataArray = readings.reverse();
    }
  } catch (err) {
    console.error("MongoDB fetch failed, falling back to JSON:", err);
  }

  if (dataArray.length === 0) {
    try {
      const dataPath = path.join(process.cwd(), "public", "data", "opticell_clean1.json");
      if (!fs.existsSync(dataPath)) return "No sensor data available.";
      dataArray = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
      if (!dataArray || dataArray.length === 0) return "No sensor data available.";
    } catch (err) {
      console.error("Failed to read sensor data:", err);
      return "Sensor data temporarily unavailable.";
    }
  }

  try {
    const latest = dataArray[dataArray.length - 1];
    const d = latest.data || {};
    const ts = latest.timestamp ? new Date(latest.timestamp).toLocaleString() : "Unknown";
    const tS = d.temprature != null ? getSensorStatus("temperature", d.temprature) : "N/A";
    const hS = d.humidity != null ? getSensorStatus("humidity", d.humidity) : "N/A";
    const pS = d.pressure != null ? getSensorStatus("pressure", d.pressure) : "N/A";
    const gS = d.gas_quality != null ? getSensorStatus("gas_quality", d.gas_quality) : "N/A";
    const allS = [tS, hS, pS, gS];
    const overall = allS.includes("Critical") ? "CRITICAL" : allS.includes("High") ? "WARNING" : "NORMAL";
    const recent = dataArray.slice(-20);
    const avg = (arr: number[]) => arr.length ? (arr.reduce((a: number, b: number) => a + b, 0) / arr.length).toFixed(2) : "N/A";
    const trend = (arr: number[]) => { if (arr.length < 2) return "stable"; const diff = arr[arr.length - 1] - arr[0]; return Math.abs(diff) < 0.5 ? "stable" : diff > 0 ? "rising" : "falling"; };
    const temps = recent.map((r: any) => r.data?.temprature).filter((v: any) => v != null);
    const humids = recent.map((r: any) => r.data?.humidity).filter((v: any) => v != null);
    const pressures = recent.map((r: any) => r.data?.pressure).filter((v: any) => v != null);
    const gases = recent.map((r: any) => r.data?.gas_quality).filter((v: any) => v != null);
    return `OPTICELL FACILITY - LIVE SENSOR DATA\nLast Update: ${ts} | Overall: ${overall}\nCurrent: Temp=${d.temprature ?? "N/A"}C(${tS}), Humidity=${d.humidity ?? "N/A"}%(${hS}), Pressure=${d.pressure ?? "N/A"}hPa(${pS}), Gas=${d.gas_quality ?? "N/A"}(${gS})\nTrends: Temp avg=${avg(temps)} ${trend(temps)}, Humidity avg=${avg(humids)} ${trend(humids)}, Pressure avg=${avg(pressures)} ${trend(pressures)}, Gas avg=${avg(gases)} ${trend(gases)}\nTABLE_DATA:\nTemperature|${d.temprature ?? "N/A"} C|${tS}\nHumidity|${d.humidity ?? "N/A"} %|${hS}\nPressure|${d.pressure ?? "N/A"} hPa|${pS}\nGas Quality|${d.gas_quality ?? "N/A"}|${gS}`;
  } catch (err) {
    console.error("Failed to parse sensor context:", err);
    return "Sensor data temporarily unavailable.";
  }
}

function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  let body: { messages: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Missing messages array." }, { status: 400 });
  }
  const sanitizedMessages: ChatMessage[] = body.messages
    .filter((m) => m && typeof m.content === "string" && m.content.trim() !== "" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  if (sanitizedMessages.length === 0) return NextResponse.json({ error: "No valid messages." }, { status: 400 });
  const sensorContext = await buildSensorContext();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => { try { controller.enqueue(encoder.encode(encodeSSE(event))); } catch {} };
      const timeoutId = setTimeout(() => { send({ type: "error", message: "Request timed out.", timestamp: Date.now() }); controller.close(); }, REQUEST_TIMEOUT_MS);
      try {
        const pipeline = runMultiAgentPipeline(sanitizedMessages, sensorContext);
        for await (const event of pipeline) {
          if (event.type === "agent_start") send({ type: "agent_start", agent: event.agent, message: event.message, timestamp: Date.now() });
          else if (event.type === "token") send({ type: "token", agent: event.agent, content: event.content });
          else if (event.type === "agent_end") send({ type: "agent_end", agent: event.agent, message: `${event.agent} completed.`, timestamp: Date.now() });
          else if (event.type === "final_answer") send({ type: "final_answer", content: event.content, agentTrace: event.agentTrace, timestamp: Date.now() });
          else if (event.type === "error") send({ type: "error", message: event.message, timestamp: Date.now() });
        }
        clearTimeout(timeoutId);
        controller.close();
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[MultiAgent API] Fatal error:", message);
        send({ type: "error", message, timestamp: Date.now() });
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "opticell-multi-agent", model: "llama-3.1-8b-instant", agents: ["Supervisor", "Analyst", "Critic", "Synthesizer"], timestamp: new Date().toISOString() });
}

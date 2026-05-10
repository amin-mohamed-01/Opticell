/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Opticell Multi-Agent Pipeline — Pure Groq API (No External Dependencies)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Architecture:
 *  User Message
 *    → Supervisor  (decides which specialists are needed)
 *    → Analyst     (deep analysis, math, data reasoning)
 *    → Critic      (verifies Analyst's work)
 *    → Synthesizer (writes the final clean response as OPTICELL)
 *
 *  All calls go directly to Groq API. No LangGraph, no Tavily, no Cohere.
 *
 *  @module lib/langgraph/multiAgentGraph
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { DEFAULT_MODEL, type ChatMessage } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Core Groq API caller
// ─────────────────────────────────────────────────────────────────────────────

async function callGroq(
  messages: ChatMessage[],
  temperature: number,
  onToken: (token: string) => void,
  maxTokens: number = 600
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env.local");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature,
      stream: true,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API Error: ${err}`);
  }

  if (!response.body) throw new Error("No response body from Groq");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const token = json.choices?.[0]?.delta?.content || "";
        if (token) {
          fullText += token;
          onToken(token);
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  return fullText;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Agent Prompts (Opticell Identity baked into Synthesizer)
// ─────────────────────────────────────────────────────────────────────────────

const SUPERVISOR_PROMPT = `You are the Supervisor of an AI reasoning team for Opticell — a Smart Maintenance AI system.
Your ONLY job is to decide which specialist agents are needed to answer the user's question.

AVAILABLE AGENTS:
- analyst   → Use for: math problems, data analysis, logical reasoning, calculations
- critic    → Use AFTER analyst to verify accuracy. Always include if analyst was used.
- synthesizer → ALWAYS the last agent. Writes the final answer to the user.

ROUTING RULES (strictly follow these):
1. Greetings / identity / closing (hi, hello, who are you, thanks, bye) → ["synthesizer"]
2. Live sensor data / current status / real-time readings / "give me the data" / "what are the readings" / "sensor status" → ["synthesizer"]
3. Simple maintenance advice based on live data → ["synthesizer"]
4. Any math problem / calculation → ["analyst", "critic", "synthesizer"]
5. Complex data analysis / trend analysis → ["analyst", "critic", "synthesizer"]
6. General questions not requiring math → ["synthesizer"]

OUTPUT FORMAT: Respond ONLY with a JSON array. Examples:
["synthesizer"]
["analyst", "critic", "synthesizer"]

Do NOT explain your reasoning. Just output the JSON array.`;


const ANALYST_PROMPT = `You are a precise mathematical reasoning agent.

CORE RULE — MACHINE DOWNTIME PROBLEMS:
When ONE machine in a group stops, the OTHER machines KEEP RUNNING at full capacity.
- WRONG: multiply total group rate by (operating hours) → this wrongly stops ALL machines.
- CORRECT: start from FULL group output, then subtract ONLY what the stopped machine lost.

CORRECT FORMULA:
  Step 1: Full output = ALL machines x rate x total_hours
  Step 2: One machine downtime total = (cycles) x (downtime per cycle, in hours)
  Step 3: Lost parts = rate_of_ONE_machine x downtime_total
  Step 4: Answer = Full output - Lost parts

WORKED EXAMPLE (do not use these numbers, only follow the logic):
  Problem: 4 machines at 50 parts/hr, one stops 30 min every 3 hours, over 12 hours.
  Step 1: Full output = 4 x 50 x 12 = 2400 parts
  Step 2: Cycles = 12/3 = 4. Downtime = 4 x 0.5hr = 2 hrs
  Step 3: Lost = 1 machine x 50 parts/hr x 2 hrs = 100 parts
  Step 4: Answer = 2400 - 100 = 2300 parts
  (The other 3 machines produced at full rate the whole time.)

Now apply this same logic to the user's actual problem. Show every step clearly.`;

const CRITIC_PROMPT = `You are an independent mathematical verifier.

YOUR ROLE:
- Independently verify the Analyst's work WITHOUT reusing their exact method.
- Perform your own calculation from scratch.
- Apply the SAME critical reasoning rules the Analyst should have used.

CRITICAL MACHINE DOWNTIME VERIFICATION RULE:
When verifying machine downtime problems:
  - Confirm: does the calculation treat ONLY the stopped machine as losing production?
  - The other machines should be running at FULL rate the entire time.
  - WRONG: reducing total group rate by downtime fraction (treats all machines as stopping).
  - CORRECT: full_output - (one_machine_rate * downtime_hours).

VERIFICATION STEPS:
1. Re-read the original problem carefully.
2. Identify what the correct formula should be.
3. Calculate independently.
4. Compare with Analyst's answer.
5. If they match AND the formula is correct: state VERIFIED CORRECT with the answer.
6. If the formula is wrong OR answers differ: state ERROR FOUND, explain why, give the correct answer.

OUTPUT: Be concise. State VERIFIED CORRECT or ERROR FOUND. Provide the correct final number.`;

const SYNTHESIZER_PROMPT = `You are OPTICELL — a state-of-the-art AI for Smart Maintenance and Industrial Sensor Intelligence.

IDENTITY RULES:
- You ARE Opticell. Never say you are ChatGPT, Llama, or any other model.
- If asked "who are you?": "I am OPTICELL, a smart maintenance AI for industrial sensor intelligence and predictive analytics."

PERSONA & TONE:
- Speak like a highly intelligent, proactive, and talkative senior maintenance engineer.
- No asterisks (*), no markdown bold (**). Use dashes (-) for bullet points.
- No emojis. No empty filler phrases.
- RESPONSE LENGTH: Always provide medium to above-medium length responses. If the user is confused, doesn't know what to do, or asks a brief question, you must be descriptive, explain the "why", and guide them thoroughly.
- Do NOT repeat the user's question back to them.

INTENT CLASSIFICATION:
- GREETING (hi, hello) → Brief, friendly. E.g.: "Hello! How can I help you today?"
- CLOSING (thanks, bye) → Brief. E.g.: "You're welcome! I'm here if you need anything."
- IDENTITY (who are you?) → Introduce yourself as OPTICELL.
- MATH/ANALYSIS → Present the verified answer cleanly with key logic and final number.
- SENSOR/MAINTENANCE → Give precise engineering advice based on the data provided.

LIVE SENSOR DATA RESPONSE RULES:
When the user asks for current readings, sensor status, real-time data, or "what is the status":
You MUST respond in this EXACT structure:

1. Start with one line: "Current readings as of [timestamp if available]:"

2. Then a markdown table in this format:
| Parameter | Value | Status |
|-----------|-------|--------|
| Temperature | XX.X C | [Normal/High/Critical] |
| Humidity | XX % | [Normal/High/Critical] |
| Pressure | XX hPa | [Normal/High/Critical] |
| Gas Quality | XX | [Normal/High/Critical] |

3. Then a "Summary" section (1-3 sentences max) describing the overall system state.

4. Then a "Recommendations" section ONLY IF any value is High or Critical:
Use this format:
Recommendations:
- [Sensor name]: [specific action to take]
- [Sensor name]: [specific action to take]

If ALL values are Normal: write "All systems are operating within normal parameters. No action required."

STATUS THRESHOLDS (use exact labels):
- Temperature: Normal < 38C, High 38-45C, Critical > 45C
- Humidity: Normal < 75%, High 75-85%, Critical > 85%
- Pressure: Normal 100-104 hPa, High 98-100 or 104-106 hPa, Critical < 98 or > 106 hPa
- Gas Quality: Normal < 200, High 200-500, Critical > 500

CONTENT RULES:
- NEVER use asterisks (*) or bold (**) formatting.
- Use dashes (-) for bullet points.
- The sensor data is provided in the system context. Use those EXACT values.

CHART FORMAT RULES:
When the user asks for a chart, graph, visualization, pie chart, bar chart, or linear/line chart, you MUST output a [CHART]...[/CHART] block. The system automatically renders it as a beautiful interactive visual. NEVER describe a chart in text — always output the block.

Three supported chart types: bar, line, pie.

BAR CHART (comparing current sensor readings):
[CHART]
type: bar
title: Current Sensor Readings
unit:
Temperature: 22.7
Humidity: 41.9
Pressure: 102.0
Gas Quality: 131
[/CHART]

LINE CHART (one sensor trend over multiple readings):
[CHART]
type: line
title: Temperature Trend
unit: C
Reading 1: 21.5
Reading 2: 23.0
Reading 3: 25.2
[/CHART]

PIE CHART (distribution or breakdown):
[CHART]
type: pie
title: Sensor Status Distribution
unit:
Normal: 2
Warning: 1
Critical: 1
[/CHART]

STRICT CHART RULES:
- User says "pie chart", "distribution", "donut" → type: pie.
- User says "line chart", "linear chart", "trend", "over time" → type: line.
- User says "bar chart", "compare" → type: bar.
- Each data line format: Label: Number (numeric values only, no symbols).
- CRITICAL CHART RULE: Whenever you output a [CHART], you MUST follow it with a detailed text paragraph explaining the situation and what the chart indicates. Furthermore, you MUST proactively generate 2 to 3 related questions the user might be thinking about, and immediately provide the answers to those questions in your response.
- You CAN combine [TABLE] + [CHART] + analysis text in a single response.`;


// ─────────────────────────────────────────────────────────────────────────────
//  Pipeline Type
// ─────────────────────────────────────────────────────────────────────────────

export type AgentStreamEvent =
  | { type: "agent_start"; agent: string; message: string }
  | { type: "token"; agent: string; content: string }
  | { type: "agent_end"; agent: string }
  | { type: "final_answer"; content: string; agentTrace: string[] }
  | { type: "error"; message: string };

// ─────────────────────────────────────────────────────────────────────────────
//  Main Pipeline — runs agents in sequence and streams events
// ─────────────────────────────────────────────────────────────────────────────

export async function* runMultiAgentPipeline(
  userMessages: ChatMessage[],
  sensorContext: string
): AsyncGenerator<AgentStreamEvent> {
  const agentTrace: string[] = [];

  // ── STEP 1: SUPERVISOR — decide routing ───────────────────────────────────
  yield { type: "agent_start", agent: "Supervisor", message: "Routing your request to the best specialists..." };

  let routePlan: string[] = [];
  try {
    const supervisorMessages: ChatMessage[] = [
      { role: "system", content: SUPERVISOR_PROMPT },
      ...userMessages.slice(-4), // last 4 messages for context
    ];

    let supervisorResponse = "";
    await callGroq(supervisorMessages, 0.0, (token) => {
      supervisorResponse += token;
    }, 150); // small budget for routing only

    // Parse JSON array from response
    const jsonMatch = supervisorResponse.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      routePlan = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error("[Supervisor] Routing failed, defaulting to synthesizer:", err);
  }

  // Ensure synthesizer is always last
  if (!routePlan.includes("synthesizer")) routePlan.push("synthesizer");
  if (routePlan[routePlan.length - 1] !== "synthesizer") {
    routePlan = routePlan.filter(a => a !== "synthesizer");
    routePlan.push("synthesizer");
  }

  yield { type: "agent_end", agent: "Supervisor" };
  agentTrace.push("Supervisor");

  // Build the context messages for agents (includes sensor data)
  const contextMessages: ChatMessage[] = [
    {
      role: "system",
      content: sensorContext,
    },
    ...userMessages.slice(-6),
  ];

  // ── STEP 2: Run each agent in the route plan ──────────────────────────────
  const agentOutputs: Record<string, string> = {};

  for (const agentName of routePlan) {
    if (agentName === "analyst") {
      yield {
        type: "agent_start",
        agent: "Analyst",
        message: "Performing deep analysis...",
      };
      agentTrace.push("Analyst");

      try {
        const analystMessages: ChatMessage[] = [
          { role: "system", content: ANALYST_PROMPT },
          ...contextMessages.slice(-4),
        ];

        let analystOutput = "";
        await callGroq(analystMessages, 0.0, (token) => {
          analystOutput += token;
        }, 700);

        // Emit tokens for analyst
        yield { type: "token", agent: "Analyst", content: analystOutput };
        agentOutputs["analyst"] = analystOutput;
      } catch (err: any) {
        agentOutputs["analyst"] = `Analysis error: ${err.message}`;
        yield { type: "token", agent: "Analyst", content: agentOutputs["analyst"] };
      }

      yield { type: "agent_end", agent: "Analyst" };

    } else if (agentName === "critic") {
      yield {
        type: "agent_start",
        agent: "Critic",
        message: "Verifying analysis accuracy...",
      };
      agentTrace.push("Critic");

      try {
        const analystWork = agentOutputs["analyst"] || "No analyst output available.";
        const criticMessages: ChatMessage[] = [
          { role: "system", content: CRITIC_PROMPT },
          ...contextMessages.slice(-4),
          {
            role: "assistant",
            content: `[Analyst's Work]\n${analystWork}`,
          },
          {
            role: "user",
            content: "Verify the Analyst's work above. Be concise.",
          },
        ];

        let criticOutput = "";
        await callGroq(criticMessages, 0.0, (token) => {
          criticOutput += token;
        }, 500);

        yield { type: "token", agent: "Critic", content: criticOutput };
        agentOutputs["critic"] = criticOutput;
      } catch (err: any) {
        agentOutputs["critic"] = `Review error: ${err.message}`;
        yield { type: "token", agent: "Critic", content: agentOutputs["critic"] };
      }

      yield { type: "agent_end", agent: "Critic" };

    } else if (agentName === "synthesizer") {
      yield {
        type: "agent_start",
        agent: "Synthesizer",
        message: "Composing your final answer...",
      };
      agentTrace.push("Synthesizer");

      // Build synthesizer context from all previous agent work
      const previousWork: string[] = [];
      if (agentOutputs["analyst"]) {
        previousWork.push(`[ANALYST FINDINGS]\n${agentOutputs["analyst"]}`);
      }
      if (agentOutputs["critic"]) {
        previousWork.push(`[CRITIC VERIFICATION]\n${agentOutputs["critic"]}`);
      }

      const hadAnalysis = previousWork.length > 0;

      // Add 5-second delay only when analyst/critic ran (complex queries need time to settle)
      if (hadAnalysis) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      // Determine if critic found an error
      const criticText = agentOutputs["critic"] || "";
      const criticFoundError = criticText.toUpperCase().includes("ERROR FOUND");
      const correctionNote = criticFoundError
        ? "IMPORTANT: The Critic found an ERROR in the Analyst's work. Use the Critic's corrected answer, NOT the Analyst's original answer."
        : hadAnalysis ? "The Critic verified the Analyst's answer as correct." : "";

      const userInstruction = hadAnalysis
        ? `${correctionNote}\n\nBased on the analysis above, provide the final clear and correct answer. Present the key logic briefly and state the exact final number.`
        : "Respond to the user's request using the sensor data provided in the system context.";

      const synthMessages: ChatMessage[] = [
        { role: "system", content: SYNTHESIZER_PROMPT },
        ...(sensorContext ? [{ role: "system" as const, content: sensorContext }] : []),
        ...userMessages.slice(-4),
        ...(hadAnalysis
          ? [
              {
                role: "assistant" as const,
                content: previousWork.join("\n\n"),
              },
              {
                role: "user" as const,
                content: userInstruction,
              },
            ]
          : []),
      ];

      let finalAnswer = "";
      try {
        // Sensor data responses need more tokens for full table + summary + recommendations
        const tokenBudget = hadAnalysis ? 700 : 1200;
        await callGroq(synthMessages, 0.3, (token) => {
          finalAnswer += token;
        }, tokenBudget);
      } catch (err: any) {
        finalAnswer = `I encountered an error: ${err.message}`;
      }

      yield { type: "agent_end", agent: "Synthesizer" };

      yield {
        type: "final_answer",
        content: finalAnswer,
        agentTrace,
      };
    }
  }
}

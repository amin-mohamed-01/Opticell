/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Opticell Multi-Agent System — Type Definitions
 * ═══════════════════════════════════════════════════════════════════════════════
 *  @module lib/langgraph/types
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Agent Names
// ─────────────────────────────────────────────────────────────────────────────

export type AgentName = "supervisor" | "analyst" | "critic" | "synthesizer";

// ─────────────────────────────────────────────────────────────────────────────
//  Message Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SSE Event Types (streamed to the frontend)
// ─────────────────────────────────────────────────────────────────────────────

export interface SSEAgentStartEvent {
  type: "agent_start";
  agent: string;
  message: string;
  timestamp: number;
}

export interface SSETokenEvent {
  type: "token";
  agent: string;
  content: string;
}

export interface SSEAgentEndEvent {
  type: "agent_end";
  agent: string;
  message: string;
  timestamp: number;
}

export interface SSEFinalAnswerEvent {
  type: "final_answer";
  content: string;
  agentTrace: string[];
  timestamp: number;
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
  agent?: string;
  timestamp: number;
}

export type SSEEvent =
  | SSEAgentStartEvent
  | SSETokenEvent
  | SSEAgentEndEvent
  | SSEFinalAnswerEvent
  | SSEErrorEvent;

// ─────────────────────────────────────────────────────────────────────────────
//  Configuration Constants
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_MODEL = "llama-3.1-8b-instant";

export const AGENT_LABELS: Record<AgentName, string> = {
  supervisor: "Supervisor",
  analyst: "Analyst",
  critic: "Critic",
  synthesizer: "Synthesizer",
};

export const AGENT_START_MESSAGES: Record<AgentName, string> = {
  supervisor: "Routing your request to the best specialists...",
  analyst: "Performing deep analysis...",
  critic: "Reviewing analysis for accuracy...",
  synthesizer: "Composing your final answer...",
};

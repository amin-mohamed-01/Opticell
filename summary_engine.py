import re
import requests
import json

CHUNK_SIZE = 12000

SUMMARY_KEYWORDS = [
    "summarize", "summary", "summarise", "give me a summary",
    "summarize this chat", "summarize the conversation",
    "summary of this chat", "summary of conversation",
    "recap", "recap this", "recap the chat",
    "overview", "conversation overview",
    "brief summary", "short summary",
    "condense", "condense this chat",
    "wrap up", "wrap up the conversation", "chat summary"
]


def is_summary_request(text: str) -> bool:
    if not text:
        return False
    text = text.lower()
    return any(keyword in text for keyword in SUMMARY_KEYWORDS)


# ─────────────────────────────────────────────────────────────────────────────
# SHARED METRIC ENGINE
# Used by BOTH summary_engine.py and ai_server.py for consistent extraction.
# ─────────────────────────────────────────────────────────────────────────────

METRIC_PATTERNS = {
    "PSI": [
        r'psi\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)',   # "psi is 88" / "psi: 88"
        r'(\d+(?:\.\d+)?)\s*psi',                   # "88 psi"
    ],
    "Temperature": [
        r'temp(?:erature)?\s*(?:is|=|:)\s*(\d+(?:\.\d+)?)',           # "temp is 92"
        r'(\d+(?:\.\d+)?)\s*(?:degrees?|°|celsius|fahrenheit|[cf]\b)', # "92 degrees" / "92c"
    ],
    "Voltage": [
        r'voltage\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)',  # "voltage is 12"
        r'(\d+(?:\.\d+)?)\s*(?:volts?|v\b)',          # "12v" / "12 volts"
    ],
}

# For each metric: value above threshold → "High", else "Normal". None = always Normal.
METRIC_THRESHOLDS = {
    "PSI":         85,
    "Temperature": 70,
    "Voltage":     None,
}


def extract_metrics_from_text(text: str) -> dict:
    """
    Scan a text block and return the LAST seen value for each metric.
    Returns dict like: {"PSI": 88.0, "Temperature": 92.0}

    Pass ONLY raw message content — never the prompt template —
    to avoid picking up example numbers written in the prompt itself.
    """
    result = {}
    lowered = text.lower()
    for name, patterns in METRIC_PATTERNS.items():
        values = []
        for pat in patterns:
            for match in re.findall(pat, lowered):
                val = match if isinstance(match, str) else (match if match else None)
                if val:
                    try:
                        values.append(float(val))
                    except ValueError:
                        pass
        if values:
            result[name] = values[-1]  # keep last occurrence
    return result


def build_metrics_table(metrics_dict: dict) -> str:
    """
    Build a [TABLE]…[/TABLE] block from {metric_name: value}.
    Returns empty string if fewer than 2 metrics.
    """
    if len(metrics_dict) < 2:
        return ""
    lines = ["[TABLE]", "Parameter | Value | Status", "--- | --- | ---"]
    for name, val in metrics_dict.items():
        threshold = METRIC_THRESHOLDS.get(name)
        status = ("High" if val > threshold else "Normal") if threshold is not None else "Normal"
        display_val = int(val) if val == int(val) else val
        lines.append(f"{name} | {display_val} | {status}")
    lines.append("[/TABLE]")
    return "\n".join(lines)


def resolve_metrics_for_summary(history: list) -> dict:
    """
    FINAL FIXED VERSION - Only user messages + newest value always wins
    This completely stops old numbers like "12" from coming back in summaries.
    """
    metrics = {}

    # Scan ONLY user messages, from oldest to newest
    for msg in history:
        if msg.get("role") == "user":
            current = extract_metrics_from_text(msg.get("content", ""))
            for name, val in current.items():
                metrics[name] = val   # later user message always overrides

    return metrics


# ─────────────────────────────────────────────────────────────────────────────
# Summary generation
# ─────────────────────────────────────────────────────────────────────────────

def build_summary_prompt(history: list) -> str:
    conversation_text = ""
    for m in history:
        conversation_text += f"{m['role'].upper()}: {m['content']}\n"

    conversation_text = conversation_text[-CHUNK_SIZE:]

    summary_instruction = """
You are a professional AI conversation summarizer for OptiCell AI.

IMPORTANT RULES:
1. Only summarize information that exists in the conversation.
2. Do NOT invent or assume anything.
3. If the user provided updated values later in the conversation, use those latest values.
4. Be concise, factual, and professional.
5. CRITICAL FORMATTING:
   - Plain text ONLY. No #, ##, *, **, or any markdown.
   - Use - for all bullet points.
   - No section headings like "Main Topics:" or "## Summary".
   - Start directly with a short friendly overview paragraph.
   - Use 1- 2- only for step-by-step instructions.
   - End with the most recent important numbers if any.

Now create the summary for the conversation above following these rules exactly.
"""
    return conversation_text + "\n" + summary_instruction


def generate_summary(history: list, ollama_url: str, model_name: str) -> str:
    prompt = build_summary_prompt(history)

    resp = requests.post(
        ollama_url,
        json={
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2, "top_p": 0.9}
        },
        timeout=180
    )
    resp.raise_for_status()
    ai_summary = resp.json().get("response", "")

    last_user_msg = next(
        (m.get("content", "") for m in reversed(history) if m.get("role") == "user"), ""
    ).lower()

    wants_specific_tables = any(k in last_user_msg for k in ["two tables", "before and after", "tables before", "before and after"])

    # Smart table: last-user-message values override old conversation values
    metrics_dict = resolve_metrics_for_summary(history)
    table_block = build_metrics_table(metrics_dict)

    if wants_specific_tables and table_block:
        # Use clean table(s) instead of old text
        ai_summary = ai_summary.split("Extracted Technical Metrics:")[0].strip()
        ai_summary += "\n\n" + table_block
    elif table_block:
        ai_summary += "\n\nExtracted Technical Metrics:\n" + table_block

    return ai_summary
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel
import requests
import json
import re
import uuid
from typing import List, Optional
from datetime import datetime
import motor.motor_asyncio
from dotenv import load_dotenv
import os

# ── Import shared metric engine from summary_engine ──
from summary_engine import (
    is_summary_request,
    generate_summary,
    extract_metrics_from_text,   # shared — no more duplicate regex here
    build_metrics_table,         # shared — consistent table format
    METRIC_THRESHOLDS,           # shared — for status calculation
)

load_dotenv()

# ────────────────────────────────────────────────
# NEURAL LONG-TERM MEMORY ENGINE (per session)
# ────────────────────────────────────────────────
async def update_long_term_memory(conv_id: str, history: list):
    """Neural-like memory: creates one powerful summary of ALL facts and history"""
    if len(history) < 2:
        return ""

    conversation_text = "\n".join([f"{m.get('role','')}: {m.get('content','')}" for m in history[-25:]])

    memory_prompt = f"""
You are a perfect neural memory system for this conversation only.
Your job: Extract and consolidate EVERY important fact, metric, value, before/after, user name, and key events.
Be 100% accurate. Never invent anything. Use ONLY data from this conversation.

Conversation:
{conversation_text}

Output format (exactly like this):
LONG TERM MEMORY:
- User name: [extracted name or leave blank]
- Key metrics history:
  - Before: Temperature = X, PSI = Y
  - After: Temperature = Z, PSI = W
- All other facts: ...
- Important events: ...

Do not add any extra text. Never use example names.
"""

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": MODEL_NAME, "prompt": memory_prompt, "stream": False, "options": {"temperature": 0.0, "top_p": 0.9}},
            timeout=40
        )
        resp.raise_for_status()
        memory = resp.json().get("response", "").strip()

        await conversations_collection.update_one(
            {"_id": conv_id},
            {"$set": {"long_term_memory": memory, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        return memory
    except:
        return ""

# ────────────────────────────────────────────────
# App Setup
# ────────────────────────────────────────────────

app = FastAPI(title="OptiCell AI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ────────────────────────────────────────────────
# MongoDB Connection
# ────────────────────────────────────────────────

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "opticell")

mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
db = mongo_client[MONGODB_DB_NAME]
conversations_collection = db["conversations"]

# ────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma2:2b"
CHUNK_SIZE = 16000

SYSTEM_PROMPT = """
You are OptiCell AI Assistant.

Your role is to help users troubleshoot machines, understand sensor data, and answer general questions clearly and accurately.

ABSOLUTE RULES - NO EXCEPTIONS:
- You are STRICTLY FORBIDDEN from using the character * (asterisk) ANYWHERE in your response.
- You are STRICTLY FORBIDDEN from using ** anywhere.
- Never use any markdown, bold, italics, or asterisk at all.
- Use - (dash) for ALL bullet points instead.
- You are STRICTLY FORBIDDEN from using ANY emoji, emoticon, or unicode symbol.

TABLE FORMAT ENFORCEMENT (MANDATORY - APPLIES TO EVERY SINGLE TABLE YOU OUTPUT):
- ALWAYS wrap every table in [TABLE] ... [/TABLE] — no exceptions
- ALWAYS use this exact header on the first line inside [TABLE]:
  Parameter | Real Value | Status
  --- | --- | ---
- NEVER remove the | characters from any row
- NEVER join multiple rows onto the same line
- ALWAYS put each data row on its own separate new line
- NEVER output a plain text table or markdown table — only [TABLE] blocks

USER REQUEST CONTROLLER (HIGHEST PRIORITY - THIS SECTION OVERRIDES ALMOST EVERYTHING):

Analyze the LAST user message and classify its main intent:

- Contains any of: "table", "tables", "give me table", "give me tables"
  → output ONLY one or more [TABLE] blocks — no extra text at all

- Contains any of: "before and after", "two tables", "before/after", "comparison"
  → output TWO [TABLE] blocks + short descriptive text BEFORE each table
    Use this exact structure:

    Before the fix:
    [TABLE]
    Parameter | Real Value | Status
    --- | --- | ---
    Temperature | 102 | High
    PSI | 88 | High
    [/TABLE]

    After the fix (expected values):
    [TABLE]
    Parameter | Real Value | Status
    --- | --- | ---
    Temperature | <expected value> | Normal
    PSI | <expected value> | Normal
    [/TABLE]

    If showing predicted/estimated values after a fix, always label them clearly as "expected" or "typical after fix" — never present them as measured facts.

- Asks for "summary" + any table-related word
  → short neutral summary (2-5 sentences) then the appropriate [TABLE] block(s)

- Asks explicitly to "explain in table" or "comparison table" or "show differences in table"
  → output ONE explanatory [TABLE] using columns like:
     Aspect | Current Situation | Recommendation | Expected Change

- General greeting / hi / hello / what can you do / how are you / etc
  → friendly natural response in same language, no forced technical content
    You may offer 3-5 example things the user can ask about using - bullet list

- None of the above
  → follow normal troubleshooting / explanation / step-by-step rules

UNIT RULE (STRICT - NEVER BREAK):
Never add °F, °C, degrees, Fahrenheit, or any unit symbol to any number unless the user explicitly wrote the unit in his message.
User said "temp is 12" → output "Temperature 12", never "12°F".

TABLE RULES (ABSOLUTE - MUST OBEY):
If the user asks for ANY table, before/after, metrics, or status table:
YOU MUST USE ONLY THIS FORMAT. Never output plain text tables.

[TABLE]
Parameter | Real Value | Status
--- | --- | ---
Temperature | 12 | Normal
PSI | 30 | Normal
[/TABLE]

You can output MULTIPLE [TABLE] blocks (one for before, one for after) when user asks for before/after or two tables.
Status column can ONLY contain "High" or "Normal":
- PSI > 85 = High
- Temperature > 70 = High
- Everything else = Normal
Never invent "Critical", "Before Vacuuming", "After Vacuuming", etc.

RESPONSE FORMATTING RULES (MANDATORY - Follow exactly):

For causes or explanations (like PSI and Temperature):
- PSI: Readings above 88 PSI can point towards a pressure leak...
- Temperature: A temperature exceeding 58 degrees suggests...

For step-by-step instructions or fixes:
1- First step here.
2- Second step here.
3- Third step here.

Smart Decision Rules:
- Troubleshooting → Directly start with bullet points using - for each cause. Then numbered list (1- ) for fix steps. NO meta-headings.
- Concept explanation → Normal Paragraph.
- List of things → Bullet Points starting with "- ".
- Step-by-step guide → Numbered List starting with "1- ".
- Respond in the same language as the user.
- Use proper newlines and spacing.

Smart Tables Rule (IMPORTANT):
If the user mentions 2 or more metrics or asks for tables, use EXACTLY this format and nothing else.

You can output MULTIPLE [TABLE] blocks in ONE response if the user asks for 2 or more tables.
Tables can contain explanatory text, not just numbers.

Example when user says "give me 2 tables":
[TABLE]
Parameter | Real Value | Status
--- | --- | ---
Temperature | 76 | Normal
PSI | 88 | High
[/TABLE]

[TABLE]
Parameter | Average Value | Recommended
--- | --- | ---
Temperature | 65 | Normal
PSI | 75 | Normal
[/TABLE]

Example when user says "explain in table":
[TABLE]
Aspect | Explanation | Recommendation
--- | --- | ---
PSI | Readings above 85 indicate possible leak in the hose | Check hose connections immediately
Temperature | Motor running hot due to blocked filter | Clean filter every 30 days
[/TABLE]

Do not use any markdown table, **, or * for tables. Only this block.

INTELLIGENT TABLE DECISION RULE:

Even if user did NOT say "table", you MAY decide to output a [TABLE] when:
- comparing two states (before vs after, old vs new, problem vs solution)
- listing multiple related facts that are clearer in table form
- explaining cause + effect + action for 3 or more items

Allowed column combinations (choose the most suitable):
- Parameter | Real Value | Status
- Aspect | Explanation | Recommendation
- Problem | Possible Cause | Suggested Fix
- Before | After | Improvement
- Reading | Normal Range | Status

Use ONLY these formats inside [TABLE] ... [/TABLE]
Never invent new column names.

# ── CHART RULE - VERY STRICT (fixed version) ──
Chart output is ONLY allowed when the user EXPLICITLY uses words like:
"chart", "graph", "plot", "regression", "scatter", "diagram", "make a chart",
"show me visually", "linear regression", "draw the data", "show as graph".

If the user did NOT use any of these words — NEVER output any [CHART] block. Never assume. Never invent.

When the user DOES ask for a chart:
- Extract ONLY the exact numbers the user wrote in this conversation.
- Never add, calculate, or invent extra points.
- Output ONLY in this exact format, nothing else:

[CHART]
type: scatter_regression
title: Linear Regression - Your Data
x_data: 1,2,3,4,5
y_data: 3,5,3,2,7
[/CHART]

Supported types: line, bar, scatter, scatter_regression

Rules you MUST follow:
- Use ONLY the numbers the user wrote in this conversation.
- Do NOT add extra points.
- Do NOT change any number.
- If user gave multiple sets, make multiple [CHART] blocks.
- Title should be short and clear.

Conversation Style:
- Friendly and professional
- Plain text only
- Use exactly the formats above - nothing else. Never use * or **.

When the query is casual, social or exploratory (no clear technical question):
- Respond in natural friendly English (or language of user)
- You may start with greeting or small talk
- Offer a short list of common topics you can help with:
  - - Check current sensor readings
  - - Troubleshoot a specific fault code
  - - Compare before and after maintenance
  - - Create visual chart of measurements
  - - Explain how a component works
- Keep response short and inviting
"""

# ────────────────────────────────────────────────
# Knowledge Base (RAG)
# ────────────────────────────────────────────────

KNOWLEDGE_BASE = [
    {"text": "OptiCell monitors battery voltage and temperature in real time.", "keywords": ["opticell", "monitor", "battery", "voltage", "temperature", "real time"]},
    {"text": "Common fault code F12 means overheating detected.", "keywords": ["fault", "code", "f12", "overheat", "hot", "temperature", "error"]},
    {"text": "Maintenance requires voltage check every 30 days.", "keywords": ["maintenance", "voltage", "check", "days", "schedule", "routine"]},
    {"text": "Fault code F01 indicates low battery voltage below threshold.", "keywords": ["fault", "code", "f01", "low", "battery", "voltage", "threshold", "error"]},
    {"text": "Fault code F05 means communication loss between modules.", "keywords": ["fault", "code", "f05", "communication", "loss", "module", "disconnect", "error"]},
    {"text": "OptiCell supports remote diagnostics via the mobile dashboard.", "keywords": ["remote", "diagnostics", "mobile", "dashboard", "app", "phone"]},
    {"text": "Battery health report can be generated monthly from the admin panel.", "keywords": ["battery", "health", "report", "monthly", "admin", "panel", "generate"]},
    {"text": "Temperature threshold for safe operation is between 15C and 45C.", "keywords": ["temperature", "threshold", "safe", "operation", "celsius", "15", "45", "range"]},
    {"text": "Voltage below 11.5V on a 12V battery indicates it needs replacement.", "keywords": ["voltage", "11.5", "12v", "battery", "replace", "low", "dead"]},
    {"text": "PSI levels outside the recommended range can indicate a pressure leak.", "keywords": ["psi", "pressure", "leak", "range", "high", "low"]},
    {"text": "Fault code F10 indicates sensor malfunction.", "keywords": ["fault", "code", "f10", "sensor", "malfunction", "error"]},
    {"text": "Optimal battery charge is between 12.6V and 13.8V.", "keywords": ["battery", "charge", "voltage", "optimal", "range"]},
    {"text": "Regular firmware updates improve system stability.", "keywords": ["firmware", "update", "stability", "system"]},
]


def improved_rag_search(query: str, top_k: int = 3) -> str:
    query_lower = query.lower()
    query_words = set(re.findall(r'\w+', query_lower))
    scores = []
    for chunk in KNOWLEDGE_BASE:
        score = 0
        for kw in chunk["keywords"]:
            if kw in query_words:
                score += 2
            elif kw in query_lower:
                score += 1
        scores.append((score, chunk["text"]))
    scores.sort(key=lambda x: x[0], reverse=True)
    relevant = [text for score, text in scores[:top_k] if score > 0]
    return "\n".join(relevant) if relevant else ""


# ────────────────────────────────────────────────
# Memory Extraction
# Uses shared extract_metrics_from_text from summary_engine
# ────────────────────────────────────────────────

async def generate_message_summary(content: str) -> str:
    summary_prompt = (
        "Summarize the following message in 1-2 sentences, "
        "focusing on key facts, numbers, and intent: " + content
    )
    resp = requests.post(
        OLLAMA_URL,
        json={"model": MODEL_NAME, "prompt": summary_prompt, "stream": False, "options": {"temperature": 0.3}},
        timeout=30
    )
    if resp.status_code == 200:
        return resp.json().get("response", "").strip()
    return ""


async def extract_user_facts_and_summaries(history: list) -> str:
    """
    Build a facts + summaries block to inject into the main prompt.
    Metrics are extracted via the shared extract_metrics_from_text function
    from summary_engine — single source of truth, no duplicate regex.
    """
    summaries = []

    # Additional non-metric patterns kept here (fault codes, RPM, etc.)
    extra_patterns = [
        (r'\b(F\d{2,3})\b', "fault_code"),
        (r'\b(\d+(?:\.\d+)?)\s*(?:amps?|A|ampere)\b', "current"),
        (r'\b(\d+(?:\.\d+)?)\s*(?:rpm|RPM)\b', "rpm"),
        (r'\b(\d+(?:\.\d+)?)\s*(?:watts?|W|kW)\b', "power"),
        (r'\b(\d+(?:\.\d+)?)\s*(?:Hz|hertz|frequency)\b', "frequency"),
        (r'\b(\d+(?:\.\d+)?)\s*(?:liters?|L|gallons?|ml)\b', "fluid_level"),
        (r'\b(\d+(?:\.\d+)?)\s*(?:percent|%)\b', "percentage"),
        (r'\b(model|device|machine)\s*:\s*(\w+)', "device_model"),
    ]

    extra_facts = {}
    user_messages_text = ""

    for idx, msg in enumerate(history):
        role = msg.get("role", "") if isinstance(msg, dict) else msg.role
        content = msg.get("content", "") if isinstance(msg, dict) else msg.content

        if role == "user":
            user_messages_text += " " + content
            summary = await generate_message_summary(content)
            if summary:
                summaries.append(f"Message {idx + 1}: {summary}")

            for pattern, label in extra_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                if matches:
                    last = matches[-1]
                    extra_facts[label] = last[-1] if isinstance(last, tuple) else last

    label_display = {
        "PSI": "PSI", "Temperature": "Temperature", "Voltage": "Voltage",
        "fault_code": "Fault Code", "current": "Current (Amps)", "rpm": "RPM",
        "power": "Power (Watts)", "frequency": "Frequency (Hz)",
        "fluid_level": "Fluid Level", "percentage": "Percentage",
        "device_model": "Device Model",
    }

    # Use shared engine for PSI / Temperature / Voltage — correct and consistent
    metric_facts = extract_metrics_from_text(user_messages_text)

    output = []

    if metric_facts:
        output.append("Key facts the user has mentioned in this conversation:")
        for name, val in metric_facts.items():
            threshold = METRIC_THRESHOLDS.get(name)
            status = ("High" if val > threshold else "Normal") if threshold is not None else "Normal"
            display = label_display.get(name, name.title())
            val_str = str(int(val) if val == int(val) else val)
            output.append(f"  - {display}: {val_str} ({status})")

    if extra_facts:
        if not metric_facts:
            output.append("Key facts the user has mentioned in this conversation:")
        for label, value in extra_facts.items():
            display = label_display.get(label, label.title())
            output.append(f"  - {display}: {value}")

    if summaries:
        output.append("\nSummaries of user messages (for better context and memory):")
        output.extend(summaries)

    return "\n".join(output) if output else ""


# ────────────────────────────────────────────────
# Text Cleaning
# ────────────────────────────────────────────────

# ── Module-level emoji pattern — shared by streamer + clean_response ──────────
EMOJI_PATTERN = re.compile(
    "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF\U00002702-\U000027B0"
    "\U000024C2-\U0001F251\u200d\ufe0f]+",
    flags=re.UNICODE
)


def clean_response(text: str) -> str:
    text = EMOJI_PATTERN.sub('', text)
    text = re.sub(r'\*\*', '', text)
    text = re.sub(r'(?m)^\s*\*\s*', '- ', text)
    text = re.sub(r'\*', '', text)

    # Forbidden meta-headings — remove only standalone header lines, not mid-sentence usage
    forbidden = [
        r'(?im)^possible causes\s*:?\s*$',
        r'(?im)^here are some possible causes\s*:?\s*$',
        r'(?im)^potential causes\s*:?\s*$',
        r'(?im)^likely causes\s*:?\s*$',
        r'(?im)^causes for this issue\s*:?\s*$',
        r'(?im)^troubleshooting steps\s*:?\s*$',
        r'(?im)^the most likely explanation\s*:?\s*$',
        r'(?im)^based on these changes\s*:?\s*$',
    ]
    for pat in forbidden:
        text = re.sub(pat, '', text, flags=re.MULTILINE | re.IGNORECASE)

    text = re.sub(r'^\s*##.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*#.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def build_prompt(history: list, rag_context: str, user_facts_and_summaries: str, long_term_memory: str) -> str:
    prompt = SYSTEM_PROMPT + "\n\n"

    # HIGHEST POWER: Neural Long-Term Memory
    if long_term_memory:
        prompt += f"{long_term_memory}\n\n"

    if user_facts_and_summaries:
        prompt += f"{user_facts_and_summaries}\n\n"

    if rag_context:
        prompt += f"Relevant System Knowledge:\n{rag_context}\n\n"

    prompt += "Conversation History (oldest to newest):\n"
    for m in history:
        role = m.get("role", "user") if isinstance(m, dict) else m.role
        content = m.get("content", "") if isinstance(m, dict) else m.content
        prompt += f"{'User' if role == 'user' else 'Assistant'}: {content}\n"

    prompt += "\nAssistant Response:\n"
    return prompt


# ────────────────────────────────────────────────
# Pydantic Models + Endpoints
# ────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    conversation_id: Optional[str] = None
    stream: bool = True


async def save_conversation(conv_id: str, history: list):
    await conversations_collection.update_one(
        {"_id": conv_id},
        {"$set": {"messages": history[-120:], "updated_at": datetime.utcnow()}},
        upsert=True
    )


@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        conv_id = req.conversation_id or str(uuid.uuid4())
        conv_doc = await conversations_collection.find_one({"_id": conv_id})
        history = conv_doc.get("messages", []) if conv_doc else []

        last_user_content = next(
            (m.content for m in reversed(req.messages) if m.role.lower() == "user"), None
        )

        if last_user_content:
            if not history or not (
                history[-1].get("role") == "user" and
                history[-1].get("content") == last_user_content
            ):
                history.append({"role": "user", "content": last_user_content})

        # ── Update Neural Long-Term Memory (every 3 messages) ──
        if len(history) % 3 == 0 or len(history) == 2:
            long_term_memory = await update_long_term_memory(conv_id, history)
        else:
            doc = await conversations_collection.find_one({"_id": conv_id})
            long_term_memory = doc.get("long_term_memory", "") if doc else ""

        if is_summary_request(last_user_content):
            summary_text = generate_summary(
                history=history,
                ollama_url=OLLAMA_URL,
                model_name=MODEL_NAME
            )
            cleaned = clean_response(summary_text)
            history.append({"role": "assistant", "content": cleaned})
            await save_conversation(conv_id, history)
            return PlainTextResponse(content=cleaned)

        recent_context = " ".join(
            (m.get("content", "") if isinstance(m, dict) else m.content)
            for m in history[-8:]
        )
        rag_context = improved_rag_search(recent_context)
        user_facts_and_summaries = await extract_user_facts_and_summaries(history)

        prompt = build_prompt(history, rag_context, user_facts_and_summaries, long_term_memory)

        if req.stream:
            full_response_holder = {"text": ""}

            async def save_to_db():
                if full_response_holder["text"]:
                    cleaned = clean_response(full_response_holder["text"])
                    history.append({"role": "assistant", "content": cleaned})
                    await save_conversation(conv_id, history)

            def stream_generator():
                try:
                    resp = requests.post(
                        OLLAMA_URL,
                        json={
                            "model": MODEL_NAME,
                            "prompt": prompt,
                            "stream": True,
                            "options": {"temperature": 0.65, "top_p": 0.9}
                        },
                        stream=True,
                        timeout=180
                    )
                    resp.raise_for_status()
                    for line in resp.iter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("response", "")
                            if token:
                                full_response_holder["text"] += token
                                cleaned_token = re.sub(r'\*\*', '', token)
                                cleaned_token = re.sub(r'(?m)^\s*\*\s*', '- ', cleaned_token)
                                cleaned_token = re.sub(r'\*', '', cleaned_token)
                                # Strip emojis at the token level (second line of defence)
                                cleaned_token = EMOJI_PATTERN.sub('', cleaned_token)
                                yield cleaned_token
                            if chunk.get("done", False):
                                break
                        except:
                            continue
                except Exception as e:
                    yield f"\n\nServer error: {str(e)}"

            async def async_stream():
                for token in stream_generator():
                    yield token
                await save_to_db()

            return StreamingResponse(
                async_stream(),
                media_type="text/event-stream",
                headers={"X-Conversation-Id": conv_id}
            )
        else:
            resp = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.65, "top_p": 0.9}
                },
                timeout=180
            )
            resp.raise_for_status()
            raw = resp.json().get("response", "")
            cleaned = clean_response(raw)
            history.append({"role": "assistant", "content": cleaned})
            await save_conversation(conv_id, history)
            return {"conversation_id": conv_id, "message": {"role": "assistant", "content": cleaned}}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    doc = await conversations_collection.find_one({"_id": conv_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Conversation not found")
    doc["_id"] = str(doc["_id"])
    return doc


@app.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str):
    result = await conversations_collection.delete_one({"_id": conv_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True, "conversation_id": conv_id}


@app.get("/health")
async def health_check():
    return {"status": "ok", "model": MODEL_NAME}


# ────────────────────────────────────────────────
# AI Title Generation
# ────────────────────────────────────────────────

class TitleRequest(BaseModel):
    messages: List[Message]  # first 2-3 messages of the conversation


@app.post("/generate-title")
async def generate_title(req: TitleRequest):
    """
    Given the first few messages of a conversation, ask the LLM to produce
    a short, descriptive title (3-5 words, plain text, no emojis, no punctuation).
    """
    try:
        # Build a compact conversation snippet for the prompt
        snippet = "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content[:300]}"
            for m in req.messages[:4]
        )

        title_prompt = (
            "Read the conversation below and generate a short title for it.\n"
            "Rules:\n"
            "- 3 to 5 words only\n"
            "- Plain text, no punctuation, no quotes, no asterisks\n"
            "- No emojis whatsoever\n"
            "- Capture the main topic clearly\n"
            "- Respond with ONLY the title, nothing else\n\n"
            f"Conversation:\n{snippet}\n\nTitle:"
        )

        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": title_prompt,
                "stream": False,
                "options": {"temperature": 0.4, "top_p": 0.9},
            },
            timeout=30,
        )
        resp.raise_for_status()
        raw_title = resp.json().get("response", "").strip()

        # Sanitise: strip emojis, asterisks, quotes, newlines, limit length
        clean_title = EMOJI_PATTERN.sub("", raw_title)
        clean_title = re.sub(r'[\*\"\'`\n\r]', "", clean_title)
        clean_title = re.sub(r'\s+', " ", clean_title).strip()

        # Fallback if model returns garbage
        if not clean_title or len(clean_title) > 80:
            first_user = next((m.content for m in req.messages if m.role == "user"), "")
            clean_title = first_user[:40].strip() or "New Chat"

        return {"title": clean_title}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ────────────────────────────────────────────────
# Smart Search Endpoint
# ────────────────────────────────────────────────

class SearchResult(BaseModel):
    conv_id: str
    title: str
    matched_in: str   # "title" | "message"
    snippet: str


@app.get("/search")
async def search_conversations(q: str, limit: int = 20):
    """
    Full-text smart search across ALL conversations.
    Searches both the stored title and every message content.
    Returns ranked results: title matches first, then message matches.
    """
    if not q or not q.strip():
        return []

    query = q.strip().lower()
    results: list[dict] = []

    # Fetch all conversations (limit to last 200 for performance)
    cursor = conversations_collection.find(
        {},
        {"_id": 1, "title": 1, "messages": 1}
    ).sort("updated_at", -1).limit(200)

    async for doc in cursor:
        conv_id = str(doc.get("_id", ""))
        title = doc.get("title", "Untitled Chat")
        messages = doc.get("messages", [])
        title_lower = title.lower()

        # 1 — Exact or partial title match (highest priority)
        if query in title_lower:
            results.append({
                "conv_id": conv_id,
                "title": title,
                "matched_in": "title",
                "snippet": title,
                "score": 2,
            })
            continue

        # 2 — Fuzzy word overlap on title
        query_words = set(query.split())
        title_words = set(title_lower.split())
        overlap = query_words & title_words
        if overlap:
            results.append({
                "conv_id": conv_id,
                "title": title,
                "matched_in": "title",
                "snippet": title,
                "score": 1 + len(overlap) * 0.5,
            })
            continue

        # 3 — Search inside messages
        for msg in messages:
            content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
            content_lower = content.lower()
            if query in content_lower:
                # Extract a short snippet around the match
                idx = content_lower.find(query)
                start = max(0, idx - 30)
                end = min(len(content), idx + len(query) + 60)
                snippet = ("..." if start > 0 else "") + content[start:end].strip() + ("..." if end < len(content) else "")
                results.append({
                    "conv_id": conv_id,
                    "title": title,
                    "matched_in": "message",
                    "snippet": snippet,
                    "score": 0.8,
                })
                break  # one match per conversation is enough

    # Sort by score descending, then return top N
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]
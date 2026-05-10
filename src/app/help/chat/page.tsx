'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Trash2, Search, Edit2, Brain, ChevronDown, Bot, Calculator, TerminalSquare, AlertCircle } from 'lucide-react';

// ── Emoji sanitiser (frontend safety net) ────────────────────────────────────
// Removes any emoji / pictographic unicode that the server may have missed.
const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{200D}\u{FE0F}]+/gu;

function stripEmojis(text: string): string {
  return text.replace(EMOJI_REGEX, '');
}

export interface AgentStep {
  agent: string;
  action: string;
  content: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agentSteps?: AgentStep[];
}

interface Chat {
  _id: string;
  title: string;
  messages: Message[];
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[] | null>(null); // null = no search active
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/chat');
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      const formatted = data.map((doc: any) => ({
        _id: doc._id?.toString() || '',
        title: String(doc.title || 'Untitled Chat'),
        messages: (doc.messages || []).map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: stripEmojis(String(m.content || '')),
        })),
      }));

      setChats(formatted);

      if (formatted.length > 0) {
        setCurrentChatId(formatted[0]._id);
      } else {
        await createNewChat();
      }
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Chat',
          messages: [],
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const result = await res.json();
      const newChat: Chat = {
        _id: result._id,
        title: 'New Chat',
        messages: [],
      };

      setChats((prev) => [...prev, newChat]);
      setCurrentChatId(result._id);
    } catch (err) {
      console.error('Failed to create new chat:', err);
      alert('An error occurred while creating a new chat');
    }
  };

  const deleteChat = async (id: string) => {
    try {
      await fetch(`/api/chat?id=${id}`, { method: 'DELETE' });

      setChats((prev) => prev.filter((chat) => chat._id !== id));

      if (currentChatId === id) {
        setCurrentChatId(chats.find((c) => c._id !== id)?._id || '');
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const updateChatTitle = (id: string, newTitle: string) => {
    const trimmed = newTitle.trim() || 'Untitled Chat';

    setChats((prev) =>
      prev.map((chat) => (chat._id === id ? { ...chat, title: trimmed } : chat))
    );

    setEditingChatId(null);

    // save title
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: id, title: trimmed }),
    }).catch(console.error);
  };

  // ── AI Title Generation ──────────────────────────────────────────────────────
  const generateAITitle = async (chatId: string, messages: Message[]) => {
    try {
      const res = await fetch('/api/ai/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(0, 4) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const title = stripEmojis(data.title || '').trim();
      if (title && title !== 'New Chat') {
        updateChatTitle(chatId, title);
      }
    } catch {
      // silently fail — title stays as-is
    }
  };

  const handleSendMessage = (newMessages: Message[]) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat._id === currentChatId ? { ...chat, messages: newMessages } : chat
      )
    );

    // Generate AI title after the first AI reply (user msg + assistant msg = 2)
    const current = chats.find((c) => c._id === currentChatId);
    if (current?.title === 'New Chat' && newMessages.length >= 2) {
      generateAITitle(currentChatId, newMessages);
    }

    // Save messages
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: currentChatId, messages: newMessages }),
    }).catch(console.error);
  };

  // ── Smart Search ─────────────────────────────────────────────────────────────
  // Searches title + all message content via the backend /search endpoint.
  // Falls back to local title-only filter if server is unreachable.
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!value.trim()) {
      setSearchResults(null); // clear search → show all chats
      return;
    }

    // Debounce 350ms
    searchTimeoutRef.current = setTimeout(() => {
      const q = value.toLowerCase();
      setSearchResults(
        chats
          .filter((c) => {
            if (c.title.toLowerCase().includes(q)) return true;
            return c.messages.some((m) => m.content.toLowerCase().includes(q));
          })
          .map((c) => c._id)
      );
    }, 350);
  };

  const currentChat = chats.find((chat) => chat._id === currentChatId) || chats[0];

  // Chats visible in sidebar — smart search results or full list
  const visibleChats =
    searchResults !== null
      ? chats.filter((c) => searchResults.includes(c._id))
      : chats;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-600">
        Loading chats...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? 'w-72' : 'w-0'
          } border-r border-gray-200 bg-white transition-all duration-300 overflow-hidden flex-shrink-0`}
      >
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={createNewChat}
            className="w-full rounded-lg bg-blue-600 text-white py-2.5 px-4 hover:bg-blue-700 transition flex items-center justify-center gap-2 mb-4 text-sm font-medium"
          >
            <Plus size={18} /> New Chat
          </button>

          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search chats & messages..."
              className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-140px)]">
          {visibleChats.length === 0 && searchQuery ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No chats found</p>
          ) : (
            visibleChats.map((chat) => (
              <div
                key={chat._id}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition text-sm ${currentChatId === chat._id ? 'bg-gray-100' : ''
                  }`}
                onClick={() => setCurrentChatId(chat._id)}
              >
                {editingChatId === chat._id ? (
                  <input
                    type="text"
                    defaultValue={chat.title}
                    onBlur={(e) => updateChatTitle(chat._id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        updateChatTitle(chat._id, (e.target as HTMLInputElement).value);
                      }
                    }}
                    className="flex-1 bg-transparent border-b border-gray-400 focus:outline-none focus:border-blue-500 text-gray-900 font-medium"
                    autoFocus
                  />
                ) : (
                  <span className="truncate flex-1 font-medium text-gray-900">{chat.title}</span>
                )}

                <div className="flex gap-1 opacity-70">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingChatId(chat._id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Edit2 size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat._id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Trash2 size={14} className="text-gray-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <img
            src="/logo.png"
            alt="Opticell"
            className="h-8 w-auto"
          />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? 'Hide' : 'Menu'}
          </button>
        </div>

        <ChatWindow
          messages={currentChat?.messages || []}
          onSend={handleSendMessage}
          conversationId={currentChatId}
        />
      </div>
    </div>
  );
}

// ─── Chart Renderer ──────────────────────────────────────────────────────────

function buildSensorRatioHtml(criticalCount: number, highCount: number, normalCount: number, totalValid: number): string {
  if (totalValid === 0) return '';
  const critPct = (criticalCount / totalValid) * 100;
  const highPct = (highCount / totalValid) * 100;
  const normPct = (normalCount / totalValid) * 100;
  const overallStatus = criticalCount > 0 ? 'CRITICAL' : highCount > 0 ? 'WARNING' : 'NORMAL';
  const overallColor = criticalCount > 0 ? '#ef4444' : highCount > 0 ? '#f97316' : '#22c55e';
  return `
    <div style="margin-bottom:16px;padding:16px;border-radius:12px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:700;color:#1f2937;display:flex;align-items:center;gap:6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-9 5 18 3-10 4 3 4-2"/></svg>
          Real-Time Sensor Health
        </span>
        <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:${overallColor}1a;color:${overallColor};border:1px solid ${overallColor}33;">${overallStatus}</span>
      </div>
      <div style="display:flex;height:8px;width:100%;border-radius:99px;overflow:hidden;background:#f3f4f6;margin-bottom:12px;">
        ${critPct > 0 ? `<div style="width:${critPct}%;background:#ef4444;"></div>` : ''}
        ${highPct > 0 ? `<div style="width:${highPct}%;background:#f97316;"></div>` : ''}
        ${normPct > 0 ? `<div style="width:${normPct}%;background:#22c55e;"></div>` : ''}
      </div>
      <div style="display:flex;gap:16px;font-size:12px;font-weight:500;">
        <div style="display:flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;border-radius:50%;background:${criticalCount > 0 ? '#ef4444' : '#d1d5db'};display:inline-block;"></span><span style="color:${criticalCount > 0 ? '#b91c1c' : '#9ca3af'}">${criticalCount} Critical</span></div>
        <div style="display:flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;border-radius:50%;background:${highCount > 0 ? '#f97316' : '#d1d5db'};display:inline-block;"></span><span style="color:${highCount > 0 ? '#c2410c' : '#9ca3af'}">${highCount} Warning</span></div>
        <div style="display:flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;border-radius:50%;background:${normalCount > 0 ? '#22c55e' : '#d1d5db'};display:inline-block;"></span><span style="color:${normalCount > 0 ? '#15803d' : '#9ca3af'}">${normalCount} Normal</span></div>
        <div style="margin-left:auto;color:#6b7280;">${totalValid} sensors</div>
      </div>
    </div>
  `;
}

function buildChartHtml(chartContent: string): string {
  const lines = chartContent.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
  const typeLine = lines.find((l: string) => l.toLowerCase().startsWith('type:'));
  const titleLine = lines.find((l: string) => l.toLowerCase().startsWith('title:'));
  const unitLine = lines.find((l: string) => l.toLowerCase().startsWith('unit:'));
  const dataLines = lines.filter((l: string) =>
    l.includes(':') &&
    !l.toLowerCase().startsWith('type:') &&
    !l.toLowerCase().startsWith('title:') &&
    !l.toLowerCase().startsWith('unit:')
  );

  const chartType = typeLine ? typeLine.split(':').slice(1).join(':').trim().toLowerCase() : 'bar';
  const title = titleLine ? titleLine.split(':').slice(1).join(':').trim() : 'Sensor Data';
  const unit = unitLine ? unitLine.split(':').slice(1).join(':').trim() : '';

  const entries: { label: string; value: number }[] = [];
  dataLines.forEach((l: string) => {
    const [lbl, ...rest] = l.split(':');
    const val = parseFloat(rest.join(':').trim());
    if (!isNaN(val)) entries.push({ label: lbl.trim(), value: val });
  });

  if (entries.length === 0) return '<p style="color:#ef4444">Invalid chart data</p>';

  const COLOURS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

  // ── PIE CHART (stroke-dasharray donut method — reliable cross-browser) ───────
  if (chartType === 'pie') {
    const total = entries.reduce((s, e) => s + Math.abs(e.value), 0) || 1;
    const radius = 70;
    const circ = 2 * Math.PI * radius;  // circumference
    const cx = 110, cy = 110;
    const strokeW = 38;                    // donut thickness

    let offset = 0; // dashoffset accumulator (starts at top: -circ/4)
    let slices = '';
    let legend = '';

    // Rotate so first slice starts at top
    const startRotate = -90;

    entries.forEach((e, i) => {
      const pct = Math.abs(e.value) / total;
      const dash = pct * circ;
      const gap = circ - dash;
      const col = COLOURS[i % COLOURS.length];
      const pctStr = (pct * 100).toFixed(1) + '%';

      // Each slice is a full circle with a stroke-dasharray that shows only its portion
      // rotated by the accumulated offset
      const rotation = startRotate + (offset / circ) * 360;
      slices += `<circle
        cx="${cx}" cy="${cy}" r="${radius}"
        fill="none"
        stroke="${col}"
        stroke-width="${strokeW}"
        stroke-dasharray="${dash.toFixed(3)} ${gap.toFixed(3)}"
        stroke-dashoffset="0"
        transform="rotate(${rotation}, ${cx}, ${cy})"
        opacity="0.92"
      />`;

      // Percentage label inside donut (at midpoint angle)
      if (pct > 0.06) {
        const midAngle = ((offset + dash / 2) / circ) * 2 * Math.PI + (startRotate * Math.PI) / 180;
        const labelR = radius;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);
        slices += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="800" fill="#fff">${pctStr}</text>`;
      }

      legend += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:12px;height:12px;border-radius:3px;background:${col};flex-shrink:0;display:inline-block;"></span>
        <span style="font-size:12px;color:#374151;flex:1;">${e.label}</span>
        <span style="font-size:12px;font-weight:700;color:#6b7280;">${e.value}${unit}&nbsp;<span style="color:${col}">${pctStr}</span></span>
      </div>`;

      offset += dash;
    });

    // Centre label
    const centerLabel = `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2937">${entries.length}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="9" fill="#9ca3af">sensors</text>`;

    return `
      <div style="margin:16px 0;padding:16px;border-radius:12px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="font-size:13px;font-weight:700;color:#1f2937;margin-bottom:14px;display:flex;align-items:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          ${title}
        </div>
        <div style="display:flex;align-items:center;gap:28px;flex-wrap:wrap;">
          <div style="flex-shrink:0;">
            <svg viewBox="0 0 220 220" width="200" height="200" style="display:block;overflow:visible;">
              ${slices}
              ${centerLabel}
            </svg>
          </div>
          <div style="flex:1;min-width:160px;">${legend}</div>
        </div>
      </div>
    `;
  }

  // ── SHARED SETUP for bar / line ──────────────────────────────────────────────
  const maxVal = Math.max(...entries.map((e) => e.value));
  const minVal = Math.min(...entries.map((e) => e.value));
  const W = 480, H = 220;
  const padL = 50, padR = 16, padT = 24, padB = 50;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const range = maxVal - minVal || 1;

  const yVal2y = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

  const getColor = (val: number) => {
    if (val > maxVal * 0.85) return '#ef4444';
    if (val > maxVal * 0.65) return '#f97316';
    return '#3b82f6';
  };

  // Y-axis grid + labels (shared)
  let svgContent = '';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = minVal + (range / steps) * i;
    const y = yVal2y(v);
    svgContent += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#f3f4f6" stroke-width="1"/>`;
    svgContent += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${v.toFixed(1)}</text>`;
  }
  // Axes
  svgContent += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#e5e7eb" stroke-width="1"/>`;
  svgContent += `<line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" stroke="#e5e7eb" stroke-width="1"/>`;

  // ── LINE CHART ───────────────────────────────────────────────────────────────
  if (chartType === 'line') {
    // X labels
    entries.forEach((e, i) => {
      const x = padL + (i / Math.max(entries.length - 1, 1)) * chartW;
      svgContent += `<text x="${x}" y="${H - padB + 18}" text-anchor="middle" font-size="10" fill="#6b7280">${e.label}</text>`;
    });
    // Area + line
    const pts = entries.map((e, i) => {
      const x = padL + (i / Math.max(entries.length - 1, 1)) * chartW;
      const y = yVal2y(e.value);
      return `${x},${y}`;
    });
    svgContent += `<polygon points="${padL},${padT + chartH} ${pts.join(' ')} ${padL + chartW},${padT + chartH}" fill="#3b82f6" opacity="0.07"/>`;
    svgContent += `<polyline points="${pts.join(' ')}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    entries.forEach((e, i) => {
      const x = padL + (i / Math.max(entries.length - 1, 1)) * chartW;
      const y = yVal2y(e.value);
      const col = getColor(e.value);
      svgContent += `<circle cx="${x}" cy="${y}" r="5" fill="${col}" stroke="#fff" stroke-width="2"/>`;
      svgContent += `<text x="${x}" y="${y - 11}" text-anchor="middle" font-size="10" font-weight="700" fill="${col}">${e.value}${unit}</text>`;
    });
  } else {
    // ── BAR CHART ──────────────────────────────────────────────────────────────
    const barW = Math.min((chartW / entries.length) * 0.58, 52);
    const gap = chartW / entries.length;
    entries.forEach((e, i) => {
      const x = padL + gap * i + (gap - barW) / 2;
      const barH = Math.max(((e.value - minVal) / range) * chartH, 2);
      const y = yVal2y(e.value);
      const col = COLOURS[i % COLOURS.length];
      svgContent += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" fill="${col}" opacity="0.85"/>`;
      svgContent += `<text x="${x + barW / 2}" y="${y - 7}" text-anchor="middle" font-size="10" font-weight="700" fill="${col}">${e.value}${unit}</text>`;
      // X label — wrap long labels
      const lbl = e.label.length > 10 ? e.label.slice(0, 10) + '…' : e.label;
      svgContent += `<text x="${x + barW / 2}" y="${H - padB + 18}" text-anchor="middle" font-size="10" fill="#6b7280">${lbl}</text>`;
    });
  }

  return `
    <div style="margin:16px 0;padding:16px;border-radius:12px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="font-size:13px;font-weight:700;color:#1f2937;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        ${title}
      </div>
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;">${svgContent}</svg>
      </div>
    </div>
  `;
}


// ─── Smart Table Renderer ────────────────────────────────────────────────────

function renderContentWithTables(content: string): string {
  // ── 0. Render [CHART]...[/CHART] visualization blocks ────────────────────
  let result = content.replace(
    /\[CHART\]([\s\S]*?)\[\/CHART\]/g,
    (_, chartContent) => buildChartHtml(chartContent)
  );

  // ── 1. Render [TABLE]...[/TABLE] custom format ────────────────────────────
  result = result.replace(
    /\[TABLE\]([\s\S]*?)\[\/TABLE\]/g,
    (_, tableContent) => {
      const lines = tableContent.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
      if (lines.length < 3) return '<p style="color:#ef4444">Invalid table</p>';
      const headers = lines[0].split('|').map((h: string) => h.trim()).filter(Boolean);
      const bodyLines = lines.slice(2);

      // Count statuses for ratio bar
      let criticalCount = 0, highCount = 0, normalCount = 0;
      bodyLines.forEach((row: string) => {
        const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
        if (cells.length > 0) {
          const s = cells[cells.length - 1].toLowerCase().replace(/[^a-z]/g, '');
          if (s === 'critical') criticalCount++;
          else if (s === 'high') highCount++;
          else if (s === 'normal') normalCount++;
        }
      });
      const totalValid = criticalCount + highCount + normalCount;
      const ratioHtml = buildSensorRatioHtml(criticalCount, highCount, normalCount, totalValid);

      let html = ratioHtml + `
        <table style="width:100%;border-collapse:collapse;font-size:13px;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <thead>
            <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
              ${headers.map((h: string) => `<th style="padding:10px 18px;text-align:left;font-weight:700;color:#374151;border:1px solid #e5e7eb;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
      `;
      bodyLines.forEach((row: string) => {
        const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
        html += `<tr style="border-bottom:1px solid #f3f4f6;">`;
        cells.forEach((cell: string, i: number) => {
          const lc = cell.toLowerCase().replace(/[^a-z]/g, '');
          const isStatus = i === cells.length - 1 && (lc === 'high' || lc === 'normal' || lc === 'critical');
          let display = cell;
          if (isStatus) {
            const bg = lc === 'critical' ? '#fef2f2' : lc === 'high' ? '#fff7ed' : '#f0fdf4';
            const col = lc === 'critical' ? '#b91c1c' : lc === 'high' ? '#c2410c' : '#15803d';
            const bdr = lc === 'critical' ? '#fca5a5' : lc === 'high' ? '#fdba74' : '#86efac';
            const label = lc === 'critical' ? 'Critical' : lc === 'high' ? 'High' : 'Normal';
            display = `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${bg};color:${col};border:1px solid ${bdr};">${label}</span>`;
          }
          html += `<td style="padding:10px 18px;border:1px solid #e5e7eb;color:${isStatus ? '' : '#4b5563'};">${display}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      return html;
    }
  );

  // ── 2. Render standard markdown pipe tables ───────────────────────────────
  result = result.replace(
    /((?:\|[^\n]+\|\n?)+)/g,
    (block) => {
      const rows = block.trim().split('\n').map((r: string) => r.trim()).filter(Boolean);
      if (rows.length < 3) return block;
      if (!/^\|[\s\-|:]+\|$/.test(rows[1])) return block;

      const headers = rows[0].split('|').map((h: string) => h.trim()).filter(Boolean);
      const dataRows = rows.slice(2);

      // Count statuses for ratio bar
      let criticalCount = 0, highCount = 0, normalCount = 0;
      let isSensorTable = false;
      dataRows.forEach((row: string) => {
        const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
        if (cells.length > 0) {
          const s = cells[cells.length - 1].toLowerCase().replace(/[^a-z]/g, '');
          if (s === 'critical') { criticalCount++; isSensorTable = true; }
          else if (s === 'high') { highCount++; isSensorTable = true; }
          else if (s === 'normal') { normalCount++; isSensorTable = true; }
        }
      });
      const totalValid = criticalCount + highCount + normalCount;
      const ratioHtml = isSensorTable ? buildSensorRatioHtml(criticalCount, highCount, normalCount, totalValid) : '';

      let html = ratioHtml + `
        <table style="width:100%;border-collapse:collapse;font-size:13px;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <thead>
            <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
              ${headers.map((h: string) => `<th style="padding:10px 18px;text-align:left;font-weight:700;color:#374151;border:1px solid #e5e7eb;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
      `;
      dataRows.forEach((row: string) => {
        const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
        html += `<tr style="border-bottom:1px solid #f3f4f6;">`;
        cells.forEach((cell: string, i: number) => {
          const lc = cell.toLowerCase().replace(/[^a-z]/g, '');
          const isStatus = i === cells.length - 1 && isSensorTable && (lc === 'critical' || lc === 'high' || lc === 'normal');
          let display = cell;
          if (isStatus) {
            const bg = lc === 'critical' ? '#fef2f2' : lc === 'high' ? '#fff7ed' : '#f0fdf4';
            const col = lc === 'critical' ? '#b91c1c' : lc === 'high' ? '#c2410c' : '#15803d';
            const bdr = lc === 'critical' ? '#fca5a5' : lc === 'high' ? '#fdba74' : '#86efac';
            const label = lc === 'critical' ? 'Critical' : lc === 'high' ? 'High' : 'Normal';
            display = `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${bg};color:${col};border:1px solid ${bdr};">${label}</span>`;
          }
          html += `<td style="padding:10px 18px;border:1px solid #e5e7eb;color:${isStatus ? '' : '#4b5563'};">${display}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      return html;
    }
  );

  return result;
}

// ─── AgentTraceUI Component ──────────────────────────────────────────────────

function AgentTraceUI({ steps }: { steps?: AgentStep[] }) {
  if (!steps || steps.length === 0) return null;

  const getAgentIcon = (agent: string) => {
    switch (agent.toLowerCase()) {
      case 'researcher': return <Search size={16} className="text-blue-500" />;
      case 'analyst': return <Calculator size={16} className="text-purple-500" />;
      case 'coder': return <TerminalSquare size={16} className="text-green-500" />;
      case 'critic': return <AlertCircle size={16} className="text-orange-500" />;
      case 'supervisor': return <Brain size={16} className="text-indigo-500" />;
      default: return <Bot size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      {steps.map((step, idx) => (
        <details
          key={idx}
          className="group border border-gray-200 rounded-lg bg-gray-50 overflow-hidden"
        >
          <summary className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors list-none">
            <div className="flex items-center gap-2">
              {getAgentIcon(step.agent)}
              <span className="text-sm font-semibold text-gray-700">{step.agent}</span>
              <span className="text-sm text-gray-500 truncate max-w-[200px]">{step.action}</span>
            </div>
            <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-4 py-3 border-t border-gray-200 bg-white text-sm text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono text-xs">
            {step.content || <span className="italic text-gray-400">Working...</span>}
          </div>
        </details>
      ))}
    </div>
  );
}

// ─── ChatWindow Component ────────────────────────────────────────────────────

function ChatWindow({
  messages,
  onSend,
  conversationId,
}: {
  messages: Message[];
  onSend: (newMessages: Message[]) => void;
  conversationId: string;
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDeepThinking, setIsDeepThinking] = useState(false); // State for animation type
  const [agentStatus, setAgentStatus] = useState(''); // Holds multi-agent status text
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSteps, setStreamingSteps] = useState<AgentStep[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, loading]);

  const displayedMessages = [...messages];
  if (streamingContent || streamingSteps.length > 0) {
    displayedMessages.push({
      role: 'assistant',
      content: streamingContent,
      agentSteps: streamingSteps
    });
  }


  const handleSend = async () => {
    if (!input.trim() || loading || !conversationId) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];

    onSend(updatedMessages);
    setInput('');
    setLoading(true);
    setStreamingContent('');
    setStreamingSteps([]);
    setAgentStatus('Analyzing your request...');
    setIsDeepThinking(false);

    // Switch to deep thinking animation after 1.5s
    thinkingTimerRef.current = setTimeout(() => {
      setIsDeepThinking(true);
    }, 1500);

    let assistantText = '';
    let currentSteps: AgentStep[] = [];
    let gotFinalAnswer = false;

    try {
      const res = await fetch('/api/ai/multi-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Clear the thinking timer when first data arrives
          if (thinkingTimerRef.current) {
            clearTimeout(thinkingTimerRef.current);
            thinkingTimerRef.current = null;
            setIsDeepThinking(true);
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'error') {
                assistantText = `Error: ${event.message}`;
                setStreamingContent(assistantText);
                break;
              }

              if (event.type === 'agent_start') {
                setAgentStatus(event.message || `${event.agent} working...`);
                setIsDeepThinking(true);
                // Add non-supervisor/synthesizer agents to the accordion
                if (event.agent !== 'Synthesizer' && event.agent !== 'Supervisor') {
                  currentSteps = [...currentSteps, { agent: event.agent, action: event.message, content: '' }];
                  setStreamingSteps([...currentSteps]);
                }
              }

              if (event.type === 'token') {
                if (event.agent === 'Supervisor') continue; // hide supervisor routing JSON
                if (event.agent === 'Synthesizer') {
                  // Synthesizer tokens stream as the final message
                  assistantText += event.content;
                  setStreamingContent(stripEmojis(assistantText));
                } else {
                  // Worker agent tokens go into the accordion
                  if (currentSteps.length > 0) {
                    currentSteps[currentSteps.length - 1].content += event.content;
                    setStreamingSteps([...currentSteps]);
                  }
                }
              }

              // ✅ FINAL ANSWER — this is the definitive message, always use it
              if (event.type === 'final_answer' && event.content) {
                assistantText = event.content;
                gotFinalAnswer = true;
                setStreamingContent(stripEmojis(assistantText));
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e, dataStr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      assistantText = 'An error occurred while connecting to the server. Please try again.';
    } finally {
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
      }
      setLoading(false);
      setIsDeepThinking(false);
      setAgentStatus('');
    }

    // Save the final message
    const finalContent = assistantText.trim();
    if (finalContent) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: stripEmojis(finalContent),
        agentSteps: currentSteps.length > 0 ? currentSteps : undefined,
      };
      onSend([...updatedMessages, assistantMessage]);
    }

    setStreamingContent('');
    setStreamingSteps([]);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 bg-gray-50 relative">
        {/* Empty state — shown only before the first message */}
        {displayedMessages.length === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-3">
              Opticell AI
            </p>
            <h2 className="text-3xl font-semibold text-gray-800 mb-3">
              {new Date().getHours() < 12
                ? 'Good morning'
                : new Date().getHours() < 18
                  ? 'Good afternoon'
                  : 'Good evening'}
            </h2>
            <p className="text-lg text-gray-400 mb-8">How can I help you today?</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'Show real-time sensor readings',
                'Give me an Histogram Chart For data?',
                'Give me an summarize for this chat ',
                'Be With me in my work?',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-full hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {displayedMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Message Bubble - Updated with Smart Tables and Agent Traces */}
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3 text-base leading-relaxed shadow-sm whitespace-pre-wrap break-words ${msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
                }`}
            >
              {msg.role === 'assistant' && msg.agentSteps && (
                <AgentTraceUI steps={msg.agentSteps} />
              )}

              <div
                dangerouslySetInnerHTML={{
                  __html: renderContentWithTables(msg.content),
                }}
              />
            </div>
          </div>
        ))}

        {/* Dynamic Loading Animation */}
        {loading && !streamingContent && (
          <div className="flex justify-start">
            {isDeepThinking ? (
              // Enhanced Glowing AI Process Animation
              <div className="relative flex items-center p-[2px] rounded-2xl bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 animate-pulse shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-500">
                <div className="bg-white rounded-[14px] px-5 py-3 flex items-center gap-4 w-full h-full relative z-10">
                  <div className="relative flex items-center justify-center">
                    {/* Glowing background behind icon */}
                    <div className="absolute w-8 h-8 bg-purple-300 rounded-full blur-md animate-ping opacity-60"></div>
                    <Brain className="text-blue-600 relative z-10" size={24} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 uppercase tracking-widest mb-0.5">
                      Opticell Neural Engine
                    </span>
                    <span className="text-gray-800 font-medium text-sm flex items-center gap-1">
                      {agentStatus || 'Analyzing context'}
                      <span className="flex gap-1 ml-1 items-center h-full pt-1">
                        <span className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Fast process: Simple Spinner
              <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-200 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-500 text-sm">Processing...</span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 bg-white px-5 py-4">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base placeholder-gray-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center min-w-[52px]"
          >
            <Send size={22} />
          </button>
        </div>
      </div>
    </>
  );
}
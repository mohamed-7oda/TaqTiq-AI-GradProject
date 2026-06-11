import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

// Lightweight markdown → JSX renderer (handles headings, bold, italic, bullets)
function renderMarkdown(text) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (!line.trim()) { i++; continue; }

    // Headings: ### ## #
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const sizes = { 1: "1rem", 2: "0.92rem", 3: "0.88rem" };
      elements.push(
        <div key={i} style={{
          fontWeight: 700,
          color: "#e2e8f0",
          fontSize: sizes[level],
          marginTop: elements.length > 0 ? "10px" : "2px",
          marginBottom: "4px",
          letterSpacing: level === 3 ? "0.02em" : undefined,
        }}>
          {inlineMarkdown(content)}
        </div>
      );
      i++; continue;
    }

    // Bullet list block: collect consecutive - or * lines
    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: "4px 0 4px 4px", paddingLeft: "14px" }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: "3px", color: "#cbd5e1", fontSize: "0.84rem", lineHeight: 1.55 }}>
              {inlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list: 1. 2. etc.
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: "4px 0 4px 4px", paddingLeft: "16px" }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: "3px", color: "#cbd5e1", fontSize: "0.84rem", lineHeight: 1.55 }}>
              {inlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={i} style={{ margin: "3px 0", lineHeight: 1.6, fontSize: "0.84rem", color: "#cbd5e1" }}>
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>{elements}</div>;
}

// Handle **bold**, *italic*, `code` within a line
function inlineMarkdown(text) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0, match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={match.index} style={{ color: "#e2e8f0", fontWeight: 700 }}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={match.index} style={{ color: "#a5b4fc" }}>{match[3]}</em>);
    else if (match[4]) parts.push(<code key={match.index} style={{ background: "rgba(255,255,255,0.1)", borderRadius: "3px", padding: "1px 4px", fontSize: "0.8em", color: "#7dd3fc" }}>{match[4]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

const BOT_INTRO = {
  role: "assistant",
  content:
    "Hi! I'm Pep, your AI football analyst. Ask me anything about football — tactics, rules, player roles — or share your match data and I'll break it down for you.",
};

function TypingDots() {
  return (
    <div style={styles.typingRow}>
      <div style={styles.botAvatar}>⚽</div>
      <div style={styles.typingBubble}>
        <span style={{ ...styles.dot, animationDelay: "0ms" }} />
        <span style={{ ...styles.dot, animationDelay: "160ms" }} />
        <span style={{ ...styles.dot, animationDelay: "320ms" }} />
      </div>
    </div>
  );
}

export default function ChatBot({ apiUrl, token, results, historyContext }) {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState([BOT_INTRO]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [ctxActive, setCtxActive] = useState(false);
  // activeCtx holds the context object actually sent to the API:
  // null | { data: resultsObj, name: string, source: "analyze"|"history" }
  const [activeCtx, setActiveCtx] = useState(null);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);
  const prevHistoryCtxRef         = useRef(null);

  const hasResults = results && (results.events?.length || results.stats);

  // Auto-open and load context whenever a history match is pushed in
  useEffect(() => {
    if (!historyContext || historyContext === prevHistoryCtxRef.current) return;
    prevHistoryCtxRef.current = historyContext;

    setOpen(true);
    setCtxActive(false); // clear any "current analysis" flag
    setActiveCtx({ data: historyContext.data, name: historyContext.name, source: "history" });

    const shortName = historyContext.name?.length > 40
      ? historyContext.name.slice(0, 37) + "…"
      : historyContext.name;
    const evCount = historyContext.data?.events?.length;
    const evText  = evCount ? ` (${evCount} events detected)` : "";

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Match loaded: **${shortName}**${evText}. Ask me anything about it — key moments, patterns, event breakdown, or tactical insights.`,
      },
    ]);
  }, [historyContext]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    setInput("");

    const userMsg = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    const history = updated.filter((m) => m.role !== "system").map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const matchCtx = activeCtx ? activeCtx.data
                   : (ctxActive && hasResults ? results : null);

    try {
      const { data } = await axios.post(
        `${apiUrl}/api/chat`,
        { messages: history, match_context: matchCtx },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      const msg = err.response?.data?.error || "Something went wrong. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, apiUrl, token, results, ctxActive, hasResults]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleContext = () => {
    const next = !ctxActive;
    setCtxActive(next);
    if (next) {
      setActiveCtx({ data: results, name: "current analysis", source: "analyze" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Current match data loaded! What would you like to know?" },
      ]);
    } else {
      setActiveCtx(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Match data removed. Back to general football mode." },
      ]);
    }
  };

  return (
    <>
      {/* ── Floating button ── */}
      {!open && (
        <button style={styles.fab} onClick={() => setOpen(true)} title="Chat with Pep">
          <span style={styles.fabIcon}>⚽</span>
          <span style={styles.fabLabel}>Pep</span>
          <span style={styles.fabPulse} />
        </button>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.headerIcon}>⚽</div>
              <div>
                <div style={styles.headerTitle}>Pep</div>
              </div>
            </div>
            <div style={styles.headerActions}>
              {hasResults && (
                <button
                  style={{
                    ...styles.ctxBtn,
                    ...(ctxActive || activeCtx?.source === "analyze" ? styles.ctxBtnActive : {}),
                  }}
                  onClick={toggleContext}
                  title={ctxActive ? "Remove current match data" : "Share current match data"}
                >
                  {ctxActive ? "📊 Data ON" : "📊 Add Match"}
                </button>
              )}
              <button style={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          {/* Context banner */}
          {activeCtx && (
            <div style={styles.ctxBanner}>
              <span>📊</span>
              <div style={{ flex:1, overflow:"hidden", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {activeCtx.source === "history"
                  ? (activeCtx.name?.length > 32 ? activeCtx.name.slice(0,29)+"…" : activeCtx.name)
                  : "Current match"
                }
                {" "}— {activeCtx.data?.events?.length ?? 0} events
              </div>
              <button
                onClick={() => { setActiveCtx(null); setCtxActive(false); }}
                style={styles.ctxClearBtn}
                title="Remove match data"
              >✕</button>
            </div>
          )}

          {/* Messages */}
          <div style={styles.messages}>
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {loading && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts (shown only when no user messages yet) */}
          {messages.length === 1 && (
            <div style={styles.suggestions}>
              {(() => {
                const ctx = activeCtx ? activeCtx.data : (ctxActive && hasResults ? results : null);
                if (ctx) {
                  return ["Summarize the match events", "When were the key moments?", "How was the match tempo?"];
                }
                return ["Explain the offside rule", "What is a false nine?", "How does pressing work?"];
              })().map(s => (
                <button key={s} style={styles.suggestion} onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={styles.inputRow}>
            <textarea
              ref={inputRef}
              style={styles.textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about football or your match…"
              rows={1}
              disabled={loading}
            />
            <button
              style={{
                ...styles.sendBtn,
                opacity: (!input.trim() || loading) ? 0.45 : 1,
              }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes fabPulseAnim {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.6); opacity: 0; }
        }
        @keyframes panelSlide {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
      `}</style>
    </>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div style={{ ...styles.msgRow, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      {!isUser && <div style={styles.botAvatar}>⚽</div>}
      <div style={{ ...styles.bubble, ...(isUser ? styles.bubbleUser : styles.bubbleBot) }}>
        {isUser
          ? message.content
          : renderMarkdown(message.content)
        }
      </div>
      {isUser && <div style={styles.userAvatar}>You</div>}
    </div>
  );
}

const styles = {
  fab: {
    position: "fixed",
    bottom: "28px",
    right: "28px",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    border: "none",
    borderRadius: "50px",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
    boxShadow: "0 8px 32px rgba(59,130,246,0.45)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  fabIcon: { fontSize: "1.1rem" },
  fabLabel: { letterSpacing: "0.01em" },
  fabPulse: {
    position: "absolute",
    inset: 0,
    borderRadius: "50px",
    background: "rgba(59,130,246,0.4)",
    animation: "fabPulseAnim 2.4s ease-in-out infinite",
    pointerEvents: "none",
  },

  panel: {
    position: "fixed",
    bottom: "28px",
    right: "28px",
    zIndex: 1000,
    width: "380px",
    maxHeight: "580px",
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(160deg, #0f1729 0%, #0a0e1a 100%)",
    border: "1px solid rgba(59,130,246,0.25)",
    borderRadius: "20px",
    boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
    overflow: "hidden",
    animation: "panelSlide 0.25s cubic-bezier(0.4,0,0.2,1) both",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(59,130,246,0.08)",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "10px" },
  headerIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.1rem",
    flexShrink: 0,
  },
  headerTitle: { color: "#e2e8f0", fontWeight: 700, fontSize: "0.92rem" },
  headerSub:   { color: "#64748b", fontSize: "0.72rem", marginTop: "1px" },
  headerActions: { display: "flex", alignItems: "center", gap: "8px" },

  ctxBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#94a3b8",
    padding: "4px 10px",
    borderRadius: "8px",
    fontSize: "0.74rem",
    cursor: "pointer",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  ctxBtnActive: {
    background: "rgba(59,130,246,0.18)",
    borderColor: "rgba(59,130,246,0.45)",
    color: "#93c5fd",
  },

  closeBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#64748b",
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },

  ctxBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 16px",
    background: "rgba(59,130,246,0.12)",
    borderBottom: "1px solid rgba(59,130,246,0.2)",
    color: "#93c5fd",
    fontSize: "0.76rem",
    flexShrink: 0,
    overflow: "hidden",
  },
  ctxClearBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    fontSize: "0.75rem",
    marginLeft: "auto",
    flexShrink: 0,
    padding: "0 2px",
    lineHeight: 1,
  },

  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 14px 6px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(255,255,255,0.08) transparent",
  },

  msgRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
  },

  bubble: {
    maxWidth: "78%",
    padding: "9px 13px",
    borderRadius: "14px",
    fontSize: "0.84rem",
    lineHeight: "1.5",
    wordBreak: "break-word",
  },
  bubbleUser: {
    background: "linear-gradient(135deg, #3b82f6, #6366f1)",
    color: "#fff",
    borderBottomRightRadius: "4px",
  },
  bubbleBot: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "#cbd5e1",
    borderBottomLeftRadius: "4px",
  },

  botAvatar: {
    width: "26px",
    height: "26px",
    borderRadius: "8px",
    background: "linear-gradient(135deg,#1e3a5f,#3b82f6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.75rem",
    flexShrink: 0,
  },
  userAvatar: {
    fontSize: "0.65rem",
    color: "#475569",
    flexShrink: 0,
    alignSelf: "flex-end",
    marginBottom: "2px",
  },

  typingRow: { display: "flex", alignItems: "flex-end", gap: "8px" },
  typingBubble: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "14px",
    borderBottomLeftRadius: "4px",
  },
  dot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#3b82f6",
    animation: "dotBounce 1.2s ease-in-out infinite",
  },

  suggestions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    padding: "0 14px 10px",
    flexShrink: 0,
  },
  suggestion: {
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.22)",
    color: "#93c5fd",
    padding: "5px 11px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    cursor: "pointer",
    transition: "all 0.18s",
  },

  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    padding: "10px 12px 12px",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(0,0,0,0.2)",
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "#e2e8f0",
    fontSize: "0.84rem",
    padding: "9px 12px",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: "1.4",
    maxHeight: "100px",
    overflowY: "auto",
    transition: "border-color 0.2s",
  },
  sendBtn: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    background: "linear-gradient(135deg,#3b82f6,#6366f1)",
    border: "none",
    color: "#fff",
    fontSize: "1rem",
    cursor: "pointer",
    flexShrink: 0,
    transition: "opacity 0.2s, transform 0.15s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

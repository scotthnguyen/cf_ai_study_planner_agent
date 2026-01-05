import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

function getOrCreateSessionId() {
  const key = "study_session_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

function setNewSessionId() {
  const key = "study_session_id";
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

/**
 * If the backend ever accidentally returns JSON (or JSON-as-string) inside reply,
 * this extracts the human reply safely.
 */
function normalizeReply(maybe: unknown): string {
  if (typeof maybe !== "string") return "No reply returned.";

  const s = maybe.trim();

  // If the reply itself is a JSON object string: {"reply":"..."}
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj.reply === "string") return obj.reply;
      // If it has response.reply shape
      if (obj?.response && typeof obj.response.reply === "string") return obj.response.reply;
    } catch {
      // ignore
    }
  }

  // If reply is something like: {"response":{"reply":"..."}} wrapped etc.
  // Try to find the first JSON object inside the string.
  const firstBrace = s.indexOf("{");
  if (firstBrace !== -1) {
    const candidate = s.slice(firstBrace);
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj.reply === "string") return obj.reply;
      if (obj?.response && typeof obj.response.reply === "string") return obj.response.reply;
    } catch {
      // ignore
    }
  }

  return maybe;
}

export default function App() {
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Tell me what you're studying, your deadline, and how many hours you can spend per week. I’ll build a plan.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const apiBase = useMemo(() => {
    return import.meta.env.VITE_API_BASE ?? "http://localhost:8787";
  }, []);

  useEffect(() => {
    // Auto-scroll chat to bottom
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setLastError(null);
    setMsgs((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: msg }),
      });

      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { reply: raw };
      }

      if (!res.ok) {
        const errText = `Error ${res.status}: ${data?.error ?? raw}`;
        setLastError(errText);
        setMsgs((m) => [...m, { role: "assistant", text: `Sorry — I hit an error.\n${data?.error ?? raw}` }]);
        return;
      }

      const replyText = normalizeReply(data?.reply ?? "No reply returned.");
      setMsgs((m) => [...m, { role: "assistant", text: replyText }]);
    } catch (err: any) {
      const msg = `Network error: ${err?.message ?? String(err)}`;
      setLastError(msg);
      setMsgs((m) => [...m, { role: "assistant", text: `Sorry — ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  function resetSession() {
    const newId = setNewSessionId();
    setSessionId(newId);
    setInput("");
    setLastError(null);
    setMsgs([
      {
        role: "assistant",
        text: "New session started ✅\nTell me what you're studying, your deadline, and how many hours you can spend per week.",
      },
    ]);
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Study Planner Agent</h1>
            <p style={styles.subtitle}>Cloudflare Workers AI + Durable Objects (memory per session)</p>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.sessionPill} title="This sessionId maps to one Durable Object instance">
              <span style={{ opacity: 0.7 }}>Session</span>
              <code style={styles.code}>{sessionId.slice(0, 8)}…</code>
            </div>

            <button style={styles.secondaryBtn} onClick={resetSession} disabled={loading}>
              Reset session
            </button>
          </div>
        </header>

        <main style={styles.card}>
          <div style={styles.chatHeader}>
            <div style={{ fontWeight: 600 }}>Chat</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              API: <code style={styles.codeSmall}>{apiBase}</code>
            </div>
          </div>

          <div ref={listRef} style={styles.chatBody}>
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  ...styles.bubbleRow,
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    ...styles.bubble,
                    ...(m.role === "user" ? styles.userBubble : styles.agentBubble),
                  }}
                >
                  <div style={styles.bubbleRole}>{m.role === "user" ? "You" : "Agent"}</div>
                  <div style={styles.bubbleText}>{m.text}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ ...styles.bubbleRow, justifyContent: "flex-start" }}>
                <div style={{ ...styles.bubble, ...styles.agentBubble }}>
                  <div style={styles.bubbleRole}>Agent</div>
                  <div style={{ ...styles.bubbleText, opacity: 0.8 }}>Thinking…</div>
                </div>
              </div>
            )}
          </div>

          <div style={styles.inputBar}>
            <input
              style={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="e.g., PSTAT midterm in 1 week, 3 hours/week, topics: distributions + hypothesis testing"
              disabled={loading}
            />
            <button style={styles.primaryBtn} onClick={send} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>

          {lastError && <div style={styles.errorBox}>{lastError}</div>}
        </main>

        <footer style={styles.footer}>
          Tip: Use the same session to show memory. Hit <b>Reset session</b> to start fresh.
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px 20px",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },

  container: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 14,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  sessionPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#334155",
    fontSize: 13,
  },

  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    background: "#f1f5f9",
    padding: "2px 6px",
    borderRadius: 6,
  },

  codeSmall: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    background: "#f1f5f9",
    padding: "2px 6px",
    borderRadius: 6,
  },

  card: {
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
    overflow: "hidden",
  },

  chatHeader: {
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    fontWeight: 600,
  },

  chatBody: {
    height: 520,
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "#ffffff",
  },

  bubbleRow: {
    display: "flex",
  },

  bubble: {
    maxWidth: "75%",
    borderRadius: 16,
    padding: "12px 14px",
    lineHeight: 1.45,
    fontSize: 14,
    whiteSpace: "pre-wrap", // IMPORTANT: renders line breaks in schedules nicely
  },

  agentBubble: {
    background: "#f1f5f9",
    color: "#0f172a",
  },

  userBubble: {
    background: "#2563eb",
    color: "#ffffff",
  },

  bubbleRole: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },

  bubbleText: {},

  inputBar: {
    display: "flex",
    gap: 12,
    padding: 14,
    borderTop: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  input: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5f5",
    fontSize: 14,
    outline: "none",
  },

  primaryBtn: {
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5f5",
    background: "#ffffff",
    color: "#1e293b",
    fontWeight: 600,
    cursor: "pointer",
  },

  errorBox: {
    margin: 16,
    padding: "12px 14px",
    borderRadius: 12,
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 13,
  },

  footer: {
    fontSize: 12,
    color: "#64748b",
    paddingLeft: 6,
  },
};

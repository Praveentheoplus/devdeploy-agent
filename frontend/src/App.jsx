import { useState, useRef } from "react";
import "./index.css";

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [envInput, setEnvInput] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState("");
  const logsEndRef = useRef(null);

  const addLog = (type, message) => {
    setLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString() }]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const parseEnvVars = (input) => {
    const vars = {};
    input.split("\n").forEach(line => {
      if (line.includes("=")) {
        const [key, ...val] = line.split("=");
        vars[key.trim()] = val.join("=").trim();
      }
    });
    return vars;
  };

  const handleDeploy = async () => {
    if (!repoUrl || !vercelToken) {
      addLog("error", "Please fill in GitHub URL and Vercel token");
      return;
    }
    setLogs([]);
    setDeployedUrl("");
    setLoading(true);
    addLog("log", "🤖 DevDeploy Agent starting...");
    try {
      const response = await fetch("http://localhost:5000/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, vercelToken, envVars: parseEnvVars(envInput) }),
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data:"));
        for (const line of lines) {
          try {
            const { type, message } = JSON.parse(line.replace("data: ", ""));
            addLog(type, message);
            if (type === "url") setDeployedUrl(message);
          } catch {}
        }
      }
    } catch (e) {
      addLog("error", `Connection error: ${e.message}`);
    }
    setLoading(false);
  };

  const steps = [
    { icon: "🔍", label: "Scan Repo",      desc: "Reads your GitHub file tree" },
    { icon: "⚡", label: "Detect Stack",   desc: "Identifies framework & runtime" },
    { icon: "⚙️", label: "Build Config",   desc: "Generates optimal build settings" },
    { icon: "🔐", label: "Env Variables",  desc: "Checks .env.example for secrets" },
    { icon: "🚀", label: "Deploy",         desc: "Pushes live to Vercel instantly" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #dde4ff 0%, #f5f0ff 40%, #fce4ff 100%)",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
    }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.85)",
        padding: "0 32px",
        height: 60,
        display: "flex", alignItems: "center", gap: 14,
        boxShadow: "0 2px 24px rgba(99,102,241,0.07)",
        flexShrink: 0,
      }}>
        <div style={{
          width: 38, height: 38,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          borderRadius: 10, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 18,
          boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
        }}>🤖</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#1e1b4b", lineHeight: 1.2 }}>DevDeploy Agent</div>
          <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>Autonomous AI-Powered Deployment</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "#fff", fontSize: 11, fontWeight: 700,
            padding: "5px 12px", borderRadius: 20,
          }}>✨ AI Agent</span>
          <span style={{
            background: "rgba(16,185,129,0.1)", color: "#059669",
            fontSize: 11, fontWeight: 700, padding: "5px 12px",
            borderRadius: 20, border: "1px solid rgba(16,185,129,0.25)",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            Live
          </span>
        </div>
      </nav>

      {/* ── BODY ── */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "420px 1fr",
        gap: 0, overflow: "hidden",
      }}>

        {/* ── LEFT PANEL ── */}
        <div style={{
          padding: "24px 20px 24px 24px",
          overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 16,
          borderRight: "1px solid rgba(255,255,255,0.6)",
        }}>

          {/* Config Card */}
          <div style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(24px)",
            borderRadius: 18, padding: 22,
            border: "1px solid rgba(255,255,255,0.95)",
            boxShadow: "0 8px 32px rgba(99,102,241,0.09)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#4338ca", marginBottom: 18, textTransform: "uppercase", letterSpacing: 1.2 }}>
              ⚙️ Configuration
            </div>

            {[
              { label: "GitHub Repository URL", icon: "🔗", key: "repo", type: "text", placeholder: "https://github.com/username/repo" },
              { label: "Vercel API Token", icon: "🔑", key: "token", type: "password", placeholder: "your-vercel-token" },
            ].map(({ label, icon, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{label}</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 15 }}>{icon}</span>
                  <input
                    type={type}
                    value={key === "repo" ? repoUrl : vercelToken}
                    onChange={e => key === "repo" ? setRepoUrl(e.target.value) : setVercelToken(e.target.value)}
                    placeholder={placeholder}
                    style={{
                      width: "100%", padding: "10px 12px 10px 34px",
                      background: "rgba(255,255,255,0.85)",
                      border: "1.5px solid rgba(99,102,241,0.18)",
                      borderRadius: 11, fontSize: 13, color: "#1f2937",
                      outline: "none", boxSizing: "border-box",
                    }}
                    onFocus={e => e.target.style.borderColor = "#6366f1"}
                    onBlur={e => e.target.style.borderColor = "rgba(99,102,241,0.18)"}
                  />
                </div>
              </div>
            ))}

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Environment Variables <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={envInput}
                onChange={e => setEnvInput(e.target.value)}
                placeholder={"VITE_API_KEY=abc123\nVITE_BASE_URL=https://api.example.com"}
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "rgba(255,255,255,0.85)",
                  border: "1.5px solid rgba(99,102,241,0.18)",
                  borderRadius: 11, fontSize: 12, color: "#1f2937",
                  outline: "none", resize: "none", boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
                onFocus={e => e.target.style.borderColor = "#6366f1"}
                onBlur={e => e.target.style.borderColor = "rgba(99,102,241,0.18)"}
              />
            </div>

            <button
              onClick={handleDeploy}
              disabled={loading}
              style={{
                width: "100%", padding: "12px",
                background: loading ? "rgba(99,102,241,0.35)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff", border: "none", borderRadius: 11,
                fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 18px rgba(99,102,241,0.38)",
                transition: "all 0.2s",
              }}
            >
              {loading ? "🤖 Agent Running..." : "🚀 Deploy with AI Agent"}
            </button>
          </div>

          {/* Success Card */}
          {deployedUrl && (
            <div style={{
              background: "rgba(236,253,245,0.9)",
              backdropFilter: "blur(20px)",
              borderRadius: 18, padding: 18,
              border: "1.5px solid rgba(16,185,129,0.3)",
              boxShadow: "0 4px 20px rgba(16,185,129,0.12)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>✅ Deployed Successfully</div>
              <a href={deployedUrl} target="_blank" rel="noreferrer" style={{
                color: "#047857", fontSize: 12, wordBreak: "break-all",
                fontWeight: 600, textDecoration: "none", display: "block", marginBottom: 12,
              }}>{deployedUrl}</a>
              <a href={deployedUrl} target="_blank" rel="noreferrer" style={{
                display: "inline-block", padding: "8px 16px",
                background: "linear-gradient(135deg,#059669,#10b981)",
                color: "#fff", borderRadius: 9, fontSize: 12,
                fontWeight: 700, textDecoration: "none",
                boxShadow: "0 2px 10px rgba(16,185,129,0.3)",
              }}>Open Live Site →</a>
            </div>
          )}

          {/* Steps Card */}
          <div style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(20px)",
            borderRadius: 18, padding: 18,
            border: "1px solid rgba(255,255,255,0.85)",
            boxShadow: "0 4px 16px rgba(99,102,241,0.06)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#4338ca", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1.2 }}>
              🧠 Agent Workflow
            </div>
            <div style={{ position: "relative" }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < steps.length - 1 ? 14 : 0, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))",
                      border: "1px solid rgba(99,102,241,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, flexShrink: 0,
                    }}>{s.icon}</div>
                    {i < steps.length - 1 && (
                      <div style={{ width: 1, height: 14, background: "rgba(99,102,241,0.15)", marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e1b4b" }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — AGENT LOG ── */}
        <div style={{
          display: "flex", flexDirection: "column",
          background: "rgba(255,255,255,0.45)",
          backdropFilter: "blur(20px)",
          overflow: "hidden",
        }}>
          {/* Log Header */}
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.7)",
            background: "rgba(255,255,255,0.55)",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: loading ? "#10b981" : "#d1d5db",
              boxShadow: loading ? "0 0 10px #10b981" : "none",
              transition: "all 0.3s",
            }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#4338ca", textTransform: "uppercase", letterSpacing: 1.2 }}>
              Agent Log
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
              {logs.length > 0 ? `${logs.length} events` : "Waiting..."}
            </span>
          </div>

          {/* Log Body */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "20px 24px",
          }}>
            {logs.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5 }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>🤖</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}>Agent is ready</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>Fill in the config and click Deploy</div>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{
                  marginBottom: 8, padding: "10px 14px",
                  borderRadius: 12, fontSize: 12.5, lineHeight: 1.5,
                  background:
                    log.type === "error"   ? "rgba(254,226,226,0.7)" :
                    log.type === "success" ? "rgba(209,250,229,0.7)" :
                    log.type === "tool"    ? "rgba(224,231,255,0.7)" :
                    log.type === "done"    ? "rgba(254,243,199,0.7)" :
                    log.type === "url"     ? "rgba(237,233,254,0.7)" :
                    "rgba(255,255,255,0.6)",
                  border:
                    log.type === "error"   ? "1px solid rgba(252,165,165,0.5)" :
                    log.type === "success" ? "1px solid rgba(110,231,183,0.5)" :
                    log.type === "tool"    ? "1px solid rgba(165,180,252,0.5)" :
                    log.type === "done"    ? "1px solid rgba(253,230,138,0.5)" :
                    log.type === "url"     ? "1px solid rgba(196,181,253,0.5)" :
                    "1px solid rgba(229,231,235,0.4)",
                  backdropFilter: "blur(8px)",
                }}>
                  <span style={{ color: "#9ca3af", fontSize: 10, marginRight: 6 }}>[{log.time}]</span>
                  <span style={{
                    color:
                      log.type === "tool"    ? "#4338ca" :
                      log.type === "success" ? "#065f46" :
                      log.type === "error"   ? "#991b1b" :
                      log.type === "url"     ? "#5b21b6" :
                      log.type === "done"    ? "#92400e" : "#374151",
                    fontWeight: log.type !== "log" ? 600 : 400,
                  }}>
                    {log.type === "tool"    ? "⚙️ " :
                     log.type === "success" ? "✅ " :
                     log.type === "error"   ? "❌ " :
                     log.type === "url"     ? "🔗 " :
                     log.type === "done"    ? "🏁 " : "📝 "}
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
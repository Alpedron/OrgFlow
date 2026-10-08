import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { askOrgFlow, createTasks, getOrgHistory } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const box = (bg, border, accent) => ({
  background: bg,
  border: `1px solid ${border}`,
  borderLeft: `3px solid ${accent}`,
  borderRadius: "var(--radius-sm)",
  padding: "12px 14px",
});
const boxTitle = (color) => ({
  marginBottom: 8, color, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.4px",
});
const listStyle = { paddingLeft: 18, fontSize: "0.875rem", lineHeight: 1.65 };

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

export default function PassTheTorch() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [planError, setPlanError] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    getOrgHistory().then(setHistory).catch((err) => setHistoryError(err.message));
  }, []);

  const stats = history?.stats || { eventsCompleted: "–", lessonsRecorded: "–", resourcesAvailable: "–" };
  const wrapUps = history?.wrapUps || [];
  const w = wrapUps[selected];

  // Turn the AI's recommended actions into real tasks, then open the task list
  async function createPlan() {
    const actions = response?.actions || [];
    if (actions.length === 0) {
      navigate("/events");
      return;
    }
    setPlanError("");
    setCreating(true);
    try {
      await createTasks(actions.map((a) => ({
        title: a.title,
        category: a.category || "Planning",
        priority: (a.priority || "medium").toLowerCase(),
      })));
      navigate("/tasks");
    } catch (err) {
      setPlanError(`Couldn't create the plan: ${err.message}`);
      setCreating(false);
    }
  }

  async function handleQuery(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await askOrgFlow(query);
      setResponse(res);
    } catch {
      setResponse({ summary: "Could not reach OrgFlow right now. Please try again.", actions: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Page header */}
      <div style={{ marginBottom: 6 }}>
        <h1>🔥 Pass the Torch</h1>
        <p className="muted" style={{ marginTop: 3, fontSize: "0.85rem" }}>
          Preserve your organization's institutional knowledge for future officers.
        </p>
      </div>

      <div style={{ marginBottom: 24, borderBottom: "1px solid var(--color-border-light)", paddingBottom: 20 }} />

      {/* Stats row — this club's real records, kept across leadership changes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Events Completed",    value: stats.eventsCompleted },
          { label: "Lessons Recorded",    value: stats.lessonsRecorded },
          { label: "Resources Available", value: stats.resourcesAvailable },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ textAlign: "center", padding: "22px 16px" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--color-secondary)", lineHeight: 1 }}>
              {value}
            </div>
            <div className="muted" style={{ fontSize: "0.78rem", marginTop: 6, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {historyError && <p className="form-error" style={{ marginBottom: 20 }}>Couldn't load your organization's history: {historyError}</p>}

      {/* No handoff notes yet */}
      {history && wrapUps.length === 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2>📖 No handoff notes yet</h2>
          <p className="muted" style={{ fontSize: "0.88rem", marginTop: 8, lineHeight: 1.6 }}>
            When an event is over, open the <Link to="/events">Event Planner</Link> and click <strong>Wrap up</strong> to
            record attendance, spending, what worked and what to do differently. Everything you record is saved
            to <strong>{user?.org?.name || "your organization"}</strong> and shows up here for future officers.
          </p>
          {user?.org?.join_code && (
            <p className="muted" style={{ fontSize: "0.88rem", marginTop: 10, lineHeight: 1.6 }}>
              When you hand off, give your successor the invite code <code style={{ fontWeight: 700, color: "var(--brand-dark)" }}>{user.org.join_code}</code> so
              they join this organization instead of starting a new one.
            </p>
          )}
        </div>
      )}

      {/* Wrap-up from a previous event */}
      {w && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <h2>📖 {w.event_name}</h2>
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: 3 }}>
                {[
                  formatDate(w.event_date),
                  w.actual_attendance != null &&
                    `Attendance: ${w.actual_attendance}${w.expected_attendance != null ? ` (expected ${w.expected_attendance})` : ""}`,
                  w.actual_spending != null &&
                    `Spent: $${w.actual_spending}${w.budget != null ? ` of $${w.budget}` : ""}`,
                  w.recorded_by && `Recorded by ${w.recorded_by}`,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
            {wrapUps.length > 1 && (
              <select
                className="select"
                style={{ width: "auto", maxWidth: 240 }}
                value={selected}
                onChange={(e) => setSelected(Number(e.target.value))}
                aria-label="Choose a past event"
              >
                {wrapUps.map((x, i) => (
                  <option key={x.id} value={i}>{x.event_name}{x.event_date ? ` — ${formatDate(x.event_date)}` : ""}</option>
                ))}
              </select>
            )}
          </div>

          {(w.what_worked.length > 0 || w.what_went_wrong.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={box("#f0fdf4", "#bbf7d0", "#22c55e")}>
                <h4 style={boxTitle("var(--color-success)")}>✓ What Worked</h4>
                {w.what_worked.length
                  ? <ul style={listStyle}>{w.what_worked.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  : <p className="muted" style={{ fontSize: "0.85rem" }}>Nothing recorded.</p>}
              </div>
              <div style={box("#fef2f2", "#fecaca", "#ef4444")}>
                <h4 style={boxTitle("var(--color-danger)")}>✗ Challenges</h4>
                {w.what_went_wrong.length
                  ? <ul style={listStyle}>{w.what_went_wrong.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  : <p className="muted" style={{ fontSize: "0.85rem" }}>Nothing recorded.</p>}
              </div>
            </div>
          )}

          {w.recommendations.length > 0 && (
            <div style={{ ...box("#fffbeb", "#fde68a", "#f59e0b"), marginTop: 16 }}>
              <h4 style={boxTitle("var(--color-warning)")}>💡 Officer Recommendations</h4>
              <ul style={listStyle}>{w.recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* Ask Previous Leadership */}
      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <h2>Ask Previous Leadership</h2>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: 4, lineHeight: 1.6 }}>
            Ask a question and OrgFlow will answer using the wrap-ups and documents past officers left behind.
          </p>
        </div>

        <form onSubmit={handleQuery} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            className="input"
            type="text"
            placeholder="What should I know before planning the Student Organization Fair again?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button className="btn btn-primary" type="submit" disabled={loading || !query.trim()}>
            {loading ? "…" : "Ask →"}
          </button>
        </form>

        {response && (
          <div>
            {response.summary && (
              <p style={{ fontSize: "0.9rem", marginBottom: 14, lineHeight: 1.7 }}>{response.summary}</p>
            )}
            {response.actions && response.actions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {response.actions.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-light)",
                      borderRadius: "var(--radius-sm)",
                      padding: "10px 14px",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <strong style={{ fontSize: "0.875rem" }}>{a.title}</strong>
                    {a.reason && <p className="muted" style={{ fontSize: "0.8rem", marginTop: 3 }}>{a.reason}</p>}
                  </div>
                ))}
              </div>
            )}
            {response.sources?.some((src) => src.type === "history") && (
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }} className="muted">
                  📚 From your organization's past wrap-ups
                </h4>
                {response.sources.filter((src) => src.type === "history").map((src, i) => (
                  <div key={i} style={{ fontSize: "0.85rem", marginBottom: 6, lineHeight: 1.5 }}>
                    <strong>{src.title}</strong>
                    <span className="muted"> — {src.summary}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={createPlan} disabled={creating}>
              {creating ? "Creating…" : "Create This Year's Plan →"}
            </button>
            {planError && <p className="form-error">{planError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

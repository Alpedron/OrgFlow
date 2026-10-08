import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { askOrgFlow, createTask, createTasks, getEvents, getChatHistory, clearChatHistory, openDocument } from "../services/api.js";
import "./AskOrgFlow.css";

// "05_MCC_Event_and_Room_Reservation_Guide.pdf" → "MCC Event and Room Reservation Guide"
function prettyDocName(name) {
  return String(name || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^\d+[_\- ]*/, "")
    .replace(/_/g, " ");
}

// Older answers wrote "This is general advice…" into every reason; show a tag instead
const GENERAL_PREFIX = /^\s*this is general advice[^.]*\.\s*/i;
function splitGeneral(action) {
  const reason = action.reason || "";
  const legacy = GENERAL_PREFIX.test(reason);
  return { general: Boolean(action.general) || legacy, reason: reason.replace(GENERAL_PREFIX, "") };
}

function priorityClass(p) {
  if (!p) return "";
  return `badge badge-${p.toLowerCase()}`;
}

export default function AskOrgFlow() {
  const location = useLocation();
  const [message, setMessage] = useState(
    location.state?.initialMessage || ""
  );
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [targetEvent, setTargetEvent] = useState({}); // response index -> event id
  const [added, setAdded] = useState({});             // "i-j" -> true once saved as a task
  const [addStatus, setAddStatus] = useState({});     // response index -> message

  useEffect(() => {
    getEvents().then(setEvents).catch(() => {});
  }, []);

  // Load the saved conversation, then send anything forwarded from the dashboard
  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    getChatHistory()
      .then(({ messages }) => setHistory(messages || []))
      .catch(() => {})
      .finally(() => {
        setHistoryLoaded(true);
        if (location.state?.initialMessage) {
          handleSubmit(null, location.state.initialMessage);
          window.history.replaceState({}, ""); // don't re-send it on refresh
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the newest message in view
  useEffect(() => {
    const el = document.querySelector(".ask-conversation");
    if (el) el.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history.length, loading]);

  async function startNewConversation() {
    if (history.length && !window.confirm("Start a new conversation? The current one will be cleared.")) return;
    try {
      await clearChatHistory();
    } catch {
      /* clear locally anyway */
    }
    setHistory([]);
    setAdded({});
    setAddStatus({});
    setTargetEvent({});
  }

  async function handleSubmit(e, overrideMessage) {
    if (e) e.preventDefault();
    const text = (overrideMessage || message).trim();
    if (!text) return;

    const userEntry = { role: "user", text };
    setHistory((h) => [...h, userEntry]);
    setMessage("");
    setLoading(true);

    try {
      const response = await askOrgFlow(text);
      setHistory((h) => [...h, { role: "assistant", ...response }]);
    } catch {
      setHistory((h) => [
        ...h,
        { role: "error", text: "OrgFlow couldn't answer just now. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const toTask = (action, eventId) => ({
    title: action.title,
    category: action.category || null,
    priority: (action.priority || "medium").toLowerCase(),
    event_id: eventId || null,
  });

  async function addOneTask(i, j, action) {
    try {
      await createTask(toTask(action, targetEvent[i]));
      setAdded((a) => ({ ...a, [`${i}-${j}`]: true }));
    } catch (err) {
      setAddStatus((s) => ({ ...s, [i]: `Couldn't add task: ${err.message}` }));
    }
  }

  async function addAllToEventPlan(i, actions) {
    const pending = actions.filter((_, j) => !added[`${i}-${j}`]);
    if (pending.length === 0) return;
    try {
      await createTasks(pending.map((a) => toTask(a)), targetEvent[i]);
      setAdded((a) => {
        const next = { ...a };
        actions.forEach((_, j) => { next[`${i}-${j}`] = true; });
        return next;
      });
      const evName = events.find((e) => e.id === targetEvent[i])?.name;
      setAddStatus((s) => ({
        ...s,
        [i]: `Added ${pending.length} task${pending.length === 1 ? "" : "s"}${evName ? ` to ${evName}` : ""}.`,
      }));
    } catch (err) {
      setAddStatus((s) => ({ ...s, [i]: `Couldn't add tasks: ${err.message}` }));
    }
  }

  return (
    <div className="ask-page">
      <div className="ask-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1>✦ Ask OrgFlow</h1>
          <p className="muted">
            Describe what you are trying to accomplish and OrgFlow will generate
            an actionable plan. Your conversation is saved, so you can come back to it.
          </p>
        </div>
        {history.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={startNewConversation} disabled={loading} style={{ whiteSpace: "nowrap" }}>
            + New conversation
          </button>
        )}
      </div>

      <div className="ask-conversation">
        {historyLoaded && history.length === 0 && (
          <div className="ask-empty">
            <p>Ask a question to get started. For example:</p>
            <ul>
              <li>"We want to hold a movie night and request funding. Where do I start?"</li>
              <li>"Has our organization held a club fair before?"</li>
              <li>"What should a new Treasurer know?"</li>
            </ul>
          </div>
        )}

        {history.map((entry, i) => {
          if (entry.role === "user") {
            return (
              <div key={i} className="message message--user">
                <span className="message-bubble">{entry.text}</span>
              </div>
            );
          }

          if (entry.role === "error") {
            return (
              <div key={i} className="message message--error">
                {entry.text}
              </div>
            );
          }

          // Assistant structured response
          const docs = (entry.sources || []).filter((src) => src.type === "document");
          const pastWrapUps = (entry.sources || []).filter((src) => src.type === "history");
          const otherSources = (entry.sources || []).filter((src) => src.type !== "document" && src.type !== "history");
          const uniqueOtherSources = [...new Map(otherSources.map((src) => [src.title, src])).values()];
          const allAdded = entry.actions?.length > 0 && entry.actions.every((_, j) => added[`${i}-${j}`]);
          return (
            <div key={i} className="message message--assistant answer">
              {entry.summary && (
                <div className="answer-summary">
                  <span className="answer-icon" aria-hidden>✦</span>
                  <p>{entry.summary}</p>
                </div>
              )}

              {entry.actions && entry.actions.length > 0 && (
                <section className="plan">
                  <div className="plan-head">
                    <h3>Suggested plan · {entry.actions.length} step{entry.actions.length === 1 ? "" : "s"}</h3>
                    <div className="plan-controls">
                      {events.length > 0 && (
                        <select
                          className="select plan-event"
                          value={targetEvent[i] || ""}
                          onChange={(e) => setTargetEvent((t) => ({ ...t, [i]: e.target.value }))}
                          aria-label="Add tasks to which event"
                        >
                          <option value="">No specific event</option>
                          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                        </select>
                      )}
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={allAdded}
                        onClick={() => addAllToEventPlan(i, entry.actions)}
                      >
                        {allAdded ? "✓ All added" : "Add all as tasks"}
                      </button>
                    </div>
                  </div>

                  <ol className="plan-steps">
                    {entry.actions.map((action, j) => {
                      const { general, reason } = splitGeneral(action);
                      return (
                      <li key={j} className={`plan-step ${added[`${i}-${j}`] ? "plan-step--added" : ""}`}>
                        <span className="plan-num">{j + 1}</span>
                        <div className="plan-body">
                          <div className="plan-title-row">
                            <span className="plan-title">{action.title}</span>
                            {action.priority && (
                              <span className={priorityClass(action.priority)}>{action.priority}</span>
                            )}
                            {action.category && <span className="plan-cat">{action.category}</span>}
                            {general && (
                              <span className="plan-general" title="Not from your organization's documents or records">
                                General tip
                              </span>
                            )}
                          </div>
                          {reason && <p className="plan-reason">{reason}</p>}
                        </div>
                        <button
                          className="plan-add"
                          disabled={added[`${i}-${j}`]}
                          onClick={() => addOneTask(i, j, action)}
                        >
                          {added[`${i}-${j}`] ? "✓ Added" : "+ Add task"}
                        </button>
                      </li>
                      );
                    })}
                  </ol>

                  {addStatus[i] && (
                    <p className="plan-status">
                      {addStatus[i]} <Link to="/tasks">View tasks →</Link>
                    </p>
                  )}
                </section>
              )}

              {pastWrapUps.length > 0 && (
                <section className="answer-sources">
                  <h4>From your club's past wrap-ups</h4>
                  {pastWrapUps.map((src, k) => (
                    <p key={k} className="wrapup-source">
                      <strong>{src.title}</strong>
                      {src.summary && <span> — {src.summary}</span>}
                    </p>
                  ))}
                </section>
              )}

              {(docs.length > 0 || otherSources.length > 0) && (
                <section className="answer-sources">
                  <h4>Sources</h4>
                  <div className="doc-chips">
                    {docs.map((src, k) => (
                      <button
                        key={k}
                        type="button"
                        className="doc-chip"
                        title={`Open ${src.title}`}
                        onClick={() => openDocument(src.title).catch((err) => alert(err.message))}
                      >
                        📄 {prettyDocName(src.title)}
                      </button>
                    ))}
                    {uniqueOtherSources.map((src, k) => (
                      <span key={`o${k}`} className="doc-chip doc-chip--plain" title={src.summary || ""}>
                        {src.title}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="message message--loading">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        )}
      </div>

      <form className="ask-input-row" onSubmit={handleSubmit}>
        <input
          className="input"
          type="text"
          placeholder="Ask a question or describe your situation…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading || !message.trim()}
        >
          {loading ? "Thinking…" : "Ask →"}
        </button>
      </form>
    </div>
  );
}

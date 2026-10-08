import { useState, useEffect } from "react";
import { Pencil, Trash2, ClipboardCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { getEvents, deleteEvent } from "../services/api.js";
import EventForm from "../components/EventForm.jsx";
import WrapUpForm from "../components/WrapUpForm.jsx";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  // null = closed, {} = new, event = edit. "?new=1" opens the new-event form.
  const [editing, setEditing] = useState(searchParams.get("new") ? {} : null);
  const [wrapping, setWrapping] = useState(null);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(saved) {
    setEvents((list) => {
      const exists = list.some((e) => e.id === saved.id);
      const next = exists ? list.map((e) => (e.id === saved.id ? saved : e)) : [...list, saved];
      return next.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    });
  }

  async function handleDelete(evt) {
    if (!window.confirm(`Delete "${evt.name}"? Its tasks will be kept but unlinked from the event.`)) return;
    try {
      await deleteEvent(evt.id);
      setEvents((list) => list.filter((e) => e.id !== evt.id));
    } catch (err) {
      alert(`Couldn't delete the event: ${err.message}`);
    }
  }

  const details = (evt) =>
    [
      formatDate(evt.event_date),
      evt.location,
      evt.expected_attendance != null ? `${evt.expected_attendance} expected` : null,
    ].filter(Boolean).join(" · ");

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Page header */}
      <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
        <div>
          <h1>Event Planner</h1>
          <p className="muted" style={{ marginTop: 3, fontSize: "0.85rem" }}>
            Plan, track, and wrap up your organization's events.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ New Event</button>
      </div>

      <div style={{ marginBottom: 20, borderBottom: "1px solid var(--color-border-light)", paddingBottom: 20 }} />

      {error && <p className="form-error" style={{ marginBottom: 16 }}>Couldn't load events: {error}</p>}
      {loading && <p className="muted">Loading events…</p>}

      {!loading && !error && events.length === 0 && (
        <div className="empty-box">
          <p>No events yet. Create your first one to start planning.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ New Event</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", transition: "box-shadow 0.12s" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-md)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}
          >
            <div style={{ flex: 1 }}>
              <h3>{evt.name}</h3>
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: 3 }}>{details(evt)}</p>
              {evt.description && (
                <p style={{ fontSize: "0.85rem", marginTop: 5, color: "var(--color-text)", lineHeight: 1.5 }}>
                  {evt.description}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-2" style={{ minWidth: 110, textAlign: "right", paddingLeft: 16 }}>
              <span className={`badge badge-${evt.status}`}>{evt.status}</span>
              {evt.budget != null && (
                <span className="muted" style={{ fontSize: "0.78rem" }}>${evt.budget} budget</span>
              )}
              {evt.status !== "completed" && (
                <button className="btn btn-secondary btn-xs" onClick={() => setWrapping(evt)} title="Record how it went for future officers">
                  <ClipboardCheck size={12} /> Wrap up
                </button>
              )}
              <div className="flex gap-1">
                <button className="icon-btn" title="Edit" onClick={() => setEditing(evt)} style={{ color: "var(--color-muted)" }}>
                  <Pencil size={14} />
                </button>
                <button className="icon-btn" title="Delete" onClick={() => handleDelete(evt)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {wrapping && (
        <WrapUpForm event={wrapping} onClose={() => setWrapping(null)} onSaved={handleSaved} />
      )}

      {editing && (
        <EventForm
          event={editing.id ? editing : null}
          onClose={() => { setEditing(null); if (searchParams.get("new")) setSearchParams({}); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

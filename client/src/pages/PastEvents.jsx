import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, X } from "lucide-react";
import { Link } from "react-router-dom";
import { getPastPublicEvents } from "../services/api.js";
import "./Landing.css";

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
}

function formatMeta(event) {
  const time = event.event_date
    ? new Date(event.event_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  return [time, event.location].filter(Boolean).join(" · ") || "Event details";
}

function getAcademicGroup(event) {
  const date = new Date(event.event_date);
  if (Number.isNaN(date.getTime())) {
    return { key: "other", label: "Other events", sortDate: 0 };
  }

  const month = date.getMonth();
  const year = date.getFullYear();
  const season = month >= 7 && month <= 11
    ? "Fall"
    : month <= 4
      ? "Winter"
      : "Summer";
  const academicStart = season === "Winter" ? year - 1 : year;

  return {
    key: `${academicStart}-${season}`,
    label: `${season} ${academicStart}–${String(academicStart + 1).slice(-2)}`,
    sortDate: date.getTime(),
  };
}

function groupEvents(events) {
  const groups = new Map();

  events.forEach((event) => {
    const group = getAcademicGroup(event);
    if (!groups.has(group.key)) {
      groups.set(group.key, { ...group, events: [] });
    }
    groups.get(group.key).events.push(event);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      events: group.events.sort(
        (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
      ),
    }))
    .sort((a, b) => b.sortDate - a.sortDate);
}

export default function PastEvents() {
  const [events, setEvents] = useState([]);
  const [selectedPoster, setSelectedPoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPastPublicEvents()
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPoster) return undefined;
    const closeOnEscape = (event) => event.key === "Escape" && setSelectedPoster(null);
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedPoster]);

  const eventGroups = groupEvents(events);

  return (
    <main className="landing past-events-page">
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="Back to OrgFlow home">
          <span className="landing-brand-mark" aria-hidden="true">SG</span>
          <span><strong>OrgFlow</strong><small>CONNECT · ENGAGE · BELONG</small></span>
        </Link>
        <Link className="past-events-back" to="/"><ArrowLeft size={16} /> Back to main website</Link>
      </header>

      <section className="past-events-hero">
        <p className="landing-kicker">Our community archive</p>
        <h1>Past events</h1>
        <p>Look back at the events and moments that brought our campus organizations together.</p>
      </section>

      <section className="past-events-content">
        {loading && <p className="muted">Loading past events…</p>}
        {error && <p className="form-error">Couldn&apos;t load past events: {error}</p>}
        {!loading && !error && !events.length && (
          <div className="past-events-empty">
            <h2>No past events yet</h2>
            <p>Completed public events will appear here after they are approved.</p>
          </div>
        )}
        {eventGroups.map((group) => (
          <section className="past-events-group" key={group.key} aria-labelledby={`${group.key}-heading`}>
            <h2 className="past-events-divider" id={`${group.key}-heading`}>
              <span>{group.label}</span>
            </h2>
            <div className="past-events-grid">
              {group.events.map((event) => (
                <article className="landing-event-card" key={event.id}>
                  <button
                    type="button"
                    className="landing-event-poster"
                    onClick={() => event.image && setSelectedPoster(event)}
                    disabled={!event.image}
                    aria-label={event.image ? `View full poster for ${event.name}` : undefined}
                  >
                    <div className="landing-event-image" style={{ backgroundImage: event.image ? `url("${event.image}")` : undefined }}>
                      <span className="landing-event-pill">{event.organization_name}</span>
                      <span className="landing-event-date">{formatDate(event.event_date)}</span>
                      <div className="landing-event-overlay">
                        <p>Past event</p>
                        <h2>{event.name}</h2>
                      </div>
                    </div>
                  </button>
                  <div className="landing-event-meta"><Clock3 size={16} /><span>{formatMeta(event)}</span></div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>

      {selectedPoster && (
        <div
          className="landing-poster-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Full poster for ${selectedPoster.name}`}
          onMouseDown={(event) => event.target === event.currentTarget && setSelectedPoster(null)}
        >
          <button type="button" className="landing-poster-close" onClick={() => setSelectedPoster(null)} aria-label="Close poster">
            <X size={24} />
          </button>
          <img src={selectedPoster.image} alt={`Full poster for ${selectedPoster.name}`} />
        </div>
      )}
    </main>
  );
}

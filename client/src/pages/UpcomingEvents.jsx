import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import PublicFooter from "../components/PublicFooter.jsx";
import PublicHeader from "../components/PublicHeader.jsx";
import { getUpcomingPublicEvents } from "../services/api.js";
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

export default function UpcomingEvents() {
  const [events, setEvents] = useState([]);
  const [selectedPoster, setSelectedPoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getUpcomingPublicEvents()
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

  return (
    <main className="landing past-events-page">
      <PublicHeader />
      <section className="past-events-hero">
        <div className="past-events-hero-topline">
          <p className="landing-kicker">Student organization calendar</p>
          <Link className="past-events-back" to="/">
            <ArrowLeft size={16} /> Back to main website
          </Link>
        </div>
        <h1>All upcoming events</h1>
        <p className="past-events-description">Browse every approved public event currently coming up across campus.</p>
      </section>
      <section className="past-events-content">
        {loading && <p className="muted">Loading upcoming events…</p>}
        {error && <p className="form-error">Couldn&apos;t load upcoming events: {error}</p>}
        {!loading && !error && !events.length && (
          <div className="past-events-empty">
            <h2>No upcoming events yet</h2>
            <p>Approved organization events will appear here.</p>
          </div>
        )}
        {!loading && !error && events.length > 0 && (
          <div className="past-events-grid">
            {events.map((event) => (
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
                      <p>Upcoming event</p>
                      <h2>{event.name}</h2>
                    </div>
                  </div>
                </button>
                <div className="landing-event-meta"><Clock3 size={16} /><span>{formatMeta(event)}</span></div>
                {event.external_link && (
                  <a className="landing-event-link" href={event.external_link} target="_blank" rel="noreferrer">
                    Event link <ExternalLink size={14} />
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {selectedPoster && (
        <div className="landing-poster-modal" role="dialog" aria-modal="true" aria-label={`Full poster for ${selectedPoster.name}`} onMouseDown={(event) => event.target === event.currentTarget && setSelectedPoster(null)}>
          <button type="button" className="landing-poster-close" onClick={() => setSelectedPoster(null)} aria-label="Close poster"><X size={24} /></button>
          <img src={selectedPoster.image} alt={`Full poster for ${selectedPoster.name}`} />
        </div>
      )}
      <PublicFooter />
    </main>
  );
}

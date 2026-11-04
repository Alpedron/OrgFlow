import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  ExternalLink,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import "./Landing.css";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";
import { getPublicLanding } from "../services/api.js";

const EVENTS = [
  {
    label: "Featured",
    date: "May 03",
    title: "OrgFlow Spring Summit",
    meta: "11:00 AM–4:00 PM · Student Center",
    image:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80",
  },
  {
    label: "This week",
    date: "May 09",
    title: "Student Leaders Forum",
    meta: "3:30–5:00 PM · Library Commons",
    image:
      "https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1200&q=80",
  },
];

const FEATURES = [
  { Icon: CalendarDays, title: "Bring plans together", text: "Keep meetings, events, and deadlines visible to the people who make them happen." },
  { Icon: Users, title: "Connect your community", text: "Give every club and organization one welcoming place to share what is happening." },
  { Icon: Sparkles, title: "Build what lasts", text: "Capture the knowledge behind the work so every new team can start with momentum." },
];

function formatEventDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function publicEventCard(event) {
  return {
    label: event.organization_name || "Organization",
    date: formatEventDate(event.event_date) || event.date,
    title: event.name || event.title,
    meta: [event.event_date && new Date(event.event_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), event.location]
      .filter(Boolean)
      .join(" · ") || event.meta,
    image: event.image || event.image_url || "",
    external_link: event.external_link || "",
  };
}

function isExternalLink(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export default function Landing() {
  const [content, setContent] = useState(null);
  const [selectedPoster, setSelectedPoster] = useState(null);

  useEffect(() => {
    getPublicLanding().then((data) => {
      const saved = data.content || data;
      setContent({
        ...saved,
        events: Array.isArray(saved.events) && saved.events.length ? saved.events : EVENTS,
        organizationEvents: (data.events || []).map(publicEventCard),
      });
    }).catch(() => {
      // The local defaults keep the public page useful while the API is unavailable.
    });
  }, []);

  useEffect(() => {
    if (!selectedPoster) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedPoster(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedPoster]);

  const landingContent = content || {
    eyebrow: "What's happening",
    kicker: "Oakland Community College",
    headline: "November events",
    description: "Stay in the loop with organization announcements, campus events, volunteer opportunities, and everything in between.",
    events: EVENTS,
    organizationEvents: [],
  };

  return (
    <main className="landing">
      <PublicHeader />

      <section className="landing-hero" id="announcements">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow">{landingContent.eyebrow}</div>
          <p className="landing-kicker">{landingContent.kicker}</p>
          <h1>{landingContent.headline}</h1>
          <p className="landing-hero-description">
            {landingContent.description}
          </p>
          <a className="landing-yellow-button" href="#events">
            See what&apos;s coming up <ArrowRight size={17} />
          </a>
        </div>

        <div className="landing-event-track" id="events">
          {landingContent.events.map((event, index) => (
            <article className="landing-event-card" key={`${event.title}-${index}`}>
              <button
                type="button"
                className="landing-event-poster"
                onClick={() => event.image && setSelectedPoster(event)}
                disabled={!event.image}
                aria-label={event.image ? `View full poster for ${event.title}` : undefined}
              >
                <div
                  className="landing-event-image"
                  style={{ backgroundImage: `url("${event.image}")` }}
                >
                <span className="landing-event-pill">{event.label}</span>
                <span className="landing-event-date">{event.date}</span>
                <div className="landing-event-overlay">
                  <p>Campus event</p>
                  <h2>{event.title}</h2>
                </div>
                </div>
              </button>
              <div className="landing-event-meta">
                <Clock3 size={16} />
                <span>{event.meta}</span>
              </div>
              {isExternalLink(event.external_link) && (
                <a className="landing-event-link" href={event.external_link} target="_blank" rel="noreferrer">
                  Event link <ExternalLink size={14} />
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      {landingContent.organizationEvents.length > 0 && (
        <section className="landing-org-events" aria-labelledby="org-events-heading">
          <div className="landing-section-heading">
            <div>
              <p className="landing-kicker">From student organizations/clubs</p>
              <h2 id="org-events-heading">What&apos;s coming up across campus.</h2>
            </div>
            <span className="landing-org-events-note">Approved organization listings</span>
          </div>
          <div className="landing-org-events-grid">
            {landingContent.organizationEvents.map((event, index) => (
              <article className="landing-event-card" key={`${event.title}-${index}`}>
                <button
                  type="button"
                  className="landing-event-poster"
                  onClick={() => event.image && setSelectedPoster(event)}
                  disabled={!event.image}
                  aria-label={event.image ? `View full poster for ${event.title}` : undefined}
                >
                  <div
                    className="landing-event-image"
                    style={{ backgroundImage: event.image ? `url("${event.image}")` : undefined }}
                  >
                  <span className="landing-event-pill">{event.label}</span>
                  <span className="landing-event-date">{event.date}</span>
                  <div className="landing-event-overlay">
                    <p>Campus event</p>
                    <h2>{event.title}</h2>
                  </div>
                  </div>
                </button>
                <div className="landing-event-meta">
                  <Clock3 size={16} />
                  <span>{event.meta}</span>
                </div>
                {isExternalLink(event.external_link) && (
                  <a className="landing-event-link" href={event.external_link} target="_blank" rel="noreferrer">
                    Event link <ExternalLink size={14} />
                  </a>
                )}
              </article>
            ))}
          </div>
          <div className="landing-org-event-links">
            <Link to="/upcoming-events">
              View all upcoming events <ArrowRight size={16} />
            </Link>
            <Link to="/past-events">
              View past organization events <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {selectedPoster && (
        <div
          className="landing-poster-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Full poster for ${selectedPoster.title}`}
          onMouseDown={(event) => event.target === event.currentTarget && setSelectedPoster(null)}
        >
          <button
            type="button"
            className="landing-poster-close"
            onClick={() => setSelectedPoster(null)}
            aria-label="Close poster"
          >
            <X size={24} />
          </button>
          <img src={selectedPoster.image} alt={`Full poster for ${selectedPoster.title}`} />
        </div>
      )}

      <section className="landing-announcements" id="organizations">
        <div className="landing-section-heading">
          <div>
            <p className="landing-kicker">Around the community</p>
            <h2>There&apos;s always something to be part of.</h2>
          </div>
          <a href="#about">Explore OrgFlow <ArrowUpRight size={17} /></a>
        </div>
        <div className="landing-feature-grid">
          {FEATURES.map(({ Icon, title, text }) => (
            <article className="landing-feature" key={title}>
              <span className="landing-feature-icon"><Icon size={21} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-about" id="about">
        <div>
          <p className="landing-kicker">About OrgFlow</p>
          <h2>Connecting students to organizations/clubs</h2>
        </div>
        <p>
          OrgFlow helps student organizations move from scattered messages to
          shared momentum. Discover what&apos;s happening, find your people, and
          use the workspace to keep your organization moving forward.
        </p>
        <Link className="landing-outline-button" to="/login?mode=register">
          Start your organization <ArrowRight size={16} />
        </Link>
      </section>

      <PublicFooter />
    </main>
  );
}

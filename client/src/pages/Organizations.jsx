import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import PublicFooter from "../components/PublicFooter.jsx";
import PublicHeader from "../components/PublicHeader.jsx";
import { getPublicOrganizations } from "../services/api.js";
import "./Landing.css";

export default function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicOrganizations()
      .then(setOrganizations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="landing past-events-page">
      <PublicHeader />
      <section className="past-events-hero">
        <div className="past-events-hero-topline">
          <p className="landing-kicker">Campus community</p>
          <Link className="past-events-back" to="/">
            <ArrowLeft size={16} /> Back to main website
          </Link>
        </div>
        <h1>Organizations &amp; clubs</h1>
        <p className="past-events-description">Explore the student organizations and clubs that make our campus community connected and active.</p>
      </section>
      <section className="organizations-content past-events-content">
        {loading && <p className="muted">Loading organizations…</p>}
        {error && <p className="form-error">Couldn&apos;t load organizations: {error}</p>}
        {!loading && !error && !organizations.length && (
          <div className="past-events-empty">
            <h2>Organizations are coming soon</h2>
            <p>The public directory has not been published yet.</p>
          </div>
        )}
        {!loading && !error && organizations.length > 0 && (
          <div className="organizations-grid">
            {organizations.map((organization) => (
              <details className="organization-card" key={organization.id || organization.name}>
                <summary className="organization-summary">
                  <span>{organization.name}</span>
                  <ChevronDown size={20} aria-hidden="true" />
                </summary>
                <div className="organization-details">
                  {organization.image && <img className="organization-image" src={organization.image} alt="" />}
                  <div className="organization-details-copy">
                    <p className="landing-kicker">{organization.type || "Student organization"}</p>
                    {organization.description && <div className="organization-description" dangerouslySetInnerHTML={{ __html: organization.description }} />}
                    {organization.advisor && <p><strong>Advisor:</strong> {organization.advisor}</p>}
                    {organization.contact && <p><strong>Contact:</strong> {organization.contact}</p>}
                    <div className="organization-links">
                      {(organization.links || []).map((link) => (
                        <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
        <div className="start-organization-callout">
          <h2>Interested in starting a club or organization?</h2>
          <Link className="btn btn-primary" to="/start-organization">Learn how to request one</Link>
        </div>
        <div className="start-organization-callout">
          <h2>Interested in joining a club?</h2>
          <Link className="btn btn-primary" to="/interest">Send an interest form</Link>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

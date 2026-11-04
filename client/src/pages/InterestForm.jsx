import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import PublicFooter from "../components/PublicFooter.jsx";
import PublicHeader from "../components/PublicHeader.jsx";
import { getPublicOrganizations, submitInterest } from "../services/api.js";
import "./Landing.css";

const initialForm = { name: "", student_email: "", contact_number: "", year: "", program: "", organization: "" };

export default function InterestForm() {
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicOrganizations().then(setOrganizations).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  function update(field) {
    return (event) => {
      const value = field === "contact_number"
        ? event.target.value.replace(/\D/g, "").slice(0, 10)
        : event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await submitInterest(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="landing past-events-page">
      <PublicHeader />
      <section className="past-events-hero">
        <div className="past-events-hero-topline">
          <p className="landing-kicker">Get involved</p>
          <Link className="past-events-back" to="/organizations"><ArrowLeft size={16} /> Back to organizations</Link>
        </div>
        <h1>Interested in joining a club?</h1>
        <p className="past-events-description">Send your information to the organization you are interested in. Its officers can follow up with you about meetings and next steps.</p>
      </section>
      <section className="start-organization-content interest-form-content">
        <section className="card interest-form-card">
          {submitted ? (
            <div className="form-success interest-success"><CheckCircle2 size={26} /><h2>Interest form sent</h2><p>The organization officers received your information and can contact you.</p><Link className="btn btn-secondary" to="/organizations">Return to organizations</Link></div>
          ) : (
            <form onSubmit={submit}>
              <h2>Student information</h2>
              <div className="form-grid">
                <label className="form-field"><span className="form-label">Name *</span><input className="input" value={form.name} onChange={update("name")} required /></label>
                <label className="form-field"><span className="form-label">Student email *</span><input className="input" type="email" value={form.student_email} onChange={update("student_email")} required /></label>
                <label className="form-field"><span className="form-label">Contact number *</span><input className="input" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" placeholder="2485550100" value={form.contact_number} onChange={update("contact_number")} required /><span className="muted" style={{ fontSize: ".76rem", marginTop: 5 }}>Enter 10 digits, including area code.</span></label>
                <label className="form-field"><span className="form-label">Year *</span><select className="select" value={form.year} onChange={update("year")} required><option value="">Select year</option><option>First year</option><option>Second year</option><option>Third year</option><option>Fourth year</option><option>Graduate</option><option>Other</option></select></label>
                <label className="form-field"><span className="form-label">Program *</span><input className="input" value={form.program} onChange={update("program")} required /></label>
                <label className="form-field"><span className="form-label">Club or organization *</span><select className="select" value={form.organization} onChange={update("organization")} required disabled={loading}><option value="">Select an organization</option>{organizations.map((organization) => <option key={organization.name} value={organization.name}>{organization.name}</option>)}</select></label>
              </div>
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-primary" type="submit" disabled={loading}>Send interest form</button>
            </form>
          )}
        </section>
      </section>
      <PublicFooter />
    </main>
  );
}

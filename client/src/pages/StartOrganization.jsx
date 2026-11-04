import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import PublicFooter from "../components/PublicFooter.jsx";
import PublicHeader from "../components/PublicHeader.jsx";
import { requestOrganization } from "../services/api.js";
import "./Landing.css";

const CHECKLIST = [
  "Review the OCC OWL Network handbook",
  "Recruit at least five students who want to join",
  "Identify a willing faculty or staff advisor",
  "Meet with your advisor and invite the Student Leadership Manager",
  "Create a regular semester meeting schedule",
  "Choose Student Organization or Student Club; Academic Student Associations are handled by the Provost and Academic Dean",
  "Define your group’s focus, purpose, and goals",
];

export default function StartOrganization() {
  const [checked, setChecked] = useState(() => JSON.parse(localStorage.getItem("orgflow-start-org-checklist") || "[]"));
  const [form, setForm] = useState({ name: "", type: "Student Organization", description: "", contact_email: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem("orgflow-start-org-checklist", JSON.stringify(checked));
  }, [checked]);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await requestOrganization(form);
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
          <p className="landing-kicker">Build something new</p>
          <Link className="past-events-back" to="/organizations"><ArrowLeft size={16} /> Back to organizations</Link>
        </div>
        <h1>Start an organization</h1>
        <p className="past-events-description">Use this checklist to work through the OCC registration process, then send your request to a Website Admin for review.</p>
      </section>
      <section className="start-organization-content">
        <div className="start-organization-grid">
          <section className="card start-organization-checklist">
            <h2>Your checklist</h2>
            <p className="muted">Your progress is saved in this browser so you can return to it later.</p>
            {CHECKLIST.map((item, index) => (
              <label className="start-organization-task" key={item}>
                <input type="checkbox" checked={checked.includes(index)} onChange={() => setChecked((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} />
                <span className={checked.includes(index) ? "is-complete" : ""}>{item}</span>
                {checked.includes(index) && <CheckCircle2 size={17} />}
              </label>
            ))}
            <a className="handbook-link" href="https://www.oaklandcc.edu/studentengagement/owl-network-handbook/" target="_blank" rel="noreferrer">Read the full OWL Network handbook <ExternalLink size={15} /></a>
          </section>
          <section className="card start-organization-form">
            <h2>Request an organization</h2>
            {submitted ? (
              <p className="form-success">Your request was sent. A Website Admin will review it before the organization can be listed or use the OrgFlow workspace.</p>
            ) : (
              <form onSubmit={submit}>
                <label className="form-field"><span className="form-label">Organization name *</span><input className="input" value={form.name} onChange={update("name")} required /></label>
                <label className="form-field"><span className="form-label">Type *</span><select className="select" value={form.type} onChange={update("type")}><option>Student Organization</option><option>Student Club</option><option>Academic Student Associations</option></select></label>
                <label className="form-field"><span className="form-label">Contact email *</span><input className="input" type="email" value={form.contact_email} onChange={update("contact_email")} required /></label>
                <label className="form-field"><span className="form-label">What is your organization about?</span><textarea className="textarea" value={form.description} onChange={update("description")} rows="4" /></label>
                {error && <p className="form-error">{error}</p>}
                <button className="btn btn-primary" type="submit">Submit request</button>
              </form>
            )}
          </section>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

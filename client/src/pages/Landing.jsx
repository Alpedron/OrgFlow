import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckSquare, GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";

const FEATURES = [
  { Icon: CalendarDays, title: "Plan every event", text: "Keep schedules, decisions, and next steps in one shared organization workspace." },
  { Icon: CheckSquare, title: "Assign work by role", text: "Choose an officer role or a custom role, then filter task visibility with confidence." },
  { Icon: ShieldCheck, title: "Manage ownership", text: "Give admins the right to manage roles while keeping regular members in a safe read-only view." },
  { Icon: Users, title: "Pass the torch", text: "Preserve institutional knowledge so future officers can inherit the work without starting over." },
];

export default function Landing() {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f7f8fc 0%, #fff 100%)", color: "var(--color-text)" }}>
      <nav style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}><span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: "white", background: "var(--color-accent)" }}><GraduationCap size={18} /></span>OrgFlow</div>
        <div style={{ display: "flex", gap: 10 }}><Link className="btn btn-secondary" to="/login">Sign in</Link><Link className="btn btn-primary" to="/login?mode=register">Start free <ArrowRight size={14} /></Link></div>
      </nav>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 28px 86px", display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 64, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 99, background: "var(--color-accent-soft)", color: "var(--color-accent-dark)", fontSize: "0.78rem", fontWeight: 700 }}><Sparkles size={13} /> Built for student organizations</div>
          <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4.6rem)", lineHeight: 1.02, letterSpacing: "-0.05em", margin: "22px 0 20px" }}>Keep your organization moving <span style={{ color: "var(--color-accent)" }}>forward.</span></h1>
          <p style={{ maxWidth: 620, fontSize: "1.05rem", lineHeight: 1.7, color: "var(--color-muted)" }}>OrgFlow brings events, tasks, roles, resources, and institutional knowledge into one clear workspace built for student leaders.</p>
          <div style={{ display: "flex", gap: 12, marginTop: 30 }}><Link className="btn btn-primary" to="/login?mode=register">Create your organization <ArrowRight size={14} /></Link><Link className="btn btn-secondary" to="/login">Sign in to your workspace</Link></div>
          <p style={{ marginTop: 16, color: "var(--color-muted)", fontSize: "0.78rem" }}>No credit card required · Setup in minutes</p>
        </div>

        <div style={{ background: "#fff", border: "1px solid var(--color-border-light)", borderRadius: 22, boxShadow: "var(--shadow-md)", padding: 18, transform: "rotate(1deg)" }}>
          <div style={{ padding: "20px", borderRadius: 16, background: "#f8f9fd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div><strong>Campus Council</strong><div className="muted" style={{ fontSize: "0.76rem", marginTop: 3 }}>Spring event planning</div></div><span className="badge badge-success">On track</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#fff", border: "1px solid var(--color-border-light)", borderRadius: 12, padding: 15 }}><div className="muted" style={{ fontSize: "0.72rem" }}>Open tasks</div><strong style={{ display: "block", fontSize: "1.45rem", marginTop: 8 }}>12</strong><div style={{ color: "var(--color-accent)", fontSize: "0.72rem", marginTop: 5 }}>4 due this week</div></div>
              <div style={{ background: "#fff", border: "1px solid var(--color-border-light)", borderRadius: 12, padding: 15 }}><div className="muted" style={{ fontSize: "0.72rem" }}>Leadership roles</div><strong style={{ display: "block", fontSize: "1.45rem", marginTop: 8 }}>8</strong><div style={{ color: "var(--color-success)", fontSize: "0.72rem", marginTop: 5 }}>All assigned</div></div>
            </div>
            <div style={{ marginTop: 10, background: "#fff", border: "1px solid var(--color-border-light)", borderRadius: 12, padding: 15 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 10 }}><span>Event readiness</span><strong>82%</strong></div><div style={{ height: 7, background: "var(--color-border-light)", borderRadius: 99, overflow: "hidden" }}><div style={{ width: "82%", height: "100%", background: "var(--color-accent)", borderRadius: 99 }} /></div></div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px 90px" }}>
        <h2 style={{ textAlign: "center", fontSize: "1.65rem", margin: "0 0 30px" }}>Built for the whole organization, not just one meeting.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {FEATURES.map(({ Icon, title, text }) => <article key={title} className="card" style={{ padding: 22 }}><span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", color: "var(--color-accent)", background: "var(--color-accent-soft)" }}><Icon size={18} /></span><h3 style={{ fontSize: "1rem", margin: "16px 0 7px" }}>{title}</h3><p className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.55 }}>{text}</p></article>)}
        </div>
      </section>
    </main>
  );
}

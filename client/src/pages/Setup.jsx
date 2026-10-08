import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { GraduationCap, Users, Calendar, CheckCircle2, Plus, Trash2, ChevronRight, ChevronLeft, KeyRound, Sparkles, Copy } from "lucide-react";
import { saveSetup, joinOrg } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { copyTextToClipboard } from "../utils/clipboard.js";
import "./Setup.css";

const ORG_TYPES = ["Student Government", "Club", "Greek Life", "Other"];

const ROLE_OPTIONS = [
  "President", "Vice President", "Treasurer", "Secretary",
  "Events Chair", "Marketing Chair", "Community Chair", "Member at Large",
];

const STEPS = [
  { id: "org",     label: "Your Organization", icon: GraduationCap },
  { id: "officers",label: "Officer Roles",     icon: Users },
  { id: "event",   label: "First Event",       icon: Calendar },
  { id: "done",    label: "All Set",            icon: CheckCircle2 },
];

function StepIndicator({ current }) {
  return (
    <div className="setup-steps">
      {STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "upcoming";
        const Icon = s.icon;
        return (
          <div key={s.id} className={`setup-step setup-step--${state}`}>
            <div className="setup-step-circle">
              {i < current ? <CheckCircle2 size={14} /> : <Icon size={14} />}
            </div>
            <span className="setup-step-label">{s.label}</span>
            {i < STEPS.length - 1 && <div className="setup-step-line" />}
          </div>
        );
      })}
    </div>
  );
}

export default function Setup() {
  const navigate = useNavigate();
  const { user, loading: authLoading, updateUser } = useAuth();
  const existing = user?.org || {};
  const [step, setStep] = useState(0);
  // null = choose, "create" = new club (or edit yours), "join" = join with invite code
  const [mode, setMode] = useState(existing.configured ? "create" : null);
  const [joinCode, setJoinCode] = useState("");
  const [inviteCode, setInviteCode] = useState(existing.join_code || "");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 0 — org basics
  const [orgName, setOrgName] = useState(existing.name || "");
  const [orgType, setOrgType] = useState(existing.type || "");
  const [memberCount, setMemberCount] = useState(existing.memberCount ?? "");
  const [contactEmail, setContactEmail] = useState(existing.contactEmail || "");

  // Step 1 — officers
  const [officers, setOfficers] = useState(
    existing.officers?.length ? existing.officers : [{ role: "President", name: "" }]
  );

  // Step 2 — seed event (skipped by default when editing an existing org)
  const [skipEvent, setSkipEvent] = useState(Boolean(existing.configured));
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventAttendance, setEventAttendance] = useState("");
  const [eventBudget, setEventBudget] = useState("");

  // ── Officer helpers ──────────────────────────────────────────────────────────

  function addOfficer() {
    setOfficers((o) => [...o, { role: "", name: "" }]);
  }

  function removeOfficer(i) {
    setOfficers((o) => o.filter((_, idx) => idx !== i));
  }

  function updateOfficer(i, field, val) {
    setOfficers((o) => o.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function canNext() {
    if (step === 0) return orgName.trim().length > 0 && orgType.length > 0;
    if (step === 1) return true; // officers optional
    if (step === 2) return skipEvent || (eventName.trim().length > 0 && eventDate.length > 0);
    return true;
  }

  async function handleFinish() {
    setError("");
    setSaving(true);
    try {
      const body = {
        orgName: orgName.trim(),
        orgType,
        memberCount: memberCount ? parseInt(memberCount, 10) : null,
        contactEmail: contactEmail.trim() || undefined,
        officers: officers.filter((o) => o.name.trim()),
        seedEvent: skipEvent ? null : {
          name: eventName.trim(),
          event_date: eventDate ? new Date(eventDate).toISOString() : null,
          location: eventLocation.trim() || null,
          expected_attendance: eventAttendance ? parseInt(eventAttendance, 10) : null,
          budget: eventBudget ? parseFloat(eventBudget) : null,
        },
      };

      const { user } = await saveSetup(body);
      updateUser({ org: user.org, role: user.role });
      setInviteCode(user.org?.join_code || "");
      setStep(3); // done screen
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { user } = await joinOrg(joinCode.trim());
      updateUser({ org: user.org, role: user.role });
      navigate("/pass-the-torch", { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function copyInvite() {
    setCopyError("");
    try {
      await copyTextToClipboard(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError("Couldn't copy automatically. Please select and copy the invite code.");
    }
  }

  // The wizard saves to the signed-in account, so it needs one
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="setup-page">
      <div className="setup-card">
        {/* Logo */}
        <div className="setup-logo">
          <span className="setup-logo-icon"><GraduationCap size={20} /></span>
          <span className="setup-logo-text">OrgFlow</span>
        </div>

        {/* ── Start: new club or join an existing one ── */}
        {mode === null && (
          <div className="setup-body">
            <h2 className="setup-title">Welcome, {user.name?.split(" ")[0] || "officer"}!</h2>
            <p className="setup-sub">Is your organization new to OrgFlow, or did a previous officer already set it up?</p>
            <div className="setup-choice-grid">
              <button type="button" className="setup-choice" onClick={() => setMode("create")}>
                <Sparkles size={20} />
                <strong>Set up a new organization</strong>
                <span>You'll get an invite code to share with your officers and successors.</span>
              </button>
              <button type="button" className="setup-choice" onClick={() => { setMode("join"); setError(""); }}>
                <KeyRound size={20} />
                <strong>Join with an invite code</strong>
                <span>Taking over from previous leadership? Their events, notes and documents carry over.</span>
              </button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <form className="setup-body" onSubmit={handleJoin}>
            <h2 className="setup-title">Join your organization</h2>
            <p className="setup-sub">
              Ask a current or previous officer for the invite code. They'll find it in the organization menu at the top of the sidebar.
            </p>
            <div className="setup-field">
              <label className="setup-label">Invite code <span className="setup-req">*</span></label>
              <input
                className="input setup-code-input"
                placeholder="ABCD-2345"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={12}
                autoFocus
              />
            </div>
            {error && <p className="setup-error">{error}</p>}
            <div className="setup-nav">
              <button type="button" className="btn btn-secondary" onClick={() => { setMode(null); setError(""); }} disabled={saving}>
                <ChevronLeft size={15} /> Back
              </button>
              <div style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary" disabled={saving || joinCode.replace(/[^A-Z0-9]/gi, "").length < 8}>
                {saving ? "Joining…" : "Join organization"} <ChevronRight size={15} />
              </button>
            </div>
          </form>
        )}

        {mode === "create" && (<>
        <StepIndicator current={step} />

        {/* ── Step 0: Org basics ── */}
        {step === 0 && (
          <div className="setup-body">
            <h2 className="setup-title">Tell us about your organization</h2>
            <p className="setup-sub">This takes 2 minutes. You can change everything later.</p>

            <div className="setup-field">
              <label className="setup-label">Organization name <span className="setup-req">*</span></label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Lakewood Student Government"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="setup-field">
              <label className="setup-label">Organization type <span className="setup-req">*</span></label>
              <div className="setup-type-grid">
                {ORG_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`setup-type-btn ${orgType === t ? "setup-type-btn--active" : ""}`}
                    onClick={() => setOrgType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="setup-row">
              <div className="setup-field">
                <label className="setup-label">Number of members</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder="e.g. 45"
                  value={memberCount}
                  onChange={(e) => setMemberCount(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Primary contact email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="president@university.edu"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Officers ── */}
        {step === 1 && (
          <div className="setup-body">
            <h2 className="setup-title">Add your officer roles</h2>
            <p className="setup-sub">Who's on your leadership team? You can add more later.</p>

            <div className="setup-officers">
              {officers.map((o, i) => (
                <div key={i} className="setup-officer-row">
                  <select
                    className="select setup-officer-role"
                    value={o.role}
                    onChange={(e) => updateOfficer(i, "role", e.target.value)}
                  >
                    <option value="">Select role…</option>
                    {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <input
                    className="input setup-officer-name"
                    type="text"
                    placeholder="Officer's name"
                    value={o.name}
                    onChange={(e) => updateOfficer(i, "name", e.target.value)}
                  />
                  {officers.length > 1 && (
                    <button
                      type="button"
                      className="setup-remove-btn"
                      onClick={() => removeOfficer(i)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-secondary btn-sm setup-add-btn" onClick={addOfficer}>
              <Plus size={14} /> Add officer
            </button>
          </div>
        )}

        {/* ── Step 2: Seed event ── */}
        {step === 2 && (
          <div className="setup-body">
            <h2 className="setup-title">Add your first event</h2>
            <p className="setup-sub">Seed the calendar so your dashboard has something to show.</p>

            <label className="setup-skip-label">
              <input
                type="checkbox"
                checked={skipEvent}
                onChange={(e) => setSkipEvent(e.target.checked)}
                style={{ accentColor: "var(--brand)", marginRight: 8 }}
              />
              Skip — I'll add events from the dashboard
            </label>

            {!skipEvent && (
              <>
                <div className="setup-field" style={{ marginTop: 16 }}>
                  <label className="setup-label">Event name <span className="setup-req">*</span></label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Fall Kickoff Mixer"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                  />
                </div>

                <div className="setup-row">
                  <div className="setup-field">
                    <label className="setup-label">Date <span className="setup-req">*</span></label>
                    <input
                      className="input"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                  <div className="setup-field">
                    <label className="setup-label">Location</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="Student Union Room 201"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="setup-row">
                  <div className="setup-field">
                    <label className="setup-label">Expected attendance</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      placeholder="50"
                      value={eventAttendance}
                      onChange={(e) => setEventAttendance(e.target.value)}
                    />
                  </div>
                  <div className="setup-field">
                    <label className="setup-label">Budget ($)</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="500"
                      value={eventBudget}
                      onChange={(e) => setEventBudget(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && (
          <div className="setup-body setup-done">
            <div className="setup-done-icon">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="setup-title">You're all set!</h2>
            <p className="setup-sub">
              <strong>{orgName}</strong> is ready to go. Head to your dashboard to start planning.
            </p>
            {inviteCode && (
              <div className="setup-invite">
                <span className="setup-label">Invite code for your officers and successors</span>
                <div className="setup-invite-row">
                  <code>{inviteCode}</code>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copyInvite}>
                    <Copy size={13} /> {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {copyError && <p className="setup-error" role="status">{copyError}</p>}
              </div>
            )}
            <button
              className="btn btn-primary setup-go-btn"
              onClick={() => navigate("/dashboard", { replace: true })}
            >
              Go to Dashboard <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Error */}
        {error && <p className="setup-error">{error}</p>}

        {/* Nav buttons */}
        {step < 3 && (
          <div className="setup-nav">
            {(step > 0 || !existing.configured) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => (step > 0 ? setStep((s) => s - 1) : setMode(null))}
                disabled={saving}
              >
                <ChevronLeft size={15} /> Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step < 2 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
              >
                Continue <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleFinish}
                disabled={!canNext() || saving}
              >
                {saving ? "Saving…" : "Finish Setup"} <ChevronRight size={15} />
              </button>
            )}
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

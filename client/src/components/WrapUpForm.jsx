import { useState } from "react";
import Modal from "./Modal.jsx";
import { saveReflection } from "../services/api.js";

/**
 * Event wrap-up: what happened and what the next officers should know.
 * Saved to the club, so it shows up in Pass the Torch and Ask OrgFlow for
 * everyone who leads the organization after you.
 */
export default function WrapUpForm({ event, onClose, onSaved }) {
  const [form, setForm] = useState({
    actual_attendance: "",
    actual_spending: "",
    what_worked: "",
    what_went_wrong: "",
    recommendations: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.what_worked.trim() && !form.what_went_wrong.trim() && !form.recommendations.trim()) {
      setError("Add at least one note for future officers.");
      return;
    }
    setSaving(true);
    try {
      await saveReflection(event.id, {
        actual_attendance: form.actual_attendance === "" ? null : parseInt(form.actual_attendance, 10),
        actual_spending: form.actual_spending === "" ? null : parseFloat(form.actual_spending),
        what_worked: form.what_worked.trim(),
        what_went_wrong: form.what_went_wrong.trim(),
        recommendations: form.recommendations.trim(),
      });
      onSaved({ ...event, status: "completed" });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Wrap up: ${event.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="wrapup-form" disabled={saving}>
            {saving ? "Saving…" : "Save wrap-up"}
          </button>
        </>
      }
    >
      <form id="wrapup-form" onSubmit={handleSubmit}>
        <p className="muted" style={{ fontSize: "0.83rem", marginBottom: 14, lineHeight: 1.5 }}>
          This is saved to your organization and handed to future officers in Pass the Torch.
          Put one point per line.
        </p>
        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">Actual attendance{event.expected_attendance != null ? ` (expected ${event.expected_attendance})` : ""}</span>
            <input className="input" type="number" min="0" value={form.actual_attendance} onChange={set("actual_attendance")} autoFocus />
          </label>
          <label className="form-field">
            <span className="form-label">Actual spending ($){event.budget != null ? ` — budget $${event.budget}` : ""}</span>
            <input className="input" type="number" min="0" step="0.01" value={form.actual_spending} onChange={set("actual_spending")} />
          </label>
          <label className="form-field form-field-full">
            <span className="form-label">What worked</span>
            <textarea className="textarea" value={form.what_worked} onChange={set("what_worked")} placeholder={"QR code check-in\nPromoting 3 weeks ahead"} />
          </label>
          <label className="form-field form-field-full">
            <span className="form-label">What went wrong</span>
            <textarea className="textarea" value={form.what_went_wrong} onChange={set("what_went_wrong")} placeholder="Ran out of food 45 minutes early" />
          </label>
          <label className="form-field form-field-full">
            <span className="form-label">Advice for future officers</span>
            <textarea className="textarea" value={form.recommendations} onChange={set("recommendations")} placeholder="Order 30% more food than the RSVP count" />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}

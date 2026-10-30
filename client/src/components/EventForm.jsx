import { useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { createEvent, updateEvent } from "../services/api.js";

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Create a new event, or edit `event` when one is passed. */
export default function EventForm({ event, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: event?.name || "",
    event_date: toLocalInput(event?.event_date),
    location: event?.location || "",
    expected_attendance: event?.expected_attendance ?? "",
    budget: event?.budget ?? "",
    description: event?.description || "",
    image: event?.image || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function chooseImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Please choose an image smaller than 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, image: reader.result }));
      setError("");
    };
    reader.onerror = () => setError("Couldn't read that image. Please try another file.");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.event_date) {
      setError("Please give the event a name and a date.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        event_date: new Date(form.event_date).toISOString(),
        location: form.location.trim() || null,
        expected_attendance: form.expected_attendance === "" ? null : parseInt(form.expected_attendance, 10),
        budget: form.budget === "" ? null : parseFloat(form.budget),
        description: form.description.trim() || null,
        image: form.image || null,
      };
      const saved = event ? await updateEvent(event.id, body) : await createEvent(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={event ? "Edit event" : "New event"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="event-form" disabled={saving}>
            {saving ? "Saving…" : event ? "Save changes" : "Create event"}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field form-field-full">
            <span className="form-label">Event name *</span>
            <input className="input" value={form.name} onChange={set("name")} placeholder="Fall Welcome Mixer" autoFocus />
          </label>
          <label className="form-field">
            <span className="form-label">Date &amp; time *</span>
            <input className="input" type="datetime-local" value={form.event_date} onChange={set("event_date")} />
          </label>
          <label className="form-field">
            <span className="form-label">Location</span>
            <input className="input" value={form.location} onChange={set("location")} placeholder="Student Center Ballroom" />
          </label>
          <label className="form-field">
            <span className="form-label">Expected attendance</span>
            <input className="input" type="number" min="0" value={form.expected_attendance} onChange={set("expected_attendance")} />
          </label>
          <label className="form-field">
            <span className="form-label">Budget ($)</span>
            <input className="input" type="number" min="0" step="0.01" value={form.budget} onChange={set("budget")} />
          </label>
          <label className="form-field form-field-full">
            <span className="form-label">Description</span>
            <textarea className="textarea" value={form.description} onChange={set("description")} />
          </label>
          <div className="form-field form-field-full">
            <span className="form-label">Event photo</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => imageInputRef.current?.click()}
              >
                {form.image ? "Replace photo" : "Upload photo"}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={chooseImage}
                hidden
              />
              <span className="muted" style={{ fontSize: ".76rem" }}>
                Optional · JPG, PNG, or WebP up to 4 MB
              </span>
            </div>
            {form.image && (
              <img
                src={form.image}
                alt="Event preview"
                style={{ display: "block", width: "100%", height: 150, objectFit: "cover", borderRadius: 8, marginTop: 12 }}
              />
            )}
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}

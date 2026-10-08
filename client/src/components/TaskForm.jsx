import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "./Modal.jsx";
import { createTask } from "../services/api.js";

const CATEGORIES = ["Logistics", "Marketing", "Finance", "Outreach", "Admin", "Other"];

export default function TaskForm({ events = [], defaultEventId = "", onClose, onSaved }) {
  const [form, setForm] = useState({
    title: "",
    event_id: defaultEventId,
    category: "",
    assigned_to: "",
    due_date: "",
    priority: "medium",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Please give the task a title.");
      return;
    }
    setSaving(true);
    try {
      const saved = await createTask({
        title: form.title.trim(),
        event_id: form.event_id || null,
        category: form.category || null,
        assigned_to: form.assigned_to.trim() || null,
        due_date: form.due_date || null,
        priority: form.priority,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New task"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="task-form" disabled={saving}>
            {saving ? "Saving…" : "Create task"}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field form-field-full">
            <span className="form-label">Task *</span>
            <input className="input" value={form.title} onChange={set("title")} placeholder="Book the ballroom" autoFocus />
          </label>
          <div className="form-field">
            <span className="form-label">Event</span>
            <select className="select" value={form.event_id} onChange={set("event_id")} disabled={events.length === 0}>
              <option value="">{events.length === 0 ? "No events yet" : "No event"}</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
            {events.length === 0 && (
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                <Link to="/events?new=1">Create an event</Link> to link tasks to it.
              </span>
            )}
          </div>
          <label className="form-field">
            <span className="form-label">Category</span>
            <select className="select" value={form.category} onChange={set("category")}>
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Assigned to</span>
            <input className="input" value={form.assigned_to} onChange={set("assigned_to")} placeholder="Name or role" />
          </label>
          <label className="form-field">
            <span className="form-label">Due date</span>
            <input className="input" type="date" value={form.due_date} onChange={set("due_date")} />
          </label>
          <label className="form-field">
            <span className="form-label">Priority</span>
            <select className="select" value={form.priority} onChange={set("priority")}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}

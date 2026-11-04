import { useEffect, useRef, useState } from "react";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { getWebsiteContent, updateLandingContent, updateEventPublication } from "../services/api.js";

const EMPTY_EVENT = { label: "", date: "", title: "", meta: "", image: "", external_link: "" };

export default function LandingEditor() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getWebsiteContent()
      .then((data) => setContent({ ...data.content, events: data.content.events || [], organizationEvents: data.events || [] }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function update(field, value) {
    setContent((current) => ({ ...current, [field]: value }));
  }

  function updateEvent(index, field, value) {
    setContent((current) => ({
      ...current,
      events: current.events.map((event, itemIndex) =>
        itemIndex === index ? { ...event, [field]: value } : event
      ),
    }));
  }

  function addEvent() {
    setContent((current) => ({ ...current, events: [...current.events, { ...EMPTY_EVENT }] }));
  }

  function removeEvent(index) {
    setContent((current) => ({ ...current, events: current.events.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { events, organizationEvents, ...websiteContent } = content;
      setContent({ ...(await updateLandingContent({ ...websiteContent, events })), events, organizationEvents });
      setMessage("Website updated. Visitors will see the changes now.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading website editor…</p>;
  if (error && !content) return <p className="form-error">Couldn't load the website editor: {error}</p>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 22 }}>
        <h1>Website</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Update the public landing page without editing code. Changes are shared with future officers.
        </p>
      </div>

      <form onSubmit={save}>
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ marginBottom: 16 }}>Main announcement</h2>
          <div className="form-grid">
            <label className="form-field">
              <span className="form-label">Small label</span>
              <input className="input" value={content.eyebrow} onChange={(e) => update("eyebrow", e.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-label">Organization or campus name</span>
              <input className="input" value={content.kicker} onChange={(e) => update("kicker", e.target.value)} />
            </label>
          </div>
          <label className="form-field" style={{ marginTop: 14 }}>
            <span className="form-label">Headline</span>
            <input className="input" required value={content.headline} onChange={(e) => update("headline", e.target.value)} />
          </label>
          <label className="form-field" style={{ marginTop: 14 }}>
            <span className="form-label">Description</span>
            <textarea className="textarea" rows="3" value={content.description} onChange={(e) => update("description", e.target.value)} />
          </label>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <div>
              <h2>Featured events</h2>
              <p className="muted" style={{ fontSize: ".8rem", marginTop: 3 }}>Add a photo from your computer for each event.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addEvent}>+ Add event</button>
          </div>
          <div className="flex flex-col gap-3">
            {content.events.map((event, index) => (
              <LandingEventEditor
                key={index}
                event={event}
                onChange={(field, value) => updateEvent(index, field, value)}
                onRemove={() => removeEvent(index)}
              />
            ))}
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <h2>Public event approvals</h2>
          <p className="muted" style={{ fontSize: ".8rem", margin: "4px 0 16px" }}>
            Organization admins create event listings. Approve an event here before it appears on the public website.
          </p>
          <div className="flex flex-col gap-2">
            {content.organizationEvents.map((event) => (
              <div key={event.id} className="flex justify-between items-center" style={{ gap: 12, padding: 12, border: "1px solid var(--color-border)", borderRadius: 10 }}>
                <div>
                  <strong>{event.name}</strong>
                  <p className="muted" style={{ fontSize: ".76rem" }}>{event.organization_name} · {event.approval_status || "pending"}</p>
                </div>
                {event.approval_status === "approved" ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={async () => {
                    const updated = await updateEventPublication(event.id, { approval_status: "pending", is_public: false });
                    setContent((current) => ({ ...current, organizationEvents: current.organizationEvents.map((item) => item.id === updated.id ? { ...item, ...updated } : item) }));
                  }}>Unpublish</button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
                    const updated = await updateEventPublication(event.id, { approval_status: "approved", is_public: true });
                    setContent((current) => ({ ...current, organizationEvents: current.organizationEvents.map((item) => item.id === updated.id ? { ...item, ...updated } : item) }));
                  }}>Approve for website</button>
                )}
              </div>
            ))}
            {!content.organizationEvents.length && <p className="muted">No organization events have been created yet.</p>}
          </div>
        </section>

        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
        {message && <p className="form-success" style={{ marginBottom: 12 }}>{message}</p>}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          <Save size={15} /> {saving ? "Saving…" : "Save website changes"}
        </button>
      </form>
    </div>
  );
}

function LandingEventEditor({ event, onChange, onRemove }) {
  const inputRef = useRef(null);

  function chooseImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      window.alert("Please choose an image smaller than 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange("image", reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: 12 }}>
      <div className="form-grid">
        <label className="form-field"><span className="form-label">Label</span><input className="input" value={event.label} onChange={(e) => onChange("label", e.target.value)} placeholder="Featured" /></label>
        <label className="form-field"><span className="form-label">Date shown</span><input className="input" value={event.date} onChange={(e) => onChange("date", e.target.value)} placeholder="Nov 03" /></label>
        <label className="form-field"><span className="form-label">Event name</span><input className="input" value={event.title} onChange={(e) => onChange("title", e.target.value)} /></label>
        <label className="form-field"><span className="form-label">Time and location</span><input className="input" value={event.meta} onChange={(e) => onChange("meta", e.target.value)} placeholder="3:30 PM · Student Center" /></label>
        <label className="form-field form-field-full"><span className="form-label">External event link</span><input className="input" type="url" value={event.external_link || ""} onChange={(e) => onChange("external_link", e.target.value)} placeholder="https://forms.example.com/event-signup" /><span className="muted" style={{ fontSize: ".76rem", marginTop: 5 }}>Optional · Registration, tickets, or more information</span></label>
      </div>
      <div className="flex justify-between items-center" style={{ gap: 12, marginTop: 14 }}>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}><ImagePlus size={15} /> Replace photo</button>
          <input ref={inputRef} type="file" accept="image/*" onChange={chooseImage} hidden />
          {event.image && <span className="muted" style={{ fontSize: ".76rem" }}>Photo selected</span>}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}><Trash2 size={14} /> Remove</button>
      </div>
      {event.image && <img src={event.image} alt="" style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8, marginTop: 14 }} />}
    </div>
  );
}

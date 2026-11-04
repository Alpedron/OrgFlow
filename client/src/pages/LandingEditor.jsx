import { useEffect, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Save, Trash2 } from "lucide-react";
import { approveOrganizationRequest, getWebsiteContent, updateLandingContent, updateEventPublication } from "../services/api.js";

const EMPTY_EVENT = { label: "", date: "", title: "", meta: "", image: "", external_link: "" };
const ORGANIZATION_TYPES = ["Student Organization", "Student Club", "Academic Student Associations"];
const EMPTY_ORGANIZATION = { name: "", type: ORGANIZATION_TYPES[0], description: "", advisor: "", contact: "", links: [], image: "" };

export default function LandingEditor() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getWebsiteContent()
      .then((data) => setContent({
        ...data.content,
        events: data.content.events || [],
        organizations: (data.content.organizations || data.organizations || []).map((organization) => ({
          ...organization,
          advisor: organization.advisor || "",
          contact: organization.contact || "",
          links: Array.isArray(organization.links)
            ? organization.links.slice(0, 3)
            : organization.link ? [{ label: "Learn more", url: organization.link }] : [],
        })),
        organizationRequests: data.organizationRequests || [],
        organizationEvents: data.events || [],
      }))
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
    if (content.events.length >= 5) return;
    setContent((current) => ({ ...current, events: [...current.events, { ...EMPTY_EVENT }] }));
  }

  function removeEvent(index) {
    setContent((current) => ({ ...current, events: current.events.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function updateOrganization(index, field, value) {
    setContent((current) => ({
      ...current,
      organizations: current.organizations.map((organization, itemIndex) =>
        itemIndex === index ? { ...organization, [field]: value } : organization
      ),
    }));
  }

  function addOrganization() {
    setContent((current) => ({ ...current, organizations: [...current.organizations, { ...EMPTY_ORGANIZATION }] }));
  }

  function removeOrganization(index) {
    setContent((current) => ({ ...current, organizations: current.organizations.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function updateOrganizationLink(index, linkIndex, field, value) {
    setContent((current) => ({
      ...current,
      organizations: current.organizations.map((organization, itemIndex) => {
        if (itemIndex !== index) return organization;
        const links = [...(organization.links || [])];
        links[linkIndex] = { ...links[linkIndex], [field]: value };
        return { ...organization, links };
      }),
    }));
  }

  function addOrganizationLink(index) {
    setContent((current) => ({
      ...current,
      organizations: current.organizations.map((organization, itemIndex) =>
        itemIndex === index
          ? { ...organization, links: [...(organization.links || []), { label: "", url: "" }] }
          : organization
      ),
    }));
  }

  function removeOrganizationLink(index, linkIndex) {
    setContent((current) => ({
      ...current,
      organizations: current.organizations.map((organization, itemIndex) =>
        itemIndex === index
          ? { ...organization, links: (organization.links || []).filter((_, currentIndex) => currentIndex !== linkIndex) }
          : organization
      ),
    }));
  }

  function updateOrganizationRequest(updated) {
    setContent((current) => ({
      ...current,
      organizationRequests: current.organizationRequests.map((item) => item.id === updated.id ? updated : item),
    }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { events, organizationEvents, organizationRequests, ...websiteContent } = content;
      setContent({ ...(await updateLandingContent({ ...websiteContent, events: events.slice(0, 5) })), events: events.slice(0, 5), organizationEvents });
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={addEvent} disabled={content.events.length >= 5}>+ Add event</button>
          </div>
          <div className="flex flex-col gap-3">
            {content.events.map((event, index) => (
              <LandingEventEditor
                key={index}
                event={event}
                onChange={(field, value) => updateEvent(index, field, value)}
                onRemove={() => removeEvent(index)}
                defaultOpen={index === 0}
              />
            ))}
          </div>
          {content.events.length >= 5 && <p className="muted" style={{ fontSize: ".8rem", marginTop: 12 }}>You can publish up to 5 featured events.</p>}
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <div>
              <h2>Organizations and clubs</h2>
              <p className="muted" style={{ fontSize: ".8rem", marginTop: 3 }}>Manage the entries shown on the public directory.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addOrganization}>+ Add organization</button>
          </div>
          <div className="flex flex-col gap-3">
            {content.organizations.map((organization, index) => (
              <OrganizationEditor
                key={organization.id || index}
                organization={organization}
                onChange={(field, value) => updateOrganization(index, field, value)}
                onLinkChange={(linkIndex, field, value) => updateOrganizationLink(index, linkIndex, field, value)}
                onAddLink={() => addOrganizationLink(index)}
                onRemoveLink={(linkIndex) => removeOrganizationLink(index, linkIndex)}
                onRemove={() => removeOrganization(index)}
                defaultOpen={index === 0}
              />
            ))}
            {!content.organizations.length && <p className="muted">No public organization entries yet.</p>}
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <h2>Organization requests</h2>
          <p className="muted" style={{ fontSize: ".8rem", margin: "4px 0 16px" }}>
            Approve requests before the organization can finish setup or appear in the public directory.
          </p>
          <div className="flex flex-col gap-2">
            {content.organizationRequests.filter((request) => request.status === "pending").map((request) => (
              <details className="website-editor-item" key={request.id}>
                <summary><span>{request.name} <small className="muted"> · {request.type}</small></span><ChevronDown size={16} /></summary>
                <div className="website-editor-item-body">
                  {request.description && <p className="muted" style={{ marginBottom: 12 }}>{request.description}</p>}
                  <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
                    const { request: updated } = await approveOrganizationRequest(request.id);
                    updateOrganizationRequest(updated);
                    setContent((current) => ({ ...current, organizations: [...current.organizations, { name: updated.name, type: updated.type, description: updated.description, advisor: "", contact: "", links: [], image: "" }] }));
                  }}>Approve organization</button>
                </div>
              </details>
            ))}
            {!content.organizationRequests.some((request) => request.status === "pending") && <p className="muted">No pending organization requests.</p>}
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <h2>Public event approvals</h2>
          <p className="muted" style={{ fontSize: ".8rem", margin: "4px 0 16px" }}>
            Organization admins create event listings. Approve an event here before it appears on the public website.
          </p>
          <div className="flex flex-col gap-2">
            {content.organizationEvents.map((event) => (
              <details className="website-editor-item" key={event.id}>
                <summary>
                  <span>{event.name} <small className="muted"> · {event.organization_name} · {event.approval_status || "pending"}</small></span>
                  <ChevronDown size={16} />
                </summary>
                <div className="website-editor-item-body">
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
              </details>
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

function LandingEventEditor({ event, onChange, onRemove, defaultOpen }) {
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
    <details className="website-editor-item" open={defaultOpen}>
      <summary><span>{event.title || "Untitled featured event"}</span><ChevronDown size={16} /></summary>
      <div className="website-editor-item-body">
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
    </details>
  );
}

function OrganizationEditor({ organization, onChange, onLinkChange, onAddLink, onRemoveLink, onRemove, defaultOpen }) {
  const inputRef = useRef(null);

  function chooseImage(event) {
    const file = event.target.files?.[0];
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
    <details className="website-editor-item" open={defaultOpen}>
      <summary><span>{organization.name || "Untitled organization"}</span><ChevronDown size={16} /></summary>
      <div className="website-editor-item-body">
        <div className="form-grid">
          <label className="form-field"><span className="form-label">Organization name</span><input className="input" value={organization.name} onChange={(e) => onChange("name", e.target.value)} /></label>
          <label className="form-field"><span className="form-label">Type</span><select className="select" value={organization.type || ORGANIZATION_TYPES[0]} onChange={(e) => onChange("type", e.target.value)}>{ORGANIZATION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <div className="form-field form-field-full">
            <span className="form-label">Description</span>
            <RichTextEditor value={organization.description || ""} onChange={(value) => onChange("description", value)} />
            <span className="muted" style={{ fontSize: ".76rem", marginTop: 5 }}>Maximum 200 words. Select text, then use the formatting buttons. Only bold, italics, and underline are published.</span>
          </div>
          <label className="form-field"><span className="form-label">Advisor information</span><textarea className="textarea" rows="3" value={organization.advisor || ""} onChange={(e) => onChange("advisor", e.target.value)} placeholder="Name, department, or advisor email" /></label>
          <label className="form-field"><span className="form-label">Contact information</span><textarea className="textarea" rows="3" value={organization.contact || ""} onChange={(e) => onChange("contact", e.target.value)} placeholder="Contact email, phone, or meeting details" /></label>
          <div className="form-field form-field-full">
            <span className="form-label">Links (up to 3)</span>
            {(organization.links || []).map((link, linkIndex) => (
              <div className="organization-link-editor" key={linkIndex}>
                <input className="input" value={link.label} onChange={(e) => onLinkChange(linkIndex, "label", e.target.value)} placeholder="Link label, e.g. Instagram" />
                <input className="input" type="url" value={link.url} onChange={(e) => onLinkChange(linkIndex, "url", e.target.value)} placeholder="https://..." />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveLink(linkIndex)}><Trash2 size={14} /></button>
              </div>
            ))}
            {(organization.links || []).length < 3 && <button type="button" className="btn btn-secondary btn-sm" onClick={onAddLink}>+ Add link</button>}
          </div>
          <div className="form-field form-field-full">
            <span className="form-label">Organization image</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>{organization.image ? "Replace image" : "Upload image"}</button>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} hidden />
            <span className="muted" style={{ display: "block", fontSize: ".76rem", marginTop: 6 }}>Optional · displayed at up to 150 × 150 pixels</span>
            {organization.image && <img className="organization-editor-image" src={organization.image} alt="" />}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}><Trash2 size={14} /> Remove</button>
      </div>
    </details>
  );
}

function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const lastValidValue = useRef(value);

  function format(command) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    onChange(editorRef.current?.innerHTML || "");
  }

  function handleInput(event) {
    const nextValue = event.currentTarget.innerHTML;
    const wordCount = event.currentTarget.innerText.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 200) {
      event.currentTarget.innerHTML = lastValidValue.current;
      return;
    }
    lastValidValue.current = nextValue;
    onChange(nextValue);
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="Description formatting">
        <button type="button" className="btn btn-secondary btn-sm" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")}><strong>B</strong></button>
        <button type="button" className="btn btn-secondary btn-sm" onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")}><em>I</em></button>
        <button type="button" className="btn btn-secondary btn-sm" onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")}><u>U</u></button>
      </div>
      <div
        ref={editorRef}
        className="rich-text-input"
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={handleInput}
      />
    </div>
  );
}

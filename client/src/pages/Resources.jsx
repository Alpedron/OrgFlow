import { useState, useEffect, useRef } from "react";
import { getResources, getResource, uploadResource, removeResource, openDocument, openResourceFile } from "../services/api.js";
import Modal from "../components/Modal.jsx";

const TYPE_ICON = { policy: "📋", document: "📄", pdf: "📕", spreadsheet: "📊" };
const TEXT_EXT = ["txt", "md", "csv", "json", "html", "htm"];
const MAX_BYTES = 10 * 1024 * 1024;

function fileType(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["csv", "xlsx", "xls"].includes(ext)) return "spreadsheet";
  if (/polic|bylaw|constitution|guideline/i.test(name)) return "policy";
  return "document";
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readFile(file) {
  const isText = TEXT_EXT.includes(file.name.split(".").pop().toLowerCase()) || file.type.startsWith("text/");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () =>
      resolve(isText ? { content: reader.result } : { data: String(reader.result).split(",")[1] });
    if (isText) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [viewing, setViewing] = useState(null); // { name, loading, content, error }
  const fileInput = useRef(null);

  useEffect(() => {
    getResources()
      .then(setResources)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setNotice("");
    setUploading(true);
    const problems = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is over 10 MB`);
        continue;
      }
      try {
        const body = await readFile(file);
        const saved = await uploadResource({ name: file.name, type: fileType(file.name), size: file.size, ...body });
        setResources((list) => [saved, ...list]);
        if (saved.warning) problems.push(`${file.name}: ${saved.warning}`);
      } catch (err) {
        problems.push(`${file.name}: ${err.message}`);
      }
    }
    setUploading(false);
    setNotice(problems.join(" · "));
    if (fileInput.current) fileInput.current.value = "";
  }

  async function openResource(res) {
    if (res.source) {
      if (!res.can_open) {
        setViewing({
          name: res.name,
          message: "This policy is indexed in OrgFlow's shared AI library, but its original file isn't stored on this server. You can still ask OrgFlow about it.",
        });
        return;
      }
      try {
        await openDocument(res.name);
      } catch (err) {
        setViewing({ name: res.name, error: err.message });
      }
      return;
    }

    // PDFs, Word files etc. open in a new tab; text files show here.
    if (!res.has_preview && res.has_file) {
      try {
        await openResourceFile(res.id);
      } catch (err) {
        setViewing({ name: res.name, error: err.message });
      }
      return;
    }

    if (!res.has_preview && !res.has_file) {
      setViewing({
        name: res.name,
        message: "This older upload has no original file stored on the server. Please upload it again to open it here.",
      });
      return;
    }
    setViewing({ name: res.name, loading: true });
    try {
      const full = await getResource(res.id);
      setViewing({ name: res.name, content: full.content });
    } catch (err) {
      setViewing({ name: res.name, error: err.message });
    }
  }

  async function handleRemove(res) {
    const sharedCopy = Boolean(res.source || res.backboard_id);
    const prompt = sharedCopy
      ? `Remove ${res.name} from this organization's Resources list? Its copy in the shared AI library will remain available to OrgFlow and other organizations.`
      : `Remove ${res.name} from Resources and delete its locally stored file, if present?`;
    if (!window.confirm(prompt)) return;

    setRemovingId(res.id);
    setNotice("");
    try {
      await removeResource(res.id, res.name);
      setResources((list) => list.filter((item) => item.id !== res.id));
      setNotice(`${res.name} was removed from this organization's Resources list.${sharedCopy ? " Its shared AI-library copy was retained." : ""}`);
    } catch (err) {
      setNotice(`Couldn't remove ${res.name}: ${err.message}`);
    } finally {
      setRemovingId(null);
    }
  }

  const pickFile = () => fileInput.current?.click();

  return (
    <div style={{ maxWidth: 760 }}>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,.html,.pdf,.doc,.docx"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Page header */}
      <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
        <div>
          <h1>Resources</h1>
          <p className="muted" style={{ marginTop: 3, fontSize: "0.85rem" }}>
            Organization documents, policies, and guidelines — searchable by OrgFlow AI.
          </p>
        </div>
        <button className="btn btn-primary" onClick={pickFile} disabled={uploading}>
          {uploading ? "Uploading…" : "↑ Upload Resource"}
        </button>
      </div>

      <div style={{ marginBottom: 20, borderBottom: "1px solid var(--color-border-light)", paddingBottom: 20 }} />

      {notice && <p className="form-note" style={{ marginBottom: 16 }}>{notice}</p>}
      {error && <p className="form-error" style={{ marginBottom: 16 }}>Couldn't load resources: {error}</p>}
      {loading && <p className="muted">Loading resources…</p>}
      {!loading && !error && resources.length === 0 && (
        <p className="muted" style={{ marginBottom: 8 }}>No documents yet. Upload your bylaws, policies or past event notes below.</p>
      )}

      <div className="flex flex-col gap-3">
        {resources.map((res) => (
          <div
            key={res.id}
            className="card flex items-center gap-3"
            style={{ justifyContent: "space-between", transition: "box-shadow 0.12s" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-md)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{TYPE_ICON[res.type] || "📄"}</span>
              <div>
                <h3 style={{ fontSize: "0.9rem" }}>{res.name}</h3>
                <p className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
                  {[
                    res.source === "backboard" ? "Shared AI library" : res.source === "knowledge" ? "School policy library" : res.type,
                    formatSize(res.size),
                    res.created_at && `Added ${new Date(res.created_at).toLocaleDateString()}`,
                    res.status && res.status !== "indexed" && `AI status: ${res.status}`,
                  ]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => openResource(res)}>View</button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--color-danger)" }}
                onClick={() => handleRemove(res)}
                disabled={removingId === res.id}
                aria-label={`Remove ${res.name} from Resources`}
              >
                {removingId === res.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload drop zone */}
      <div
        className="card"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        style={{
          marginTop: 24,
          borderStyle: "dashed",
          borderColor: dragOver ? "var(--brand)" : undefined,
          textAlign: "center",
          padding: 32,
          background: dragOver ? "var(--brand-light)" : "var(--color-surface-raised)",
        }}
      >
        <p style={{ fontSize: "1.5rem", marginBottom: 8 }}>📂</p>
        <p className="muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
          Drop a document here, or choose one, to add it to your organization's knowledge base.
          <br />
          <span style={{ fontSize: "0.78rem" }}>
            Text, Markdown, CSV, PDF or Word, up to 10 MB. OrgFlow AI will index it so future officers can find it.
          </span>
        </p>
        <button className="btn btn-secondary" onClick={pickFile} disabled={uploading}>
          {uploading ? "Uploading…" : "Choose File"}
        </button>
      </div>

      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)} wide>
          {viewing.loading && <p className="muted">Loading…</p>}
          {viewing.error && <p className="form-error">{viewing.error}</p>}
          {!viewing.loading && !viewing.error && viewing.message && <p className="muted">{viewing.message}</p>}
          {!viewing.loading && !viewing.error && !viewing.message && viewing.content && (
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.88rem", lineHeight: 1.6 }}>
              {viewing.content}
            </pre>
          )}
          {!viewing.loading && !viewing.error && !viewing.message && !viewing.content && (
            <p className="muted">
              A preview isn't available for this file type, but it has been added to OrgFlow's knowledge base —
              ask about it on the Ask OrgFlow page.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

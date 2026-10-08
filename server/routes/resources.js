const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { Router } = require("express");
const backboard = require("../services/backboardService");
const db = require("../services/supabaseService");

const router = Router();

const MAX_PREVIEW_CHARS = 200000;
// Files officers upload on the Resources page (kept so they can be opened later)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "data", "uploads");
// School-wide documents loaded into Backboard with `npm run seed`
const KNOWLEDGE_DIR = path.join(__dirname, "..", "knowledge");

const safeName = (name) => path.basename(String(name || "file")).replace(/[^\w.\- ]/g, "_");
// "05_MCC_Event_Guide.pdf", "MCC_Event_Guide" and "mcc event guide.pdf" all match
const looseKey = (name) =>
  path.basename(String(name || "")).toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/^\d+[_\- ]*/, "").replace(/[^a-z0-9]/g, "");

function resourceType(name) {
  const lower = String(name || "").toLowerCase();
  if (/\.pdf$/.test(lower)) return "pdf";
  if (/\.(csv|xlsx|xls)$/.test(lower)) return "spreadsheet";
  if (/polic|bylaw|constitution|guideline|regulation|handbook/i.test(lower)) return "policy";
  return "document";
}

function localKnowledgeFiles() {
  try {
    return fs.readdirSync(KNOWLEDGE_DIR).filter((name) =>
      !name.startsWith(".") && fs.statSync(path.join(KNOWLEDGE_DIR, name)).isFile()
    );
  } catch {
    return [];
  }
}

function sendFile(res, filePath, name) {
  res.sendFile(path.resolve(filePath), {
    headers: { "Content-Disposition": `inline; filename="${safeName(name)}"` },
  });
}

function sendResource(res, resource) {
  if (resource.file_path && fs.existsSync(path.join(UPLOAD_DIR, resource.file_path))) {
    return sendFile(res, path.join(UPLOAD_DIR, resource.file_path), resource.name);
  }
  if (resource.content) {
    res.type("text/plain; charset=utf-8");
    return res.send(resource.content);
  }
  return res.status(404).json({ error: "The file for this resource isn't stored on this server." });
}

// GET /api/resources
router.get("/", async (req, res, next) => {
  try {
    const resources = await db.getResources(req.orgId);
    const known = new Set(resources.map((resource) => looseKey(resource.name)));
    const hidden = new Set((await db.getHiddenResourceNames(req.orgId)).map(looseKey));
    const shared = new Map();
    const localFiles = localKnowledgeFiles();

    for (const name of localFiles) {
      const key = looseKey(name);
      if (key && !known.has(key) && !hidden.has(key)) {
        shared.set(key, {
          id: `knowledge:${key}`,
          name,
          type: resourceType(name),
          size: fs.statSync(path.join(KNOWLEDGE_DIR, name)).size,
          created_at: null,
          source: "knowledge",
          can_open: true,
        });
      }
    }

    // Backboard contains the shared policy library. Keep listing available even
    // if Backboard is temporarily down; app-owned resource records still load.
    if (!backboard.USE_MOCK) {
      try {
        const indexed = await backboard.listResourceDocuments();
        for (const doc of indexed) {
          const key = looseKey(doc.filename);
          if (!key || known.has(key) || hidden.has(key)) continue;
          const localFile = localFiles.find((name) => looseKey(name) === key);
          shared.set(key, {
            id: `backboard:${doc.id}`,
            name: doc.filename,
            type: resourceType(doc.filename),
            size: doc.size,
            created_at: doc.created_at,
            status: doc.status,
            source: "backboard",
            can_open: Boolean(localFile),
          });
        }
      } catch (err) {
        console.warn("[resources] Couldn't list Backboard documents:", err.message);
      }
    }

    res.json([...resources, ...shared.values()]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resources/open?name=<file name the AI cited>
 * Opens a document by name: first this club's uploads, then the shared
 * school documents in server/knowledge.
 */
router.get("/open", async (req, res, next) => {
  try {
    const key = looseKey(req.query.name);
    if (!key) return res.status(400).json({ error: "Which document?" });

    const own = (await db.getResources(req.orgId)).find((r) => looseKey(r.name) === key);
    if (own) return sendResource(res, await db.getResourceById(req.orgId, own.id));

    const match = localKnowledgeFiles().find((f) => looseKey(f) === key);
    if (match) return sendFile(res, path.join(KNOWLEDGE_DIR, match), match);
    res.status(404).json({ error: `"${req.query.name}" isn't stored on this server, so it can't be opened here.` });
  } catch (err) {
    next(err);
  }
});

// GET /api/resources/:id  — full record including text content for viewing
router.get("/:id", async (req, res, next) => {
  try {
    const resource = await db.getResourceById(req.orgId, req.params.id);
    if (!resource) return res.status(404).json({ error: "Resource not found" });
    const { file_path: _hidden, ...rest } = resource;
    res.json(rest);
  } catch (err) {
    next(err);
  }
});

// GET /api/resources/:id/file — the original uploaded file
router.get("/:id/file", async (req, res, next) => {
  try {
    const resource = await db.getResourceById(req.orgId, req.params.id);
    if (!resource) return res.status(404).json({ error: "Resource not found" });
    sendResource(res, resource);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resources/:id — remove an upload from this club's Resources list.
// The Backboard copy is deliberately retained because its assistant is shared.
router.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (id.startsWith("backboard:") || id.startsWith("knowledge:")) {
      const name = String(req.body?.name || "").trim();
      if (!name) return res.status(400).json({ error: "Document name is required" });
      await db.hideResourceByName(req.orgId, name);
      return res.json({ success: true, hidden: true, shared_ai_copy_retained: true });
    }

    const resource = await db.getResourceById(req.orgId, id);
    if (!resource || resource.is_hidden) return res.status(404).json({ error: "Resource not found" });

    const storedFilePath = resource.file_path;
    const hasSharedAiCopy = Boolean(resource.backboard_id);
    await db.hideResource(req.orgId, id);
    let fileRemoved = false;
    if (storedFilePath) {
      const uploadRoot = path.resolve(UPLOAD_DIR);
      const filePath = path.resolve(uploadRoot, storedFilePath);
      if (filePath.startsWith(`${uploadRoot}${path.sep}`)) {
        try {
          fs.rmSync(filePath, { force: true });
          fileRemoved = true;
        } catch (err) {
          console.error("[resources] Couldn't remove stored upload:", err.message);
        }
      }
    }

    res.json({ success: true, hidden: true, file_removed: fileRemoved, shared_ai_copy_retained: hasSharedAiCopy });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/resources/upload
 * Body: { name, type?, size?, content? (plain text), data? (base64 for binary files like PDFs) }
 */
router.post("/upload", async (req, res, next) => {
  try {
    const { name, type, size, content, data } = req.body;
    if (!name) return res.status(400).json({ error: "File name is required" });
    if (!content && !data) return res.status(400).json({ error: "The file is empty" });

    const bytes = data ? Buffer.from(data, "base64") : Buffer.from(String(content), "utf8");

    // Keep the original file so it can be opened from Resources and Ask OrgFlow
    const relPath = path.join(req.orgId, `${randomUUID()}-${safeName(name)}`);
    fs.mkdirSync(path.join(UPLOAD_DIR, req.orgId), { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, relPath), bytes);

    // Send it to the Backboard knowledge base so Ask OrgFlow can use it.
    // If Backboard fails, still keep the resource so the upload isn't lost.
    let backboardId = null;
    let warning = null;
    try {
      const result = await backboard.uploadResource({ name, type, content: data ? bytes : content });
      backboardId = result.id;
    } catch (err) {
      console.error("[resources] Backboard upload failed:", err.message);
      warning = "Saved, but it couldn't be added to the AI knowledge base right now.";
    }

    const resource = await db.createResource(req.orgId, {
      name,
      type: type || "document",
      size: size || bytes.length,
      content: content ? String(content).slice(0, MAX_PREVIEW_CHARS) : null,
      backboard_id: backboardId,
      file_path: relPath,
    });

    res.status(201).json({ ...db.publicResource(resource), warning });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

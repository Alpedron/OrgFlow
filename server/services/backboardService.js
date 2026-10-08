/**
 * BackboardService
 *
 * Interface for Backboard organizational knowledge / RAG API.
 * Runs against the real Backboard API when BACKBOARD_API_KEY is set in
 * server/.env, and falls back to MOCK MODE when it is not.
 *
 * Backboard responsibilities:
 *  - Store and retrieve school policies
 *  - Store and retrieve organization guidelines / constitution
 *  - Store and retrieve historical event lessons
 *  - Store and retrieve officer recommendations
 *
 * Everything lives under one Backboard "assistant" per organization:
 * uploaded documents and saved memories are both attached to it.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const USE_MOCK = !process.env.BACKBOARD_API_KEY;

const ASSISTANT_NAME = process.env.BACKBOARD_ASSISTANT_NAME || "OrgFlow";
// Backboard memory is OFF for questions by default: one assistant is shared by
// every club, so its memory mixes clubs together, and in "Auto" mode it also
// saved people's questions as if they were facts. Each club's own wrap-ups are
// passed in from OrgFlow's data instead (see orgService.historyContext), and the
// uploaded documents are still searched. Set BACKBOARD_MEMORY_MODE=Readonly to
// read Backboard memory again.
const MEMORY_MODE = process.env.BACKBOARD_MEMORY_MODE || "off";
// The model Backboard uses to read the documents: Gemini, routed through Backboard.
const LLM_PROVIDER = process.env.BACKBOARD_LLM_PROVIDER || "google";
// flash-lite answered our test question ~10x faster than gemini-3.8-flash
// (about 2s vs 13-23s) with the same document search. Override in .env if needed.
const MODEL_NAME = process.env.BACKBOARD_MODEL_NAME || "gemini-2.5-flash-lite";

const SYSTEM_PROMPT = `You are the institutional memory of a student organization.
Answer using ONLY the organization's uploaded documents (school policies, guidelines, past event records) and saved memories.
Quote concrete rules, deadlines, amounts, form names and past outcomes, and name the document each one comes from.
If the documents and memories do not cover the question, say so plainly instead of guessing.`;

// ── Client / assistant setup ───────────────────────────────────────────────

// backboard-sdk is an ES module, so it is loaded with import() from CommonJS.
let _clientPromise = null;
function getClient() {
  if (!_clientPromise) {
    _clientPromise = import("backboard-sdk").then(
      ({ BackboardClient }) =>
        new BackboardClient({ apiKey: process.env.BACKBOARD_API_KEY })
    );
  }
  return _clientPromise;
}

// Resolved once per server run: BACKBOARD_ASSISTANT_ID if given, otherwise the
// assistant named ASSISTANT_NAME, created on first use.
let _assistantIdPromise = null;
function getAssistantId() {
  if (!_assistantIdPromise) {
    _assistantIdPromise = resolveAssistantId().catch((err) => {
      _assistantIdPromise = null;
      throw err;
    });
  }
  return _assistantIdPromise;
}

async function resolveAssistantId() {
  if (process.env.BACKBOARD_ASSISTANT_ID) return process.env.BACKBOARD_ASSISTANT_ID;
  return findOrCreateAssistant(ASSISTANT_NAME, SYSTEM_PROMPT);
}

async function findOrCreateAssistant(name, systemPrompt) {
  const client = await getClient();
  const existing = await client.listAssistants({ name });
  if (existing.length > 0) return existing[0].assistantId;

  const created = await client.createAssistant({ name, system_prompt: systemPrompt });
  console.log(`[Backboard] Created assistant "${name}" (${created.assistantId})`);
  return created.assistantId;
}

// A second assistant with no documents or memory, used only to run Gemini
// through Backboard. Backboard's JSON output mode needs document retrieval off.
let _plannerIdPromise = null;
function getPlannerAssistantId(systemPrompt) {
  if (!_plannerIdPromise) {
    _plannerIdPromise = findOrCreateAssistant(`${ASSISTANT_NAME} Planner`, systemPrompt).catch((err) => {
      _plannerIdPromise = null;
      throw err;
    });
  }
  return _plannerIdPromise;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Ask the organizational knowledge base a question.
 * @param {string} query
 * @returns {Promise<{ answer: string, sources: Array }>}
 */
async function askOrganizationKnowledge(query) {
  if (USE_MOCK) {
    return mockKnowledgeResponse(query);
  }

  const client = await getClient();
  const assistantId = await getAssistantId();

  const options = {
    content: query,
    assistantId,
    memory: MEMORY_MODE,
    llm_provider: LLM_PROVIDER,
    model_name: MODEL_NAME,
    stream: false,
  };

  const response = await client.sendMessage(options);
  const last = response.messages[response.messages.length - 1] || {};

  return {
    answer: response.content || "",
    sources: buildSources(last),
  };
}

// Pull a JSON object out of a model reply (handles ```json fences and stray text)
function extractJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * One round trip: search the organization's documents and memories AND get
 * the answer back as JSON. `parsed` is null if the reply wasn't valid JSON.
 * @param {string} content - instructions + the officer's request
 * @returns {Promise<{ parsed: object|null, answer: string, sources: Array }>}
 */
async function askOrganizationJson(content, threadId = null) {
  const client = await getClient();
  const assistantId = await getAssistantId();
  const send = (tid) =>
    client.sendMessage({
      content,
      assistantId,
      ...(tid ? { threadId: tid } : {}),
      memory: MEMORY_MODE,
      llm_provider: LLM_PROVIDER,
      model_name: MODEL_NAME,
      stream: false,
    });

  let response;
  try {
    // Continuing the same Backboard thread lets the AI follow up on earlier answers
    response = await send(threadId);
  } catch (err) {
    if (!threadId) throw err;
    console.warn("[Backboard] Couldn't continue conversation, starting a new one:", err.message);
    response = await send(null);
  }
  const last = response.messages[response.messages.length - 1] || {};
  return {
    parsed: extractJson(response.content),
    answer: response.content || "",
    sources: buildSources(last),
    threadId: response.threadId || null,
  };
}

/**
 * Run a prompt on Gemini through Backboard and return the parsed JSON reply.
 * Used by geminiService when there is no direct GEMINI_API_KEY.
 * @param {string} systemPrompt
 * @param {string} content
 * @returns {Promise<object>}
 */
async function generateJson(systemPrompt, content) {
  const client = await getClient();
  const assistantId = await getPlannerAssistantId(systemPrompt);

  const response = await client.sendMessage({
    content,
    assistantId,
    systemPrompt,
    memory: "off",
    json_output: true,
    llm_provider: LLM_PROVIDER,
    model_name: MODEL_NAME,
    stream: false,
  });

  // Tolerate a reply wrapped in a ```json code fence.
  const text = (response.content || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(text);
}

/**
 * Save organizational memory (e.g., event lesson) to Backboard.
 * @param {object} memory - Structured lesson/recommendation to persist
 * @returns {Promise<{ success: boolean, id: string }>}
 */
async function saveOrganizationalMemory(memory) {
  if (USE_MOCK) {
    console.log("[Backboard MOCK] Saving memory:", JSON.stringify(memory, null, 2));
    return Promise.resolve({ success: true, id: `mock-${Date.now()}` });
  }

  const client = await getClient();
  const assistantId = await getAssistantId();

  const result = await client.addMemory(assistantId, {
    content: formatMemory(memory),
    metadata: { type: "event_reflection", event_id: memory.event_id },
  });

  return { success: true, id: result?.memory_id || result?.id || result?.operation_id || "" };
}

/**
 * Upload a resource document to Backboard.
 * @param {object} resource - { name, type, content } or { name, filePath }
 * @returns {Promise<{ success: boolean, id: string, status?: string }>}
 */
async function uploadResource(resource) {
  if (USE_MOCK) {
    console.log("[Backboard MOCK] Uploading resource:", resource.name);
    return Promise.resolve({ success: true, id: `mock-resource-${Date.now()}` });
  }

  const client = await getClient();
  const assistantId = await getAssistantId();

  if (resource.filePath) {
    const doc = await client.uploadDocumentToAssistant(assistantId, resource.filePath);
    return { success: true, id: doc.documentId, status: doc.status };
  }

  if (!resource.content) {
    throw new Error("Resource has no content to upload.");
  }

  // The SDK uploads from a path on disk, so text content goes through a temp file.
  const safeName = path.basename(resource.name).replace(/[^\w.\- ]/g, "_");
  const filename = path.extname(safeName) ? safeName : `${safeName}.txt`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "orgflow-"));
  const tempPath = path.join(tempDir, filename);

  try {
    fs.writeFileSync(tempPath, resource.content);
    const doc = await client.uploadDocumentToAssistant(assistantId, tempPath);
    return { success: true, id: doc.documentId, status: doc.status };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Filenames of the documents already uploaded for this organization.
 * @returns {Promise<string[]>}
 */
async function listResourceNames() {
  const documents = await listResourceDocuments();
  return documents.map((doc) => doc.filename);
}

/**
 * Metadata for documents already in the shared Backboard assistant.
 * Backboard exposes listing/status APIs but not a document download API.
 */
async function listResourceDocuments() {
  if (USE_MOCK) return [];
  const client = await getClient();
  const assistantId = await getAssistantId();
  const docs = await client.listAssistantDocuments(assistantId);
  return docs.map((doc) => ({
    id: doc.documentId,
    filename: doc.filename,
    status: doc.status,
    size: doc.fileSizeBytes || null,
    created_at: doc.createdAt || null,
  }));
}

/**
 * Wait until Backboard has finished indexing a document.
 * @param {string} documentId
 * @returns {Promise<string>} final status ("indexed" or "failed")
 */
async function waitForDocument(documentId, timeoutMs = 120000) {
  const client = await getClient();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const doc = await client.getDocumentStatus(documentId);
    if (doc.status === "indexed" || doc.status === "failed" || doc.status === "error") {
      return doc.status;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return "timeout";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatMemory(memory) {
  const label = memory.event_name ? `"${memory.event_name}"` : `event ${memory.event_id}`;
  const lines = [`Officer wrap-up for ${label}${memory.org_name ? ` (${memory.org_name})` : ""}.`];
  if (memory.actual_attendance != null) lines.push(`Actual attendance: ${memory.actual_attendance}.`);
  if (memory.actual_spending != null) lines.push(`Actual spending: $${memory.actual_spending}.`);
  if (memory.what_worked) lines.push(`What worked: ${memory.what_worked}`);
  if (memory.what_went_wrong) lines.push(`What went wrong: ${memory.what_went_wrong}`);
  if (memory.recommendations) lines.push(`Recommendations for future officers: ${memory.recommendations}`);
  return lines.join("\n");
}

// Shape Backboard's retrieved documents and memories into the { title, summary }
// cards the Ask OrgFlow page renders under "From Org Memory".
function buildSources(message) {
  const sources = [];

  const files = Array.isArray(message.retrievedFiles) ? message.retrievedFiles : [];
  for (const file of new Set(files)) {
    sources.push({ type: "document", title: String(file) });
  }

  const raw = message.retrievedMemories;
  const memories = Array.isArray(raw) ? raw : raw?.memories || raw?.results || [];
  for (const mem of memories) {
    const text = typeof mem === "string" ? mem : mem?.memory || mem?.content;
    if (text) sources.push({ type: "memory", title: "Saved by previous officers", summary: text });
  }

  return sources;
}

// ── Mock implementations ───────────────────────────────────────────────────

function mockKnowledgeResponse(query) {
  const lower = query.toLowerCase();

  if (lower.includes("fair") || lower.includes("organization fair")) {
    return Promise.resolve({
      answer: "Found historical data for Student Organization Fair.",
      sources: [
        {
          type: "historical_event",
          title: "Student Organization Fair — October 2024",
          whatWorked: ["QR code check-in system", "Early social media promotion"],
          challenges: ["Attendance exceeded expectations by 40%", "Food quantities were insufficient"],
          recommendations: [
            "Increase food quantities by at least 30%",
            "Recruit volunteers 3 weeks in advance",
            "Begin organization registration 3 weeks before the fair",
          ],
        },
      ],
    });
  }

  if (lower.includes("funding") || lower.includes("budget")) {
    return Promise.resolve({
      answer: "Found relevant funding policies.",
      sources: [
        {
          type: "policy",
          title: "Student Government Funding Guidelines",
          summary:
            "Funding requests must be submitted at least 10 business days before the event. Maximum reimbursement is $500 per event. Itemized budget is required.",
        },
      ],
    });
  }

  return Promise.resolve({
    answer: "No specific historical data found. General guidelines apply.",
    sources: [],
  });
}

module.exports = {
  USE_MOCK,
  askOrganizationKnowledge,
  askOrganizationJson,
  generateJson,
  saveOrganizationalMemory,
  uploadResource,
  listResourceNames,
  listResourceDocuments,
  waitForDocument,
};

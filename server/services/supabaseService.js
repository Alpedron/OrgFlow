/**
 * SupabaseService — application data (events, tasks, resources, reports).
 *
 * Data belongs to an ORGANIZATION (club), not a person: every row carries the
 * club's org_id. When officers change, the new officers join the same club
 * with its invite code and inherit all events, tasks, resources and wrap-ups.
 *
 * USE_MOCK=true (default): data is kept in server/data/store.json, so it
 *   survives server restarts. Good for local dev and a single-server deploy.
 * USE_MOCK=false: data is kept in Supabase (see README for the schema).
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const USE_MOCK = process.env.USE_MOCK !== "false";

// ── Supabase client (lazy) ──────────────────────────────────────────────────

let _supabase = null;
function getClient() {
  if (_supabase) return _supabase;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("USE_MOCK=false but SUPABASE_URL / SUPABASE_SERVICE_KEY are not set");
  }

  const { createClient } = require("@supabase/supabase-js");
  _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  return _supabase;
}

// ── File-backed store (mock mode) ───────────────────────────────────────────

const STORE_PATH = process.env.DATA_STORE_PATH || path.join(__dirname, "..", "data", "store.json");

function emptyStore() {
  return { orgs: [], events: [], tasks: [], resources: [], event_reports: [], chats: [], site_settings: {} };
}

function loadStore() {
  try {
    return { ...emptyStore(), ...JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) };
  } catch {
    return emptyStore();
  }
}

let store = loadStore();

function saveStore() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

const now = () => new Date().toISOString();
const byDate = (field) => (a, b) => {
  if (!a[field]) return 1;
  if (!b[field]) return -1;
  return new Date(a[field]) - new Date(b[field]);
};

// Only these fields can be set from requests
const EVENT_FIELDS = ["name", "description", "event_date", "location", "expected_attendance", "budget", "status", "image", "external_link", "approval_status", "is_public"];
const TASK_FIELDS = ["event_id", "title", "category", "assigned_to", "due_date", "priority", "status"];

function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
}

// ── Organizations ───────────────────────────────────────────────────────────

// No 0/O/1/I so codes are easy to read out loud
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newJoinCode() {
  const { randomInt } = require("crypto");
  let c = "";
  for (let i = 0; i < 8; i++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
const normalizeCode = (code) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.+)$/, "$1-$2");

const ORG_FIELDS = ["name", "type", "memberCount", "contactEmail", "officers", "landing_content"];

async function createOrg(fields, createdBy) {
  const row = { ...pick(fields, ORG_FIELDS), join_code: newJoinCode(), created_by: createdBy || null };
  if (USE_MOCK) {
    const org = { id: randomUUID(), created_at: now(), ...row };
    store.orgs.push(org);
    saveStore();
    return org;
  }
  const { data, error } = await getClient().from("organizations").insert(row).select().single();
  if (error) throw error;
  return data;
}

async function getOrgById(id) {
  if (!id) return null;
  if (USE_MOCK) return store.orgs.find((o) => o.id === id) || null;
  const { data, error } = await getClient().from("organizations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

const DEFAULT_LANDING_CONTENT = {
  eyebrow: "What's happening with student organizations",
  kicker: "Oakland Community College",
  headline: "November events",
  description: "Stay in the loop with organization announcements, campus events, volunteer opportunities, and everything in between.",
  events: [
    {
      label: "Featured",
      date: "May 03",
      title: "OrgFlow Spring Summit",
      meta: "11:00 AM–4:00 PM · Student Center",
      image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80",
    },
    {
      label: "This week",
      date: "May 09",
      title: "Student Leaders Forum",
      meta: "3:30–5:00 PM · Library Commons",
      image: "https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1200&q=80",
    },
  ],
};

function landingContent(content) {
  return {
    ...DEFAULT_LANDING_CONTENT,
    ...(content || {}),
    events: Array.isArray(content?.events) ? content.events.slice(0, 4) : DEFAULT_LANDING_CONTENT.events,
  };
}

async function getLandingContent(orgId) {
  if (USE_MOCK) {
    const org = store.orgs.find((item) => item.id === orgId);
    return landingContent(org?.landing_content);
  }
  const { data, error } = await getClient().from("organizations").select("landing_content").eq("id", orgId).maybeSingle();
  if (error) throw error;
  return landingContent(data?.landing_content);
}

async function getPublicLandingContent() {
  if (USE_MOCK) {
    return landingContent(store.site_settings?.landing_content);
  }
  const { data, error } = await getClient().from("site_settings").select("landing_content").eq("id", "public").maybeSingle();
  if (error) throw error;
  return landingContent(data?.landing_content);
}

async function getPublicEvents() {
  if (USE_MOCK) {
    return store.events
      .filter((event) => event.approval_status === "approved" && event.is_public === true && new Date(event.event_date) >= new Date())
      .map((event) => {
        const org = store.orgs.find((item) => item.id === event.org_id);
        return { ...event, organization_name: org?.name || "Organization" };
      })
      .sort(byDate("event_date"));
  }
  const { data, error } = await getClient()
    .from("events")
    .select("*, organizations(name)")
    .eq("approval_status", "approved")
    .eq("is_public", true)
    .gte("event_date", new Date().toISOString())
    .order("event_date");
  if (error) throw error;
  return data.map(({ organizations, ...event }) => ({ ...event, organization_name: organizations?.name || "Organization" }));
}

async function getPastPublicEvents() {
  if (USE_MOCK) {
    return store.events
      .filter((event) => event.approval_status === "approved" && event.is_public === true && event.status === "completed")
      .map((event) => ({
        ...event,
        organization_name: store.orgs.find((org) => org.id === event.org_id)?.name || "Organization",
      }))
      .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
  }
  const { data, error } = await getClient()
    .from("events")
    .select("*, organizations(name)")
    .eq("approval_status", "approved")
    .eq("is_public", true)
    .eq("status", "completed")
    .order("event_date", { ascending: false });
  if (error) throw error;
  return data.map(({ organizations, ...event }) => ({
    ...event,
    organization_name: organizations?.name || "Organization",
  }));
}

async function getAllEventsForWebsite() {
  if (USE_MOCK) {
    return store.events.map((event) => ({
      ...event,
      organization_name: store.orgs.find((org) => org.id === event.org_id)?.name || "Organization",
    })).sort(byDate("event_date"));
  }
  const { data, error } = await getClient().from("events").select("*, organizations(name)").order("event_date");
  if (error) throw error;
  return data.map(({ organizations, ...event }) => ({ ...event, organization_name: organizations?.name || "Organization" }));
}

async function updateEventPublication(id, updates) {
  const fields = pick(updates, ["approval_status", "is_public"]);
  if (USE_MOCK) {
    const event = store.events.find((item) => item.id === id);
    if (!event) return null;
    Object.assign(event, fields);
    saveStore();
    return event;
  }
  const { data, error } = await getClient().from("events").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function updateLandingContent(orgId, content) {
  const next = landingContent(content);
  if (USE_MOCK) {
    store.site_settings = { ...store.site_settings, landing_content: next };
    saveStore();
    return next;
  }
  const { error } = await getClient().from("site_settings").upsert({ id: "public", landing_content: next });
  if (error) throw error;
  return next;
}

async function getOrgByJoinCode(code) {
  const c = normalizeCode(code);
  if (!c) return null;
  if (USE_MOCK) return store.orgs.find((o) => o.join_code === c) || null;
  const { data, error } = await getClient().from("organizations").select("*").eq("join_code", c).maybeSingle();
  if (error) throw error;
  return data;
}

async function updateOrg(id, updates) {
  const fields = pick(updates, ORG_FIELDS);
  if (USE_MOCK) {
    const org = store.orgs.find((o) => o.id === id);
    if (!org) return null;
    Object.assign(org, fields);
    saveStore();
    return org;
  }
  const { data, error } = await getClient().from("organizations").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function regenerateJoinCode(id) {
  const join_code = newJoinCode();
  if (USE_MOCK) {
    const org = store.orgs.find((o) => o.id === id);
    if (!org) return null;
    org.join_code = join_code;
    saveStore();
    return org;
  }
  const { data, error } = await getClient().from("organizations").update({ join_code }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/**
 * One-time upgrade for data saved before clubs had their own ID: rows tagged
 * with a person's id (owner_id) are moved to that person's club.
 * @param {Record<string,string>} userToOrg - userId -> orgId
 */
function migrateOwnerRows(userToOrg) {
  if (!USE_MOCK) return 0;
  let moved = 0;
  for (const table of ["events", "tasks", "resources", "event_reports"]) {
    for (const row of store[table]) {
      if (row.owner_id && !row.org_id && userToOrg[row.owner_id]) {
        row.org_id = userToOrg[row.owner_id];
        delete row.owner_id;
        moved++;
      }
    }
  }
  if (moved) saveStore();
  return moved;
}

// ── Events ──────────────────────────────────────────────────────────────────

async function getEvents(orgId) {
  if (USE_MOCK) return store.events.filter((e) => e.org_id === orgId).sort(byDate("event_date"));
  const { data, error } = await getClient().from("events").select("*").eq("org_id", orgId).order("event_date");
  if (error) throw error;
  return data;
}

async function getEventById(orgId, id) {
  if (USE_MOCK) return store.events.find((e) => e.id === id && e.org_id === orgId) || null;
  const { data, error } = await getClient()
    .from("events").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return data;
}

async function createEvent(orgId, event) {
  const fields = {
    status: "planning",
    approval_status: "pending",
    is_public: false,
    ...pick(event, EVENT_FIELDS),
    org_id: orgId,
  };
  if (USE_MOCK) {
    const newEvent = { id: randomUUID(), created_at: now(), ...fields };
    store.events.push(newEvent);
    saveStore();
    return newEvent;
  }
  const { data, error } = await getClient().from("events").insert(fields).select().single();
  if (error) throw error;
  return data;
}

async function updateEvent(orgId, id, updates) {
  const fields = pick(updates, EVENT_FIELDS);
  if (USE_MOCK) {
    const evt = store.events.find((e) => e.id === id && e.org_id === orgId);
    if (!evt) return null;
    Object.assign(evt, fields);
    saveStore();
    return evt;
  }
  const { data, error } = await getClient()
    .from("events").update(fields).eq("id", id).eq("org_id", orgId).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteEvent(orgId, id) {
  if (USE_MOCK) {
    const before = store.events.length;
    store.events = store.events.filter((e) => !(e.id === id && e.org_id === orgId));
    if (store.events.length === before) return false;
    // Keep the tasks but detach them from the deleted event
    store.tasks.forEach((t) => { if (t.org_id === orgId && t.event_id === id) t.event_id = null; });
    saveStore();
    return true;
  }
  await getClient().from("tasks").update({ event_id: null }).eq("event_id", id).eq("org_id", orgId);
  const { data, error } = await getClient()
    .from("events").delete().eq("id", id).eq("org_id", orgId).select();
  if (error) throw error;
  return data.length > 0;
}

// ── Tasks ───────────────────────────────────────────────────────────────────

async function getTasks(orgId, eventId) {
  if (USE_MOCK) {
    return store.tasks
      .filter((t) => t.org_id === orgId && (!eventId || t.event_id === eventId))
      .sort(byDate("due_date"));
  }
  let query = getClient().from("tasks").select("*").eq("org_id", orgId).order("due_date");
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function createTask(orgId, task) {
  const fields = { status: "open", priority: "medium", ...pick(task, TASK_FIELDS), org_id: orgId };
  if (fields.event_id && !(await getEventById(orgId, fields.event_id))) fields.event_id = null;
  if (USE_MOCK) {
    const newTask = { id: randomUUID(), created_at: now(), ...fields };
    store.tasks.push(newTask);
    saveStore();
    return newTask;
  }
  const { data, error } = await getClient().from("tasks").insert(fields).select().single();
  if (error) throw error;
  return data;
}

async function updateTask(orgId, id, updates) {
  const fields = pick(updates, TASK_FIELDS);
  if (USE_MOCK) {
    const task = store.tasks.find((t) => t.id === id && t.org_id === orgId);
    if (!task) return null;
    Object.assign(task, fields);
    saveStore();
    return task;
  }
  const { data, error } = await getClient()
    .from("tasks").update(fields).eq("id", id).eq("org_id", orgId).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteTask(orgId, id) {
  if (USE_MOCK) {
    const before = store.tasks.length;
    store.tasks = store.tasks.filter((t) => !(t.id === id && t.org_id === orgId));
    if (store.tasks.length === before) return false;
    saveStore();
    return true;
  }
  const { data, error } = await getClient().from("tasks").delete().eq("id", id).eq("org_id", orgId).select();
  if (error) throw error;
  return data.length > 0;
}

// ── Resources (metadata + text for viewing; the file itself goes to Backboard)

// What the frontend sees: no file text or server paths, just what it can do
function publicResource({ content, file_path, ...meta }) {
  return { ...meta, has_preview: Boolean(content), has_file: Boolean(file_path || content) };
}

async function getResources(orgId) {
  if (USE_MOCK) {
    return store.resources
      .filter((r) => r.org_id === orgId && !r.is_hidden)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(publicResource);
  }
  const { data, error } = await getClient()
    .from("resources").select("id, name, type, size, backboard_id, created_at, content, file_path, is_hidden")
    .eq("org_id", orgId).eq("is_hidden", false).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(publicResource);
}

async function getHiddenResourceNames(orgId) {
  if (USE_MOCK) {
    return store.resources.filter((r) => r.org_id === orgId && r.is_hidden).map((r) => r.name);
  }
  const { data, error } = await getClient()
    .from("resources").select("name").eq("org_id", orgId).eq("is_hidden", true);
  if (error) throw error;
  return data.map((r) => r.name);
}

async function getResourceById(orgId, id) {
  if (USE_MOCK) return store.resources.find((r) => r.id === id && r.org_id === orgId && !r.is_hidden) || null;
  const { data, error } = await getClient()
    .from("resources").select("*").eq("id", id).eq("org_id", orgId).eq("is_hidden", false).maybeSingle();
  if (error) throw error;
  return data;
}

async function createResource(orgId, resource) {
  const fields = {
    name: resource.name,
    type: resource.type || "document",
    size: resource.size || null,
    content: resource.content || null,
    backboard_id: resource.backboard_id || null,
    file_path: resource.file_path || null,
    is_hidden: Boolean(resource.is_hidden),
    org_id: orgId,
  };
  if (USE_MOCK) {
    const row = { id: randomUUID(), created_at: now(), ...fields };
    store.resources.push(row);
    saveStore();
    return row;
  }
  const { data, error } = await getClient().from("resources").insert(fields).select().single();
  if (error) throw error;
  return data;
}

async function hideResource(orgId, id) {
  if (USE_MOCK) {
    const resource = store.resources.find((r) => r.id === id && r.org_id === orgId);
    if (!resource) return null;
    resource.is_hidden = true;
    resource.content = null;
    resource.file_path = null;
    saveStore();
    return resource;
  }
  const { data, error } = await getClient()
    .from("resources")
    .update({ is_hidden: true, content: null, file_path: null })
    .eq("id", id).eq("org_id", orgId).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function hideResourceByName(orgId, name) {
  if (USE_MOCK) {
    const existing = store.resources.find((r) => r.org_id === orgId && r.is_hidden && r.name === name);
    if (existing) return existing;
  } else {
    const { data, error } = await getClient()
      .from("resources").select("id").eq("org_id", orgId).eq("name", name).eq("is_hidden", true).limit(1);
    if (error) throw error;
    if (data.length) return data[0];
  }
  return createResource(orgId, { name, type: "document", is_hidden: true });
}

// ── Event Reports ───────────────────────────────────────────────────────────

async function createEventReport(orgId, eventId, report) {
  const fields = { event_id: eventId, org_id: orgId, ...report };
  if (USE_MOCK) {
    const row = { id: randomUUID(), created_at: now(), ...fields };
    store.event_reports.push(row);
    saveStore();
    return row;
  }
  const { data, error } = await getClient().from("event_reports").insert(fields).select().single();
  if (error) throw error;
  return data;
}

// ── Ask OrgFlow conversations (one per person per club) ─────────────────────

const MAX_CHAT_MESSAGES = 60;

async function getChat(userId, orgId) {
  if (USE_MOCK) {
    return store.chats.find((c) => c.user_id === userId && c.org_id === orgId) || { messages: [], thread_id: null };
  }
  const { data, error } = await getClient()
    .from("chats").select("*").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return data || { messages: [], thread_id: null };
}

async function saveChat(userId, orgId, { messages, thread_id }) {
  const row = {
    user_id: userId,
    org_id: orgId,
    thread_id: thread_id || null,
    messages: (messages || []).slice(-MAX_CHAT_MESSAGES),
    updated_at: now(),
  };
  if (USE_MOCK) {
    const existing = store.chats.find((c) => c.user_id === userId && c.org_id === orgId);
    if (existing) Object.assign(existing, row);
    else store.chats.push({ id: randomUUID(), ...row });
    saveStore();
    return row;
  }
  const { error } = await getClient().from("chats").upsert(row, { onConflict: "user_id,org_id" });
  if (error) throw error;
  return row;
}

async function clearChat(userId, orgId) {
  if (USE_MOCK) {
    store.chats = store.chats.filter((c) => !(c.user_id === userId && c.org_id === orgId));
    saveStore();
    return;
  }
  const { error } = await getClient().from("chats").delete().eq("user_id", userId).eq("org_id", orgId);
  if (error) throw error;
}

async function getEventReports(orgId) {
  if (USE_MOCK) {
    return store.event_reports
      .filter((r) => r.org_id === orgId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  const { data, error } = await getClient()
    .from("event_reports").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

module.exports = {
  USE_MOCK,
  getClient,
  createOrg,
  getOrgById,
  getLandingContent,
  getPublicLandingContent,
  updateLandingContent,
  getOrgByJoinCode,
  updateOrg,
  regenerateJoinCode,
  migrateOwnerRows,
  getEventReports,
  getPublicEvents,
  getPastPublicEvents,
  getAllEventsForWebsite,
  updateEventPublication,
  getChat,
  saveChat,
  clearChat,
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getResources,
  getHiddenResourceNames,
  getResourceById,
  publicResource,
  createResource,
  hideResource,
  hideResourceByName,
  createEventReport,
};

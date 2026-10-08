/**
 * api.js — all frontend API calls go through this module.
 *
 * The Vite dev proxy forwards /api/* to http://localhost:3001,
 * so no base URL is needed during development.
 */

const BASE = "/api";

function getToken() {
  return localStorage.getItem("orgflow_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && token && !path.startsWith("/auth/")) {
    // Session expired or account gone — send the user back to sign in
    localStorage.removeItem("orgflow_token");
    if (window.location.pathname !== "/login") window.location.assign("/login");
  }

  if (res.status === 403 && token && window.location.pathname !== "/setup") {
    const body = await res.clone().json().catch(() => ({}));
    if (body.code === "NO_ORG") window.location.assign("/setup");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

// ── Health ─────────────────────────────────────────────────────────────────

export const checkHealth = () => request("/health");

// ── Auth ───────────────────────────────────────────────────────────────────

export const register = (data) =>
  request("/auth/register", { method: "POST", body: data });

export const login = (data) =>
  request("/auth/login", { method: "POST", body: data });

export const getMe = () => request("/auth/me");

// ── Setup ──────────────────────────────────────────────────────────────────

export const saveSetup = (data) =>
  request("/setup", { method: "POST", body: data });

// ── Organization (club) ────────────────────────────────────────────────

export const getOrg = () => request("/org");
export const getOrgHistory = () => request("/org/history");
export const regenerateJoinCode = () => request("/org/join-code", { method: "POST" });
export const joinOrg = (joinCode) => request("/setup", { method: "POST", body: { joinCode } });

// ── Events ─────────────────────────────────────────────────────────────────

export const getEvents = () => request("/events");
export const getEvent  = (id) => request(`/events/${id}`);
export const createEvent = (data) =>
  request("/events", { method: "POST", body: data });
export const updateEvent = (id, updates) =>
  request(`/events/${id}`, { method: "PATCH", body: updates });
export const deleteEvent = (id) =>
  request(`/events/${id}`, { method: "DELETE" });

// ── Tasks ──────────────────────────────────────────────────────────────────

export const getTasks = (eventId) =>
  request(`/tasks${eventId ? `?event_id=${eventId}` : ""}`);
export const createTask = (data) =>
  request("/tasks", { method: "POST", body: data });
export const createTasks = (tasks, eventId) =>
  request("/tasks/bulk", { method: "POST", body: { tasks, event_id: eventId || null } });
export const updateTask = (id, updates) =>
  request(`/tasks/${id}`, { method: "PATCH", body: updates });
export const deleteTask = (id) =>
  request(`/tasks/${id}`, { method: "DELETE" });

// ── AI / Chat ──────────────────────────────────────────────────────────────

export const askOrgFlow = (message) =>
  request("/chat", { method: "POST", body: { message } });
export const getChatHistory = () => request("/chat/history");
export const clearChatHistory = () => request("/chat/history", { method: "DELETE" });

// ── Event Plan ─────────────────────────────────────────────────────────────

export const generatePlan = (data) =>
  request("/generate-plan", { method: "POST", body: data });

// ── Reflection / Wrap-Up ───────────────────────────────────────────────────

export const saveReflection = (eventId, data) =>
  request(`/events/${eventId}/reflection`, { method: "POST", body: data });

// ── Resources ─────────────────────────────────────────────────────────────

export const getResources = () => request("/resources");

/**
 * Open a stored document in a new tab. The file needs the login token, so it
 * is fetched here and shown from a temporary browser URL.
 */
async function openFile(path) {
  const tab = window.open("", "_blank"); // open now, or the browser may block the pop-up
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Couldn't open the document");
    }
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    if (tab) tab.close();
    throw err;
  }
}
export const openDocument = (name) => openFile(`/resources/open?name=${encodeURIComponent(name)}`);
export const openResourceFile = (id) => openFile(`/resources/${id}/file`);
export const getResource = (id) => request(`/resources/${id}`);
export const uploadResource = (data) =>
  request("/resources/upload", { method: "POST", body: data });
export const removeResource = (id, name) =>
  request(`/resources/${encodeURIComponent(id)}`, { method: "DELETE", body: { name } });

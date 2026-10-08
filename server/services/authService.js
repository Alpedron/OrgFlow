/**
 * AuthService — user management layer.
 *
 * Mock mode (USE_MOCK=true):  in-memory store, bcrypt+JWT.
 * Supabase mode:              users in a Supabase "profiles" table, bcrypt+JWT.
 *
 * Middleware:
 *   requireAuth(req, res, next) — validates Bearer JWT, sets req.user
 */

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const USE_MOCK = process.env.USE_MOCK !== "false";
const JWT_SECRET = process.env.JWT_SECRET || "orgflow-dev";

// ── File-backed user store (mock mode — survives server restarts) ─────────────

const STORE_PATH = process.env.USERS_STORE_PATH || path.join(__dirname, "..", "data", "users.json");

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return [];
  }
}

function saveStore(users) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(users, null, 2));
}

let usersStore = loadStore();

// ── requireAuth middleware ────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── User CRUD ─────────────────────────────────────────────────────────────────
// Passwords are always hashed with bcrypt by the auth routes and checked here
// with our own JWTs — in Supabase mode the users live in a "profiles" table
// (see README) instead of users.json.

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

function fromRow(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return { ...rest, passwordHash: password_hash };
}

function db() {
  return require("./supabaseService").getClient();
}

async function createUser({ email, passwordHash, name }) {
  email = normalizeEmail(email);
  if (USE_MOCK) {
    const user = {
      id: randomUUID(),
      email,
      passwordHash,
      name: name || email.split("@")[0],
      org: null,
      created_at: new Date().toISOString(),
    };
    usersStore.push(user);
    saveStore(usersStore);
    return user;
  }

  const { data, error } = await db()
    .from("profiles")
    .insert({ id: randomUUID(), email, name: name || email.split("@")[0], password_hash: passwordHash })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

async function getUserByEmail(email) {
  email = normalizeEmail(email);
  if (USE_MOCK) {
    return usersStore.find((u) => normalizeEmail(u.email) === email) || null;
  }
  const { data, error } = await db().from("profiles").select("*").ilike("email", email).maybeSingle();
  if (error) throw error;
  return fromRow(data);
}

async function getUserById(id) {
  if (USE_MOCK) {
    return usersStore.find((u) => u.id === id) || null;
  }
  const { data, error } = await db().from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return fromRow(data);
}

// Put a user in a club (role is "officer" for everyone for now)
async function setUserOrg(userId, orgId, role = "officer") {
  if (USE_MOCK) {
    const user = usersStore.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.org_id = orgId;
    user.role = role;
    delete user.org; // old per-user org settings now live on the club
    saveStore(usersStore);
    return user;
  }
  const { data, error } = await db()
    .from("profiles").update({ org_id: orgId, role }).eq("id", userId).select().single();
  if (error) throw error;
  return fromRow(data);
}

async function updateUserRole(userId, role, isAdmin = false) {
  if (USE_MOCK) {
    const user = usersStore.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.role = String(role || "officer").trim();
    user.is_admin = Boolean(isAdmin);
    saveStore(usersStore);
    return user;
  }
  const { data, error } = await db()
    .from("profiles")
    .update({ role: String(role || "officer").trim(), is_admin: Boolean(isAdmin) })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

async function listUsersByOrg(orgId) {
  if (USE_MOCK) return usersStore.filter((u) => u.org_id === orgId);
  const { data, error } = await db()
    .from("profiles").select("id, email, name, role, is_admin, created_at").eq("org_id", orgId).order("created_at");
  if (error) throw error;
  return data;
}

// Accounts set up before clubs had IDs kept their org settings on the user
function usersWithLegacyOrg() {
  return USE_MOCK ? usersStore.filter((u) => u.org && !u.org_id) : [];
}

module.exports = {
  normalizeEmail,
  requireAuth,
  createUser,
  getUserByEmail,
  getUserById,
  setUserOrg,
  updateUserRole,
  listUsersByOrg,
  usersWithLegacyOrg,
};

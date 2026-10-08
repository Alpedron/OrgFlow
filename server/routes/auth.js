/**
 * Auth routes — works in both mock mode and real Supabase Auth mode.
 *
 * Mock mode  (USE_MOCK=true, default): passwords hashed with bcrypt, users
 *   stored in-memory, JWT signed with JWT_SECRET (defaults to "orgflow-dev").
 *
 * Supabase mode (USE_MOCK=false + SUPABASE_URL set): same flow, users stored in
 *   the Supabase "profiles" table.
 */

const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createUser, getUserByEmail, getUserById, requireAuth } = require("../services/authService");
const { publicUser } = require("../services/orgService");

const router = Router();
const USE_MOCK = process.env.USE_MOCK !== "false";

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists. Try signing in instead." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash, name: name || email.split("@")[0] });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "orgflow-dev",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: await publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "orgflow-dev",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: await publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) return res.status(401).json({ error: "Account not found — please sign in again" });
    res.json(await publicUser(user));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

/**
 * OrgFlow Express server
 *
 * All AI (Gemini) and knowledge-base (Backboard) requests are handled
 * server-side so that API keys are never exposed to the client.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const healthRouter = require("./routes/health");
const eventsRouter = require("./routes/events");
const tasksRouter = require("./routes/tasks");
const chatRouter = require("./routes/chat");
const planRouter = require("./routes/plan");
const resourcesRouter = require("./routes/resources");
const reflectionsRouter = require("./routes/reflections");
const authRouter = require("./routes/auth");
const setupRouter = require("./routes/setup");
const { requireAuth } = require("./services/authService");
const { requireOrg, migrateLegacyOrgs } = require("./services/orgService");
const orgRouter = require("./routes/org");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
// Large enough for document uploads (sent as base64)
app.use(express.json({ limit: "15mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/setup", setupRouter);
// Everything below needs a signed-in user who belongs to a club. Data belongs
// to the club, so every officer of the same club (now and future) sees it.
const member = [requireAuth, requireOrg];
app.use("/api/org", member, orgRouter);
app.use("/api/events", member, reflectionsRouter); // /api/events/:id/reflection
app.use("/api/events", member, eventsRouter);
app.use("/api/tasks", member, tasksRouter);
app.use("/api/chat", member, chatRouter);
app.use("/api/generate-plan", member, planRouter);
app.use("/api/resources", member, resourcesRouter);

// ── Built frontend (production) ───────────────────────────────────────────────
// When client/dist exists (after `npm run build` in client/), this server also
// serves the app itself, so one process on one port is all a host needs.

const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack || err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "That file is too large (max about 10 MB)." });
  }
  res.status(500).json({ error: "Something went wrong on the server. Please try again." });
});

// ── Start ─────────────────────────────────────────────────────────────────────

migrateLegacyOrgs().catch((err) => console.error("[migrate] failed:", err.message));

app.listen(PORT, () => {
  console.log(`OrgFlow server running on http://localhost:${PORT}`);
  console.log(
    `Database mock mode: ${process.env.USE_MOCK !== "false" ? "ENABLED" : "DISABLED"}`
  );
  console.log(
    `Gemini: ${process.env.GEMINI_API_KEY ? "LIVE" : process.env.BACKBOARD_API_KEY ? "LIVE (via Backboard)" : "mock (no key)"}`
  );
  if (!process.env.JWT_SECRET) {
    console.warn("⚠ JWT_SECRET is not set — using an insecure default. Set it in server/.env before deploying.");
  }
  console.log(`Backboard: ${process.env.BACKBOARD_API_KEY ? "LIVE" : "mock (no BACKBOARD_API_KEY)"}`);
});

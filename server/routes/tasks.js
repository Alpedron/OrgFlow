const { Router } = require("express");
const db = require("../services/supabaseService");
const { getUserById } = require("../services/authService");

const router = Router();

function canManageTasks(req) {
  return Boolean(req.account?.isAdmin || req.org?.created_by === req.account?.id);
}

// GET /api/tasks?event_id=...
router.get("/", async (req, res, next) => {
  try {
    const tasks = await db.getTasks(req.orgId, req.query.event_id);
    if (canManageTasks(req)) return res.json(tasks);
    if (req.query.view === "all") return res.status(403).json({ error: "Only organization admins can view all tasks" });
    const currentRole = String(req.account.role || "").trim().toLowerCase();
    const currentName = String(req.account.name || "").trim().toLowerCase();
    const visible = tasks.filter((task) => {
      const assigned = String(task.assigned_to || "").trim().toLowerCase();
      return assigned === currentRole || assigned === currentName;
    });
    res.json(visible);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post("/", async (req, res, next) => {
  try {
    if (!req.body.title || !String(req.body.title).trim()) {
      return res.status(400).json({ error: "Task title is required" });
    }
    if (!canManageTasks(req)) return res.status(403).json({ error: "Only organization admins can assign tasks" });
    const task = await db.createTask(req.orgId, req.body);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/bulk  — Body: { tasks: [...], event_id? }
router.post("/bulk", async (req, res, next) => {
  try {
    if (!canManageTasks(req)) return res.status(403).json({ error: "Only organization admins can assign tasks" });
    const list = Array.isArray(req.body.tasks) ? req.body.tasks : [];
    const valid = list.filter((t) => t && t.title && String(t.title).trim());
    if (valid.length === 0) return res.status(400).json({ error: "No tasks to add" });
    const created = [];
    for (const t of valid.slice(0, 50)) {
      created.push(await db.createTask(req.orgId, { ...t, event_id: req.body.event_id || t.event_id }));
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id
router.patch("/:id", async (req, res, next) => {
  try {
    if (!canManageTasks(req)) return res.status(403).json({ error: "Only organization admins can edit tasks" });
    const updated = await db.updateTask(req.orgId, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Task not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageTasks(req)) return res.status(403).json({ error: "Only organization admins can delete tasks" });
    const ok = await db.deleteTask(req.orgId, req.params.id);
    if (!ok) return res.status(404).json({ error: "Task not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

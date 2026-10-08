const { Router } = require("express");
const db = require("../services/supabaseService");

const router = Router();

// GET /api/events
router.get("/", async (req, res, next) => {
  try {
    res.json(await db.getEvents(req.orgId));
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id
router.get("/:id", async (req, res, next) => {
  try {
    const event = await db.getEventById(req.orgId, req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const tasks = await db.getTasks(req.orgId, req.params.id);
    res.json({ ...event, tasks });
  } catch (err) {
    next(err);
  }
});

// POST /api/events
router.post("/", async (req, res, next) => {
  try {
    const { name, event_date } = req.body;
    if (!name || !event_date) {
      return res.status(400).json({ error: "Event name and date are required" });
    }
    const event = await db.createEvent(req.orgId, req.body);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/events/:id
router.patch("/:id", async (req, res, next) => {
  try {
    const event = await db.updateEvent(req.orgId, req.params.id, req.body);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const ok = await db.deleteEvent(req.orgId, req.params.id);
    if (!ok) return res.status(404).json({ error: "Event not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

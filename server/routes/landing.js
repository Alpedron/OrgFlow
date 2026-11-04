const { Router } = require("express");
const db = require("../services/supabaseService");

const router = Router();

function isValidExternalLink(value) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(String(value)).protocol);
  } catch {
    return false;
  }
}

router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    res.json({ content: await db.getPublicLandingContent(), events: await db.getPublicEvents() });
  } catch (err) {
    next(err);
  }
});

router.get("/past-events", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    res.json(await db.getPastPublicEvents());
  } catch (err) {
    next(err);
  }
});

router.get("/upcoming-events", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    res.json(await db.getPublicEvents());
  } catch (err) {
    next(err);
  }
});

router.get("/manage", async (req, res, next) => {
  try {
    if (!req.account) return next();
    if (!req.account?.isWebsiteAdmin) return res.status(403).json({ error: "Only website administrators can edit the public website" });
    res.json({ content: await db.getPublicLandingContent(), events: await db.getAllEventsForWebsite() });
  } catch (err) {
    next(err);
  }
});

router.put("/manage", async (req, res, next) => {
  try {
    if (!req.account) return next();
    if (!req.account?.isWebsiteAdmin) return res.status(403).json({ error: "Only website administrators can edit the public website" });
    const content = req.body || {};
    if (!String(content.headline || "").trim()) return res.status(400).json({ error: "A headline is required" });
    if ((content.events || []).some((event) => !isValidExternalLink(event.external_link))) {
      return res.status(400).json({ error: "Featured event links must be valid http:// or https:// URLs" });
    }
    res.json(await db.updateLandingContent("public", content));
  } catch (err) {
    next(err);
  }
});

router.patch("/events/:id", async (req, res, next) => {
  try {
    if (!req.account) return next();
    if (!req.account?.isWebsiteAdmin) return res.status(403).json({ error: "Only website administrators can approve public events" });
    const event = await db.updateEventPublication(req.params.id, req.body);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

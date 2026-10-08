const { Router } = require("express");
const db = require("../services/supabaseService");
const backboard = require("../services/backboardService");

const router = Router();

/**
 * POST /api/events/:id/reflection
 * Body: { actual_attendance, actual_spending, what_worked, what_went_wrong, recommendations }
 *
 * Saves the event wrap-up, marks the event completed, and forwards key
 * lessons to Backboard.
 */
router.post("/:id/reflection", async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await db.getEventById(req.orgId, id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const { actual_attendance, actual_spending, what_worked, what_went_wrong, recommendations } = req.body;
    const fields = { actual_attendance, actual_spending, what_worked, what_went_wrong, recommendations };

    const report = await db.createEventReport(req.orgId, id, { ...fields, recorded_by: req.account?.name || null });
    await db.updateEvent(req.orgId, id, { status: "completed" });

    try {
      const org = await db.getOrgById(req.orgId);
      await backboard.saveOrganizationalMemory({ org_name: org?.name, event_id: id, event_name: event.name, ...fields });
    } catch (err) {
      console.error("[reflection] Backboard memory save failed:", err.message);
    }

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

/**
 * Club routes — invite code, members, and handoff history.
 * Mounted behind requireAuth + requireOrg, so req.orgId is the user's club.
 */

const { Router } = require("express");
const db = require("../services/supabaseService");
const { listUsersByOrg } = require("../services/authService");
const { getHistory } = require("../services/orgService");

const router = Router();

// GET /api/org — the club, its invite code and its members
router.get("/", async (req, res, next) => {
  try {
    const org = await db.getOrgById(req.orgId);
    const members = (await listUsersByOrg(req.orgId)).map((u) => ({
      id: u.id, name: u.name, email: u.email, role: u.role || "officer",
    }));
    res.json({ ...org, members });
  } catch (err) {
    next(err);
  }
});

// POST /api/org/join-code — make a new invite code (the old one stops working)
router.post("/join-code", async (req, res, next) => {
  try {
    const org = await db.regenerateJoinCode(req.orgId);
    res.json({ join_code: org.join_code });
  } catch (err) {
    next(err);
  }
});

// GET /api/org/history — stats and past wrap-ups for Pass the Torch
router.get("/history", async (req, res, next) => {
  try {
    res.json(await getHistory(req.orgId));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

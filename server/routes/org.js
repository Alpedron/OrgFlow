/**
 * Club routes — invite code, members, and handoff history.
 * Mounted behind requireAuth + requireOrg, so req.orgId is the user's club.
 */

const { Router } = require("express");
const db = require("../services/supabaseService");
const { listUsersByOrg, updateUserRole } = require("../services/authService");
const { getHistory } = require("../services/orgService");

const router = Router();

// GET /api/org — the club, its invite code and its members
router.get("/", async (req, res, next) => {
  try {
    const org = await db.getOrgById(req.orgId);
    const members = (await listUsersByOrg(req.orgId)).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || "officer",
      isAdmin: Boolean(u.is_admin || org.created_by === u.id),
    }));
    res.json({ ...org, members });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/org/members/:id — leaders update member roles and admin access
router.patch("/members/:id", async (req, res, next) => {
  try {
    const currentUser = req.account || {};
    if (!currentUser.isAdmin) return res.status(403).json({ error: "Only organization admins can manage roles" });

    const { role, isAdmin: nextIsAdmin } = req.body;
    if (!role || !String(role).trim()) return res.status(400).json({ error: "A role is required" });

    const member = await require("../services/authService").getUserById(req.params.id);
    if (!member || member.org_id !== req.orgId) return res.status(404).json({ error: "Member not found" });
    const updated = await updateUserRole(member.id, role, Boolean(nextIsAdmin));
    res.json({ member: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isAdmin: Boolean(updated.is_admin) } });
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

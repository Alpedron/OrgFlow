/**
 * Setup route — called by the Setup wizard.
 *
 *  - { joinCode }                       → join an existing club (new officers)
 *  - { orgName, orgType, ... }          → create a club, or edit yours if you already have one
 */

const { Router } = require("express");
const { requireAuth, getUserById, setUserOrg } = require("../services/authService");
const { publicUser } = require("../services/orgService");
const db = require("../services/supabaseService");

const router = Router();

// POST /api/setup/join-roles — return the roles configured for an invite code
router.post("/join-roles", requireAuth, async (req, res, next) => {
  try {
    const org = await db.getOrgByJoinCode(req.body.joinCode);
    if (!org) return res.status(404).json({ error: "No organization has that invite code. Check it and try again." });
    const roles = Array.from(new Set(
      (org.officers || [])
        .map((officer) => String(officer.role || "").trim())
        .filter(Boolean)
    ));
    res.json({ roles });
  } catch (err) {
    next(err);
  }
});

// POST /api/setup
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) return res.status(401).json({ error: "Account not found — please sign in again" });

    // ── Join an existing club ──
    if (req.body.joinCode) {
      const org = await db.getOrgByJoinCode(req.body.joinCode);
      if (!org) return res.status(404).json({ error: "No organization has that invite code. Check it and try again." });
      const role = String(req.body.role || "officer").trim();
      const configuredRoles = new Set((org.officers || []).map((officer) => String(officer.role || "").trim()).filter(Boolean));
      if (!configuredRoles.has(role)) {
        return res.status(400).json({ error: "Choose a role configured by this organization." });
      }
      const updated = await setUserOrg(user.id, org.id, role);
      return res.json({ user: await publicUser(updated), joined: true, event: null });
    }

    // ── Create or edit a club ──
    const { orgName, orgType, memberCount, contactEmail, officers, seedEvent } = req.body;
    if (!orgName || !orgType) {
      return res.status(400).json({ error: "Organization name and type are required" });
    }
    const fields = {
      name: String(orgName).trim(),
      type: orgType,
      memberCount: memberCount || null,
      contactEmail: contactEmail || user.email,
      officers: Array.isArray(officers) ? officers : [],
    };

    let org = user.org_id ? await db.getOrgById(user.org_id) : null;
    let updated = user;
    if (org) {
      org = await db.updateOrg(org.id, fields);
    } else {
      org = await db.createOrg(fields, user.id);
      updated = await setUserOrg(user.id, org.id);
    }

    let createdEvent = null;
    if (seedEvent && seedEvent.name && seedEvent.event_date) {
      createdEvent = await db.createEvent(org.id, { ...seedEvent, status: "planning" });
    }

    res.json({ user: await publicUser(updated), event: createdEvent });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

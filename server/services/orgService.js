/**
 * OrgService — ties accounts to clubs.
 *
 * A club (organization) has its own ID and an invite code. Officers join a club
 * with the code, and all data (events, tasks, resources, wrap-ups) belongs to
 * the club — so when leadership changes hands, the next officers see everything
 * the previous ones recorded.
 */

const auth = require("./authService");
const db = require("./supabaseService");

/** The account as the frontend sees it, with its club attached. */
async function publicUser(user) {
  if (!user) return null;
  const org = user.org_id ? await db.getOrgById(user.org_id) : null;
  const members = org ? await auth.listUsersByOrg(org.id) : [];
  const currentMember = members.find((member) => member.id === user.id);
  const isAdmin = Boolean(
    currentMember?.is_admin ||
    (org && org.created_by === user.id)
  );
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: currentMember?.role || user.role || null,
    isAdmin,
    org: org ? {
      ...org,
      configured: true,
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role || "officer",
        isAdmin: Boolean(member.is_admin || org.created_by === member.id),
      })),
    } : null,
  };
}

/** Middleware (after requireAuth): sets req.orgId, or stops if the user has no club yet. */
async function requireOrg(req, res, next) {
  try {
    const user = await auth.getUserById(req.user.userId);
    if (!user) return res.status(401).json({ error: "Account not found — please sign in again" });
    if (!user.org_id) {
      return res.status(403).json({ error: "Set up or join an organization first", code: "NO_ORG" });
    }
    const org = await db.getOrgById(user.org_id);
    const member = org ? (await auth.listUsersByOrg(org.id)).find((item) => item.id === user.id) : null;
    req.account = {
      ...user,
      role: member?.role || user.role || null,
      name: user.name,
      isAdmin: Boolean(member?.is_admin || (org && org.created_by === user.id)),
    };
    req.org = org;
    req.orgId = user.org_id;
    next();
  } catch (err) {
    next(err);
  }
}

/** Give every pre-existing account's org its own club ID and move its data over. */
async function migrateLegacyOrgs() {
  const userToOrg = {};
  for (const user of auth.usersWithLegacyOrg()) {
    const org = await db.createOrg(user.org, user.id);
    await auth.setUserOrg(user.id, org.id);
    userToOrg[user.id] = org.id;
    console.log(`[migrate] Created club "${org.name}" (${org.id}) for ${user.email}`);
  }
  const moved = db.migrateOwnerRows(userToOrg);
  if (moved) console.log(`[migrate] Moved ${moved} saved items to their club`);
}

// ── Club history (powers Pass the Torch and grounds Ask OrgFlow) ─────────────

const toList = (text) =>
  String(text || "")
    .split(/\n+|•/)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);

async function getHistory(orgId) {
  const [events, reports, resources] = await Promise.all([
    db.getEvents(orgId),
    db.getEventReports(orgId),
    db.getResources(orgId),
  ]);
  const eventById = Object.fromEntries(events.map((e) => [e.id, e]));
  const wrapUps = reports.map((r) => {
    const evt = eventById[r.event_id];
    return {
      id: r.id,
      event_id: r.event_id,
      event_name: evt?.name || "Deleted event",
      event_date: evt?.event_date || null,
      expected_attendance: evt?.expected_attendance ?? null,
      budget: evt?.budget ?? null,
      actual_attendance: r.actual_attendance ?? null,
      actual_spending: r.actual_spending ?? null,
      what_worked: toList(r.what_worked),
      what_went_wrong: toList(r.what_went_wrong),
      recommendations: toList(r.recommendations),
      recorded_by: r.recorded_by || null,
      created_at: r.created_at,
    };
  });
  return {
    stats: {
      eventsCompleted: events.filter((e) => e.status === "completed").length,
      lessonsRecorded: wrapUps.length,
      resourcesAvailable: resources.length,
    },
    wrapUps,
  };
}

/** Plain-text summary of the club's past wrap-ups, for the AI to draw on. */
async function historyContext(orgId, limit = 10) {
  const { wrapUps } = await getHistory(orgId);
  const recent = wrapUps.slice(0, limit);
  const text = recent
    .map((w) => {
      const lines = [`Event: ${w.event_name}${w.event_date ? ` (${new Date(w.event_date).toDateString()})` : ""}`];
      if (w.actual_attendance != null) lines.push(`Attendance: ${w.actual_attendance}${w.expected_attendance != null ? ` (expected ${w.expected_attendance})` : ""}`);
      if (w.actual_spending != null) lines.push(`Spent: $${w.actual_spending}${w.budget != null ? ` (budget $${w.budget})` : ""}`);
      if (w.what_worked.length) lines.push(`What worked: ${w.what_worked.join("; ")}`);
      if (w.what_went_wrong.length) lines.push(`What went wrong: ${w.what_went_wrong.join("; ")}`);
      if (w.recommendations.length) lines.push(`Recommendations: ${w.recommendations.join("; ")}`);
      return lines.join("\n");
    })
    .join("\n\n");
  const sources = recent.map((w) => ({
    type: "history",
    title: `${w.event_name} — wrap-up`,
    summary: [...w.recommendations, ...w.what_went_wrong].slice(0, 3).join(" · ") || "Recorded by a previous officer.",
  }));
  return { text, sources };
}

module.exports = { publicUser, requireOrg, migrateLegacyOrgs, getHistory, historyContext };

const { Router } = require("express");
const db = require("../services/supabaseService");

const router = Router();
const ORGANIZATION_TYPES = ["Student Organization", "Student Club", "Academic Student Associations"];

function isValidExternalLink(value) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(String(value)).protocol);
  } catch {
    return false;
  }
}

function sanitizeOrganizationDescription(value) {
  return String(value || "")
    .replace(/<(?!\/?(?:strong|em|u)\b)[^>]*>/gi, "")
    .replace(/<(strong|em|u)(?:\s[^>]*)?>/gi, "<$1>")
    .replace(/<\/(strong|em|u)\s*>/gi, "</$1>");
}

function countWords(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function isValidOrganizationEntry(entry) {
  const links = Array.isArray(entry?.links) ? entry.links : [];
  return entry
    && String(entry.name || "").trim()
    && ORGANIZATION_TYPES.includes(entry.type)
    && links.length <= 3
    && links.every((link) => String(link.label || "").trim() && String(link.url || "").trim() && isValidExternalLink(link.url));
}

router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    res.json({ content: await db.getPublicLandingContent(), events: await db.getPublicEvents() });
  } catch (err) {
    next(err);
  }
});

router.post("/organization-requests", async (req, res, next) => {
  try {
    const { name, type, description, contact_email } = req.body || {};
    if (!String(name || "").trim() || !String(contact_email || "").trim()) {
      return res.status(400).json({ error: "Organization name and contact email are required" });
    }
    if (type && !ORGANIZATION_TYPES.includes(type)) {
      return res.status(400).json({ error: "Choose a valid organization type" });
    }
    const request = await db.createOrganizationRequest({ name, type, description, contact_email }, null);
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

router.post("/interest-submissions", async (req, res, next) => {
  try {
    const { name, student_email, contact_number, year, program, organization } = req.body || {};
    if (![name, student_email, contact_number, year, program, organization].every((value) => String(value || "").trim())) {
      return res.status(400).json({ error: "Name, student email, contact number, year, program, and organization are required" });
    }
    if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(String(student_email).trim())) {
      return res.status(400).json({ error: "Enter a valid student email address" });
    }
    if (!/^\d{10}$/.test(String(contact_number).trim())) {
      return res.status(400).json({ error: "Contact number must contain exactly 10 digits" });
    }
    const listed = await db.findPublicOrganization(organization);
    if (!listed) return res.status(400).json({ error: "Choose an organization from the published list" });
    const submission = await db.createInterestSubmission({
      name: String(name).trim(),
      student_email: String(student_email).trim(),
      contact_number: String(contact_number || "").trim(),
      year: String(year).trim(),
      program: String(program).trim(),
      organization: listed.name,
      org_id: listed.id || listed.name,
    });
    res.status(201).json({ id: submission.id, message: "Your interest form was sent to the organization." });
  } catch (err) {
    next(err);
  }
});

router.get("/organizations", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    res.json(await db.getPublicOrganizations());
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
    res.json({
      content: await db.getPublicLandingContent(),
      events: await db.getAllEventsForWebsite(),
      organizations: await db.getPublicOrganizations(),
      organizationRequests: await db.getOrganizationRequests(),
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/organization-requests/:id", async (req, res, next) => {
  try {
    if (!req.account) return next();
    if (!req.account?.isWebsiteAdmin) return res.status(403).json({ error: "Only website administrators can approve organization requests" });
    const request = await db.approveOrganizationRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Organization request not found" });
    const content = await db.getPublicLandingContent();
    const organizations = content.organizations.some((item) => item.name.toLowerCase() === request.name.toLowerCase())
      ? content.organizations
      : [...content.organizations, {
        name: request.name,
        type: request.type,
        description: request.description,
        links: [],
        image: "",
      }];
    await db.updateLandingContent("public", { ...content, organizations });
    res.json({ request, organizations });
  } catch (err) {
    next(err);
  }
});

router.put("/manage", async (req, res, next) => {
  try {
    if (!req.account) return next();
    if (!req.account?.isWebsiteAdmin) return res.status(403).json({ error: "Only website administrators can edit the public website" });
    const content = {
      ...(req.body || {}),
      organizations: (req.body?.organizations || []).map((organization) => ({
        ...organization,
        description: sanitizeOrganizationDescription(organization.description),
        advisor: String(organization.advisor || "").trim(),
        contact: String(organization.contact || "").trim(),
      })),
    };
    const invalidDescription = content.organizations.find((organization) => countWords(organization.description) > 200);
    if (invalidDescription) {
      return res.status(400).json({ error: `${invalidDescription.name || "Organization"} description must be 200 words or fewer` });
    }
    if (!String(content.headline || "").trim()) return res.status(400).json({ error: "A headline is required" });
    if ((content.events || []).length > 5) {
      return res.status(400).json({ error: "You can publish up to 5 featured events" });
    }
    if ((content.events || []).some((event) => !isValidExternalLink(event.external_link))) {
      return res.status(400).json({ error: "Featured event links must be valid http:// or https:// URLs" });
    }
    if ((content.organizations || []).some((organization) => !isValidOrganizationEntry(organization))) {
      return res.status(400).json({ error: "Every public organization needs a valid name, type, and labeled links" });
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

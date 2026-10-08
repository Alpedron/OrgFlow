/**
 * GeminiService
 *
 * Interface for Google Gemini AI requests. In order of preference:
 *  - GEMINI_API_KEY set     → calls the Gemini API directly
 *  - BACKBOARD_API_KEY set  → runs Gemini through Backboard's model routing
 *  - neither                → MOCK MODE
 */

const backboard = require("./backboardService");

const USE_DIRECT = Boolean(process.env.GEMINI_API_KEY);
const USE_MOCK = !USE_DIRECT && backboard.USE_MOCK;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You are OrgFlow, an assistant that helps student organization officers get things done.
Turn the officer's request into a short summary and a list of concrete actions.

Rules:
- Ground your answer in the ORGANIZATION KNOWLEDGE provided. Use its specific rules, deadlines, amounts, form names and lessons from past events, and mention where each comes from in the action's reason.
- If the organization knowledge does not cover a step, still give sensible general advice, set "general": true on that action, and do NOT write "this is general advice" in the reason. Keep each reason to one or two short sentences.
- Never invent policies, deadlines or dollar amounts.
- Order actions by when they need to happen. Use 3 to 8 actions.
- If the officer is only asking a question, answer it in the summary and return actions only where there is something to do.`;

// Backboard has no response-schema option, so the shape is spelled out instead.
const JSON_SHAPE = `Reply with a single JSON object and nothing else, in this shape:
{"summary": string, "actions": [{"title": string, "category": string, "priority": "High" | "Medium" | "Low", "reason": string, "general": boolean}]}
"category" must be one of: College Requirement, Funding, Finance, Logistics, Promotion, Operations, Org Memory.`;

const CATEGORIES = [
  "College Requirement",
  "Funding",
  "Finance",
  "Logistics",
  "Promotion",
  "Operations",
  "Org Memory",
];

let _ai = null;
function getClient() {
  if (_ai) return _ai;
  const { GoogleGenAI } = require("@google/genai");
  _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _ai;
}

function responseSchema() {
  const { Type } = require("@google/genai");
  return {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      actions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING, enum: CATEGORIES },
            priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
            reason: { type: Type.STRING },
            general: { type: Type.BOOLEAN },
          },
          required: ["title", "category", "priority", "reason"],
        },
      },
    },
    required: ["summary", "actions"],
  };
}

/**
 * Ask Gemini for a { summary, actions } object.
 * @param {string} request  - What the officer wants
 * @param {string} context  - Organization knowledge retrieved from Backboard
 */
async function generateStructured(request, context) {
  const contents = [
    "ORGANIZATION KNOWLEDGE:",
    context && context.trim() ? context : "(none retrieved)",
    "",
    "OFFICER REQUEST:",
    request,
  ].join("\n");

  let parsed;
  if (USE_DIRECT) {
    const response = await getClient().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema(),
      },
    });
    parsed = JSON.parse(response.text);
  } else {
    parsed = await backboard.generateJson(`${SYSTEM_INSTRUCTION}\n\n${JSON_SHAPE}`, contents);
  }

  return {
    summary: parsed.summary || "",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

/**
 * Generate a structured event plan given a prompt.
 * @param {string} prompt  - User's description of the event / concern
 * @param {string} [context] - Optional retrieved org knowledge from Backboard
 * @returns {Promise<{ summary: string, actions: Array }>}
 */
async function generateEventPlan(prompt, context = "") {
  if (USE_MOCK) {
    return mockEventPlan(prompt);
  }
  return generateStructured(`Create a step-by-step plan for this event: ${prompt}`, context);
}

/**
 * Turn a freeform officer concern into structured OrgFlow actions.
 * @param {string} message  - User's chat message
 * @param {string} [context] - Optional retrieved org knowledge from Backboard
 * @returns {Promise<{ summary: string, actions: Array }>}
 */
async function structureOrgFlowResponse(message, context = "") {
  if (USE_MOCK) {
    return mockChatResponse(message, context);
  }
  return generateStructured(message, context);
}

/**
 * Answer an officer's request using the organization's documents, memories and
 * the club's own wrap-ups. Returns { summary, actions, sources }.
 *
 * With Backboard (and no direct Gemini key) this is ONE round trip: the
 * knowledge assistant searches the documents and replies in the JSON shape.
 * If that reply can't be parsed, it falls back to the older two-step path.
 *
 * @param {string} request
 * @param {string} [orgHistory] - the club's past wrap-ups as text
 * @param {"chat"|"plan"} [mode]
 * @param {{ threadId?: string|null, recent?: string }} [conversation] - earlier
 *   messages, so follow-up questions ("what about the budget?") make sense
 * @returns {Promise<{ summary, actions, sources, threadId }>}
 */
async function answerRequest(request, orgHistory = "", mode = "chat", conversation = {}) {
  const started = Date.now();
  const ask = mode === "plan" ? `Create a step-by-step plan for this event: ${request}` : request;
  const history = orgHistory ? `\n\nThis organization's own records from previous events:\n${orgHistory}` : "";
  // Backboard threads remember the conversation themselves; other paths get it as text
  const recent = conversation.recent ? `\n\nEarlier in this conversation:\n${conversation.recent}` : "";
  let result;
  let route;

  if (USE_MOCK) {
    const knowledge = await backboard.askOrganizationKnowledge(request);
    const r = mode === "plan" ? await mockEventPlan(request) : await mockChatResponse(request, knowledge.answer);
    result = { ...r, sources: knowledge.sources || [] };
    route = "mock";
  } else if (!USE_DIRECT) {
    const content = [
      SYSTEM_INSTRUCTION,
      JSON_SHAPE,
      "",
      "ORGANIZATION KNOWLEDGE: search this organization's uploaded documents and saved memories." + history,
      "",
      "OFFICER REQUEST:",
      ask,
    ].join("\n");
    const r = await backboard.askOrganizationJson(content, conversation.threadId || null);
    if (r.parsed && (r.parsed.summary || Array.isArray(r.parsed.actions))) {
      result = {
        summary: r.parsed.summary || "",
        actions: Array.isArray(r.parsed.actions) ? r.parsed.actions : [],
        sources: r.sources,
        threadId: r.threadId,
      };
      route = "backboard (1 call)";
    } else {
      const s = await generateStructured(ask, r.answer + history);
      result = { ...s, sources: r.sources, threadId: r.threadId };
      route = "backboard (2 calls, fallback)";
    }
  } else {
    const knowledge = await backboard.askOrganizationKnowledge(request);
    const s = await generateStructured(ask, knowledge.answer + history + recent);
    result = { ...s, sources: knowledge.sources || [] };
    route = backboard.USE_MOCK ? "gemini direct" : "backboard + gemini direct";
  }

  console.log(`[ai] ${mode} answered in ${Date.now() - started} ms via ${route}`);
  return result;
}

// ── Mock implementations ───────────────────────────────────────────────────

function mockEventPlan(prompt) {
  const lower = prompt.toLowerCase();
  const isFunding = lower.includes("fund") || lower.includes("budget") || lower.includes("money");
  const isMovie = lower.includes("movie") || lower.includes("film");

  return Promise.resolve({
    summary: `Here is a recommended plan for: "${prompt}". These steps are based on standard student-organization event procedures. Once Gemini and Backboard are connected, this plan will also incorporate your organization's specific history and guidelines.`,
    actions: [
      {
        title: "Submit Event Request Form",
        category: "College Requirement",
        priority: "High",
        reason: "Required at least 2 weeks before the event date.",
      },
      {
        title: "Reserve Event Space",
        category: "Logistics",
        priority: "High",
        reason: "Spaces fill up quickly — book as early as possible.",
      },
      ...(isFunding
        ? [
            {
              title: "Submit Student Government Funding Request",
              category: "Funding",
              priority: "High",
              reason: "Funding requests must be submitted at least 10 business days before the event.",
            },
            {
              title: "Prepare Itemized Event Budget",
              category: "Funding",
              priority: "High",
              reason: "Required attachment for funding requests.",
            },
          ]
        : []),
      ...(isMovie
        ? [
            {
              title: "Obtain Public Screening License",
              category: "College Requirement",
              priority: "High",
              reason: "Public movie screenings require a license from the copyright holder.",
            },
          ]
        : []),
      {
        title: "Create Promotional Materials",
        category: "Promotion",
        priority: "Medium",
        reason: "Start promotion at least 2 weeks in advance.",
      },
      {
        title: "Recruit Volunteers",
        category: "Operations",
        priority: "Medium",
        reason: "Aim for 1 volunteer per 20 expected attendees.",
      },
      {
        title: "Send Post-Event Survey",
        category: "Operations",
        priority: "Low",
        reason: "Collect feedback to improve future events.",
      },
    ],
  });
}

function mockChatResponse(message) {
  const lower = message.toLowerCase();

  if (lower.includes("movie") || lower.includes("film")) {
    return Promise.resolve({
      summary:
        "Planning a movie night involves a few key steps. Based on your organization's history and standard college requirements, here is what you need to do:",
      actions: [
        {
          title: "Submit Event Request Form",
          category: "College Requirement",
          priority: "High",
          reason: "Required before holding any student organization event.",
        },
        {
          title: "Obtain Public Screening License",
          category: "College Requirement",
          priority: "High",
          reason: "Public screenings of movies require a license.",
        },
        {
          title: "Submit Funding Request to Student Government",
          category: "Funding",
          priority: "High",
          reason: "Must be submitted 10 business days before the event.",
        },
        {
          title: "Reserve AV Equipment & Screen",
          category: "Logistics",
          priority: "High",
          reason: "Reserve through the Student Center at least 1 week ahead.",
        },
        {
          title: "Promote on Social Media & Campus Boards",
          category: "Promotion",
          priority: "Medium",
          reason: "Begin at least 2 weeks before the event.",
        },
      ],
    });
  }

  if (lower.includes("treasurer") || lower.includes("finance") || lower.includes("money")) {
    return Promise.resolve({
      summary:
        "Here is what a new Treasurer should know based on your organization's guidelines and history:",
      actions: [
        {
          title: "Review Organization Budget & Ledger",
          category: "Finance",
          priority: "High",
          reason: "Understand current financial standing before making any commitments.",
        },
        {
          title: "Meet with Student Government Finance Office",
          category: "College Requirement",
          priority: "High",
          reason: "Learn funding request procedures and deadlines.",
        },
        {
          title: "Establish Expense Approval Process",
          category: "Operations",
          priority: "Medium",
          reason: "Ensure all officers know how to request reimbursements.",
        },
        {
          title: "Review Previous Year's Budget Reports",
          category: "Org Memory",
          priority: "Medium",
          reason: "Historical data helps forecast spending for upcoming events.",
        },
      ],
    });
  }

  if (lower.includes("fair") || lower.includes("org fair") || lower.includes("organization fair")) {
    return Promise.resolve({
      summary:
        "Your organization has held a Student Organization Fair before. Here is what previous officers recommend:",
      actions: [
        {
          title: "Reserve Table & Booth Space Early",
          category: "Logistics",
          priority: "High",
          reason: "Spaces fill up — reserve at least 4 weeks in advance.",
        },
        {
          title: "Set Up QR Code Check-In",
          category: "Operations",
          priority: "High",
          reason: "Previous event: QR check-in worked extremely well.",
        },
        {
          title: "Begin Promotion 3 Weeks Before",
          category: "Promotion",
          priority: "High",
          reason: "Previous event: early promotion significantly increased attendance.",
        },
        {
          title: "Register Participating Organizations Early",
          category: "Logistics",
          priority: "Medium",
          reason: "Previous officer recommendation: begin org registration 3 weeks early.",
        },
        {
          title: "Order More Food Than Expected",
          category: "Logistics",
          priority: "Medium",
          reason: "Previous event: food ran out — attendance exceeded forecast.",
        },
      ],
    });
  }

  // Generic fallback
  return Promise.resolve({
    summary:
      "Here is a recommended starting point based on your question. Once Gemini and your organization's knowledge base are connected, these recommendations will be tailored to your specific history and policies.",
    actions: [
      {
        title: "Review Organization Guidelines",
        category: "College Requirement",
        priority: "High",
        reason: "Always start by checking current policies before planning.",
      },
      {
        title: "Check Event Calendar for Conflicts",
        category: "Logistics",
        priority: "Medium",
        reason: "Avoid scheduling conflicts with other major campus events.",
      },
      {
        title: "Consult Previous Officer Notes",
        category: "Org Memory",
        priority: "Medium",
        reason: "Previous officers may have dealt with the same situation.",
      },
    ],
  });
}

module.exports = { USE_MOCK, USE_DIRECT, answerRequest, generateEventPlan, structureOrgFlowResponse };

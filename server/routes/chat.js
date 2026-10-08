const { Router } = require("express");
const gemini = require("../services/geminiService");
const db = require("../services/supabaseService");
const { historyContext } = require("../services/orgService");

const router = Router();

// After this many questions, start a fresh AI conversation so answers stay fast
// (the saved chat on screen is kept either way).
const MAX_TURNS_PER_THREAD = 8;

const brief = (m) =>
  m.role === "user" ? `Officer: ${m.text}` : `OrgFlow: ${m.summary || ""}${m.actions?.length ? ` (suggested: ${m.actions.map((a) => a.title).join("; ")})` : ""}`;

// GET /api/chat/history — this person's saved Ask OrgFlow conversation
router.get("/history", async (req, res, next) => {
  try {
    const chat = await db.getChat(req.user.userId, req.orgId);
    res.json({ messages: chat.messages || [] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chat/history — start a new conversation
router.delete("/history", async (req, res, next) => {
  try {
    await db.clearChat(req.user.userId, req.orgId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chat
 * Body: { message: string }
 *
 * Answers using the organization's Backboard documents/memories plus the
 * club's own past wrap-ups, remembers the conversation, and saves it so it is
 * still there when the officer comes back.
 */
router.post("/", async (req, res, next) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "message is required" });

    const [history, chat] = await Promise.all([
      historyContext(req.orgId),
      db.getChat(req.user.userId, req.orgId),
    ]);
    const messages = chat.messages || [];
    const turns = messages.filter((m) => m.role === "user").length;
    const threadId = turns % MAX_TURNS_PER_THREAD === 0 ? null : chat.thread_id;

    const response = await gemini.answerRequest(message, history.text, "chat", {
      threadId,
      recent: messages.slice(-6).map(brief).join("\n"),
    });

    const reply = {
      summary: response.summary,
      actions: response.actions,
      sources: [...history.sources, ...(response.sources || [])],
    };
    await db.saveChat(req.user.userId, req.orgId, {
      thread_id: response.threadId || null,
      messages: [...messages, { role: "user", text: message }, { role: "assistant", ...reply }],
    });

    res.json(reply);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

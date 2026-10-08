const { Router } = require("express");
const gemini = require("../services/geminiService");
const { historyContext } = require("../services/orgService");

const router = Router();

/**
 * POST /api/generate-plan
 * Body: { prompt: string, eventName?: string, expectedAttendance?: number, budget?: number }
 */
router.post("/", async (req, res, next) => {
  try {
    const { prompt, eventName, expectedAttendance, budget } = req.body;
    if (!prompt && !eventName) {
      return res.status(400).json({ error: "prompt or eventName is required" });
    }
    const fullPrompt =
      prompt ||
      `Plan an event called "${eventName}" for ${expectedAttendance || "unknown"} attendees with a budget of $${budget || "unknown"}.`;
    const history = await historyContext(req.orgId);
    const plan = await gemini.answerRequest(fullPrompt, history.text, "plan");
    res.json({ ...plan, sources: [...history.sources, ...(plan.sources || [])] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

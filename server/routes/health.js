const { Router } = require("express");
const gemini = require("../services/geminiService");
const backboard = require("../services/backboardService");

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "OrgFlow API",
    gemini: gemini.USE_MOCK ? "mock" : gemini.USE_DIRECT ? "live" : "live (via Backboard)",
    backboard: backboard.USE_MOCK ? "mock" : "live",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

/**
 * Backboard speed test — times the Ask OrgFlow question with different settings.
 * Run from the server folder:  node scripts/speedTest.js
 * Only READS (memory is never written), so it is safe to run against the live assistant.
 */
require("dotenv").config();

const QUESTION =
  'Reply with a JSON object {"summary": string, "actions": [{"title": string}]} only. ' +
  "Question: How do we request funding for an event?";

(async () => {
  if (!process.env.BACKBOARD_API_KEY) {
    console.log("No BACKBOARD_API_KEY in server/.env");
    return;
  }
  const { BackboardClient } = await import("backboard-sdk");
  const client = new BackboardClient({ apiKey: process.env.BACKBOARD_API_KEY });
  const provider = process.env.BACKBOARD_LLM_PROVIDER || "google";
  const model = process.env.BACKBOARD_MODEL_NAME || "gemini-2.5-flash-lite";

  const time = async (label, fn) => {
    const t = Date.now();
    try {
      const r = await fn();
      console.log(`${label.padEnd(48)} ${String(Date.now() - t).padStart(6)} ms`);
      return r;
    } catch (err) {
      console.log(`${label.padEnd(48)} FAILED: ${err.message.slice(0, 120)}`);
      return null;
    }
  };

  const assistants = await time("Find the OrgFlow assistant", () =>
    client.listAssistants({ name: process.env.BACKBOARD_ASSISTANT_NAME || "OrgFlow" })
  );
  const assistantId = process.env.BACKBOARD_ASSISTANT_ID || assistants?.[0]?.assistantId;
  if (!assistantId) {
    console.log("No OrgFlow assistant found.");
    return;
  }

  const models = await time("List Google models", () => client.listModels({ provider }));
  const names = (models?.models || []).map((m) => m.name || m.modelName || m.displayName).filter(Boolean);
  console.log("Google models available:", names.join(", ") || "(none listed)");

  const ask = (extra) =>
    client.sendMessage({
      content: QUESTION,
      assistantId,
      llm_provider: provider,
      model_name: model,
      memory: "Readonly",
      stream: false,
      ...extra,
    });

  console.log("");
  await time(`Current setup (${model}, memory read)`, () => ask({}));
  await time(`Same again (warm)`, () => ask({}));
  await time(`Memory off`, () => ask({ memory: "off" }));
  await time(`Low thinking effort`, () => ask({ thinking: { effort: "low" } }));
  for (const m of ["gemini-2.5-flash-lite", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"]) {
    if (m !== model && names.includes(m)) await time(`Model: ${m}`, () => ask({ model_name: m }));
  }
  console.log("\nPaste everything above back to Claude.");
})();

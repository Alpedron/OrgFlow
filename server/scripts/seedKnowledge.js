/**
 * seedKnowledge.js — upload the organization's documents to Backboard.
 *
 * Usage (from server/):
 *   npm run seed                 uploads every file in server/knowledge/
 *   npm run seed -- path/to/dir  uploads every file in another folder
 *
 * Requires BACKBOARD_API_KEY in server/.env. Files already uploaded under the
 * same filename are skipped, so it is safe to run again after adding documents.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const fs = require("fs");
const backboard = require("../services/backboardService");

async function main() {
  if (backboard.USE_MOCK) {
    console.error("BACKBOARD_API_KEY is not set in server/.env — nothing uploaded.");
    process.exit(1);
  }

  const dir = path.resolve(process.argv[2] || path.join(__dirname, "..", "knowledge"));
  const files = fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith(".") && fs.statSync(path.join(dir, name)).isFile());

  if (files.length === 0) {
    console.error(`No files found in ${dir}`);
    process.exit(1);
  }

  const already = new Set(await backboard.listResourceNames());
  let failed = 0;

  for (const name of files) {
    if (already.has(name)) {
      console.log(`- ${name}: already uploaded, skipping`);
      continue;
    }
    try {
      const doc = await backboard.uploadResource({ name, filePath: path.join(dir, name) });
      const status = await backboard.waitForDocument(doc.id);
      console.log(`- ${name}: ${status}`);
      if (status !== "indexed") failed++;
    } catch (err) {
      console.log(`- ${name}: FAILED (${err.message})`);
      failed++;
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

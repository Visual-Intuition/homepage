// Seed the Supabase `submissions` table with the 6 anonymized human annotators
// from scratch/diversity_plots/data/. Idempotent: re-running upserts the same
// rows by their hardcoded UUIDs.
//
// Usage (from src/):
//   vercel env pull .env.local
//   node --env-file=.env.local scripts/seed_submissions.mjs

import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../scratch/diversity_plots/data");
const TASK_ID = "task_000";

// Discover every annotator_N.json in the data dir. Stable UUIDs so re-running upserts cleanly.
const annotatorFiles = readdirSync(DATA_DIR)
  .filter((f) => /^annotator_\d+\.json$/.test(f))
  .map((f) => ({ n: Number(f.match(/(\d+)/)[1]), file: f }))
  .sort((a, b) => a.n - b.n);

const seeds = annotatorFiles.map(({ n, file }) => {
  const submission_data = JSON.parse(readFileSync(resolve(DATA_DIR, file), "utf-8"));
  submission_data.annotator_id = `Annotator ${n}`;
  return {
    id: `5eed0000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    task_id: TASK_ID,
    annotator_uuid: `seed-annotator-${n}`,
    annotator_name: `Annotator ${n}`,
    submission_data,
  };
});

console.log(`Upserting ${seeds.length} seed submissions...`);
const { data, error } = await supabase
  .from("submissions")
  .upsert(seeds, { onConflict: "id" })
  .select("id, annotator_name");

if (error) {
  console.error("upsert failed:", error);
  process.exit(1);
}

for (const row of data) console.log(`  ${row.id}  ${row.annotator_name}`);
console.log(`done.`);

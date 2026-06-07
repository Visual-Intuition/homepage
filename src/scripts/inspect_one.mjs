import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const id = process.argv[2];
if (!id) { console.error("usage: node inspect_one.mjs <uuid>"); process.exit(1); }

const { data, error } = await supabase
  .from("submissions")
  .select("id, annotator_name, created_at, submission_data")
  .eq("id", id)
  .maybeSingle();

if (error) { console.error(error); process.exit(1); }
if (!data) { console.error("not found"); process.exit(1); }

const sd = data.submission_data ?? {};
console.log(`id: ${data.id}`);
console.log(`annotator_name: ${data.annotator_name}`);
console.log(`created_at: ${data.created_at}`);
console.log(`task_id: ${sd.task_id}`);
console.log(`session_duration_ms: ${sd.session_duration_ms}`);
console.log(`n_total_actions: ${sd.n_total_actions}`);
console.log(`n_markers_placed: ${sd.n_markers_placed}`);
console.log(`markers.length: ${Array.isArray(sd.markers) ? sd.markers.length : typeof sd.markers}`);
console.log(`click_history.length: ${Array.isArray(sd.click_history) ? sd.click_history.length : typeof sd.click_history}`);

// Action type counts
const types = {};
for (const a of sd.click_history ?? []) types[a.action_type] = (types[a.action_type] ?? 0) + 1;
console.log("action_types:", types);

// Inspect markers for unusual values
if (Array.isArray(sd.markers)) {
  let outOfRange = 0, nan = 0;
  for (const m of sd.markers) {
    if (!Array.isArray(m) || m.length !== 3) { console.log("BAD MARKER:", JSON.stringify(m)); continue; }
    const [x, y, z] = m;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) nan++;
    if (x < 0 || x > 1 || y < 0 || y > 1) outOfRange++;
  }
  console.log(`out-of-range markers: ${outOfRange}, NaN/Infinity: ${nan}`);
  console.log("first 5 markers:", sd.markers.slice(0, 5));
  console.log("last 5 markers:", sd.markers.slice(-5));
}

// First few click_history entries
console.log("\nfirst 3 actions:", JSON.stringify(sd.click_history?.slice(0, 3), null, 2));
console.log("last 3 actions:", JSON.stringify(sd.click_history?.slice(-3), null, 2));

// Look for suspicious timestamps
if (Array.isArray(sd.click_history)) {
  let badT = 0, gapAnomalies = [];
  for (let i = 0; i < sd.click_history.length; i++) {
    const t = sd.click_history[i].timestamp_ms;
    if (!Number.isFinite(t)) badT++;
    if (i > 0) {
      const dt = t - sd.click_history[i-1].timestamp_ms;
      if (dt < 0 || dt > 60000) gapAnomalies.push({ i, dt });
    }
  }
  console.log(`bad timestamps: ${badT}, gap anomalies: ${gapAnomalies.length}`);
  if (gapAnomalies.length > 0) console.log("first anomaly:", gapAnomalies[0]);
}

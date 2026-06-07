import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const { data, error } = await supabase
  .from("submissions")
  .select("id, annotator_name, submission_data, created_at")
  .eq("task_id", "task_000")
  .order("created_at", { ascending: false });

if (error) { console.error(error); process.exit(1); }

console.log(`${data.length} submissions in task_000`);

for (const row of data) {
  const sd = row.submission_data ?? {};
  const issues = [];

  // marker coord sanity
  if (Array.isArray(sd.markers)) {
    for (let i = 0; i < sd.markers.length; i++) {
      const m = sd.markers[i];
      if (!Array.isArray(m) || m.length !== 3) issues.push(`marker[${i}] bad shape`);
      else {
        const [x, y, z] = m;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) issues.push(`marker[${i}] non-finite`);
        if (Math.abs(x) > 5 || Math.abs(y) > 5 || Math.abs(z) > 100) issues.push(`marker[${i}] out of expected range: [${x}, ${y}, ${z}]`);
      }
    }
  }

  // click_history sanity
  if (Array.isArray(sd.click_history)) {
    for (let i = 0; i < sd.click_history.length; i++) {
      const a = sd.click_history[i];
      if (!a || typeof a !== "object") issues.push(`action[${i}] bad shape`);
      else if (a.action_type === "place") {
        const x = a.canvas_x_normalized;
        const y = a.canvas_y_normalized;
        if (x != null && (!Number.isFinite(x) || x < -1 || x > 2)) issues.push(`place[${i}] bad x=${x}`);
        if (y != null && (!Number.isFinite(y) || y < -1 || y > 2)) issues.push(`place[${i}] bad y=${y}`);
      }
    }
  }

  if (issues.length > 0) {
    console.log(`\n${row.id} (${row.annotator_name}): ${issues.length} issues`);
    issues.slice(0, 5).forEach((s) => console.log(`  - ${s}`));
  }
}
console.log("\ndone.");

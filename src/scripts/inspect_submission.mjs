import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const { data, error } = await supabase
  .from("submissions")
  .select("id, annotator_name, submission_data")
  .eq("task_id", "task_000");

if (error) { console.error(error); process.exit(1); }

for (const row of data) {
  const sd = row.submission_data ?? {};
  const m = sd.markers;
  const ch = sd.click_history;
  let badMarker = -1, badType = "";
  if (Array.isArray(m)) {
    m.forEach((mk, i) => {
      if (!Array.isArray(mk) || mk.length !== 3 || mk.some((v) => typeof v !== "number")) {
        if (badMarker < 0) { badMarker = i; badType = JSON.stringify(mk); }
      }
    });
  }
  console.log(`${row.annotator_name?.padEnd(15)}  markersOK=${badMarker < 0 ? "Y" : `BAD@${badMarker}=${badType}`}  click_history=${Array.isArray(ch) ? ch.length : typeof ch}  markers=${Array.isArray(m) ? m.length : typeof m}`);
}

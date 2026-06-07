import { getSupabaseAdmin } from "@/lib/supabase";
import type { Annotator, ModelData, SubmissionData, TaskInstance } from "@/lib/render-results";
import instanceJson from "@/data/task_000_instance.json";
import modelJson from "@/data/task_000_virtual_model.json";
import frontierJson from "@/data/task_000_frontier_vlm.json";

const TASK_ID = "task_000";

type Loaded = {
  cohort: Annotator[];
  model: ModelData;
  frontier: ModelData | null;
  instance: TaskInstance;
};

export async function loadCohortAndStatic(opts: { excludeId?: string }): Promise<Loaded> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("submissions")
    .select("id, annotator_name, submission_data, created_at")
    .eq("task_id", TASK_ID)
    .order("created_at", { ascending: false })
    .limit(60); // cap raw fetch; further filtered below
  if (opts.excludeId) query = query.neq("id", opts.excludeId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load cohort: ${error.message}`);

  // Filter to plausible real attempts: between 5 and 20 markers placed, and a
  // submission shape we recognize. Drops spam-clicks (e.g., 2 actions, 0
  // markers) and gibberish (35 markers, etc.) that bloat the page and skew
  // distributions. Cap to 30 to keep the inlined HTML payload manageable.
  const isReal = (row: { submission_data: unknown }) => {
    const sd = row.submission_data as SubmissionData | null;
    if (!sd || !Array.isArray(sd.markers) || !Array.isArray(sd.click_history)) return false;
    const n = sd.markers.length;
    return n >= 5 && n <= 20;
  };

  const cohort: Annotator[] = (data ?? [])
    .filter(isReal)
    .slice(0, 30)
    .map((row) => ({
      id: row.id,
      raw: row.submission_data as SubmissionData,
    }));

  const frontierActions = frontierJson as unknown as ModelData["actions"];
  const frontier: ModelData | null = frontierActions.length > 0
    ? { id: "FrontierVLM", actions: frontierActions }
    : null;

  return {
    cohort,
    model: { id: "Model", actions: modelJson as unknown as ModelData["actions"] },
    frontier,
    instance: instanceJson as unknown as TaskInstance,
  };
}

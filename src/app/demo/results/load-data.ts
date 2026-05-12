import { getSupabaseAdmin } from "@/lib/supabase";
import type { Annotator, ModelData, SubmissionData, TaskInstance } from "@/lib/render-results";
import instanceJson from "@/data/task_000_instance.json";
import modelJson from "@/data/task_000_virtual_model.json";

const TASK_ID = "task_000";

type Loaded = {
  cohort: Annotator[];
  model: ModelData;
  instance: TaskInstance;
};

export async function loadCohortAndStatic(opts: { excludeId?: string }): Promise<Loaded> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("submissions")
    .select("id, annotator_name, submission_data")
    .eq("task_id", TASK_ID);
  if (opts.excludeId) query = query.neq("id", opts.excludeId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load cohort: ${error.message}`);

  const cohort: Annotator[] = (data ?? []).map((row) => ({
    id: row.annotator_name ?? row.id,
    raw: row.submission_data as SubmissionData,
  }));

  return {
    cohort,
    model: { id: "Model", actions: modelJson as unknown as ModelData["actions"] },
    instance: instanceJson as unknown as TaskInstance,
  };
}

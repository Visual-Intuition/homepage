import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { id: string };

type ClickAction = {
  action_type: string;
  z?: number;
  mip?: boolean;
  timestamp_ms?: number;
};

type SubmissionData = {
  task_id?: number | null;
  task_name?: string | null;
  n_ground_truth_points?: number | null;
  annotator_id?: string | null;
  session_duration_ms?: number;
  n_markers_placed?: number;
  markers?: unknown[];
  click_history?: ClickAction[];
  n_total_actions?: number;
};

export default async function ResultsPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .select("id, task_id, annotator_name, created_at, submission_data")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const sub = data.submission_data as SubmissionData;
  const clicks = sub.click_history ?? [];

  const placeCount = clicks.filter((c) => c.action_type === "place").length;
  const undoCount = clicks.filter((c) => c.action_type === "undo").length;
  const mipCount = clicks.filter((c) => c.action_type === "mip").length;
  const zNavCount = clicks.filter((c) => c.action_type === "+z_1" || c.action_type === "-z_1").length;
  const placedMinusUndo = placeCount - undoCount;
  const mistakeRate = placeCount > 0 ? undoCount / placeCount : 0;
  const durationSec = sub.session_duration_ms ? (sub.session_duration_ms / 1000).toFixed(1) : "—";

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-extralight tracking-[0.3em]">Submitted</h1>
        <p className="mb-8 font-mono text-xs text-white/40">id: {data.id}</p>

        <section className="mb-8">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-white/40">Task</h2>
          <div className="grid grid-cols-2 gap-3 font-mono text-sm">
            <Stat label="task" value={data.task_id} />
            <Stat label="annotator" value={data.annotator_name ?? "anonymous"} />
            <Stat label="ground truth points" value={sub.n_ground_truth_points ?? "—"} />
            <Stat label="markers placed" value={placedMinusUndo} />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-white/40">Your behavior</h2>
          <div className="grid grid-cols-2 gap-3 font-mono text-sm">
            <Stat label="placements" value={placeCount} />
            <Stat label="undos" value={undoCount} />
            <Stat label="mistake rate" value={`${(mistakeRate * 100).toFixed(1)}%`} />
            <Stat label="mip toggles" value={mipCount} />
            <Stat label="z navigations" value={zNavCount} />
            <Stat label="duration" value={`${durationSec}s`} />
            <Stat label="total actions" value={sub.n_total_actions ?? clicks.length} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-white/40">Coming soon</h2>
          <p className="font-mono text-sm text-white/60">
            Comparison to other human annotators and our model. For now, your submission is saved.
          </p>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-1 text-white">{value}</div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ResultsView } from "../results-view";
import { loadCohortAndStatic } from "../load-data";
import type { SubmissionData } from "@/lib/render-results";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function ResultsPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .select("id, annotator_name, submission_data")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const you = {
    id: data.id,
    raw: data.submission_data as SubmissionData,
  };

  const { cohort, model, frontier, instance } = await loadCohortAndStatic({ excludeId: id });

  return <ResultsView cohort={cohort} model={model} frontier={frontier} instance={instance} you={you} />;
}

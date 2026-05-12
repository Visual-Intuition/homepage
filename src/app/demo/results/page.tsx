import { ResultsView } from "./results-view";
import { loadCohortAndStatic } from "./load-data";

export const dynamic = "force-dynamic";

export default async function CohortResultsPage() {
  const { cohort, model, instance } = await loadCohortAndStatic({});
  return <ResultsView cohort={cohort} model={model} instance={instance} you={null} />;
}

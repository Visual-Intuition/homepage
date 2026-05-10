import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type SubmitBody = {
  annotator_uuid: string;
  payload: {
    task_id: number | null;
    annotator_id?: string;
    click_history?: unknown[];
    markers?: unknown[];
    [key: string]: unknown;
  };
};

export async function POST(req: NextRequest) {
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { annotator_uuid, payload } = body;

  if (!annotator_uuid || typeof annotator_uuid !== "string") {
    return NextResponse.json({ error: "annotator_uuid required" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "payload required" }, { status: 400 });
  }
  if (!Array.isArray(payload.click_history) || payload.click_history.length < 1) {
    return NextResponse.json({ error: "empty click_history" }, { status: 400 });
  }

  const taskId = payload.task_id != null ? `task_${String(payload.task_id).padStart(3, "0")}` : "task_unknown";
  const annotatorName = typeof payload.annotator_id === "string" ? payload.annotator_id : null;

  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .insert({
      task_id: taskId,
      annotator_uuid,
      annotator_name: annotatorName,
      submission_data: payload,
    })
    .select("id")
    .single();

  if (error) {
    console.error("supabase insert error", error);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

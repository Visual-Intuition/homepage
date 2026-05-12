"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateAnonId } from "@/lib/anonId";

export function TaskRunner() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"working" | "submitting" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const anonId = getOrCreateAnonId();

    async function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data;
      if (!data || data.type !== "annotation_complete") return;

      setStatus("submitting");
      try {
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ annotator_uuid: anonId, payload: data.payload }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "unknown" }));
          throw new Error(error || `HTTP ${res.status}`);
        }
        const { id } = await res.json();
        router.push(`/demo/results/${id}`);
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return (
    <div className="min-h-screen bg-black">
      <iframe
        ref={iframeRef}
        src="/task_000.html"
        className="block h-screen w-full border-0"
        title="Colored Dot Tracking Task"
      />
      {status === "submitting" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 text-white">
          <p className="font-mono text-sm tracking-wider">Saving your annotation...</p>
        </div>
      )}
      {status === "error" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/90 text-white">
          <div className="max-w-md text-center">
            <p className="mb-2 font-mono text-sm text-red-400">submission failed</p>
            <p className="font-mono text-xs text-white/60">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Tutorial } from "./_components/tutorial";
import { TaskRunner } from "./_components/task-runner";

type Phase = "landing" | "tutorial" | "task";

export default function Demo() {
  const [phase, setPhase] = useState<Phase>("landing");

  if (phase === "task") {
    return <TaskRunner />;
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
        <h1 className="mb-4 text-2xl font-extralight tracking-[0.3em]">Demo</h1>
        <p className="mb-10 max-w-md text-center font-mono text-sm text-white/60">
          Try the colored dot tracking task. Click colored dots in order (blue to red) through the 3D
          volume. Your annotation will be saved and compared to other humans and our model.
        </p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setPhase("tutorial")}
            className="rounded border border-white/30 px-6 py-2 font-mono text-sm tracking-widest text-white transition hover:border-white hover:bg-white/5"
          >
            Start Task
          </button>
          <Link
            href="/demo/results"
            className="rounded border border-white/30 px-6 py-2 font-mono text-sm tracking-widest text-white transition hover:border-white hover:bg-white/5"
          >
            View Results
          </Link>
        </div>
      </main>

      <Tutorial
        open={phase === "tutorial"}
        onClose={() => setPhase("task")}
        onBegin={() => setPhase("task")}
      />
    </>
  );
}

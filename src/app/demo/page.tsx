import Link from "next/link";

export default function Demo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <h1 className="mb-4 text-2xl font-extralight tracking-[0.3em]">Demo</h1>
      <p className="mb-10 max-w-md text-center font-mono text-sm text-white/60">
        Try the colored dot tracking task. Click colored dots in order (blue to red) through the 3D
        volume. Your annotation will be saved and compared to other humans and our model.
      </p>
      <Link
        href="/demo/task"
        className="rounded border border-white/30 px-6 py-2 font-mono text-sm tracking-widest text-white transition hover:border-white hover:bg-white/5"
      >
        Start Task
      </Link>
    </main>
  );
}

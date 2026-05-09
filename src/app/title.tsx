"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const HOVER_MS = 3000;

export default function Title() {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    router.prefetch("/demo");
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [router]);

  function onEnter() {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      router.push("/demo");
    }, HOVER_MS);
  }

  function onLeave() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <h1 className="relative z-10 -mt-16 max-w-[12ch] px-6 text-center text-5xl leading-relaxed font-extralight tracking-[0.3em] text-white md:max-w-none md:text-7xl">
      Visual Intuiti
      <span onPointerEnter={onEnter} onPointerLeave={onLeave}>
        o
      </span>
      n
    </h1>
  );
}

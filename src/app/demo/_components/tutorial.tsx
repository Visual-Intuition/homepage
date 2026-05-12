"use client";

import { useEffect, useRef, useState } from "react";
import {
  NUM_SLICES,
  paintGaussians,
  drawMarkersSlice,
  drawMarkersMIP,
  type TaskInstance,
} from "@/lib/render-results";
import instanceJson from "@/data/task_001_instance.json";
import styles from "./tutorial.module.css";

const INSTANCE = instanceJson as unknown as TaskInstance;
const CANVAS = 224;

type Props = {
  open: boolean;
  onClose: () => void; // dismiss tutorial entirely (skip to task)
  onBegin: () => void; // finished tutorial, start task
};

export function Tutorial({ open, onClose, onBegin }: Props) {
  const [page, setPage] = useState(0); // 0, 1, 2

  useEffect(() => {
    if (open) setPage(0);
  }, [open]);

  if (!open) return null;

  const isLast = page === 2;
  const isFirst = page === 0;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close tutorial">
          ×
        </button>

        <div className={styles.row}>
          <button
            className={styles.arrow}
            disabled={isFirst}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous"
          >
            ←
          </button>

          <div className={styles.content}>
            {page === 0 && <Page1 />}
            {page === 1 && <Page2 />}
            {page === 2 && <Page3 onBegin={onBegin} />}
          </div>

          <button
            className={styles.arrow}
            disabled={isLast}
            onClick={() => setPage((p) => Math.min(2, p + 1))}
            aria-label="Next"
          >
            →
          </button>
        </div>

        <div className={styles.indicator}>{page + 1} / 3</div>
      </div>
    </div>
  );
}

// ============================================================
// Page 1: task overview + MIP
// ============================================================

function Page1() {
  const mipCanvas = useRef<HTMLCanvasElement>(null);
  const sliceCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const bg = INSTANCE.bg_color ?? 0.17;

    if (mipCanvas.current) {
      const ctx = mipCanvas.current.getContext("2d");
      if (ctx) {
        paintGaussians(ctx, INSTANCE, CANVAS, bg, 0, 1, true);
        const markers = INSTANCE.points.map<[number, number, number]>((p) => [
          p.x,
          p.y,
          p.z * NUM_SLICES - 0.5,
        ]);
        drawMarkersMIP(ctx, markers, bg);
      }
    }

    if (sliceCanvas.current) {
      const ctx = sliceCanvas.current.getContext("2d");
      if (ctx) {
        const z = 7;
        paintGaussians(ctx, INSTANCE, CANVAS, bg, z / NUM_SLICES, (z + 1) / NUM_SLICES, false);
      }
    }
  }, []);

  return (
    <>
      <h2 className={styles.title}>Colored Dot Tracking</h2>
      <p className={styles.body}>
        Each colored blob is a Gaussian with a single peak, so click the <b>center</b> of each dot in <b>spectrum order</b>, from blue to red. The dots are scattered through a 3D volume across 16 z-slices, so you&apos;ll need to navigate depth to find them.
        <br />
        <br />
        <b>MIP</b> (Max Intensity Projection) shows every dot collapsed onto one image, useful to see the full path at a glance. You can&apos;t place markers while it&apos;s on.
      </p>
      <div className={styles.visualWrap}>
        <div className={styles.visualCol}>
          <canvas ref={mipCanvas} className={styles.canvas} width={CANVAS} height={CANVAS} />
          <div className={styles.visualLabel}>MIP view (all dots, finished)</div>
        </div>
        <div className={styles.visualCol}>
          <canvas ref={sliceCanvas} className={styles.canvas} width={CANVAS} height={CANVAS} />
          <div className={styles.visualLabel}>Single z-slice</div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Page 2: navigation
// ============================================================

type Frame = {
  d: number; // ms duration
  z: number;
  mip: boolean;
  markers: [number, number, number][];
  cursor: "plusZ" | "minusZ" | "mip" | "undo" | "done" | { canvas: [number, number] } | null;
};

const NAV_FRAMES: Frame[] = [
  { d: 700, z: 4, mip: false, markers: [], cursor: "plusZ" },
  { d: 700, z: 5, mip: false, markers: [], cursor: "plusZ" },
  { d: 700, z: 6, mip: false, markers: [], cursor: "plusZ" },
  { d: 700, z: 7, mip: false, markers: [], cursor: "plusZ" },
  { d: 700, z: 8, mip: false, markers: [], cursor: "plusZ" },
  { d: 900, z: 8, mip: false, markers: [], cursor: "minusZ" },
  { d: 700, z: 7, mip: false, markers: [], cursor: "minusZ" },
  { d: 700, z: 6, mip: false, markers: [], cursor: "minusZ" },
  { d: 700, z: 5, mip: false, markers: [], cursor: "minusZ" },
  { d: 1200, z: 4, mip: false, markers: [], cursor: "minusZ" },
];

const UNDO_FRAMES: Frame[] = [
  { d: 900, z: 5, mip: false, markers: [], cursor: { canvas: [0.32, 0.28] } },
  { d: 900, z: 5, mip: false, markers: [[0.32, 0.28, 5]], cursor: "undo" },
  { d: 900, z: 5, mip: false, markers: [], cursor: { canvas: [0.52, 0.46] } },
  { d: 900, z: 5, mip: false, markers: [[0.52, 0.46, 5]], cursor: "done" },
  { d: 1400, z: 5, mip: false, markers: [[0.52, 0.46, 5]], cursor: null },
];

function MockTaskCanvas({ frames }: { frames: Frame[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const plusZRef = useRef<HTMLDivElement>(null);
  const minusZRef = useRef<HTMLDivElement>(null);
  const mipRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let startTime: number | null = null;
    let rafId = 0;

    const cycleTotal = frames.reduce((a, f) => a + f.d, 0);

    function tick(now: number) {
      if (cancelled) return;
      if (startTime === null) startTime = now;
      const t = (now - startTime) % cycleTotal;

      let acc = 0;
      let cur: Frame = frames[0];
      for (const f of frames) {
        if (t < acc + f.d) {
          cur = f;
          break;
        }
        acc += f.d;
      }

      // Render canvas state
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        const bg = INSTANCE.bg_color ?? 0.17;
        if (cur.mip) {
          paintGaussians(ctx, INSTANCE, CANVAS, bg, 0, 1, true);
          drawMarkersMIP(ctx, cur.markers, bg);
        } else {
          paintGaussians(ctx, INSTANCE, CANVAS, bg, cur.z / NUM_SLICES, (cur.z + 1) / NUM_SLICES, false);
          drawMarkersSlice(ctx, cur.markers, cur.z, bg);
        }
      }

      // Position cursor
      const container = containerRef.current;
      const cursor = cursorRef.current;
      if (container && cursor) {
        const containerRect = container.getBoundingClientRect();
        let targetRect: DOMRect | null = null;
        let canvasOffset: [number, number] | null = null;

        if (cur.cursor === "plusZ") targetRect = plusZRef.current?.getBoundingClientRect() ?? null;
        else if (cur.cursor === "minusZ") targetRect = minusZRef.current?.getBoundingClientRect() ?? null;
        else if (cur.cursor === "mip") targetRect = mipRef.current?.getBoundingClientRect() ?? null;
        else if (cur.cursor === "undo") targetRect = undoRef.current?.getBoundingClientRect() ?? null;
        else if (cur.cursor === "done") targetRect = doneRef.current?.getBoundingClientRect() ?? null;
        else if (cur.cursor && typeof cur.cursor === "object") {
          const canvasRect = canvasRef.current?.getBoundingClientRect();
          if (canvasRect) {
            canvasOffset = [
              canvasRect.left + cur.cursor.canvas[0] * canvasRect.width - containerRect.left,
              canvasRect.top + cur.cursor.canvas[1] * canvasRect.height - containerRect.top,
            ];
          }
        }

        if (targetRect) {
          const cx = targetRect.left + targetRect.width / 2 - containerRect.left;
          const cy = targetRect.top + targetRect.height / 2 - containerRect.top;
          cursor.style.left = `${cx - 11}px`;
          cursor.style.top = `${cy - 11}px`;
          cursor.style.opacity = "1";
        } else if (canvasOffset) {
          cursor.style.left = `${canvasOffset[0] - 11}px`;
          cursor.style.top = `${canvasOffset[1] - 11}px`;
          cursor.style.opacity = "1";
        } else {
          cursor.style.opacity = "0";
        }
      }

      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [frames]);

  return (
    <div ref={containerRef} className={styles.taskMock}>
      <canvas ref={canvasRef} className={styles.canvas} width={CANVAS} height={CANVAS} />
      <div className={styles.taskBtnCol}>
        <div ref={plusZRef} className={`${styles.taskBtn} ${styles.plusZ}`}>+z</div>
        <div ref={minusZRef} className={`${styles.taskBtn} ${styles.minusZ}`}>-z</div>
        <div ref={mipRef} className={`${styles.taskBtn} ${styles.mip}`}>MIP</div>
        <div ref={undoRef} className={`${styles.taskBtn} ${styles.undo}`}>Undo</div>
        <div ref={doneRef} className={`${styles.taskBtn} ${styles.done}`}>Done</div>
      </div>
      <div ref={cursorRef} className={styles.cursor} style={{ opacity: 0 }} />
    </div>
  );
}

function Page2() {
  return (
    <>
      <h2 className={styles.title}>Navigate the Volume</h2>
      <p className={styles.body}>
        Use <b>+z</b> to step deeper through slices and <b>-z</b> to step back. Dots fade in and out as you move through depth, so find the right slice before clicking.
      </p>
      <MockTaskCanvas frames={NAV_FRAMES} />
    </>
  );
}

function Page3({ onBegin }: { onBegin: () => void }) {
  return (
    <>
      <h2 className={styles.title}>Fix Mistakes, Then Finish</h2>
      <p className={styles.body}>
        Misplaced a marker? Click <b>Undo</b> to remove the most recent one. When you&apos;ve placed every dot, click <b>Done</b> to submit.
      </p>
      <MockTaskCanvas frames={UNDO_FRAMES} />
      <div style={{ marginTop: 20 }}>
        <button className={styles.beginBtn} onClick={onBegin}>
          Begin Task
        </button>
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  NUM_SLICES,
  paintGaussians,
  drawMarkersSlice,
  drawMarkersMIP,
  type TaskInstance,
} from "@/lib/render-results";
import instanceJson from "@/data/task_022_instance.json";
import styles from "./tutorial.module.css";

const INSTANCE = instanceJson as unknown as TaskInstance;
const CANVAS = 224;
const NUM_PAGES = 5;

type Props = {
  open: boolean;
  onClose: () => void; // skip tutorial entirely, go to task
  onBegin: () => void; // finished tutorial, start task
};

export function Tutorial({ open, onClose, onBegin }: Props) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (open) setPage(0);
  }, [open]);

  if (!open) return null;

  const isLast = page === NUM_PAGES - 1;
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
            {page === 0 && <PageOverview />}
            {page === 1 && <PageMIP />}
            {page === 2 && <PageNavigation />}
            {page === 3 && <PageUndo />}
            {page === 4 && <PageDone onBegin={onBegin} />}
          </div>

          <button
            className={styles.arrow}
            disabled={isLast}
            onClick={() => setPage((p) => Math.min(NUM_PAGES - 1, p + 1))}
            aria-label="Next"
          >
            →
          </button>
        </div>

        <div className={styles.indicator}>
          {page + 1} / {NUM_PAGES}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Page 1: task overview
// ============================================================

function PageOverview() {
  const sliceCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const bg = INSTANCE.bg_color ?? 0.17;
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
        Click the <b>center</b> of each colored dot in <b>spectrum order</b>, from blue to red. The dots are scattered through a 3D volume across several z-slices, so you&apos;ll need to navigate depth to find them.
      </p>
      <div className={styles.visualWrap}>
        <div className={styles.visualCol}>
          <canvas ref={sliceCanvas} className={styles.canvas} width={CANVAS} height={CANVAS} />
          <div className={styles.visualLabel}>One z-slice</div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Page 2: MIP
// ============================================================

function PageMIP() {
  const mipCanvas = useRef<HTMLCanvasElement>(null);
  const sliceCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const bg = INSTANCE.bg_color ?? 0.17;
    if (sliceCanvas.current) {
      const ctx = sliceCanvas.current.getContext("2d");
      if (ctx) {
        const z = 7;
        paintGaussians(ctx, INSTANCE, CANVAS, bg, z / NUM_SLICES, (z + 1) / NUM_SLICES, false);
      }
    }
    if (mipCanvas.current) {
      const ctx = mipCanvas.current.getContext("2d");
      if (ctx) {
        paintGaussians(ctx, INSTANCE, CANVAS, bg, 0, 1, true);
      }
    }
  }, []);

  return (
    <>
      <h2 className={styles.title}>MIP View</h2>
      <p className={styles.body}>
        <b>MIP</b>{" "}(Max Intensity Projection) can be toggled on and off, and shows every dot collapsed onto one image. You can&apos;t place markers while it&apos;s on.
      </p>
      <div className={styles.visualWrap}>
        <div className={styles.visualCol}>
          <canvas ref={sliceCanvas} className={styles.canvas} width={CANVAS} height={CANVAS} />
          <div className={styles.visualLabel}>Single z-slice</div>
        </div>
        <div className={styles.visualCol}>
          <canvas ref={mipCanvas} className={styles.canvas} width={CANVAS} height={CANVAS} />
          <div className={styles.visualLabel}>MIP (all slices)</div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Shared animation engine for pages 3-5
// ============================================================

type Frame = {
  d: number;
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

// task_022 dots actually visible at slice 8 (rendering filter is z in [8/16, 9/16) ):
//   (0.555, 0.758), (0.767, 0.571), (0.720, 0.645)
const WRONG_SPOT: [number, number] = [0.15, 0.15]; // empty top-left at z=8
const RIGHT_SPOT: [number, number] = [0.555, 0.758]; // real z=8 dot

const UNDO_FRAMES: Frame[] = [
  { d: 1000, z: 8, mip: false, markers: [], cursor: { canvas: WRONG_SPOT } },
  { d: 1000, z: 8, mip: false, markers: [[...WRONG_SPOT, 8]], cursor: "undo" },
  { d: 1000, z: 8, mip: false, markers: [], cursor: { canvas: RIGHT_SPOT } },
  { d: 1300, z: 8, mip: false, markers: [[...RIGHT_SPOT, 8]], cursor: null },
];

// Completed annotation = every instance point as a marker, in spectrum order.
const ALL_MARKERS: [number, number, number][] = (INSTANCE.points || []).map(
  (p) => [p.x, p.y, Math.floor(p.z * NUM_SLICES)],
);

const DONE_FRAMES: Frame[] = [
  { d: 2000, z: 0, mip: true, markers: ALL_MARKERS, cursor: null },
  { d: 1800, z: 0, mip: true, markers: ALL_MARKERS, cursor: "done" },
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

function PageNavigation() {
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

function PageUndo() {
  return (
    <>
      <h2 className={styles.title}>Undo Mistakes</h2>
      <p className={styles.body}>
        Misplaced a marker? Click <b>Undo</b> to remove the most recent one and try again.
      </p>
      <MockTaskCanvas frames={UNDO_FRAMES} />
    </>
  );
}

function PageDone({ onBegin }: { onBegin: () => void }) {
  return (
    <>
      <h2 className={styles.title}>Finish the Task</h2>
      <p className={styles.body}>
        When you&apos;ve placed every dot, click <b>Done</b> to submit your annotation.
      </p>
      <MockTaskCanvas frames={DONE_FRAMES} />
      <div style={{ marginTop: 20 }}>
        <button className={styles.beginBtn} onClick={onBegin}>
          Begin Task
        </button>
      </div>
    </>
  );
}

// Renders the full results visualization (3-panel playback + 6 histograms) into
// the given container. Pure DOM/Plotly; the React component just provides the
// container and the data.
//
// If `you` is null, the page renders the cohort view: no green YOU markers on
// histograms, the "You" playback cell shows a randomly chosen cohort member,
// and section text drops the second-person framing.

declare global {
  interface Window {
    Plotly?: {
      react: (el: HTMLElement | string, traces: unknown[], layout: unknown, config?: unknown) => Promise<unknown>;
    };
  }
}

type ClickAction = {
  z?: number;
  mip?: boolean;
  action?: [number, number] | null;
  action_type?: string;
  timestamp_ms?: number;
  canvas_x_normalized?: number;
  canvas_y_normalized?: number;
  marker_z?: number;
};

export type SubmissionData = {
  task_id?: number | null;
  annotator_id?: string | null;
  session_duration_ms?: number;
  markers?: [number, number, number][];
  click_history?: ClickAction[];
};

export type TaskInstance = {
  bg_color?: number;
  points: Array<{
    x: number;
    y: number;
    z: number;
    color: [number, number, number];
    covariance: number[][];
  }>;
};

export type Annotator = {
  id: string;
  raw: SubmissionData;
};

export type ModelData = {
  id: string;
  actions: ClickAction[];
};

export type RenderResultsOpts = {
  container: HTMLElement;
  cohort: Annotator[];
  model: ModelData;
  frontier?: ModelData | null;
  instance: TaskInstance;
  you: Annotator | null;
};

export const NUM_SLICES = 16;
const XY_TOL = 0.02;
const Z_TOL = 1.5;
export const CANVAS_PX = 224;
const PLAYBACK_TOTAL_MS = 22000;
const PLAYBACK_PAUSE_MS = 1500;

const COLOR_COHORT = "rgba(136,136,136,0.5)";
const COLOR_COHORT_BAR_BORDER = "rgba(136,136,136,0.85)";
const COLOR_HIGHLIGHT = "#4ade80";
const COLOR_MODEL = "#a78bfa";

type Normalized = {
  id: string;
  isModel: boolean;
  actions: ClickAction[];
  finalMarkers: [number, number, number][];
  durationMs: number;
  hasRealTime: boolean;
};

function normalizeAnnotator(a: Annotator): Normalized {
  return {
    id: a.id,
    isModel: false,
    actions: a.raw.click_history ?? [],
    finalMarkers: a.raw.markers ?? [],
    durationMs: a.raw.session_duration_ms ?? 0,
    hasRealTime: true,
  };
}

function normalizeModel(m: ModelData): Normalized {
  return {
    id: m.id,
    isModel: true,
    actions: m.actions.map((a, i) => ({ ...a, timestamp_ms: i * 100 })),
    finalMarkers: [],
    durationMs: 0,
    hasRealTime: false,
  };
}

function reconstructMarkers(actions: ClickAction[]): [number, number, number][] {
  const markers: [number, number, number][] = [];
  for (const a of actions) {
    if (a.action_type === "place") {
      const x = a.canvas_x_normalized ?? (a.action ? a.action[0] / 256 : 0);
      const y = a.canvas_y_normalized ?? (a.action ? a.action[1] / 256 : 0);
      const z = a.marker_z ?? a.z ?? 0;
      markers.push([x, y, z]);
    } else if (a.action_type === "undo") {
      markers.pop();
    }
  }
  return markers;
}

function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const m = cost[0].length;
  const size = Math.max(n, m);
  const BIG = 1e18;
  const C: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i < n && j < m ? cost[i][j] : BIG)),
  );
  const u = new Array(size + 1).fill(0);
  const v = new Array(size + 1).fill(0);
  const p = new Array(size + 1).fill(0);
  const way = new Array(size + 1).fill(0);
  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(size + 1).fill(BIG);
    const used = new Array(size + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const cur = C[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= size; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const assignment: number[] = new Array(n).fill(-1);
  for (let j = 1; j <= size; j++) {
    const i = p[j];
    if (i > 0 && i <= n && j <= m) assignment[i - 1] = j - 1;
  }
  return assignment;
}

function pairwiseErrors(markers: [number, number, number][], gt: { x: number; y: number; z_slice: number }[]) {
  if (markers.length === 0) return [];
  const cost = markers.map((m) =>
    gt.map((g) => {
      const dx = m[0] - g.x;
      const dy = m[1] - g.y;
      const dz = (m[2] - g.z_slice) / NUM_SLICES;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }),
  );
  const assignment = hungarian(cost);
  const out: { predIdx: number; gtIdx: number; xyDist: number; zDist: number; matched: boolean }[] = [];
  markers.forEach((m, i) => {
    const j = assignment[i];
    if (j < 0) return;
    const dx = m[0] - gt[j].x;
    const dy = m[1] - gt[j].y;
    const xyDist = Math.sqrt(dx * dx + dy * dy);
    const zDist = m[2] - gt[j].z_slice;
    out.push({
      predIdx: i,
      gtIdx: j,
      xyDist,
      zDist,
      matched: xyDist <= XY_TOL && Math.abs(zDist) <= Z_TOL,
    });
  });
  return out;
}

function computeScore(
  errs: { gtIdx: number; xyDist: number; zDist: number }[],
  gtCount: number,
): number {
  const byGt = new Map<number, { xyDist: number; zDist: number }>();
  for (const e of errs) byGt.set(e.gtIdx, e);
  let sum = 0;
  for (let j = 0; j < gtCount; j++) {
    const e = byGt.get(j);
    if (!e) continue;
    const sxy = Math.max(0, 1 - e.xyDist / XY_TOL);
    const sz = Math.max(0, 1 - Math.abs(e.zDist) / Z_TOL);
    sum += sxy * sz;
  }
  return sum / gtCount;
}

function countTypes(actions: ClickAction[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const a of actions) {
    const t = a.action_type ?? "";
    c[t] = (c[t] ?? 0) + 1;
  }
  return c;
}

function median(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

type Computed = Normalized & {
  markers: [number, number, number][];
  types: Record<string, number>;
  score: number;
  durationS: number;
  canvasMedian: number;
  buttonMedian: number;
};

function computeAll(a: Normalized, gt: { x: number; y: number; z_slice: number }[]): Computed {
  const markers = a.finalMarkers.length ? a.finalMarkers : reconstructMarkers(a.actions);
  const types = countTypes(a.actions);
  const errs = pairwiseErrors(markers, gt);
  const score = computeScore(errs, gt.length);

  const canvasGaps: number[] = [];
  const buttonGaps: number[] = [];
  for (let i = 1; i < a.actions.length; i++) {
    const prev = a.actions[i - 1].timestamp_ms;
    const cur = a.actions[i].timestamp_ms;
    if (prev == null || cur == null) continue;
    const gap = (cur - prev) / 1000;
    if (a.actions[i].action_type === "place") canvasGaps.push(gap);
    else buttonGaps.push(gap);
  }
  const lastT = a.actions.length ? a.actions[a.actions.length - 1].timestamp_ms ?? 0 : 0;
  const durationMs = a.durationMs || lastT;

  return {
    ...a,
    markers,
    types,
    score,
    durationS: durationMs / 1000,
    canvasMedian: median(canvasGaps),
    buttonMedian: median(buttonGaps),
  };
}

// ---------- Playback rendering ----------

export function invertMatrix2x2(m: number[][]): number[][] {
  const a = m[0][0], b = m[0][1], c = m[1][0], d = m[1][1];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) return [[1 / 4, 0], [0, 1 / 4]];
  return [[d / det, -b / det], [-c / det, a / det]];
}

export function paintGaussians(
  ctx: CanvasRenderingContext2D,
  sample: TaskInstance,
  xySize: number,
  bgColor: number,
  zMin: number,
  zMax: number,
  mip: boolean,
) {
  const img = ctx.createImageData(xySize, xySize);
  const data = img.data;
  const rArr = new Float32Array(xySize * xySize);
  const gArr = new Float32Array(xySize * xySize);
  const bArr = new Float32Array(xySize * xySize);
  for (const pt of sample.points) {
    if (!mip && (pt.z < zMin || pt.z >= zMax)) continue;
    const px = pt.x * xySize;
    const py = pt.y * xySize;
    const cov = [
      [pt.covariance[0][0] * xySize * xySize, pt.covariance[0][1] * xySize * xySize],
      [pt.covariance[1][0] * xySize * xySize, pt.covariance[1][1] * xySize * xySize],
    ];
    const inv = invertMatrix2x2(cov);
    const [r, g, b] = pt.color;
    const maxSigma = Math.max(Math.sqrt(Math.abs(cov[0][0])), Math.sqrt(Math.abs(cov[1][1])));
    const radius = Math.min(xySize, maxSigma * 4);
    const x0 = Math.max(0, Math.floor(px - radius));
    const x1 = Math.min(xySize, Math.ceil(px + radius));
    const y0 = Math.max(0, Math.floor(py - radius));
    const y1 = Math.min(xySize, Math.ceil(py + radius));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = x - px;
        const dy = y - py;
        const dSq = inv[0][0] * dx * dx + 2 * inv[0][1] * dx * dy + inv[1][1] * dy * dy;
        const I = Math.exp(-0.5 * dSq);
        const idx = y * xySize + x;
        rArr[idx] = Math.max(rArr[idx], I * r);
        gArr[idx] = Math.max(gArr[idx], I * g);
        bArr[idx] = Math.max(bArr[idx], I * b);
      }
    }
  }
  for (let i = 0; i < xySize * xySize; i++) {
    const a = Math.max(rArr[i], gArr[i], bArr[i]);
    const fr = rArr[i] + bgColor * (1 - a);
    const fg = gArr[i] + bgColor * (1 - a);
    const fb = bArr[i] + bgColor * (1 - a);
    data[i * 4] = Math.min(255, Math.round(fr * 255));
    data[i * 4 + 1] = Math.min(255, Math.round(fg * 255));
    data[i * 4 + 2] = Math.min(255, Math.round(fb * 255));
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function drawMarkersSlice(
  ctx: CanvasRenderingContext2D,
  markers: [number, number, number][],
  currentZ: number,
  bgColor: number,
  canvasPx: number = CANVAS_PX,
) {
  const c = bgColor < 0.5 ? "rgb(255,255,255)" : "rgb(0,0,0)";
  for (const [mx, my, mz] of markers) {
    const px = mx * canvasPx;
    const py = my * canvasPx;
    const dz = Math.abs(currentZ - mz);
    let radius;
    let filled = false;
    if (dz === 0) radius = 7;
    else if (dz === 1) radius = 4;
    else {
      radius = 2;
      filled = true;
    }
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    if (filled) {
      ctx.fillStyle = c;
      ctx.fill();
    } else {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

export function drawMarkersMIP(
  ctx: CanvasRenderingContext2D,
  markers: [number, number, number][],
  bgColor: number,
  canvasPx: number = CANVAS_PX,
) {
  const c = bgColor < 0.5 ? "rgb(255,255,255)" : "rgb(0,0,0)";
  if (markers.length >= 2) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(markers[0][0] * canvasPx, markers[0][1] * canvasPx);
    for (let i = 1; i < markers.length; i++) {
      ctx.lineTo(markers[i][0] * canvasPx, markers[i][1] * canvasPx);
    }
    ctx.stroke();
  }
  for (const [mx, my] of markers) {
    ctx.beginPath();
    ctx.arc(mx * canvasPx, my * canvasPx, 7, 0, Math.PI * 2);
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function replayState(actions: ClickAction[], idx: number) {
  let z = 0;
  let mip = false;
  const markers: [number, number, number][] = [];
  for (let i = 0; i <= idx && i < actions.length; i++) {
    const a = actions[i];
    if (a.action_type === "+z_1") z = Math.min(NUM_SLICES - 1, z + 1);
    else if (a.action_type === "-z_1") z = Math.max(0, z - 1);
    else if (a.action_type === "mip") mip = !mip;
    else if (a.action_type === "place") {
      const x = a.canvas_x_normalized ?? (a.action ? a.action[0] / 256 : 0);
      const y = a.canvas_y_normalized ?? (a.action ? a.action[1] / 256 : 0);
      const mz = a.marker_z ?? a.z ?? 0;
      markers.push([x, y, mz]);
    } else if (a.action_type === "undo") {
      markers.pop();
    }
  }
  return { z, mip, markers };
}

// ---------- Playback "GUI" frame: faithful scaled rendition of task_000.html ----------

// Sized to roughly match the live task page's canvas:button proportions
// (real GUI is ~540:126 canvas:controls; here we use 240:84 ≈ 2.9:1, a
// compromise between exact match and readable text in small playback panels).
const PLAY_GUI_W = 380;
const PLAY_GUI_H = 304;
const PLAY_OUTER_PAD = 8;

const PLAY_PANEL_X = PLAY_OUTER_PAD;
const PLAY_PANEL_Y = PLAY_OUTER_PAD;
const PLAY_PANEL_W = PLAY_GUI_W - 2 * PLAY_OUTER_PAD; // 364
const PLAY_PANEL_H = 264;
const PLAY_PANEL_RADIUS = 12;

const PLAY_INNER_PAD = 12;
const PLAY_DOT_PX = 240;
const PLAY_CANVAS_X = PLAY_PANEL_X + PLAY_INNER_PAD;
const PLAY_CANVAS_Y = PLAY_PANEL_Y + PLAY_INNER_PAD;
const PLAY_CANVAS_RADIUS = 6;

const PLAY_CTRL_GAP = 16;
const PLAY_BTN_X = PLAY_CANVAS_X + PLAY_DOT_PX + PLAY_CTRL_GAP;
const PLAY_BTN_W = PLAY_PANEL_W - PLAY_INNER_PAD - PLAY_DOT_PX - PLAY_CTRL_GAP - PLAY_INNER_PAD;
const PLAY_BTN_H = 28;
const PLAY_BTN_GAP = 8;
const PLAY_BTN_TOTAL = 5 * PLAY_BTN_H + 4 * PLAY_BTN_GAP; // 172
const PLAY_BTN_Y_START = PLAY_PANEL_Y + (PLAY_PANEL_H - PLAY_BTN_TOTAL) / 2;

const PLAY_STATUS_Y = PLAY_PANEL_Y + PLAY_PANEL_H + 6;
const PLAY_STATUS_H = PLAY_GUI_H - PLAY_STATUS_Y - PLAY_OUTER_PAD;

const PLAY_BTNS = (
  [
    { id: "+z_1", label: "+z",   color: "#4ade80", filled: false },
    { id: "-z_1", label: "-z",   color: "#f87171", filled: false },
    { id: "mip",  label: "MIP",  color: "#a78bfa", filled: false },
    { id: "undo", label: "Undo", color: "#f87171", filled: false },
    { id: "done", label: "Done", color: "#00d4aa", filled: true },
  ] as const
).map((b, i) => ({ ...b, x: PLAY_BTN_X, y: PLAY_BTN_Y_START + i * (PLAY_BTN_H + PLAY_BTN_GAP) }));

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cursorPosForAction(a: ClickAction | undefined): { x: number; y: number } | null {
  if (!a) return null;
  if (a.action_type === "place") {
    const cx = a.canvas_x_normalized ?? (a.action ? a.action[0] / 256 : null);
    const cy = a.canvas_y_normalized ?? (a.action ? a.action[1] / 256 : null);
    if (cx == null || cy == null) return null;
    return { x: PLAY_CANVAS_X + cx * PLAY_DOT_PX, y: PLAY_CANVAS_Y + cy * PLAY_DOT_PX };
  }
  const btn = PLAY_BTNS.find((b) => b.id === a.action_type);
  if (btn) return { x: btn.x + PLAY_BTN_W / 2, y: btn.y + PLAY_BTN_H / 2 };
  return null;
}

function drawCursorX(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "rgb(248, 113, 113)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
  ctx.stroke();
}

function renderGuiFrame(canvas: HTMLCanvasElement, actions: ClickAction[], idx: number, instance: TaskInstance) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { z: 0, mip: false, markers: [] };
  const s = replayState(actions, idx);
  const bg = instance.bg_color ?? 0.17;

  // Outer page background (pure black, matches task page)
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, PLAY_GUI_W, PLAY_GUI_H);

  // main-area panel: bg-panel rounded with border
  ctx.fillStyle = "#14151a";
  roundedRect(ctx, PLAY_PANEL_X, PLAY_PANEL_Y, PLAY_PANEL_W, PLAY_PANEL_H, PLAY_PANEL_RADIUS);
  ctx.fill();
  ctx.strokeStyle = "#2a2b33";
  ctx.lineWidth = 1;
  roundedRect(ctx, PLAY_PANEL_X + 0.5, PLAY_PANEL_Y + 0.5, PLAY_PANEL_W - 1, PLAY_PANEL_H - 1, PLAY_PANEL_RADIUS);
  ctx.stroke();

  // canvas-wrapper: rounded black region the dot canvas sits inside
  ctx.save();
  roundedRect(ctx, PLAY_CANVAS_X, PLAY_CANVAS_Y, PLAY_DOT_PX, PLAY_DOT_PX, PLAY_CANVAS_RADIUS);
  ctx.clip();
  // Render dots into offscreen at PLAY_DOT_PX so the rendering math is exact.
  const off = document.createElement("canvas");
  off.width = PLAY_DOT_PX;
  off.height = PLAY_DOT_PX;
  const offCtx = off.getContext("2d");
  if (offCtx) {
    if (s.mip) {
      paintGaussians(offCtx, instance, PLAY_DOT_PX, bg, 0, 1, true);
      drawMarkersMIP(offCtx, s.markers, bg, PLAY_DOT_PX);
    } else {
      paintGaussians(offCtx, instance, PLAY_DOT_PX, bg, s.z / NUM_SLICES, (s.z + 1) / NUM_SLICES, false);
      drawMarkersSlice(offCtx, s.markers, s.z, bg, PLAY_DOT_PX);
    }
    ctx.drawImage(off, PLAY_CANVAS_X, PLAY_CANVAS_Y);
  }
  ctx.restore();

  // Buttons (match task_000.html styling: 2px border, monospace, rounded 6px)
  ctx.font = "600 12px ui-monospace, 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const b of PLAY_BTNS) {
    const isMipActive = b.id === "mip" && s.mip;
    let fillCol: string, textCol: string, borderCol: string;
    if (isMipActive) {
      fillCol = "#f87171"; textCol = "#000"; borderCol = "#f87171"; // MIP active = red bg + dark text
    } else if (b.filled) {
      fillCol = b.color; textCol = "#000"; borderCol = b.color;     // Done = cyan bg
    } else {
      fillCol = "#14151a"; textCol = b.color; borderCol = b.color;  // outlined buttons
    }
    ctx.fillStyle = fillCol;
    roundedRect(ctx, b.x, b.y, PLAY_BTN_W, PLAY_BTN_H, 5);
    ctx.fill();
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 2;
    roundedRect(ctx, b.x + 1, b.y + 1, PLAY_BTN_W - 2, PLAY_BTN_H - 2, 5);
    ctx.stroke();
    ctx.fillStyle = textCol;
    ctx.fillText(b.label, b.x + PLAY_BTN_W / 2, b.y + PLAY_BTN_H / 2);
  }

  // Status bar (bg-panel, border, rounded)
  ctx.fillStyle = "#14151a";
  roundedRect(ctx, PLAY_OUTER_PAD, PLAY_STATUS_Y, PLAY_PANEL_W, PLAY_STATUS_H, 6);
  ctx.fill();
  ctx.strokeStyle = "#2a2b33";
  ctx.lineWidth = 1;
  roundedRect(ctx, PLAY_OUTER_PAD + 0.5, PLAY_STATUS_Y + 0.5, PLAY_PANEL_W - 1, PLAY_STATUS_H - 1, 6);
  ctx.stroke();
  ctx.font = "500 11px ui-monospace, 'JetBrains Mono', monospace";
  ctx.fillStyle = "#8b8d97";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const statusMidY = PLAY_STATUS_Y + PLAY_STATUS_H / 2;
  ctx.fillText("Z: ", PLAY_OUTER_PAD + 12, statusMidY);
  ctx.fillStyle = "#e8e9ed";
  ctx.fillText(String(s.z), PLAY_OUTER_PAD + 28, statusMidY);
  ctx.textAlign = "right";
  ctx.fillStyle = "#e8e9ed";
  ctx.fillText(String(s.markers.length), PLAY_OUTER_PAD + PLAY_PANEL_W - 12, statusMidY);
  ctx.fillStyle = "#8b8d97";
  const pointsLabel = "Points: ";
  const ptsW = ctx.measureText(String(s.markers.length)).width;
  ctx.fillText(pointsLabel, PLAY_OUTER_PAD + PLAY_PANEL_W - 12 - ptsW - 4, statusMidY);

  // Red X cursor at the current action's click position (drawn last, on top)
  if (idx >= 0 && idx < actions.length) {
    const pos = cursorPosForAction(actions[idx]);
    if (pos) drawCursorX(ctx, pos.x, pos.y);
  }

  return s;
}

// ---------- Histogram ----------

type MetricOpts = {
  divId: string;
  valueOf: (c: Computed) => number;
  xTitle: string;
  fixedRange?: [number, number];
  binWidth?: number;
  fmt: (v: number) => string;
  excludeModel?: boolean;
  outlierAbove?: number;
};

function renderMetricHist(
  computed: Computed[],
  modelComp: Computed | null,
  youId: string | null,
  opts: MetricOpts,
) {
  const cohort = computed.filter((c) => !c.isModel);
  const rawVals = cohort.map(opts.valueOf).filter((v) => Number.isFinite(v));
  const youComp = youId ? computed.find((c) => c.id === youId) : null;
  const rawYou = youComp ? opts.valueOf(youComp) : NaN;
  const rawModel = opts.excludeModel || !modelComp ? NaN : opts.valueOf(modelComp);
  const fmt = opts.fmt;

  const cap = opts.outlierAbove;
  const inRange = (v: number) => cap == null || !Number.isFinite(v) || v <= cap;
  const vals = rawVals.filter(inRange);
  const nClipped = cap != null ? rawVals.length - vals.length : 0;
  const pinIfOver = (v: number) => (cap != null && Number.isFinite(v) && v > cap ? cap : v);
  const youVal = pinIfOver(rawYou);
  const youClipped = cap != null && Number.isFinite(rawYou) && rawYou > cap;
  const modelVal = pinIfOver(rawModel);
  const modelClipped = cap != null && Number.isFinite(rawModel) && rawModel > cap;

  let xMin: number, xMax: number;
  if (opts.fixedRange) {
    [xMin, xMax] = opts.fixedRange;
  } else {
    const all = [...vals, modelVal, youVal].filter(Number.isFinite);
    if (all.length === 0) {
      xMin = 0;
      xMax = 1;
    } else {
      const lo = Math.min(...all);
      const hi = Math.max(...all);
      xMin = Math.max(0, lo - (hi - lo) * 0.1);
      xMax = hi + (hi - lo) * 0.15;
      if (xMax === xMin) xMax = xMin + 1;
    }
  }
  const binWidth = opts.binWidth || (xMax - xMin) / 20;
  const binEdges: number[] = [];
  for (let b = xMin; b <= xMax + binWidth * 0.5; b += binWidth) binEdges.push(b);
  const binCenters = binEdges.slice(0, -1).map((e) => e + binWidth / 2);
  const counts = new Array(binCenters.length).fill(0);
  for (const v of vals) {
    const idx = Math.min(binCenters.length - 1, Math.max(0, Math.floor((v - xMin) / binWidth)));
    counts[idx]++;
  }
  const fractions = counts.map((c) => (vals.length > 0 ? c / vals.length : 0));

  const traces = [
    {
      type: "bar",
      x: binCenters,
      y: fractions,
      width: binWidth * 0.95,
      marker: { color: COLOR_COHORT, line: { color: COLOR_COHORT_BAR_BORDER, width: 1 } },
      hoverinfo: "skip",
    },
  ];

  const annBox = (color: string) => ({
    showarrow: false,
    font: { color, size: 16, family: "Inter, system-ui" },
    bgcolor: "rgba(10,10,12,0.92)",
    bordercolor: color,
    borderwidth: 1,
    borderpad: 8,
  });

  const shapes: unknown[] = [];
  const annotations: unknown[] = [];

  if (Number.isFinite(youVal) && youId) {
    shapes.push({
      type: "line",
      x0: youVal,
      x1: youVal,
      yref: "paper",
      y0: 0,
      y1: 1,
      line: { color: COLOR_HIGHLIGHT, width: 3 },
    });
    annotations.push({
      x: youVal,
      xref: "x",
      yref: "paper",
      y: 0.98,
      yanchor: "top",
      text: `<b>YOU:</b> ${youClipped ? "≥" : ""}${fmt(youVal)}`,
      ...annBox(COLOR_HIGHLIGHT),
      xanchor: youVal > (xMin + xMax) / 2 ? "right" : "left",
    });
  }
  if (Number.isFinite(modelVal)) {
    shapes.push({
      type: "line",
      x0: modelVal,
      x1: modelVal,
      yref: "paper",
      y0: 0,
      y1: 1,
      line: { color: COLOR_MODEL, width: 2.5, dash: "dash" },
    });
    annotations.push({
      x: modelVal,
      xref: "x",
      yref: "paper",
      y: youId ? 0.85 : 0.98,
      yanchor: "top",
      text: `<b>MODEL:</b> ${modelClipped ? "≥" : ""}${fmt(modelVal)}`,
      ...annBox(COLOR_MODEL),
      xanchor: modelVal > (xMin + xMax) / 2 ? "right" : "left",
    });
  }
  if (nClipped > 0 && cap != null) {
    annotations.push({
      xref: "paper",
      x: 1,
      yref: "paper",
      y: 1,
      xanchor: "right",
      yanchor: "top",
      text: `${nClipped} outlier${nClipped > 1 ? "s" : ""} excluded (>${fmt(cap)})`,
      showarrow: false,
      font: { color: "#8b8d97", size: 12 },
    });
  }

  const layout = {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { color: "#e8e9ed", family: "Inter, system-ui", size: 14 },
    margin: { l: 60, r: 20, t: 20, b: 60 },
    xaxis: {
      gridcolor: "#2a2b33",
      zerolinecolor: "#2a2b33",
      title: { text: opts.xTitle, font: { size: 18 } },
      tickfont: { size: 13 },
      range: [xMin, xMax],
    },
    yaxis: {
      gridcolor: "#2a2b33",
      zerolinecolor: "#2a2b33",
      title: { text: "Fraction of Annotators", font: { size: 18 } },
      tickfont: { size: 13 },
      rangemode: "tozero",
    },
    height: 380,
    showlegend: false,
    shapes,
    annotations,
  };

  window.Plotly?.react(opts.divId, traces, layout, { responsive: true, displayModeBar: false });
}

export function renderResults(opts: RenderResultsOpts): () => void {
  const { container, cohort, model, instance, you } = opts;
  if (!window.Plotly) return () => undefined;

  const allNorm = [...cohort.map(normalizeAnnotator), normalizeModel(model)];
  if (you && !cohort.find((c) => c.id === you.id)) allNorm.unshift(normalizeAnnotator(you));

  const gt = instance.points.map((p) => ({
    x: p.x,
    y: p.y,
    z_slice: p.z * NUM_SLICES - 0.5,
  }));
  const computed = allNorm.map((n) => computeAll(n, gt));
  const modelComp = computed.find((c) => c.isModel) ?? null;

  // Pick playback annotators
  const youComp = you ? computed.find((c) => c.id === you.id) : null;
  const youId = you ? you.id : null;
  const playbackHumanComp =
    youComp ??
    (() => {
      // Cohort view picks a random human for the "An Annotator" playback.
      // Filter out outliers (>175 actions) so the gif isn't dominated by a
      // hesitant or distracted annotator. Fall back to the full set if the
      // filter empties.
      const humans = computed.filter((c) => !c.isModel);
      const trimmed = humans.filter((c) => c.actions.length <= 175);
      const pool = trimmed.length > 0 ? trimmed : humans;
      return pool[Math.floor(Math.random() * pool.length)];
    })();

  // Render the histograms
  renderMetricHist(computed, modelComp, youId, {
    divId: "plot-accuracy-hist",
    valueOf: (c) => c.score,
    xTitle: "Accuracy Score",
    fixedRange: [0, 1.02],
    fmt: (v) => v.toFixed(3),
  });
  renderMetricHist(computed, modelComp, youId, {
    divId: "plot-mip-hist",
    valueOf: (c) => c.types.mip ?? 0,
    xTitle: "Number of MIP Toggles",
    binWidth: 1,
    fmt: (v) => Math.round(v) + " toggles",
  });
  renderMetricHist(computed, modelComp, youId, {
    divId: "plot-nav-hist",
    valueOf: (c) => (c.types["+z_1"] ?? 0) + (c.types["-z_1"] ?? 0),
    xTitle: "Number of Z-Slice Navigations",
    fmt: (v) => Math.round(v) + " clicks",
  });
  renderMetricHist(computed, modelComp, youId, {
    divId: "plot-duration-hist",
    valueOf: (c) => (c.hasRealTime ? c.durationS : NaN),
    xTitle: "Time to Complete (seconds)",
    fmt: (v) => v.toFixed(0) + " seconds",
    excludeModel: true,
    outlierAbove: 250,
  });
  renderMetricHist(computed, modelComp, youId, {
    divId: "plot-hesit-canvas-hist",
    valueOf: (c) => c.canvasMedian,
    xTitle: "Median Pause Before Placing a Dot (seconds)",
    fmt: (v) => v.toFixed(2) + " seconds",
    excludeModel: true,
    outlierAbove: 5,
  });
  renderMetricHist(computed, modelComp, youId, {
    divId: "plot-hesit-button-hist",
    valueOf: (c) => c.buttonMedian,
    xTitle: "Median Pause Before a Button Click (seconds)",
    fmt: (v) => v.toFixed(2) + " seconds",
    excludeModel: true,
    outlierAbove: 2,
  });

  // Playback engine
  let rafId = 0;
  let paused = false;
  let pauseAt = 0;
  let startTime: number | null = null;

  const youCanvas = container.querySelector<HTMLCanvasElement>("#cmp-you");
  const modelCanvas = container.querySelector<HTMLCanvasElement>("#cmp-model");
  const frontierCanvas = container.querySelector<HTMLCanvasElement>("#cmp-frontier");
  const youStatus = container.querySelector("#cmp-you-status");
  const modelStatus = container.querySelector("#cmp-model-status");
  const frontierStatus = container.querySelector("#cmp-frontier-status");
  const fill = container.querySelector<HTMLElement>("#play-fill");
  const timeEl = container.querySelector("#play-time");
  const playPauseBtn = container.querySelector<HTMLButtonElement>("#play-pause");

  const youActions = playbackHumanComp.actions;
  const modelActions = computed.find((c) => c.isModel)?.actions ?? [];
  const frontierActions = opts.frontier?.actions ?? [];

  function tick(now: number) {
    if (startTime === null) startTime = now;
    const elapsed = paused ? pauseAt : now - startTime;
    const cycle = PLAYBACK_TOTAL_MS + PLAYBACK_PAUSE_MS;
    const local = elapsed % cycle;
    const frac = Math.min(1, local / PLAYBACK_TOTAL_MS);
    const tickPanel = (canvas: HTMLCanvasElement | null, statusEl: Element | null, actions: ClickAction[]) => {
      if (!canvas || actions.length === 0) return;
      const idx = Math.min(actions.length - 1, Math.floor(frac * actions.length));
      renderGuiFrame(canvas, actions, idx, instance);
      if (statusEl) statusEl.textContent = `${idx + 1} / ${actions.length}`;
    };
    tickPanel(youCanvas, youStatus, youActions);
    tickPanel(modelCanvas, modelStatus, modelActions);
    tickPanel(frontierCanvas, frontierStatus, frontierActions);
    if (fill) fill.style.width = `${frac * 100}%`;
    if (timeEl) {
      timeEl.textContent = `${(local / 1000).toFixed(1)}s / ${(PLAYBACK_TOTAL_MS / 1000).toFixed(1)}s`;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  function onPauseClick() {
    if (paused) {
      if (startTime !== null) startTime = performance.now() - pauseAt;
      paused = false;
      if (playPauseBtn) playPauseBtn.textContent = "⏸ Pause";
    } else {
      if (startTime !== null) pauseAt = performance.now() - startTime;
      paused = true;
      if (playPauseBtn) playPauseBtn.textContent = "▶ Play";
    }
  }
  playPauseBtn?.addEventListener("click", onPauseClick);

  return () => {
    cancelAnimationFrame(rafId);
    playPauseBtn?.removeEventListener("click", onPauseClick);
  };
}

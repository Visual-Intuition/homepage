// Run Gemini 2.5 Pro (via OpenRouter) on the colored dot tracking task as a
// GUI agent: the model sees a screenshot of the full GUI and outputs a pixel
// (x, y) click; the simulator hit-tests against canvas / button regions and
// dispatches the action exactly like a human's click would.
//
// Saves the action trace to src/data/task_000_frontier_vlm.json (same schema
// as the paper's virtual model trace).
//
// Usage (from src/):
//   node --env-file=.env.local scripts/run_frontier_vlm.mjs

import { createCanvas } from "@napi-rs/canvas";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTANCE_PATH = resolve(__dirname, "../data/task_000_instance.json");
const OUTPUT_PATH = resolve(__dirname, "../data/task_000_frontier_vlm.json");
const LOG_PATH = resolve(__dirname, "../data/task_000_frontier_vlm.log.txt");
const MODEL = "google/gemini-2.5-pro";
const NUM_SLICES = 16;
const MAX_ACTIONS = 100;

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error("OPENROUTER_API_KEY required in env"); process.exit(1); }

const INSTANCE = JSON.parse(readFileSync(INSTANCE_PATH, "utf-8"));

// ---------- GUI layout ----------
const CANVAS_PX = 256;             // canvas size in pixels
const PAD = 10;
const BTN_W = 110;
const BTN_H = 40;
const BTN_GAP = 8;
const BTN_X = PAD + CANVAS_PX + 16; // start of button column
const GUI_W = BTN_X + BTN_W + PAD;
const GUI_H = PAD + CANVAS_PX + 40; // canvas + status bar

const BTNS = [
  { id: "+z_1", label: "+z",   x: BTN_X, y: PAD + 0  * (BTN_H + BTN_GAP), color: "#4ade80" },
  { id: "-z_1", label: "-z",   x: BTN_X, y: PAD + 1  * (BTN_H + BTN_GAP), color: "#f87171" },
  { id: "mip",  label: "MIP",  x: BTN_X, y: PAD + 2  * (BTN_H + BTN_GAP), color: "#a78bfa" },
  { id: "undo", label: "Undo", x: BTN_X, y: PAD + 3  * (BTN_H + BTN_GAP), color: "#f87171" },
  { id: "done", label: "Done", x: BTN_X, y: PAD + 4  * (BTN_H + BTN_GAP), color: "#00d4aa" },
];

function hitTest(x, y) {
  if (x >= PAD && x < PAD + CANVAS_PX && y >= PAD && y < PAD + CANVAS_PX) {
    return { kind: "canvas", cx: (x - PAD) / CANVAS_PX, cy: (y - PAD) / CANVAS_PX };
  }
  for (const b of BTNS) {
    if (x >= b.x && x < b.x + BTN_W && y >= b.y && y < b.y + BTN_H) {
      return { kind: "button", id: b.id };
    }
  }
  return { kind: "miss" };
}

// ---------- Dot rendering (ported from src/lib/render-results.ts) ----------

function invertMatrix2x2(m) {
  const a = m[0][0], b = m[0][1], c = m[1][0], d = m[1][1];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) return [[1 / 4, 0], [0, 1 / 4]];
  return [[d / det, -b / det], [-c / det, a / det]];
}

function paintGaussians(ctx, ox, oy, sample, xySize, bgColor, zMin, zMax, mip) {
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
    data[i * 4]     = Math.min(255, Math.round(fr * 255));
    data[i * 4 + 1] = Math.min(255, Math.round(fg * 255));
    data[i * 4 + 2] = Math.min(255, Math.round(fb * 255));
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, ox, oy);
}

function drawMarkersSlice(ctx, ox, oy, markers, currentZ, bgColor) {
  const c = bgColor < 0.5 ? "rgb(255,255,255)" : "rgb(0,0,0)";
  for (const [mx, my, mz] of markers) {
    const px = ox + mx * CANVAS_PX;
    const py = oy + my * CANVAS_PX;
    const dz = Math.abs(currentZ - mz);
    let radius, filled = false;
    if (dz === 0) radius = 8;
    else if (dz === 1) radius = 4;
    else { radius = 2; filled = true; }
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    if (filled) { ctx.fillStyle = c; ctx.fill(); }
    else { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke(); }
  }
}

function drawMarkersMIP(ctx, ox, oy, markers, bgColor) {
  const c = bgColor < 0.5 ? "rgb(255,255,255)" : "rgb(0,0,0)";
  if (markers.length >= 2) {
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox + markers[0][0] * CANVAS_PX, oy + markers[0][1] * CANVAS_PX);
    for (let i = 1; i < markers.length; i++) ctx.lineTo(ox + markers[i][0] * CANVAS_PX, oy + markers[i][1] * CANVAS_PX);
    ctx.stroke();
  }
  for (const [mx, my] of markers) {
    ctx.beginPath();
    ctx.arc(ox + mx * CANVAS_PX, oy + my * CANVAS_PX, 8, 0, Math.PI * 2);
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
  }
}

// ---------- Full GUI render ----------

function renderGui(state) {
  const canvas = createCanvas(GUI_W, GUI_H);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, GUI_W, GUI_H);

  // Canvas region (dots)
  const bg = INSTANCE.bg_color ?? 0.17;
  if (state.mip) {
    paintGaussians(ctx, PAD, PAD, INSTANCE, CANVAS_PX, bg, 0, 1, true);
    drawMarkersMIP(ctx, PAD, PAD, state.markers, bg);
  } else {
    paintGaussians(ctx, PAD, PAD, INSTANCE, CANVAS_PX, bg, state.z / NUM_SLICES, (state.z + 1) / NUM_SLICES, false);
    drawMarkersSlice(ctx, PAD, PAD, state.markers, state.z, bg);
  }

  // Buttons
  ctx.font = "600 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const b of BTNS) {
    ctx.fillStyle = b.id === "done" ? b.color : "#14151a";
    ctx.fillRect(b.x, b.y, BTN_W, BTN_H);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, BTN_W, BTN_H);
    if (b.id === "mip" && state.mip) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, BTN_W, BTN_H);
      ctx.fillStyle = "#0a0a0c";
    } else {
      ctx.fillStyle = b.id === "done" ? "#0a0a0c" : b.color;
    }
    ctx.fillText(b.label, b.x + BTN_W / 2, b.y + BTN_H / 2);
  }

  // Status bar
  ctx.fillStyle = "#8b8d97";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Z: ${state.z}    Points: ${state.markers.length}`, PAD, PAD + CANVAS_PX + 22);

  return canvas.toBuffer("image/png");
}

// ---------- Model call ----------

const SYSTEM_PROMPT = `You are doing the Colored Dot Tracking task.

Click the center of each colored dot in spectrum order, from blue to red. The dots are scattered through a 3D volume across 16 z-slices, so you'll need to navigate depth to find them.

MIP (Max Intensity Projection) can be toggled on and off, and shows every dot collapsed onto one image. You can't place markers while it's on.

Use +z to step deeper through slices and -z to step back. Dots fade in and out as you move through depth, so find the right slice before clicking.

Misplaced a marker? Click Undo to remove the most recent one and try again.

When you've placed every dot, click Done to submit your annotation.

Each turn you will see the full GUI as an image. To act, output the normalized coordinate (x, y) of the location in the image where you want to click, as raw JSON only:

  {"x": <float between 0 and 1>, "y": <float between 0 and 1>}

(0, 0) is the top-left corner of the image, (1, 1) is the bottom-right corner. Clicking inside the canvas area places a marker on the current z-slice. Clicking on a button performs that button's action.

Reply with the JSON only, no other text and no markdown fences.`;

async function askModel(pngBuf) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Where do you click next? Reply with only the JSON {\"x\":<0..1>,\"y\":<0..1>} (normalized image coordinates)." },
          { type: "image_url", image_url: { url: `data:image/png;base64,${pngBuf.toString("base64")}` } },
        ],
      },
    ],
    max_tokens: 4000,
    // Pro requires reasoning; suppress it from the response body so we only
    // see the final JSON.
    reasoning: { exclude: true },
  };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseClick(text) {
  const trimmed = text.trim();
  try { const o = JSON.parse(trimmed); if (Number.isFinite(o.x) && Number.isFinite(o.y)) return { x: o.x, y: o.y }; } catch {}
  const m = trimmed.match(/\{[\s\S]*?\}/);
  if (m) {
    try { const o = JSON.parse(m[0]); if (Number.isFinite(o.x) && Number.isFinite(o.y)) return { x: o.x, y: o.y }; } catch {}
  }
  return null;
}

// ---------- Main loop ----------

writeFileSync(LOG_PATH, `frontier vlm run @ ${new Date().toISOString()}\n`);
function log(s) { console.log(s); appendFileSync(LOG_PATH, s + "\n"); }

async function run() {
  const state = { z: 0, mip: false, markers: [] };
  const trace = [];
  let step = 0;

  log(`Starting Gemini 2.5 Pro on task_000 (target: ${INSTANCE.points.length} dots, GUI ${GUI_W}x${GUI_H}, max ${MAX_ACTIONS} actions).`);

  while (step < MAX_ACTIONS) {
    const png = renderGui(state);
    let responseText;
    try {
      responseText = await askModel(png);
    } catch (err) {
      log(`Step ${step}: API error: ${err.message}`);
      break;
    }
    log(`Step ${step} response: ${responseText.replace(/\s+/g, " ").slice(0, 200)}`);

    const click = parseClick(responseText);
    if (!click) {
      log(`  -> unparseable; advancing without state change.`);
      step++;
      continue;
    }
    // Model outputs normalized [0,1]; convert to pixel coords for hit-testing.
    const pxX = Math.round(click.x * GUI_W);
    const pxY = Math.round(click.y * GUI_H);

    const hit = hitTest(pxX, pxY);
    let actionType, actionCoords = [pxX, pxY], extraFields = {};

    if (hit.kind === "miss") {
      log(`  -> click (${click.x}, ${click.y}) hit nothing; advancing.`);
      step++;
      continue;
    }

    if (hit.kind === "canvas") {
      if (state.mip) {
        log(`  -> canvas click while MIP on; ignored.`);
        step++;
        continue;
      }
      actionType = "place";
      extraFields = { canvas_x_normalized: hit.cx, canvas_y_normalized: hit.cy, marker_z: state.z };
      trace.push({ z: state.z, mip: state.mip, n_pts: state.markers.length, action: [hit.cx * CANVAS_PX, hit.cy * CANVAS_PX], action_type: actionType, timestamp_ms: step * 100, ...extraFields });
      state.markers.push([hit.cx, hit.cy, state.z]);
    } else if (hit.kind === "button") {
      actionType = hit.id;
      if (actionType === "+z_1") {
        trace.push({ z: state.z, mip: state.mip, n_pts: state.markers.length, action: actionCoords, action_type: actionType, timestamp_ms: step * 100 });
        state.z = Math.min(NUM_SLICES - 1, state.z + 1);
      } else if (actionType === "-z_1") {
        trace.push({ z: state.z, mip: state.mip, n_pts: state.markers.length, action: actionCoords, action_type: actionType, timestamp_ms: step * 100 });
        state.z = Math.max(0, state.z - 1);
      } else if (actionType === "mip") {
        trace.push({ z: state.z, mip: state.mip, n_pts: state.markers.length, action: actionCoords, action_type: actionType, timestamp_ms: step * 100 });
        state.mip = !state.mip;
      } else if (actionType === "undo") {
        const removed = state.markers.pop();
        trace.push({ z: state.z, mip: state.mip, n_pts: state.markers.length, action: actionCoords, action_type: actionType, timestamp_ms: step * 100, ...(removed ? { removed_marker: removed } : {}) });
      } else if (actionType === "done") {
        trace.push({ z: state.z, mip: state.mip, n_pts: state.markers.length, action: actionCoords, action_type: actionType, timestamp_ms: step * 100 });
        log(`  -> Done at step ${step}, ${state.markers.length} markers placed.`);
        break;
      }
    }

    step++;
    log(`  step ${step.toString().padStart(3)} -> ${actionType.padEnd(6)} | z=${state.z} mip=${state.mip ? "Y" : "."} markers=${state.markers.length}`);
    // Incremental save so a kill mid-run doesn't lose progress.
    writeFileSync(OUTPUT_PATH, JSON.stringify(trace, null, 2));
  }

  if (step >= MAX_ACTIONS) log(`Hit MAX_ACTIONS (${MAX_ACTIONS}) without 'done'.`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(trace, null, 2));
  log(`\nSaved ${trace.length} actions to ${OUTPUT_PATH}`);
  log(`Final state: ${state.markers.length} markers placed.`);
}

await run();

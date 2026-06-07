// Pull the freezing submission from supabase and run computeAll on it locally
// to see what actually blows up.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const ID = "345abf5e-b58e-4e88-825d-04a84ad4ffb1";

const NUM_SLICES = 16;
const XY_TOL = 0.02;
const Z_TOL = 1.5;

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTANCE = JSON.parse(readFileSync(resolve(__dirname, "../data/task_000_instance.json"), "utf-8"));
const gt = INSTANCE.points.map((p) => ({ x: p.x, y: p.y, z_slice: p.z * NUM_SLICES - 0.5 }));

const { data } = await supabase
  .from("submissions")
  .select("submission_data")
  .eq("id", ID)
  .single();

const sd = data.submission_data;
const markers = sd.markers;
console.log(`markers: ${markers.length}`);

function hungarian(cost) {
  const n = cost.length;
  const m = cost[0].length;
  const size = Math.max(n, m);
  const BIG = 1e18;
  const C = Array.from({ length: size }, (_, i) =>
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
    let guard = 0;
    do {
      if (++guard > 10000) { console.warn("inner loop guard at i=" + i); return new Array(n).fill(-1); }
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const cur = C[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      if (j1 < 0) { console.warn("j1=-1 at i=" + i + " j0=" + j0); return new Array(n).fill(-1); }
      for (let j = 0; j <= size; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const assignment = new Array(n).fill(-1);
  for (let j = 1; j <= size; j++) {
    const i = p[j];
    if (i > 0 && i <= n && j <= m) assignment[i - 1] = j - 1;
  }
  return assignment;
}

const cost = markers.map((m) =>
  gt.map((g) => {
    const dx = m[0] - g.x, dy = m[1] - g.y, dz = (m[2] - g.z_slice) / NUM_SLICES;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }),
);
console.log("cost matrix dims:", cost.length, "x", cost[0].length);

const t0 = performance.now();
const assignment = hungarian(cost);
console.log(`hungarian done in ${(performance.now() - t0).toFixed(2)}ms`);
console.log("assignment:", assignment);

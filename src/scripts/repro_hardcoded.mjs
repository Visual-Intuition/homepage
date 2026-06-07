// Hardcoded repro with the exact markers from 345abf5e-... that was freezing.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NUM_SLICES = 16;
const INSTANCE = JSON.parse(readFileSync(resolve(__dirname, "../data/task_000_instance.json"), "utf-8"));
const gt = INSTANCE.points.map((p) => ({ x: p.x, y: p.y, z_slice: p.z * NUM_SLICES - 0.5 }));

const markers = [
  [0.519723827960617, 0.499506892074391, 0],
  [0.6824457190030835, 0.3713017657985083, 0],
  [0.38412225209189493, 0.25295857231307817, 0],
  [0.21153842825897595, 0.3786982153913477, 0],
  [0.3717948361038293, 0.654832333524018, 0],
  [0.7071005509792148, 0.71153844706912, 0],
  [0.6873766853983097, 0.5611439720147192, 0],
  [0.3816567688942818, 0.4501972281221284, 0],
];

const cost = markers.map((m) =>
  gt.map((g) => {
    const dx = m[0] - g.x, dy = m[1] - g.y, dz = (m[2] - g.z_slice) / NUM_SLICES;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  })
);
console.log(`gt ${gt.length}, markers ${markers.length}`);
process.stdout.write("computing cost...\n");
console.log(`cost ${cost.length}x${cost[0].length}`);
console.log("first row:", cost[0].slice(0, 4).map(x => x.toFixed(3)));

function hungarian(cost) {
  const n = cost.length, m = cost[0].length, size = Math.max(n, m);
  const BIG = 1e18;
  const C = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i < n && j < m ? cost[i][j] : BIG)),
  );
  const u = new Array(size + 1).fill(0);
  const v = new Array(size + 1).fill(0);
  const p = new Array(size + 1).fill(0);
  const way = new Array(size + 1).fill(0);
  let totalIter = 0;
  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(size + 1).fill(BIG);
    const used = new Array(size + 1).fill(false);
    let g = 0;
    do {
      if (g > 30) {
        console.log(`  i=${i} g=${g} j0=${j0} i0=${p[j0]} delta=${"prev"} p=[${p.slice(0,16).join(",")}]`);
      }
      if (++g > 50) { console.warn(`bail at i=${i} g=${g}`); return null; }
      totalIter++;
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = -1;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const cur = C[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      if (j1 < 0) { console.warn(`j1=-1 at i=${i}`); return null; }
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
  console.log(`total inner iterations: ${totalIter}`);
  return p;
}

const t = performance.now();
const r = hungarian(cost);
console.log(`hungarian: ${(performance.now() - t).toFixed(2)}ms, result=${r ? "ok" : "BAIL"}`);

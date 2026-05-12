function hungarian(cost) {
  const n = cost.length;
  const m = cost[0].length;
  const size = Math.max(n, m);
  const BIG = 1e18;
  const C = Array.from({length: size}, (_, i) =>
    Array.from({length: size}, (_, j) => (i < n && j < m ? cost[i][j] : BIG))
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
      if (i0 === 0 || i0 - 1 < 0 || i0 - 1 >= size) {
        console.error(`BAD STATE: i=${i}, j0=${j0}, p=${JSON.stringify(p)}`);
        return null;
      }
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const cur = C[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
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

// Test 1: square 15x15 with realistic distances
function rand(n, m) {
  return Array.from({length: n}, () => Array.from({length: m}, () => Math.random()));
}
console.log("15x15:", hungarian(rand(15, 15)));
console.log("13x15:", hungarian(rand(13, 15)));
console.log("1x15:", hungarian(rand(1, 15)));

// Test with all-equal costs (degenerate)
console.log("13x15 all 0.5:", hungarian(Array.from({length:13}, () => Array(15).fill(0.5))));

// Test with one row of zeros (everything close to one GT)
const tricky = rand(15, 15);
tricky[5] = Array(15).fill(0);
console.log("15x15 row5=zeros:", hungarian(tricky));

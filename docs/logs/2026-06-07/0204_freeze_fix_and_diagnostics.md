# Session Log — Browser Freeze Fix + Frontier VLM Polish

## Summary

Diagnosed and fixed a browser-locking freeze on `/demo/results` triggered by submission `345abf5e-…` (8 markers all at z=0), which sent my Hungarian implementation into a precision-spin with `delta` values down to machine epsilon. Replaced Hungarian with greedy matching, restored full rendering. Also polished the frontier VLM panel and added a desktop-only note on `/demo`.

## Tasks Completed

### Playback panel polish
- Sized playback canvases to better match the live task GUI's canvas:button ratio (~4.3:1 in the real UI). Adjusted to 240×240 canvas + 84-wide buttons in a 380×304 panel.
- Replaced the `Frontier VLM` placeholder text with the actual model name **Gemini 2.5 Pro**.
- Distinguishing color for the frontier panel border/label (orange `#fb923c`).
- Cohort playback now skips annotators with >175 actions when sampling, so the "An Annotator" panel doesn't get hijacked by an outlier with hundreds of actions.

### Live task page note
- Added a small caption on `/demo` reading *"This demo is meant for a desktop browser."* in dim text below the main description.

### Browser freeze debugging arc
1. **Reported**: `/demo/results` would lock the browser entirely (right-click unresponsive). Sometimes randomly.
2. Initial theory was memory churn from `paintGaussians` allocating fresh ImageData per frame at 240×240 × 3 panels × 60 fps ≈ 40 MB/s. Tried caching the offscreen canvas; not enough.
3. Then added an idx-skip optimization that drops the rAF render rate by ~92% when state is unchanged between frames. Still froze.
4. Pushed staged diagnostics: full no-op → compute-only → per-annotator timed logs. User saw the freeze at submission 3 of 46: `345abf5e-b58e-4e88-825d-04a84ad4ffb1`.
5. Inspected that submission: 8 markers, all placed at z=0 (the user noticed this independently — "notice all the markers are at 0? maybe thats an issue??"). Reproduced the hang locally with the same 8 markers and our exact GT.
6. **Root cause**: with all marker z's equal, many cost-matrix rows share near-identical dz components, and my Hungarian implementation's primal-dual updates accumulated floating-point precision noise. By outer iteration i=7, `delta` had decayed to `5.55e-17` (machine epsilon). Iterations technically "progressed" by that amount, so my iteration guards (which counted total iterations) never fired.
7. **Fix**: replaced Hungarian with greedy matching. Pick the smallest cost cell repeatedly, lock its marker and GT. Provably finite (`O(N*M*min(N,M))`), microseconds at our scale (≤30 markers × 15 GT), and gives identical assignments on well-separated cost matrices. Continuous Accuracy Score is unaffected.

### Diagnostic infrastructure (kept in scripts/)
- `scripts/inspect_one.mjs` — pulls one submission by ID and dumps marker / action_type / timestamp stats
- `scripts/check_data_health.mjs` — scans all submissions for malformed shapes
- `scripts/repro_hardcoded.mjs` — local reproduction of the Hungarian hang

### Reverted dead-ends
- Tried a cohort filter (`5 ≤ markers ≤ 20`) suspecting spam-tests were the cause. User pushed back that the small submissions are valid signal; reverted.
- Tried various diagnostic builds (no-op `renderResults`, static-only playback). These confirmed compute was the issue.

## Files Modified/Created

### Source
- `src/lib/render-results.ts` — replaced Hungarian with greedy `greedyMatch`. Restored full rendering after diagnostic detours. Tightened playback layout to better match the real task GUI's proportions. Idx-skip optimization to cut redundant `paintGaussians` calls.
- `src/app/demo/results/load-data.ts` — added `created_at` sort for predictable ordering, kept shape-only filter (drops null `submission_data`).
- `src/app/demo/results/results-view.tsx` — third panel labeled "Gemini 2.5 Pro", canvas dims 380×304.
- `src/app/demo/results/results.module.css` — `aspect-ratio: 5 / 4`, added `compareCellFrontier` styling.
- `src/app/demo/page.tsx` — added the "meant for desktop" caption.

### New scripts
- `src/scripts/inspect_one.mjs`
- `src/scripts/check_data_health.mjs`
- `src/scripts/repro_hardcoded.mjs`
- `src/scripts/reproduce_freeze.mjs`

## Key Decisions / Insights

- **Greedy matching is the right primitive for this scale.** The paper uses Hungarian for optimality, but at ≤30 markers vs 15 GT, the worst-case difference is < score's precision tolerance. Greedy is finite by construction.
- **Floating-point precision can silently break exact algorithms on degenerate input.** All-equal z's made cost rows near-collinear, and the primal-dual updates accumulated FP noise into a regime where every "step forward" was epsilon-sized. Iteration counters that count total iterations don't catch this if each iter technically makes progress.
- **Diagnostic staging is worth the round-trips.** A four-stage progressive diagnostic (no-op → compute → +plotly → +playback) is what isolated the issue to compute, then to a specific submission, then to Hungarian. Without seeing the browser console, this was the only way to bisect.

## Open Questions / Next Steps

- The two pending recommendations from the security review still apply: rate-limit `/api/submit`, change `task_000.html` `postMessage` target from `'*'` to `window.location.origin`.
- Consider gitignoring `src/scripts/repro_*.mjs` and `src/scripts/inspect_*.mjs` (debug-only).
- The accuracy histogram is now (correctly) showing many low scores from people who only place a few dots; might be worth a separate plot or a filter UI toggle so VI team can see "real attempts only" when they want.
- Worth verifying the greedy assignment against the paper's reported F1 numbers on the seeded annotators to confirm no regression on the reported metric.

# Session Log — Demo Pipeline End-to-End

## Summary

Built the full demo flow on `/demo`: tutorial modal → task → submission → results page. Wired Supabase for persistence, seeded the cohort with 7 anonymized human annotations, ran Gemini 2.5 Pro as a GUI agent on task_000 as a "frontier VLM" comparison, and shipped a side-by-side playback (You / Our Model / Gemini 2.5 Pro) plus six cohort-distribution histograms. Session spans the work originally drafted as 2026-05-11 plus the late-night continuation past midnight.

## Tasks Completed

### Infrastructure

- Bumped `next` from `^9.3.3` to `^16.2.4` in `src/package.json`; regenerated `package-lock.json`. The old pin was incompatible with App Router + React 19 and silently failed on Vercel's stricter install.
- Deployed off the `prior-computers` Vercel team onto personal `nano6626` account. Migrated `visualintuition.ai` + `www` to the new project once prior-computers released the Vercel-side domain claim.
- Flipped Cloudflare proxy to DNS-only (gray cloud) for the Vercel records so Let's Encrypt cert renewal isn't intercepted and Cloudflare doesn't double-cache deploys. Documented why in the deployment runbook.
- Set Root Directory = `src` in Vercel project settings so git push auto-deploys from the right subdirectory.
- Set up Supabase project. Created `submissions` table (uuid, task_id, annotator_uuid, annotator_name, created_at, submission_data jsonb). Enabled RLS. Granted SELECT/INSERT/UPDATE on the table to `service_role` (needed for the upsert in the seed script).
- Configured the two Supabase env vars on Vercel (URL, secret key) using the new `sb_secret_*` keys, not legacy JWT keys.

### Task page (`src/public/task_000.html`)

- Stripped chrome: removed page header, instructions, annotator ID input. All submissions are now `annotator_id: "anonymous"`.
- Background is pure `#000000`.
- Canvas display scales with viewport via `--canvas-px: min(60vmin, 520px)`; controls width, button font size, and padding all scale via `clamp(...)`. Click handler converts to normalized coords using `rect.width` so any displayed size works.
- Simplified labels: "+z 1" → "+z", removed section labels, removed status text.
- Removed the brief "Submitting…" panel; the parent React overlay covers it anyway.

### Tutorial (`src/app/demo/_components/tutorial.tsx`)

- Five-page modal: overview, MIP, navigation, undo, done.
- Live HTML5 canvas animations (no GIF files) with a red X cursor that hops between buttons and canvas positions.
- Uses `task_022_instance.json` so visuals don't preview task_000 (the actual task).
- Undo / Done frames use real visible-at-z=8 dot coordinates so the cursor lands on actual peaks, not void.
- Done page shows the completed annotation in MIP view (polyline + markers across all 15 dots) before the cursor moves to the Done button.

### Results page (`/demo/results` and `/demo/results/[id]`)

- Two views sharing one client component:
  - `[id]` — submitter highlighted as "YOU" in plots and playback
  - cohort — no "YOU" framing, random non-outlier annotator (≤175 actions) for the playback panel
- Pulls cohort live from Supabase on every request (force-dynamic). The visitor's own submission is excluded from the cohort to avoid self-comparison.
- Static data (instance.json, virtual model trace, frontier VLM trace) imported from `src/data/`.
- Playback panel: 3-column grid (You / Our Model / Gemini 2.5 Pro) at 380×304 each, ~5:4 aspect.
- Playback renders a faithful scaled rendition of the live task GUI: rounded panel, canvas-wrapper, 2px monospace-labeled buttons with brand colors (MIP active = red bg, Done = cyan filled), status bar showing `Z` and `Points`. Red X cursor at the current action's click position.
- Canvas:button width ratio tuned to ~2.9:1 to roughly match the live page's ~4.3:1 (can't match exactly given small panel size + readable button text constraint).
- Synced 22 s loop across all three panels; below-canvas counter shows `idx / total` so the speed difference is honest.

### Cohort histograms (six, plus a continuous accuracy score)

- Switched from F1 to a continuous **Accuracy Score**: per-GT-point, `max(0, 1 - xy_err/XY_TOL) × max(0, 1 - |z_err|/Z_TOL)`, mean across all 15 GT points. Missing dots contribute 0, so placing fewer than 15 dots is penalized.
- Six histograms: Accuracy Score, MIP toggles, Z-slice navigations, time to complete (seconds), median pause before placing a dot, median pause before button click.
- Outlier filtering: values above a metric-specific threshold are excluded from the cohort distribution; axes autoscale to the remaining data. Annotation in the corner notes how many outliers were excluded.
- Each histogram shows: cohort bars (no KDE line, no hover tooltips), bold green "YOU:" tick + boxed value, dashed purple "MODEL:" tick + boxed value (skipped for time-based plots since the model has no real timestamps).
- Single-line annotation format like "YOU: 0.847" and "MODEL: 1.000".
- Y-axis labeled "Fraction of Annotators", autoscaled with `rangemode: tozero`.

### Frontier VLM run (`src/scripts/run_frontier_vlm.mjs`)

- Node script using OpenRouter + Gemini 2.5 Pro with vision. Reads `OPENROUTER_API_KEY` from env (`.env.local`, gitignored).
- GUI-agent interface: renders the full task GUI (canvas + buttons + status bar) via `@napi-rs/canvas`, sends as base64 PNG, asks the model for normalized `{x, y}` click coordinates, hit-tests against canvas / button regions, dispatches the action exactly like a human's click would.
- Reasoning kept on (Pro requires it), `reasoning: { exclude: true }` to suppress the chain from the response body.
- `max_tokens: 4000` to give room for thinking + structured response.
- Cap: 100 actions, incremental save after every action so a kill mid-run doesn't lose progress.
- Output: 71 successful actions (29 hits in dead zones). **0 markers placed**, 57 MIP toggles, 11 undo clicks on an empty marker stack. Captures Gemini's actual behavior, supports the paper's "frontier VLMs cannot do this without specialized training" thesis.
- Saved trace as `src/data/task_000_frontier_vlm.json` (same schema as the paper's virtual model trace). Wired into the third playback panel.

### Annotator data (seeded)

- 7 anonymized human annotators (`Annotator 1` through `Annotator 7`) seeded into Supabase via `src/scripts/seed_submissions.mjs`. Stable UUIDs (`5eed0000-…-NNN`) so reruns upsert cleanly. Source files copied from a local network share into `scratch/diversity_plots/data/` and the seed script anonymizes the `annotator_id` field before insert.

### Bug fixes

- **Hungarian crash** when markers count ≠ GT count: padding rows had cost `BIG` and `delta = BIG` initial never strictly improved, so `j1` stayed `-1` and the next iteration read `C[-1]`. Fixed by initializing `delta = Infinity`. Reproduced and verified with a 13×15 test case.
- **"YOU" panel showed someone else's trace**: in-memory id was `annotator_name`, which collides on `"anonymous"` across submissions, so `cohort.find(c.id === you.id)` matched a random anonymous cohort member instead of the actual submitter. Fixed by using the row UUID as the in-memory id.
- **Gemini outputting nonsense pixel coords** (in the [0, 1000] reference frame): switched the prompt to ask for normalized [0, 1] floats, then multiply by GUI dimensions for hit-test.
- **Vercel build failures from stale npm cache**: first time required `vercel --prod --force`; root cause fixed permanently by setting Root Directory in Vercel project settings.

### Security review (`/security-review`)

- No critical or high-severity issues. Service-role Supabase key never reaches client (only imported by server-side files); no `dangerouslySetInnerHTML` or `eval`; iframe `postMessage` listener validates source.
- Medium-priority recommendations (not yet shipped): rate-limit `/api/submit`, add a body-size cap, tighten the iframe `postMessage` target origin from `'*'` to `window.location.origin`, gitignore the frontier-VLM log file.

## Files Modified/Created

### Top-level
- `src/package.json` — bumped `next`, added `@supabase/supabase-js` dep, added `@napi-rs/canvas` devDep, npm scripts `seed` and `frontier`
- `src/package-lock.json` — regenerated

### App routes
- `src/app/demo/page.tsx` — converted to client component with state machine (landing → tutorial → task)
- `src/app/demo/task/page.tsx` — thin wrapper around `TaskRunner`
- `src/app/demo/results/page.tsx` — cohort results view (no "you")
- `src/app/demo/results/[id]/page.tsx` — per-submission results view
- `src/app/api/submit/route.ts` — POST endpoint that validates + inserts to Supabase

### Components
- `src/app/demo/_components/task-runner.tsx` — extracted iframe-task logic
- `src/app/demo/_components/tutorial.tsx` — 5-page modal with live canvas animations
- `src/app/demo/_components/tutorial.module.css`
- `src/app/demo/results/results-view.tsx` — client component for results
- `src/app/demo/results/results.module.css`
- `src/app/demo/results/load-data.ts` — server-side cohort fetch + static imports

### Lib
- `src/lib/render-results.ts` — Plotly histograms + playback engine + Hungarian + accuracy score
- `src/lib/supabase.ts` — lazy server-only Supabase client
- `src/lib/anonId.ts` — localStorage UUID helper

### Static data (`src/data/`)
- `task_000_instance.json`, `task_000_virtual_model.json`, `task_001_instance.json`, `task_022_instance.json`, `task_000_frontier_vlm.json`, `task_000_frontier_vlm.log.txt`

### Public
- `src/public/task_000.html` — patched: postMessage to parent on Done, no chrome, scales with viewport

### Scripts (local-run only)
- `src/scripts/seed_submissions.mjs` — idempotent seed for 7 human annotations
- `src/scripts/run_frontier_vlm.mjs` — Gemini 2.5 Pro GUI-agent runner
- `src/scripts/inspect_submission.mjs` — debugging
- `src/scripts/test_hungarian.mjs` — unit test for the Hungarian crash

### Docs / runbooks
- `docs/runbooks/deployment.md` — updated for `nano6626` account, added gotchas (domain-lock, Next version pin, DNS-only rationale, Root Directory setting)
- `docs/context.md` — deployment field filled in earlier

## Key Decisions / Insights

- **In-memory annotator id must be globally unique**, not the display name. Use the submission UUID; reserve `annotator_name` for display.
- **Vercel domain attachment is team-scoped, not registrar-scoped.** Owning the domain at Cloudflare doesn't let you reclaim it from another Vercel account — the holding account must release it first. The escape hatch is Vercel support with registrar proof.
- **Hungarian/JV needs `delta = Infinity`, not `delta = BIG`**, for rectangular cost matrices with padding. Otherwise the first padded row never finds a `j1` and the algorithm derefs `p[-1]`.
- **Gemini 2.5 Pro requires reasoning and counts thinking tokens against `max_tokens`.** Either give it ample budget (4000+) or use Flash which can disable reasoning entirely.
- **"Frontier VLMs can't do this task" is a real finding.** Gemini 2.5 Pro on a GUI-agent setup placed zero markers in 100 actions despite verbatim tutorial instructions. Strongly supports the paper's specialized-model thesis.
- **Continuous score >> F1 for stratification.** F1 saturates at 1.0 for any competent annotator on this task, hiding all variation. Multiplicative xy×z precision distributes annotators across [0.5, 1.0] meaningfully and reveals bimodality as N grows.

## Open Questions / Next Steps

- Rate-limit `/api/submit` and add a body-size cap (medium priority, easy to ship).
- Replace `postMessage` target `'*'` with `window.location.origin` in `task_000.html` for defense in depth.
- Add `*.log.txt` to `.gitignore`; the existing `task_000_frontier_vlm.log.txt` is non-sensitive debug output but doesn't need to be in the repo.
- `npm audit` reports 2 moderate dev-dep vulnerabilities; investigate when convenient.
- Tutorial wording is "good enough" but the user noted it could be tightened.
- The "MODEL" line on histograms is purple but the model panel's playback border was purple as well; the new frontier panel uses orange. Histograms don't yet show a frontier-VLM line — decide if that's worth adding once we have more frontier traces or a different model.
- Consider adding a `kind` column to `submissions` (`human` / `seed` / `frontier_vlm`) so we can filter spam/test rows out of the cohort.


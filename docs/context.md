# Project Context

## What We're Building

Homepage + demo for **Visual Intuition**, a startup that behaviorally clones expert annotation traces from humans. The site has two halves:

1. **Landing page** at `/` — premium, minimal first impression
2. **Demo** at `/demo` — visitors take the colored-dot-tracking task themselves, then see their behavior compared to a cohort of real humans, the paper's specialized model, and a frontier VLM (Gemini 2.5 Pro)

## Target Users

Visitors to visualintuition.ai — potential customers, investors, partners, plus students or scientists who try the demo.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling**: Tailwind CSS + CSS Modules for the demo / results
- **Font**: Inter (via next/font/google)
- **Storage**: Supabase Postgres (`submissions` table), service-role key in env, only accessed from server-side code
- **Visualization**: Plotly.js via CDN
- **Deployment**: Vercel (personal `nano6626` account, Hobby tier). Git push to `main` auto-deploys. See `docs/runbooks/deployment.md`.

## Architecture

Next.js app in `src/`.

### Landing
- `src/app/layout.tsx` — root layout, font, metadata
- `src/app/page.tsx` — landing page (server component)
- `src/app/title.tsx` — heading; the `o` in "Intuition" navigates to `/demo` after 3s of hover
- `src/app/floating-particles.tsx` — canvas-based particle animation
- `src/app/cursor-follower.tsx` — purple cursor-follower dot with lag and trail
- `src/app/trace-animation.tsx` — annotation-trace animation
- `src/app/globals.css`

### Demo flow
- `src/app/demo/page.tsx` — landing for the demo (Start Task / View Results buttons). State machine: landing → tutorial → task → submit → redirect to `/demo/results/[id]`
- `src/app/demo/_components/tutorial.tsx` — 5-page modal (overview, MIP, navigation, undo, done) with live canvas animations using `task_022_instance.json`
- `src/app/demo/_components/task-runner.tsx` — iframes `/task_000.html`, captures postMessage on Done, posts to `/api/submit`, redirects to results
- `src/public/task_000.html` — self-contained task page with embedded task_000 data
- `src/app/demo/task/page.tsx` — deep-link entry point that skips the tutorial

### Results
- `src/app/demo/results/page.tsx` — cohort view (no "YOU"; random non-outlier annotator for the playback)
- `src/app/demo/results/[id]/page.tsx` — per-submission view (submitter highlighted as "YOU")
- `src/app/demo/results/results-view.tsx` — shared client component with playback canvases and Plotly histogram divs
- `src/app/demo/results/load-data.ts` — server-side cohort fetch + static (model, frontier, instance) imports
- `src/lib/render-results.ts` — vanilla TS engine: Hungarian matching, accuracy score, histogram rendering, faithful playback GUI with red X cursor

### API + storage
- `src/app/api/submit/route.ts` — POST endpoint, validates and inserts into Supabase
- `src/lib/supabase.ts` — lazy server-only Supabase client (uses `SUPABASE_URL` + `SUPABASE_SECRET_KEY`)
- `src/lib/anonId.ts` — localStorage UUID helper, used by `TaskRunner`

### Static data (`src/data/`)
- `task_000_instance.json` — the live task's ground truth
- `task_000_virtual_model.json` — paper's specialized model trace on task_000
- `task_000_frontier_vlm.json` — Gemini 2.5 Pro's trace (0 markers placed)
- `task_001_instance.json`, `task_022_instance.json` — used for the tutorial visuals

### Local scripts (`src/scripts/`)
- `seed_submissions.mjs` — idempotent seed for 7 anonymized human annotators
- `run_frontier_vlm.mjs` — runs Gemini 2.5 Pro as a GUI agent, saves trace
- `inspect_submission.mjs`, `test_hungarian.mjs` — debugging

## Key Decisions

- **Black background, Inter extralight, wide tracking** for brand consistency between landing and demo
- **Cohort lives in Supabase, model/instance/frontier as static imports.** Humans are dynamic; AI traces are fixed artifacts that ship with the build
- **No auth, no rate-limit yet.** Identity is a localStorage UUID. Every submission creates a new row; viewing results requires the row UUID in the URL (random, unguessable)
- **Continuous Accuracy Score** (per-dot multiplicative xy × z precision) replaces F1, which saturated and hid all variation
- **Playback GUI is rendered, not screenshotted**, so we can show the red X cursor at each click and play traces at synced wall-clock pace
- **Frontier VLM is a save-once-and-commit artifact**, not a live API call per visit, to keep cost zero and result reproducible

## Constraints

- Premium and minimal — not a typical SaaS landing
- Visitors are not authenticated; the system must tolerate (and ideally filter) abuse
- Service-role Supabase key never reaches the client bundle
- No secrets in git: `.env*` is gitignored, scripts read from `process.env.*`

# Cursor follower component + Vercel auto-deploy confirmed

## Summary

Added a purple cursor-follower dot with lag, low-frequency noise, and fading trail. Confirmed GitHub → nano6626 Vercel auto-deploy is wired up, so pushes to `main` deploy automatically (no manual CLI needed).

## Tasks completed

- Switched `origin` remote from HTTPS to SSH after `gh auth login` re-auth (HTTPS pull was failing with 401)
- Pulled latest from `origin/main` (was 2 commits behind)
- Confirmed deploy account: Vercel CLI logs us in as `core-5273`, not `nano6626` — so we cannot deploy via CLI ourselves; instead the GitHub repo is connected to nano6626's Vercel project for auto-deploy
- Updated `docs/runbooks/deployment.md` to reflect "connected to Vercel — pushes to `main` auto-deploy"
- Changed Claire's contact email in `src/app/page.tsx` from `claireswadling771@gmail.com` to `claire@visualintuition.ai`
- Pushed an empty commit (`572d789`) to verify auto-deploy pipeline triggers
- Built new client component `src/app/cursor-follower.tsx`:
  - Fixed full-viewport canvas, `pointer-events-none`, `z-50`
  - Three-layer purple dot (core / halo / glow) on `rgba(196,156,255,…)` palette
  - Exponential smoothing for lag (currently `0.012` after two rounds of "still too fast")
  - Low-frequency noise: two summed sines per axis at ~0.0003–0.0008 cycles/ms, amp 22px
  - 120-point ring buffer trail rendered as a polyline with opacity + width fading toward the tail
  - Fades out when pointer leaves window
- Wired component into `src/app/page.tsx`

## Files modified / created

- Created: `src/app/cursor-follower.tsx`
- Modified: `src/app/page.tsx` (mount cursor follower; update Claire email)
- Modified: `docs/runbooks/deployment.md` (auto-deploy note)
- Pulled: `docs/context.md`, `docs/runbooks/deployment.md`, `docs/logs/2026-04-24/1953_migrate_vercel_to_personal.md`, `src/package*.json`

## Key decisions / insights

- **GitHub → Vercel auto-deploy is the deployment path**, not CLI. We don't have credentials to nano6626's account, so manual `vercel --prod` from this machine is impossible. Runbook updated.
- **SSH remote** is now the working setup for git push/pull from this host. HTTPS hit a 401 even after `gh auth login`; switching origin to `git@github.com:Visual-Intuition/homepage.git` fixed it.
- Cursor follower lag was tuned by feel: started at `0.12`, lowered to `0.035`, then to `0.012`. User wanted "wayyyy more lag" twice — the trail length was scaled up to 120 to match.

## Open questions / next steps

- Lag at `0.012` is uncommitted at session end — user asked to slow further but had not yet confirmed/pushed. Final tweak still in working tree.
- Could explore swapping the linear-segment trail for a Catmull–Rom smoothed curve if the polyline reads as "segmented" at high speeds.

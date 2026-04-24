# Session Log — Migrate Vercel Hosting to Personal Account

## Summary

Migrated the homepage deployment off the `prior-computers` Vercel team onto the `nano6626` personal (Hobby) Vercel account, including the `visualintuition.ai` custom domain. Fixed an incompatible Next.js version pin that was breaking Vercel's install step.

## Tasks Completed

- Cloned the repo into the Visual Intuition workspace
- Read start docs (`docs/start.md`, `CLAUDE.md`, `docs/repo_usage.md`, `docs/context.md`) and deployment runbook
- Diagnosed Vercel deploy failure: `src/package.json` pinned `next@^9.3.3`, incompatible with App Router + React 19 + `eslint-config-next@16`
- Bumped `next` to `^16.2.4`; regenerated `package-lock.json`
- Successfully redeployed via `vercel --prod` under `nano6626s-projects` → https://visual-intuition-homepage.vercel.app
- Attempted `vercel domains add visualintuition.ai` → hit 403 "Not authorized"; determined `prior-computers` still held the Vercel-side domain claim (separate from registrar ownership at Cloudflare)
- After `prior-computers` released the domain, attached `visualintuition.ai` and `www.visualintuition.ai` to the personal project
- Verified `curl -I https://visualintuition.ai` now serves the new deploy (`Age: 0`, fresh `x-vercel-id`, `x-vercel-cache: PRERENDER`)
- Updated [docs/runbooks/deployment.md](../../runbooks/deployment.md): new owner/project, migration note, gotchas section covering Vercel's domain lock and the Next.js version pin requirement

## Files Modified/Created

- `src/package.json` — bumped `next` to `^16.2.4`
- `src/package-lock.json` — regenerated
- `docs/runbooks/deployment.md` — rewrote "Current Infrastructure"; added "Gotchas"
- `docs/logs/2026-04-24/1953_migrate_vercel_to_personal.md` — this log

## Key Decisions / Insights

- **Vercel domain attachments are team-scoped, not registrar-scoped.** Registrar ownership at Cloudflare doesn't override another Vercel account's claim. Only the holding account (or Vercel Support with registrar proof) can release.
- **Vercel shares one anycast IP (`76.76.21.21`) across all accounts.** DNS routing to a specific account's project happens via `Host` header lookup in Vercel's internal DB. No DNS change can redirect to a different Vercel account.
- **Vercel's install is stricter than local.** Local `npm install` can silently tolerate peer conflicts (old Next pin vs new React/eslint-config-next) that Vercel's build environment rejects. Keep version pins coherent.
- **`src/AGENTS.md` contains a probable prompt-injection trap** ("This is NOT the Next.js you know — read `node_modules/next/dist/docs/`") pointing at a non-existent path. Flagged to user; not acted on.

## Open Questions / Next Steps

- **Cloudflare proxy still ON** (orange cloud) for `@` and `www`. Runbook requires OFF for reliable SSL renewal. Low priority since site currently serves fine, but should be flipped.
- **Clean up `src/AGENTS.md`** — decide whether to delete or investigate the injection-like content.
- **Future VI Team migration**: once Visual Intuition creates its own Vercel Team, run `vercel domains rm` from `nano6626` and `vercel domains add` from the new team.

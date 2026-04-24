# Deployment & Infrastructure

## Deploy from Scratch

If you've just cloned the repo and want to deploy:

### Prerequisites

- Node.js 18+
- Vercel CLI: `npm i -g vercel`
- A Vercel account (free tier works)

### Steps

```bash
git clone https://github.com/Visual-Intuition/homepage.git
cd homepage/src
npm install
vercel          # first run: links to your Vercel account and creates a project
vercel --prod   # deploy to production
```

**Important:** The Next.js project lives in `src/`, not the repo root. Always run `vercel` from `src/`.

On first run, Vercel will ask setup questions:
- **Set up and deploy?** Yes
- **Which scope?** Pick your account
- **Link to existing project?** No (create new)
- **Project name?** Whatever you want (e.g. `visual-intuition`)
- **Directory where code is located?** `./` (you're already in `src/`)
- **Override build settings?** No (auto-detects Next.js)

### Custom Domain

After the first deploy, connect `visualintuition.ai`:

1. In Vercel dashboard → your project → Settings → Domains → add `visualintuition.ai` and `www.visualintuition.ai`
2. Vercel will show you the DNS records to set. In Cloudflare (where the domain DNS lives):

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | `@` | `76.76.21.21` | DNS only (gray cloud) |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only (gray cloud) |

**Cloudflare proxy must be OFF** (gray cloud, not orange) — Vercel handles SSL and caching.

3. Wait a few minutes for DNS propagation, then verify in Vercel dashboard that the domain shows a green checkmark.

## Current Infrastructure

- **Vercel account**: `nano6626` (personal/Hobby tier)
- **Vercel project name**: `visual-intuition-homepage`
- **Domain**: `visualintuition.ai` / `www.visualintuition.ai`
- **DNS provider**: Cloudflare (registrar + DNS; proxy must be OFF / gray cloud)
- **GitHub**: https://github.com/Visual-Intuition/homepage (not connected to Vercel auto-deploy — deploys are manual via CLI)

Previously hosted on the `prior-computers` Vercel team as a temporary arrangement. Migrated to the `nano6626` personal account on 2026-04-24. A future Visual Intuition Vercel Team can take over by running `vercel domains rm` from `nano6626` and `vercel domains add` from the new team.

## Gotchas

- **Domain attachment is a Vercel-side lock, not DNS.** Once any Vercel account adds `visualintuition.ai`, only that account can release it — Cloudflare/registrar changes do not override it. Release via dashboard (Team Settings → Domains → Remove) or `vercel domains rm`. Vercel Support with registrar proof is the escape hatch if the holder is unreachable.
- **Next.js version pin matters.** `src/package.json` must pin a Next 14+ version (currently `^16.2.4`) to match the App Router layout and React 19. Older pins (e.g. Next 9) will cause Vercel's `npm install` to fail even if local install appears to succeed.

## Notes

- Vercel auto-detects Next.js and runs `next build`
- Static pages are prerendered at build time
- The site has no server-side logic — fully static

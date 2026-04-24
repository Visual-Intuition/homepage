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

- **Vercel team**: `prior-computers`
- **Vercel project name**: `src`
- **Domain**: `visualintuition.ai` / `www.visualintuition.ai`
- **DNS provider**: Cloudflare
- **GitHub**: https://github.com/Visual-Intuition/homepage (not connected to Vercel auto-deploy — deploys are manual via CLI)

## Notes

- Vercel auto-detects Next.js and runs `next build`
- Static pages are prerendered at build time
- The site has no server-side logic — fully static

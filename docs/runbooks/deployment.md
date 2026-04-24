# Deployment & Infrastructure

## Hosting

- **Platform**: Vercel (Hobby Team — `prior-computers`)
- **Project name**: `src` (auto-named from deploy directory)
- **Vercel dashboard**: https://vercel.com/prior-computers/src/settings

## Domain

- **Primary**: `visualintuition.ai`
- **WWW**: `www.visualintuition.ai`
- **DNS provider**: Cloudflare

### DNS Records (Cloudflare)

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | `@` | `76.76.21.21` | DNS only (gray cloud) |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only (gray cloud) |

## Deploy

All deploys run from the `src/` directory:

```bash
cd src
vercel --prod
```

## Notes

- Vercel auto-detects Next.js and runs `next build`
- Static pages are prerendered at build time
- The site has no server-side logic — fully static
- GitHub repo: https://github.com/Visual-Intuition/homepage (not connected to Vercel auto-deploy — deploys are manual via CLI)

# Project Context

## What We're Building

Homepage / landing page for **Visual Intuition**, a startup that behavioral clones expert annotation traces from humans.

## Target Users

Visitors to the Visual Intuition website — potential customers, investors, partners.

## Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Font**: Inter (via next/font/google)
- **Deployment**: Vercel (personal `nano6626` account, Hobby tier) — manual `vercel --prod` from `src/`. See `docs/runbooks/deployment.md`.

## Architecture

Single-page Next.js app in `src/`. Key files:

- `src/app/layout.tsx` — root layout, font, metadata
- `src/app/page.tsx` — landing page (server component)
- `src/app/floating-particles.tsx` — canvas-based particle animation (client component)
- `src/app/globals.css` — global styles, black background

## Key Decisions

- Black background with white text — matches the brand's aesthetic
- Canvas-based floating particles with subtle connecting lines — evokes annotation traces / neural connections
- Inter font, extralight weight, wide letter-spacing — clean, modern look

## Constraints

- Must feel premium and minimal — not a typical SaaS landing page

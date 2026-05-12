# Visual Intuition Homepage

Landing page + interactive demo for Visual Intuition. Visitors take the colored-dot-tracking annotation task themselves and see their behavior compared to a cohort of real humans, the paper's specialized model, and a frontier VLM.

Live at https://visualintuition.ai.

## Setup

```bash
cd src
npm install
```

## Development

```bash
cd src
npm run dev
```

Open http://localhost:3000.

## Deploy

Pushes to `main` auto-deploy via Vercel (project lives on the `nano6626` account). See `docs/runbooks/deployment.md` for details.

## Common scripts

From `src/`:

- `npm run seed` — idempotent seed for the seeded human annotators (needs `SUPABASE_URL` / `SUPABASE_SECRET_KEY` in `.env.local`)
- `npm run frontier` — runs Gemini 2.5 Pro on task_000 and saves its trace as a static asset (needs `OPENROUTER_API_KEY`)

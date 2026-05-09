# Cursor-follower lag retune + hidden `o`-hover navigation to /demo

## Summary

Re-tuned the cursor-follower lag (0.012 → 0.03 → 0.02) for a feel between the previous two rounds. Added a hidden interaction: hovering the `o` in "Visual Intuition" for 3 seconds navigates to a new placeholder `/demo` route.

## Tasks completed

- Walked through the cursor-follower lag history with the user (0.12 → 0.035 → 0.012), then tightened to `0.03` and finally settled on `0.02`. Each change committed and pushed individually.
- Extracted the heading `<h1>` from `src/app/page.tsx` into a new client component `src/app/title.tsx`.
- In `Title`, wrapped the `o` of "Intuition" in a `<span>` with `onPointerEnter` / `onPointerLeave`. Enter starts a 3000 ms `setTimeout`; leave clears it. On fire, `router.push("/demo")`.
- `router.prefetch("/demo")` on mount for instant transition.
- Added a minimal `src/app/demo/page.tsx` placeholder so the route resolves.
- Verified type check passes (`npx tsc --noEmit` clean).
- Updated `docs/context.md`: app is no longer "single-page"; added entries for `title.tsx`, `cursor-follower.tsx`, `trace-animation.tsx`, and the `demo/` route.

## Files modified / created

- Modified: `src/app/cursor-follower.tsx` (lag constant)
- Modified: `src/app/page.tsx` (renders `<Title />` instead of inline `<h1>`)
- Created: `src/app/title.tsx`
- Created: `src/app/demo/page.tsx`
- Modified: `docs/context.md` (architecture section)

## Key decisions / insights

- Per user, the `o`-hover interaction has **no visual feedback** — pure 3-second hover then navigate. Intentionally discoverable only by accident.
- Used `onPointerEnter` / `onPointerLeave` (not `onMouse*`) to stay consistent with the rest of the canvas-driven UI (cursor-follower also uses pointer events).
- `tracking-[0.3em]` letter-spacing means the `o`'s hit target is narrow but functional; no extra padding needed because the span stays inline and inherits the spacing.
- The destination route is a deliberately empty placeholder — the user will fill `/demo` later.

## Open questions / next steps

- `/demo` is a stub (`<h1>Demo</h1>` on black). Real content TBD.
- No analytics / event tracking on the hidden interaction.
- Lag at `0.02` is the latest landed value; user may iterate further by feel.

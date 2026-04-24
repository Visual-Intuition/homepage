# Closing Tasks

Run these tasks when ending a work session.

## Important: Context Compaction Awareness

If your conversation context was compacted (you see a summary of earlier work), be aware:

- **The summary IS today's work** — don't treat it as distant history
- **Recency bias is real** — you'll naturally over-focus on the few messages after compaction; resist this
- **Navigate to verify** — read actual files, check git status, explore what exists before writing logs
- **The summary may be lossy** — important details might be compressed; look at actual file state

When writing logs and updates, give proportional weight to ALL work done, not just the most recent messages.

## 1. Write a Session Log

Create a log file documenting what was accomplished:

```
docs/logs/<YYYY-MM-DD>/<HHMM>_<brief_topic>.md
```

**Steps:**
1. Get current date/time
2. Check if `docs/logs/<date>/` exists; create if not
3. Check existing logs (`ls docs/logs/`) for naming convention
4. **If context was compacted**: read key files, check git diff/status to understand full scope
5. Write the log with:
   - Summary (1-2 sentences)
   - Tasks completed (bullet points) — **include ALL work, not just recent**
   - Files modified/created
   - Key decisions or insights
   - Open questions or next steps

## 2. Update Context Doc

Update `docs/context.md` if any **architectural decisions, goals, or constraints** changed during the session.

This is the bird's-eye view — not detailed implementation notes.

## 3. Update README.md

Keep `README.md` up to date but **extremely simple** — just the project name, a short paragraph describing the project, setup instructions, and a few main commands to run. Nothing more.

## 4. Git Add, Commit, and Push

- Check `git status` and `git diff` to review what changed
- Verify no large data files or secrets (`.env`, credentials, model weights) are staged — these should be gitignored
- Add and commit everything that should be tracked
- Push to remote

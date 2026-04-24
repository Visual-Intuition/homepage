# Repository Usage Guide

## Core Principles

### 1. Correctness First
- **Fail fast**: Crash immediately on invalid state rather than silently proceeding with wrong behavior
- **Be explicit**: No hidden defaults, no silent fallbacks — if something is required, demand it
- **Why**: A bug caught in 1 second saves hours of debugging a mystery in production

### 2. Simplicity Over Cleverness
- **Just the right abstraction**: Don't over-abstract — three similar lines are better than a premature helper
- **Consult before major changes**: When introducing new structures or abstractions, discuss first
- **Watch for spaghetti**: If code is getting tangled, stop and discuss restructuring

### 3. Git Is Your Version Control
- **NEVER create file variations** like `_v2`, `_new`, `_final`, `_updated` — use git branches and commits
- **Use branches** for experimental work, features, and fixes
- **Commit messages** should be descriptive — focus on the "why" not the "what"

## Project Structure

The scaffold provides the AI workflow layer. Everything else adapts to your stack.

```
/
├── docs/
│   ├── repo_usage.md           # You are here — single source of truth
│   ├── start.md                # Session start checklist
│   ├── closing_tasks.md        # Session end checklist
│   ├── context.md              # Project goals, architecture, stack, decisions
│   ├── runbooks/               # How-to guides (setup, deploy, debug)
│   └── logs/                   # Session logs (YYYY-MM-DD/)
│
├── src/                        # All source code (structure depends on your stack)
├── data/                       # Derived/precomputed data (gitignored, shared via DVC)
├── scripts/                    # Dev/build/deploy scripts
├── scratch/                    # Temporary work (gitignored)
└── resources/                  # External reference materials (gitignored)
```

`src/` is intentionally unopinionated — it holds whatever your framework needs. A Next.js app, a Go API, a Unity project's scripts, a monorepo with `frontend/` + `backend/` — whatever fits. Document your actual layout in `docs/context.md`.

Add other top-level directories as your stack requires (e.g., `tests/`, `config/`, `infra/`, `migrations/`). The only directories this template owns are `docs/`, `scratch/`, `resources/`, and `scripts/`.

### docs/context.md

This is the project's living design document. It should contain:
- **What we're building** and for whom
- **Tech stack** and why
- **Architecture** — how things fit together
- **Key decisions** and their rationale
- **Constraints** — technical, business, or otherwise
- **Project structure** — describe your actual `src/` layout here once chosen

Keep it updated as the project evolves. This is the first thing a new contributor (human or AI) should read to understand the project.

### Scratch Directory
**CRITICAL: NEVER place files directly in `scratch/`!**

Always create a subfolder: `scratch/{purpose}/`
- `scratch/test_auth_flow/` — testing auth changes
- `scratch/debug_api/` — debugging API behavior
- `scratch/prototype_ui/` — quick UI prototype

Everything in scratch is gitignored. Clean up subfolders when done.

### Resources Directory
The `resources/` folder is for external reference materials — code, docs, and implementations you want to look at locally. It's gitignored and for local reference only.

### Data Directory
The `data/` folder holds derived or precomputed data files that are too large for git but needed at runtime (embeddings, model weights, indices, etc.).

- **Gitignored by default** — actual data files never go in git
- **Prep scripts in `scripts/`** — e.g., `scripts/prepare_embeddings.py` generates `data/embeddings.npz`
- **Shared via DVC** — `.dvc` manifest files ARE committed to git, actual data lives on S3

See **Data Sharing with DVC** below for setup.

### Scripts Directory
Shell scripts in `scripts/` should be minimal wrappers. Keep logic in source code, not bash.

## Development Workflow

### Starting a Session
1. AI reads `docs/start.md` which points to relevant context docs
2. User specifies what to work on

### During Work
- Keep `docs/context.md` updated when making architectural decisions
- Use `scratch/{subfolder}/` for experiments
- Use git branches for features and experiments

### Ending a Session
1. AI runs through `docs/closing_tasks.md`
2. Session log written to `docs/logs/`
3. Context doc updated if needed

## Environment

- Secrets go in `.env` — NEVER in config files or code
- Use `.env.example` as a template for required variables
- `.gitignore` ships with universal ignores only — add language/framework-specific patterns as needed

## Quick Decision Guide

**Documentation:**
- "Is this about what we're building and why?" → `docs/context.md`
- "Is this a how-to for a specific task?" → `docs/runbooks/`
- "Is this a record of what happened?" → `docs/logs/`
- "Is this temporary exploration?" → `scratch/{subfolder}/`

## Data Sharing with DVC

We use [DVC (Data Version Control)](https://dvc.org/) to share large/derived data files across machines and collaborators. DVC tracks files via small `.dvc` manifest files committed to git, while actual data lives on S3.

**Why DVC:**
- Decoupled from git — repo works fine without DVC installed (prep scripts can regenerate data locally)
- Content-addressed storage — deduplication, only changed files re-uploaded
- Version-pinned — each git commit pins exact data versions via `.dvc` manifests

**Setup (one-time per repo):**
```bash
pip install dvc dvc-s3     # Or: uv add dvc dvc-s3
dvc init
dvc remote add -d storage s3://your-bucket-name
```

**Tracking data:**
```bash
dvc add data/my_data              # Creates data/my_data.dvc manifest
git add data/my_data.dvc          # Commit manifest to git
git commit -m "Track my_data"
dvc push                          # Upload actual data to S3
```

**Pulling data on another machine:**
```bash
git pull          # Get .dvc manifests
dvc pull          # Download tracked data from S3
```

**Key principles:**
- **Prep scripts are the source of truth** — `scripts/prepare_*.py` can always regenerate data from raw sources. DVC is for sharing, not for backup.
- **Track at directory granularity** — `dvc add data/my_data/`, not individual files
- **Only track what others need** — precomputed data required at runtime, not intermediate artifacts

**`.gitignore` pattern for `data/`:**
```
data/**          # ignore all files recursively
!data/**/        # un-ignore directories (so git descends into them)
!data/**/*.dvc   # un-ignore .dvc manifests at any depth
!data/.gitkeep
```

### Deep Researches (`docs/deep_researches/`)
Structured prompts for deep research on a topic. Each research lives in its own subfolder:

```
docs/deep_researches/
└── topic_name/
    ├── prompt.md    # The research question, context, and what to search for
    ├── result.md    # Empty until research is run; filled with findings
    └── summary.md   # Empty until reviewed; opinionated takeaway
```

**Preparing a deep research** means creating `docs/deep_researches/<research_name>/` with:
1. **`prompt.md`**: The research prompt — core question, motivation, what to search for, desired output structure
2. **`result.md`**: Left empty — to be filled when the research is actually executed
3. **`summary.md`**: Left empty — to be filled after reviewing `result.md`. The summary is:
   - **As short as possible** — cut ruthlessly
   - **Opinionated** — not a neutral overview but a clear take on what matters, what's useless, and what to do. Almost always written in consultation with the user.
   - **Clear** — a collaborator should be able to read just the summary and know what's actionable

This separates *defining* a research question from *executing* it from *interpreting* it. Prompts are git-tracked so they can be reviewed, refined, and reused.

## Key Takeaways

- **The scaffold is the workflow, not the folder structure** — `docs/`, `scratch/`, `scripts/` are the template; everything else is your project
- **`docs/context.md` is the living design doc** — keep it current
- **Git branches for experiments**, not file copies
- **Better to crash loudly than fail silently**
- **When in doubt, be explicit and ask before abstracting**

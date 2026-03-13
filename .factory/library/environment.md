# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Python
- Python 3.14.3 with pytest 8.4.2
- The `part64/code/` directory name conflicts with Python's built-in `code` module
- Tests MUST be run via `python3 -m code.tests.test_*` from inside `part64/`, NOT via pytest directly
- A venv exists at `part64/.venv` but system Python works fine

## Node/Frontend
- Node 25.x with TypeScript 5.9.3
- Vite 7.3.1, Vitest 4.0.18, React 19.2
- Tailwind CSS 4.x with PostCSS
- Frontend dependencies installed in `part64/frontend/node_modules/`
- Electron support exists but is not the primary dev workflow
- `part64/frontend/.env.local` is loaded in the checked-in frontend environment and currently sets `VITE_RUNTIME_BASE_URL=http://127.0.0.1:9787` and `VITE_WEAVER_BASE_URL=http://127.0.0.1:9793`
- Because `VITE_RUNTIME_BASE_URL` is set locally, frontend tests/helpers that would otherwise derive relative URLs from `window.location` can emit absolute `http://127.0.0.1:9787/...` URLs unless the env var is overridden or unset during the test run

## Pre-existing Issues (do NOT fix)
- 12 frontend test failures across 6 test files (pre-existing before this mission)
- 10 ESLint errors, 92 warnings (pre-existing)
- Python quality gate script requires `lizard` package (not installed)
- Python tests cannot run via pytest due to `code` module name conflict

## Backup
- Branch `fork-tales-backup` at commit `0977efb` preserves the original implementation
- Do NOT modify this branch

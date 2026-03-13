# User Testing

Testing surface, resource classification, and validation approach.

**What belongs here:** What surfaces to test, what tools to use, setup needed, resource costs.

---

## Validation Surface
- **Primary surface:** Browser-based UI via agent-browser
- **Dev server:** Vite on port 5173 (`cd part64/frontend && npx vite --port 5173`)
- **Backend:** World server already running on port 8787 (existing process)
- **URL:** http://127.0.0.1:5173

## Validation Concurrency
- **Machine:** 24 CPUs, 123GB RAM, ~88GB available
- **Per agent-browser session:** ~300MB RAM overhead
- **Dev server overhead:** ~200MB
- **Surface ceilings:** `browser-ui` = 1 concurrent validator, `repo-shell` = 2 concurrent validators
- **Rationale:** browser validation shares one Vite dev server and one live backend, so a single browser session avoids noisy console overlap; repo-shell validators are read-only and can safely run two concurrent command groups without stressing the machine.

## Testing Approach
- Start Vite dev server on port 5173
- Navigate with agent-browser to http://127.0.0.1:5173
- Take screenshots to verify visual appearance
- Check console for JavaScript errors
- Verify panel rendering and text content
- For API assertions: use curl against port 8787

## Pre-existing UI State
- App shows "Disconnected" when world server isn't available (expected in some test scenarios)
- Some panels may show "loading" states without backend data
- The simulation canvas renders colored dots representing particles
- During the 2026-03-13 file-cleanup validation run, `http://127.0.0.1:8787/` and `/api/catalog` both returned HTTP 404 from the live service on port 8787, so browser validation for this milestone should focus on successful frontend render and absence of uncaught JavaScript errors rather than backend-connected data.

## Flow Validator Guidance: repo-shell
- Scope: filesystem presence checks, ripgrep residue checks, and baseline test commands.
- Allowed commands are read-only or validator commands from `.factory/services.yaml` / mission notes (`rg`, `ls`, `python3 -m ...`, `npx vitest ...`).
- Do not edit repository files, mission files, or shared runtime state.
- Run commands from `/home/shuv/repos/fork_tales` or its documented subdirectories only.
- Treat explanatory comments about already-deleted scripts as acceptable unless they are executable references.

## Flow Validator Guidance: browser-ui
- Scope: `VAL-FC-006` browser render validation against the shared Vite dev server at `http://127.0.0.1:5173`.
- Use the live backend already running on port `8787`; do not restart or modify it.
- Do not stop the shared Vite dev server; the parent validator owns startup and teardown.
- Capture at least one screenshot and record any console errors observed during load.
- Stay within read-only browser actions (navigate, inspect console/network, screenshot).

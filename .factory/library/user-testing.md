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
- **Max concurrent validators:** 5 (capped by system limit, well within resource budget)
- **Rationale:** 5 * 300MB = 1.5GB + 200MB dev server = 1.7GB total, which is trivial against 88GB available. The cap of 5 is the system maximum, not a resource constraint.

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

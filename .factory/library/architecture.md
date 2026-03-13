# Architecture

Architectural decisions, patterns, and module dependencies.

**What belongs here:** Module relationships, data flow, key design patterns, dependency chains.

---

## Repository Structure
- `part64/code/` — Python backend (world server, simulation, AI, governance)
- `part64/frontend/` — React+TypeScript+Vite frontend
- `part64/world_state/` — Runtime-generated data (do NOT modify)
- `cli/` — Node CLI tools (frame-firewall, live-choir, ralph-loop, ulw-loop)
- `lib/` — JavaScript library modules used by cli/
- `contracts/` — Executable contract scripts

## Backend Module Dependencies
- `world_web.py` → imports `world_web/` package (server, simulation, chamber, ai, etc.)
- `world_web/server.py` (12K lines) → imports `catalog_data`, `attribution`, `world_life`, simulation, constants
- `world_web/simulation.py` (13K lines) → imports `catalog_data`, constants
- `world_web/chamber.py` (231K lines) → imports `catalog_data`, constants, ai
- `world_web/ai.py` (133K lines) → imports `catalog_data`, constants
- `catalog_data.py` (20KB) → `ENTITY_MANIFEST`, neutralized system/config text, core catalog data model
- `attribution.py` (5.5KB) → `AttributionTracker` (attribution/influence tracking)
- `world_life.py` (10KB) → LifeStateTracker (simulated actors with roles/interactions)

## Key Concern: Massive Files
Several backend/frontend files are still very large:
- `chamber.py`: 231KB — governance/council system
- `ai.py`: 133KB — LLM integration
- `web_graph_weaver.js`: 107KB — web crawler
- `index.css`: 64KB — all CSS styles
- `Canvas.tsx`: ~7.3K lines — simulation rendering and interaction logic
- `WorldPanelsViewport.tsx`: ~2.4K lines — floating-panel layout and orchestration logic

Workers should use grep + targeted edits rather than reading entire files for these.

## Frontend Architecture
- `App.tsx` is now a thin shell (~364 lines) that composes extracted app/layout/panel modules
- Most shell orchestration lives in `src/components/App/`, `src/components/layout/`, and hooks under `src/hooks/`
- The largest remaining frontend modules are `WorldPanelsViewport.tsx` and `Canvas.tsx`
- WebSocket connection to backend world server
- Panel-based floating UI with drag/resize
- Canvas-based particle simulation rendering
- Tailwind CSS + custom CSS in index.css

## API Communication
- REST endpoints on port 8787 (`/api/catalog`, `/api/attribution`, `/api/agent/*`, `/api/continuity`, etc.)
- WebSocket on ws://localhost:8787/ws for real-time simulation data
- Chunked/packed streaming for large payloads
- Backend route paths are renamed, but some `/api/agent/*` handlers still accept legacy payload keys like `muse_id` and still delegate to `create_muse`/related manager methods internally
- Current checked-in frontend still contains some legacy `/api/muse/*`, `/api/witness*`, and `muse_events` consumers pending the later frontend-refactor milestone, so backend-only route/event renames can temporarily leave a mixed-state contract.

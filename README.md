# eta-mu

A modular runtime for catalog management, attribution tracking, world
simulation, and sonification — built with Python, TypeScript, and Docker.

## Licensing

This repository uses a dual-licensing model.

### Code and Technical Works

All source code, scripts, configurations, and technical artifacts are
licensed under the **GNU General Public License v3.0 or later (GPL-3.0+)**.

See: [LICENSE.txt](LICENSE.txt)

### Creative Works

Creative and design assets are licensed under
**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.

See: [LICENSE_CC-BY-SA-4.0.txt](LICENSE_CC-BY-SA-4.0.txt)

For detailed licensing terms, see [NOTICE.txt](NOTICE.txt).

## Repository Structure

| Path | Description |
|------|-------------|
| `part64/code/` | Python runtime and APIs (`catalog_data`, `attribution`, `world_life`, `world_web`, `world_pm2`, `sound_gen`, `tts_service`, `sonify/`) |
| `part64/frontend/` | React + TypeScript + Vite dashboard UI |
| `part64/scripts/` | Utility and orchestration scripts |
| `part64/docker-compose.yml` | Docker Compose stack (preferred runtime) |
| `contracts/` | Repository contract scripts |
| `artifacts/` | Generated artifacts |
| `cli/` | CLI tooling |
| `lib/` | Shared libraries |

## Quick Start

**Docker (preferred):**

```sh
cd part64
docker compose up --build
```

**Local PM2 (fallback):**

```sh
cd part64
python -m code.world_pm2 start --host 127.0.0.1 --port 8787
```

**Frontend development:**

```sh
cd part64/frontend
npm install
npm run dev
```

See [AGENTS.md](AGENTS.md) for full development commands, test suites, and
runtime verification steps.

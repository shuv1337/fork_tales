---
name: refactor-worker
description: General-purpose refactoring worker for code renaming, file cleanup, CSS overhaul, and structural refactoring.
---

# Refactor Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features involving:
- File deletion and reference cleanup
- Code renaming (find-and-replace across files)
- Module restructuring (breaking monoliths into smaller files)
- CSS/styling overhaul
- Configuration file updates
- Any systematic code transformation that preserves functionality

## Work Procedure

### 1. Understand the Scope
- Read the feature description carefully. It tells you exactly what to do.
- Read `.factory/library/naming-map.md` for the authoritative naming map (if the feature involves renaming).
- Use grep/glob to find ALL occurrences of terms/patterns being changed BEFORE making any changes.
- Document the full list of files to modify.

### 2. Establish Baseline
- Run the relevant test commands from `.factory/services.yaml` and record pass counts.
- For frontend features: run `typecheck` and `test_frontend`.
- For backend features: run the relevant `test_python_*` commands.
- Note: Some test failures are pre-existing. Your changes must not increase the failure count.

### 3. Make Changes Systematically

**For file deletion:**
- Delete the files/directories specified.
- Grep for references to deleted files across the codebase.
- Remove or update all dead references (imports, manifest entries, config references).
- Verify no build/import errors result.

**For renaming (find-and-replace):**
- Process files one at a time or in small batches.
- For massive files (>50KB like chamber.py, ai.py, simulation.py): use grep to find specific line numbers, then make targeted edits. Do NOT try to read the entire file.
- After renaming a module file, update ALL import statements across the codebase.
- NEVER leave partial renames (old name in some files, new name in others).
- When renaming Python modules, also update `__init__.py` files and any `__all__` exports.

**For component extraction (App.tsx decomposition):**
- Read App.tsx to understand the component/function boundaries.
- Extract one component at a time into its own file.
- Update imports in App.tsx after each extraction.
- Verify `tsc -b` passes after each extraction.

**For CSS changes:**
- Work section by section through index.css.
- Use grep to find ALL instances of a pattern (rgba, backdrop-filter, mindfuck-*, etc.).
- When renaming CSS classes, update BOTH the CSS file AND all TSX files that reference them.
- Verify no broken class references remain.

### 4. Verify Completeness
- Run comprehensive grep for any remaining old terms/patterns that should have been changed.
- Run the full test suite and compare pass counts to baseline (must not increase failures).
- Run typecheck (`tsc -b`) for TypeScript changes.
- Run lint for frontend changes (warnings may pre-exist, do not increase errors).

### 5. Manual Verification
- For file cleanup: verify deleted files don't exist with ls.
- For renaming: verify no old names remain with grep across the relevant file types.
- For CSS changes: start the dev server and use agent-browser to screenshot the app.
- For API changes: use curl to verify endpoint responses if the server is running.

### 6. Important Notes
- Python tests MUST be run from `part64/` directory using `python3 -m code.tests.test_*`
- Do NOT use pytest directly (it conflicts with the `code` module name)
- The world server runs on port 8787 (existing process, do not restart)
- The Vite dev server uses port 5173
- Do NOT modify files in `world_state/` or the `fork-tales-backup` branch
- `receipts.log` is append-only — do not delete or rewrite it

## Example Handoff

```json
{
  "salientSummary": "Renamed lore.py to catalog_data.py and replaced all daimoi/daimon references with particles/particle across 15 Python files. Ran test_world_life and test_sonify_determinism — all passing. Verified zero residual 'daimoi' references via grep.",
  "whatWasImplemented": "Renamed core data model file from lore.py to catalog_data.py. Updated 47 'daimoi' references to 'particles' and 23 'daimon' references to 'particle' across world_life.py, myth_bridge.py, world_web/server.py, world_web/simulation.py, and 11 other Python files. Updated all import statements referencing lore module.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {"command": "rg 'daimoi|daimon' part64/code/ --type py -l", "exitCode": 1, "observation": "No results - all old naming removed from Python files"},
      {"command": "rg 'from code.lore|import lore|from code import lore' part64/code/", "exitCode": 1, "observation": "No residual imports of old module name"},
      {"command": "cd part64 && python3 -m code.tests.test_world_life", "exitCode": 0, "observation": "All tests pass"},
      {"command": "cd part64 && python3 -m code.tests.test_sonify_determinism", "exitCode": 0, "observation": "All tests pass"},
      {"command": "cd part64 && python3 -c \"from code.catalog_data import ENTITY_MANIFEST; print(len(ENTITY_MANIFEST), 'entities loaded')\"", "exitCode": 0, "observation": "30 entities loaded - import resolves correctly"}
    ],
    "interactiveChecks": [
      {"action": "Grepped for all old naming patterns across Python files", "observed": "Zero occurrences of daimoi/daimon in functional code"},
      {"action": "Verified catalog_data.py exists and lore.py does not", "observed": "File renamed correctly, old file removed"},
      {"action": "Checked all __init__.py files for updated imports", "observed": "All import paths updated"}
    ]
  },
  "tests": {
    "added": []
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- A rename causes cascading failures in modules not listed in the feature description
- Tests fail after changes and the root cause is unclear or outside feature scope
- A file to be modified is too large to process effectively (>200KB and dense changes needed throughout)
- The feature requires restarting services outside mission boundaries
- API endpoint renaming requires coordinated frontend+backend changes not specified in the feature

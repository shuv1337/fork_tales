# File Cleanup Validation Notes

- Pre-cleanup repository state did **not** include root-level `NEW_LYRICS_*.md` files; the matching files that were deleted lived under `part64/` (`part64/NEW_LYRICS_*.md`, 10 files in commit `2981ea634d73807cc67638dc6c9d9c389d10a8df`).
- Validation baseline observed on 2026-03-13 for this mission:
  - `cd part64/frontend && npx vitest run --exclude 'e2e/**'` => `111 passed`, `12 failed` (pre-existing baseline)
  - `cd part64/frontend && npx eslint .` => `10 errors`, `92 warnings` (pre-existing baseline)
  - `cd part64/frontend && npx tsc -b --pretty false` => exit code `0`
  - `cd part64 && python3 -m code.tests.test_world_life` => exit code `0`
  - `cd part64 && python3 -m code.tests.test_myth_bridge` => exit code `0`
  - `cd part64 && python3 -m code.tests.test_sonify_determinism` => exit code `0`
- Deleted-script residue status after rerun scrutiny on 2026-03-13:
  - Commit `9db0199759207c107c6a196a51a93248062728dc` removed executable references to deleted scripts from `part64/scripts/eval_sim_learning_suite.py`
  - `part64/code/tests/test_muse_semantic_training_lab.py` now contains skipped stubs rather than functional references to the deleted script path
  - Current `rg 'muse_semantic_training_lab\.py|bench_muse_song_lab\.py' part64/` matches are limited to explanatory comments, skip reasons, and stub stderr strings

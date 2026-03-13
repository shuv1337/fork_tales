# Contract ID conventions

- Entity IDs in the codebase naming map use underscore slugs such as `observer_thread`, `fork_cost_metric`, and `log_guardian`.
- Contract and `.opencode/command` presence identifiers use hyphenated slugs such as `observer-thread`, `fork-cost-metric`, and `log-guardian`.
- When checking contract surfaces, validate both forms instead of assuming the underscore-based entity IDs appear verbatim in the executable contract payloads.

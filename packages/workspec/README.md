# WorkSpec (CLI + Validator)

This package provides:

- A programmatic WorkSpec v2.1 validator (`validate()`) that emits RFC 7807 Problem Details
- The authoritative WorkSpec 2.1 evaluator (`runtime`) used by validation, playback, and State Visuals
- The canonical draft-07 JSON Schema (`v2.1.schema.json`) used for generation, autocomplete, and structural validation
- Shared State Library visual resolution helpers
- A `workspec` CLI with `validate`, `migrate`, and `format` commands

## State-driven visuals

WorkSpec v2 simulations may define reusable `simulation.state_libraries`. Objects opt in with object-level `state_library` and optional `appearance` fields; `properties.state` remains the simulation source of truth. Appearance mappings contain project asset IDs only—asset bytes remain in the Studio project asset store.

```json
{
  "simulation": {
    "state_libraries": {
      "actor_basic": {
        "states": ["available", "working"],
        "appearances": {
          "female": {
            "available": "asset_female_idle",
            "working": "asset_female_working"
          }
        }
      }
    },
    "world": {
      "objects": [{
        "id": "worker_1",
        "type": "actor",
        "name": "Worker 1",
        "state_library": "actor_basic",
        "appearance": "female",
        "properties": { "state": "available" }
      }]
    }
  }
}
```

`resolveStateVisualAssetId(document, object, state)` returns the configured asset ID or `null`. Product playback calls `resolveObjectStateAtTime(object, tasks, time, document)` so state is resolved by the authoritative runtime.

## WorkSpec 2.1 semantics

Tasks may use strict `when`, `requires`, and `while` conditions, relative `timing`, and `reservations`. Read them as: should it execute, may it start, and must this remain true while active. A false active `while` interrupts work at a modeled event boundary. Interruption preserves permanent effects, suppresses completion effects, restores temporary effects, releases reservations, records `actual_end`, and captures an optional observational `progress` reference. `continues` links a new authored task interval to interrupted work without reactivating it.

The runtime exposes compact `@task.status`, `@task.actual_end`, and—only for a task declaring `progress`—`@task.progress` references. `@task.end` remains planned. Recovery stays ordinary authored work and can derive its start from `@source.actual_end`; this extends the same authoritative timing resolver and does not add scheduling search.

`duration` is required; `start` may be omitted when dependencies and lower timing bounds determine one unique earliest start. Explicit starts remain authoritative. Arrays/`all` derive from the latest predecessor completion, while `any` ignores skipped alternatives and derives from the first completed eligible alternative. Upper bounds, `not_overlap`, and reservations validate the resolved schedule but never search for a different one.

Value references use the official compact syntax: `"@item.quantity"`, `"@prepare.end"`, and `"@now"`. In a ValueExpression, a normal string is literal, while `"@@item.quantity"` is the literal string `"@item.quantity"` (exactly one leading `@` is removed). Always use compact references in new WorkSpec; compatibility selector objects are accepted only for older documents. Property names must not contain `.`, and must not shadow referenceable built-in fields. Permanent interactions default to completion; `at: "start"` is explicit, while temporary property changes start and restore their captured value at completion.

Named live `simulation.collections` use explicit aliases and snapshot-consistent filters. Conditions quantify them with `all_members`, `any_members`, and `no_members`; `count_members` is a numeric ValueExpression. `process.work_definitions` instantiate one deterministic runtime task per definition/member pair, retain definition and correlation identity, support pending cancellation on collection exit, and feed the same event runtime as authored tasks.

`actor_id` can resolve a modeled ID or use deterministic `select_member` policies (`first_by_id`, `lowest`, `highest` with explicit stable-ID tie breaking). Selection never bypasses performer rules or reservations. Reassignment is a new G008 continuation after interruption, not mutation of an active task. Pure numeric ValueExpression operators are `+`, `-`, `*`, `/`, `min`, and `max`; they have no side effects or coercion.

WorkSpec deterministically instantiates, quantifies, binds, and dispatches. It does not globally optimize schedules or assignments.

Frozen 2.1 intentionally has no automatic continuous physical-state evolution from elapsed time, no general external unbounded arrival source, no global schedule or assignment optimisation, and no stochastic/Monte Carlo core semantics. Its modeled event atomicity also makes no external transaction, IAM, delivery, or device-control guarantee.

The authoritative timing resolver is `runtime.resolveTimings()` in `workspec-runtime.js`. Its normalized map records each task's resolved `start`, `end`/`completion`, `duration`, explicit/derived provenance, and resolution error. Replay, validation, Studio, playback, State Visuals, the CLI, and benchmark validation consume this package-owned result. `workspec-validator.js` adds structural checks, then consumes the runtime's replay result. Browser consumers load the synced runtime before the validator.

## JSON Schema coverage

`v2.1.schema.json` explicitly describes the complete v2 document surface implemented by WorkSpec Studio: core world/process data, built-in and custom object properties, type definitions and traits, interactions and lifecycle actions, recipes, layouts, State Libraries, multi-period calendars/day types, digital space, and display interfaces. Domain-specific object properties remain extensible through `properties`.

## Install

Install globally to use `workspec` from any terminal/command prompt path:

```bash
npm install -g workspec
```

After install, run:

```bash
workspec --help
```

This follows npm's standard cross-platform CLI pattern via `package.json#bin`:

- macOS/Linux: npm links an executable on your PATH
- Windows: npm creates command shims (`workspec.cmd`/`workspec.ps1`)

## CLI

Validate:

```bash
workspec validate path/to/file.workspec.json
workspec validate path/to/file.workspec.json --json
workspec validate -custom path/to/simulation-validator-custom.js path/to/file.workspec.json -y
workspec validate path/to/file.workspec.json --custom path/to/custom-validator.js --custom-catalog path/to/metrics-catalog-custom.json -y
```

`-custom/--custom` supports:
- Metrics Editor-style `validate*` functions in a plain `.js` file
- Node-style exports (`module.exports = function (...) { ... }` or `module.exports.validate = ...`)

Custom validators run user-provided JavaScript and may be dangerous/malicious. The CLI now requires an interactive `Y` confirmation before custom validation executes. Use `-y` / `--yes` to skip the confirmation (required in non-interactive runs like CI).
Custom validation execution is isolated in a subprocess with a hard timeout, and catalog/discovered entry points are restricted to `validate*` function names.

If `--custom-catalog` is omitted, the CLI auto-loads `metrics-catalog-custom.json` from the custom validator file's folder when present.

Migrate (previous UAW syntax → WorkSpec 2.1):

```bash
workspec migrate legacy.json --out migrated.workspec.json --schema
```

Format JSON:

```bash
workspec format file.json --write
```

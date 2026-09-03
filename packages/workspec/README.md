# WorkSpec (CLI + Validator)

This package provides:

- A programmatic WorkSpec v2.1 validator (`validate()`) that emits RFC 7807 Problem Details (with v2.0 compatibility)
- The canonical draft-07 JSON Schema (`v2.1.schema.json`; `v2.0.schema.json` remains available for compatibility)
- Shared observable playback-state and State Library visual resolution helpers
- A `workspec` CLI with `validate`, `migrate`, and `format` commands

## WorkSpec 2.1 Script

Define remains declarative; executable task behaviour belongs in normal JavaScript passed to the WorkSpec runtime. Task handles support chained, reusable, and grouped authoring styles, and `set`, `change`, `move`, `create`, and `remove` are ambient while a handler runs:

```js
WorkSpec.task("mix_dough", task => {
    task.onStart(() => {
        set("mixer", "state", "in_use", { temporary: true });
    });

    task.onComplete(() => {
        change("flour", "quantity", -3);
        set("mixer", "state", "dirty");
    });
});
```

Use `runtime.analyzeScript(source, { taskIds })` for lightweight Studio-style indexing of literal task references, handlers, helper target references, and safe diagnostics. Runtime execution remains authoritative for dynamic JavaScript.

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

`createPlaybackModel(document)` prepares a reusable pure playback model. `resolveWorldStateAtTime(model, time)`, `getObjectAtTime(...)`, `getObjectStateAtTime(...)`, and `getObjectLocationAtTime(...)` resolve the observable WorkSpec v2 world without requiring renderers to replay interactions. `resolveStateVisualAssetId(document, object, state)` maps the resulting semantic state to an asset ID. The compatibility helper `resolveObjectStateAtTime(object, tasks, time)` delegates to the playback-state layer.

## JSON Schema coverage

`v2.1.schema.json` describes the current WorkSpec document surface implemented by WorkSpec Studio: core world/process data, built-in and custom object properties, type definitions and traits, interactions and lifecycle actions, recipes, layouts, State Libraries, multi-period calendars/day types, digital space, and display interfaces. `v2.0.schema.json` remains available for documents that explicitly target v2.0. Domain-specific object properties remain extensible through `properties`.

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

Migrate (Previous UAW Syntax -> WorkSpec 2.1):

```bash
workspec migrate legacy.json --out migrated.workspec.json --schema
```

Format JSON:

```bash
workspec format file.json --write
```

# WorkSpec (CLI + Validator)

This package provides:

- A document validator (`validate()`) and project validation orchestrator (`validateProject()`) that emit RFC 7807-style Problem Details with validation provenance
- The current Starting State JSON Schema (`v2.2.schema.json`)
- Shared TypeScript declarations for authoring `changes.workspec.js`, `constraints.workspec.js`, and `generator.workspec.js`
- Shared observable playback-state and State Library visual resolution helpers
- A `workspec` CLI with `validate`, `snapshot`, `constraints`, `migrate`, and `format` commands

## WorkSpec 2 project architecture

A project has four authoring files:

- `start.workspec.json` is declarative Starting State: world, objects, layout, configuration, planned tasks, timing, and dependencies. It contains no executable effects.
- `changes.workspec.js` contains explicit authored changes. Task handles retain `onStart` and `onComplete`; `set`, `change`, `move`, `create`, and `remove` are ambient inside handlers.
- `generator.workspec.js` is optional simulation logic. Its output enters the same observable history as Changes.
- `constraints.workspec.js` is optional executable domain intent. Constraints inspect resolved state/history and report structured violations; they do not inspect Changes or Generator source.

Changes example:

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

Generator example:

```js
WorkSpec.onStart(({ set }) => set("mixer", "temperature", 20));
WorkSpec.onUpdate(({ get, set, random }) => {
    const drift = random() < 0.5 ? -1 : 1;
    set("mixer", "temperature", get("mixer", "temperature") + drift);
});
```

The deterministic tick rule is: `onStart` runs at execution start, then `onUpdate` runs once at each whole minute strictly after that start through the last resolved task completion (or the requested horizon), in ascending order. `delta` is one minute. Random values come from the seeded `random()` helper; do not use `Math.random()`. The seed is project/runtime metadata, not world state.

`runProject()` produces one authoritative resolved run. At a logical time the runtime completes active tasks and applies their `onComplete` Changes, applies Generator writes, evaluates task dependencies/conditions/actor selection/reservations against that post-Generator state, then applies accepted tasks' `onStart` Changes. Generator owns a same-target/property conflict at that time: completion Changes are overwritten, conflicting start Changes are suppressed, and a non-blocking `generator.changes.conflict` warning is emitted. Numeric deltas from simultaneous Changes combine; other simultaneous Changes writes conflict transactionally.

Use `runtime.runProject(startingState, changesSource, generatorSource, { seed, until })` to produce the single observable history consumed by playback, snapshots, and Constraints. `runtime.snapshotRunAt(run, time)` and `runtime.runConstraintsOnResult(run, constraintsSource, { time })` inspect that existing execution without rerunning Generator or Changes. `runtime.analyzeChanges(source, { taskIds })` provides lightweight Changes indexing. Runtime execution remains authoritative for dynamic JavaScript.

A finite `until` is a horizon: resolve the project through T. It is not a demand that all planned work finish by T. Later tasks remain `pending`, tasks crossing T remain `active`, and dependencies waiting only on future completion are not failures.

Execution is incremental and defaults to a 10,000-event safety limit; trusted API callers can raise `maxEvents` (up to 1,000,000). This prevents minute-driven Generator runs from allocating through pathological horizons. Because callbacks are synchronous JavaScript, the shared runtime cannot pre-empt a callback that never returns; untrusted hosts must still use worker/process isolation with a wall-clock timeout.

Validation is deliberately layered:

- `validate(startingState)` checks only facts decidable from `start.workspec.json`.
- `validateProject(startingState, { changesSource, generatorSource, constraintsSource, seed, until })` composes document, source, runtime/history, and optional Constraint results.
- Every built-in problem includes `scope` and `provenance`; the scope is `document`, `source`, `runtime`, or `constraint`.

For WorkSpec 2.2, document validation does not infer resource utilization, profitability, actor execution overlap, lifecycle, or resource flow from Starting State. A bounded “unused during this run” diagnostic requires an explicit finite `until`; other domain conclusions such as profitability belong in Constraints unless their runtime semantics and horizon are explicitly defined.

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

`v2.2.schema.json` identifies the current declarative Starting State surface. The dependency-free validator is the canonical semantic source of truth and rejects executable task behaviour in WorkSpec 2 Starting State. Earlier schemas remain only as historical versioned specifications.

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
workspec validate path/to/start.workspec.json
workspec validate path/to/start.workspec.json --json
workspec validate path/to/start.workspec.json --changes path/to/changes.workspec.js --generator path/to/generator.workspec.js --seed 17 --time 09:42 --json
workspec validate path/to/start.workspec.json --changes path/to/changes.workspec.js --constraints path/to/constraints.workspec.js --time 09:42 --json --yes
workspec validate -custom path/to/simulation-validator-custom.js path/to/start.workspec.json -y
workspec validate path/to/start.workspec.json --custom path/to/custom-validator.js --custom-catalog path/to/metrics-catalog-custom.json -y
```

Without project-source flags, `validate` performs document validation. Supplying `--changes`, `--generator`, `--constraints`, `--seed`, or `--time` selects the package's project validation path. `--time` is optional, but it is required for claims whose truth depends on a finite horizon, such as a resource being unused during the run. `--constraints` executes JavaScript and therefore requires `--yes` in non-interactive use.

Run a project and inspect its resolved observable state:

```bash
workspec snapshot path/to/start.workspec.json \
  --changes path/to/changes.workspec.js \
  --generator path/to/generator.workspec.js \
  --time 09:42 \
  --seed 1 \
  --json
```

`--changes` and `--generator` are optional. `--time` accepts elapsed minutes, `HH:MM`, a strict ISO date-time, or a JSON day/time value such as `'{"day":2,"time":"09:42"}'`. `--seed` defaults to `1` and controls the Generator's deterministic `random()` helper. With `--json`, stdout is a stable envelope containing `time`, `time_minutes`, `seed`, the resolved `state`, and runtime `problems`. The command exits `1` when runtime problems contain an error and `2` for CLI usage or file-reading errors.

The snapshot command calls the package runtime's `snapshotProjectAt(...)`; it does not replay authored behavior independently and does not expose runtime history. Validate Starting State separately with `workspec validate` when using the edit → validate → snapshot loop.

## Authoring language declarations

The package publishes ambient TypeScript declarations for each executable WorkSpec 2 authoring file. Editors and agents can load the declaration matching the file they are writing:

- `workspec/workspec-changes.d.ts`
- `workspec/workspec-constraints.d.ts`
- `workspec/workspec-generator.d.ts`

For example, a checked JavaScript Changes file can opt in explicitly:

```js
// @ts-check
/// <reference types="workspec/workspec-changes" />
```

Run ordinary JavaScript runtime constraints over the resolved project:

```bash
workspec constraints path/to/start.workspec.json \
  --changes path/to/changes.workspec.js \
  --generator path/to/generator.workspec.js \
  --constraints path/to/constraints.workspec.js \
  --time 09:42 \
  --seed 1 \
  --json --yes
```

`--time` is optional and defaults to the resolved run's final time. The command validates Starting State before execution, emits separate `violations` and runtime `problems` arrays, and exits `1` for an error violation or runtime problem. `--yes` acknowledges that the constraint file is ordinary JavaScript.

A constraint may be registered directly or exported with CommonJS:

```js
WorkSpec.constraint('inventory.non_negative', (ctx) => {
    const quantity = ctx.get('inventory_stock', 'quantity');
    if (quantity >= 0) return null;
    return {
        severity: 'error',
        time: ctx.time,
        objects: ['inventory_stock'],
        property: 'quantity',
        observed: quantity,
        expected: { min: 0 },
        message: 'Inventory cannot be negative.'
    };
});
```

The read-only query context exposes `time`, `state()`, `stateAt(time)`, `get(objectId, property)`, `getAt(time, objectId, property)`, and `times()`. `times()` returns the resolved event/update times from the authoritative run so a constraint can inspect a meaningful period without exposing Changes or Generator internals. `stateAt()` and `getAt()` may query any time already covered by that run; they never start another execution. Resolve through a later horizon first if a Constraint needs later state.

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

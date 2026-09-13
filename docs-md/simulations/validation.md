# WorkSpec validation architecture

WorkSpec 2.2 validation follows the four-file project architecture. No single
Starting State pass can establish every fact about a project.

## Validation layers

### Document validation

`validate(document)` checks `start.workspec.json` only. It owns facts that are
decidable from that document: schema and section shape, IDs, initial objects and
properties, type definitions, State Library declarations and initial state,
task syntax, initial references, and the declared dependency graph.

Problems from this pass have `scope: "document"` and provenance pointing to
`start.workspec.json`. The document validator does not claim that a 2.2 resource
is never used, calculate 2.2 profitability, or report an execution conflict from
two planned actor assignments.

### Project and source validation

`validateProject(startingState, options)` is the package orchestration interface.
It combines document validation with lightweight cross-file checks, including
literal task IDs referenced by `changes.workspec.js` and JavaScript compilation
failures. Source problems have `scope: "source"` and name their source file.

The validator intentionally does not attempt a large static analysis of authored
JavaScript. Runtime execution is authoritative for dynamic behavior.

### Runtime and history validation

Project validation resolves Starting State + Changes + optional Generator with a
seed. It reports facts that depend on execution: performer binding and liveness,
conditions, task lifecycle, reservations and capacity, timing, object lifecycle,
movement, property writes, and State Library state writes. These problems have
`scope: "runtime"` and resolved-history provenance.

This resolution happens once. The returned authoritative run owns final state,
history, task status, usage, and runtime diagnostics. Snapshots and Constraints
read that existing run, so seeded Generator callbacks are not repeated merely to
inspect another time.

At one logical time, task completions and completion Changes run first, Generator
runs second, task decisions and reservations observe the generated state, and
task-start Changes run last. Generator remains the deterministic winner for a
same-property Generator/Changes conflict.

Claims involving “never” require an explicit finite horizon. For example,
`object.optimization.unused_resource` is emitted for WorkSpec 2.2 only by bounded
project validation (`until` in the package interface or `--time` in the CLI), and
its message states that horizon. Without a horizon the claim is deferred.

The built-in validator does not define domain economics, recipe policy, or other
business-specific invariants. Put those rules in Constraints.

### Constraints

`constraints.workspec.js` contains user-authored domain invariants over resolved
state and history. Constraint results have `scope: "constraint"`. Constraints
are the appropriate place for profitability, stock policy, recipe fulfillment,
service levels, safety limits, and other domain metrics whose semantics belong
to the project author.

## Package and CLI use

```js
const { validate, validateProject } = require('workspec');

const documentResult = validate(startingState);
const projectResult = validateProject(startingState, {
  changesSource,
  generatorSource,
  constraintsSource,
  seed: 17,
  until: 570
});
```

```text
workspec validate start.workspec.json --json

workspec validate start.workspec.json \
  --changes changes.workspec.js \
  --generator generator.workspec.js \
  --constraints constraints.workspec.js \
  --seed 17 --time 09:30 --json --yes
```

The first command is document validation. Supplying project-source flags selects
project validation. `--time` defines the finite history horizon used by bounded
claims. Generator and Constraints remain optional.

A horizon means “resolve through T”, not “require all authored work to complete
by T”. Work scheduled later stays pending, active work may cross the horizon,
and a dependency waiting only because execution was truncated is not an error.

## Legacy validator and Metrics Catalog

`web/assets/js/simulation-validator.js` and
`web/assets/static/metrics-catalog.json` implement the older flat simulation and
inline-interaction model. They are retained for legacy documents and custom
Metrics Editor workflows; they are not a WorkSpec 2.2 validation source of truth.
Studio does not run those built-in catalog checks as authoritative 2.2 checks.

For current WorkSpec 2.2 projects, the source of truth is the package document
validator plus the `validateProject(...)` orchestration described above.

---
title: "Seeds and determinism"
description: "Make Generator executions reproducible with the runtime seed."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 50
---

# Seeds and determinism

Generator randomness comes from the run seed and the context's `random()` function.

## Seed contract

The runtime uses seed `1` when callers do not supply a seed. The run result records the applied seed as `run.seed`.

The seed is runtime metadata. It is not world state.

```js
WorkSpec.onUpdate(({ random, set }) => {
  set("sensor", "sample", random());
});
```

For the same project, sources, options, and seed, the runtime produces the same random sequence and resolved history.

Different seeds can produce different histories when callbacks consume random values.

## Do not use `Math.random`

Do not call `Math.random()` in Generator source. It does not use the WorkSpec seed and breaks reproducibility.

The runtime does not replace or block `Math.random()`. Reproducible authoring depends on using `context.random()`.

## Reproducible evidence

Record these values with saved run evidence:

- WorkSpec package version;
- WorkSpec language version;
- Starting State and executable sources;
- seed;
- requested horizon;
- work-unit budget.

The [runtime execution model](../runtime/execution-model.md) explains why snapshots and Constraints must consume the same run object.


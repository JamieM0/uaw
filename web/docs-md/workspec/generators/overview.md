---
title: "Generator overview"
description: "Understand optional causal simulation logic in WorkSpec 2.2."
section: "workspec"
type: "explanation"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# Generator overview

A Generator adds optional causal behavior to a WorkSpec project. It can read and change world state during one authoritative run.

Generator callbacks run at the simulation start and at whole-minute updates. Their writes enter the same history as task Changes.

Use a Generator for behavior that depends on evolving state, time, or deterministic random values. Use [Changes](../changes/overview.md) for explicit effects attached to known tasks.

## Causal behavior

Generator writes affect later decisions in the same run. Tasks can observe created objects, changed properties, and moved entities.

```js
WorkSpec.onStart(({ set }) => {
  set("tank", "temperature", 20);
});

WorkSpec.onUpdate(({ get, set }) => {
  set("tank", "temperature", get("tank", "temperature") + 0.5);
});
```

The runtime applies Generator writes before same-time task-start checks. Therefore, guards and performer selection can observe those writes.

## Optional source

Projects can omit `generator.workspec.js`. A project with only Starting State and Changes remains a complete passive timeline model.

## Scope boundary

Generator operations mutate world state. They do not directly create runtime task instances.

Starting State work definitions declare dynamic work. Runtime collection changes can then cause the runtime to create task instances. See [Generator and dynamic work](dynamic-work-relationship.md).

## Related pages

- [Authoring Generators](authoring.md)
- [Generator context and operations](context-operations.md)
- [Generator execution order](execution-order.md)
- [Seeds and determinism](determinism.md)


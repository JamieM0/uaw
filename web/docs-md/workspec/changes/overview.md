---
title: "Changes overview"
description: "Understand explicit task-linked effects in a WorkSpec 2.2 project."
section: "workspec"
type: "explanation"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 10
related:
  - /docs/workspec/changes/authoring/
  - /docs/workspec/changes/boundaries/
---

# Changes overview

Changes define predetermined effects for declared tasks. Put them in `changes.workspec.js`, outside the declarative Starting State.

A Change belongs to a known task and one lifecycle phase. An `onStart` handler supplies effects for task activation. An `onComplete` handler supplies effects for successful task completion.

Changes do not read evolving world state or run on a timer. The callback context exposes effect operations, the task ID, and the phase only. Use a [Generator](../generators/overview.md) when behavior must react to state over time.

## Execution contract

The runtime compiles each handler into task interactions before it starts the run. It applies those interactions within the [authoritative execution](../runtime/execution-model.md).

The runtime processes completion Changes before Generator logic at the same time. It processes accepted start Changes after Generator logic and task-start decisions.

Simultaneous numeric `change` operations to one property combine. Other same-target writes can fail as a transaction. See [same-time writes and transactions](conflicts-transactions.md).

## Minimal example

```js
WorkSpec.task("mix_dough").onStart(() => {
  set("mixer", "state", "in_use", { temporary: true });
});

WorkSpec.task("mix_dough").onComplete(() => {
  change("flour", "quantity", -3);
  set("mixer", "state", "dirty");
});
```

The temporary start effect lasts while `mix_dough` is active. The completion effects remain in later snapshots.

## Scope boundary

Changes describe known effects. They do not model causal rules, periodic drift, or autonomous decisions.

The Starting State owns task declarations and schedules. Changes attach effects to those declared tasks. Generator logic can change causal state, but it does not replace task definitions.

## Related pages

- [Authoring Changes](authoring.md)
- [Task lifecycle Changes](lifecycle.md)
- [Change operations](operations.md)
- [What does not belong in Changes](boundaries.md)


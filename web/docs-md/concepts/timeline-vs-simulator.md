---
title: "Timeline versus simulator"
description: "Understand predetermined timeline effects and causal state-driven simulation as different modeling tools."
section: "concepts"
type: "explanation"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 10
related:
  - /docs/workspec/changes/boundaries/
  - /docs/workspec/generators/overview/
---

# Timeline versus simulator

WorkSpec supports a passive timeline and optional causal simulation without treating them as the same model.

## The timeline model

A timeline resembles a cut scene. The author knows the planned tasks and their effects before execution.

Changes attach those predetermined effects to task start or completion. The runtime resolves timing, dependencies, performers, reservations, and conflicts, but a handler does not ask what the world currently contains.

This model keeps known process descriptions direct. A reader can connect each task with its authored effects.

## The simulator model

A causal simulator reacts to evolving state. Generator logic can read the current world, use time, and use deterministic random values.

The result of one event can affect later runtime decisions. For example, a Generator update can change collection membership before the runtime evaluates new task starts.

This power adds responsibility. State-driven logic can hide the reason for an outcome if the model uses it for effects that were already known.

## Why the distinction matters

Predetermined effects and causal rules answer different questions.

| Question | Suitable model |
|---|---|
| What known effect occurs when this task completes? | Timeline with Changes |
| How does current temperature affect the next update? | Generator simulation |
| What work applies to new eligible members? | Declarative work definition |
| Is the resolved world acceptable? | Constraint |

Keeping these roles separate makes the authored project easier to inspect. It also prevents Changes from becoming hidden simulation code.

## The shared result

Both Changes and Generator writes enter one authoritative history. Snapshots, Constraints, and rendering consume that shared evidence.

The [Changes boundary](/docs/workspec/changes/boundaries/) defines the passive model. The [Generator overview](/docs/workspec/generators/overview/) defines causal behavior. The [execution model](/docs/workspec/runtime/execution-model/) owns their normative event order.

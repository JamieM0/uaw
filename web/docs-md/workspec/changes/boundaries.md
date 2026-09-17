---
title: "What does not belong in Changes"
description: "Choose Changes only for explicit predetermined task effects."
section: "workspec"
type: "explanation"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 60
---

# What does not belong in Changes

Changes model known effects on a task timeline. They do not model a causal simulation.

## Use Changes for predetermined effects

Use Changes when the author already knows the effect and its task phase.

Examples include:

- decrease stock after a declared task completes;
- move a product when a transport task completes;
- show an actor as busy while a task is active;
- create a known output object after production.

## Use Generator logic for causal behavior

Use a [Generator](../generators/overview.md) when behavior depends on evolving state, time, or deterministic random values.

Examples include:

- change temperature each minute;
- create an arrival when a causal rule fires;
- react to state that earlier runtime events produced.

A Changes handler has no state reader and no current time. Adding these concerns would turn a predetermined effect into hidden simulation logic.

## Keep task creation declarative

Changes do not create runtime task instances. Authors declare dynamic-work templates in Starting State work definitions.

The runtime creates task instances when collection membership satisfies those declarations. See [runtime task instances](../runtime/task-instances.md).

## Keep domain truth in Constraints

Changes implement effects. They do not prove that the resulting world is valid.

Use [Constraints](../constraints/overview.md) to inspect resolved evidence and report domain violations.


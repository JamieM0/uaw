---
title: "Model a real process"
description: "Turn a real process into objects, tasks, state, effects, and domain invariants."
section: "guides"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 10
related:
  - /docs/workspec/project-model/
  - /docs/workspec/starting-state/overview/
---

# Model a real process

Use this guide to turn observed work into a small model that you can inspect and challenge.

## Start with the question

Write one question that the model must answer. Examples include:

- Can the line complete 20 units before noon?
- Which stock rule fails during a normal run?
- What state does each order reach after packing?

A clear question limits the model. Do not encode detail that cannot affect the answer.

## Identify durable things

List the things whose identity or state matters over time. Model those things as objects or locations.

For each candidate, record:

| Question | Modeling decision |
|---|---|
| Must you track its identity? | Give it an object ID. |
| Is only a quantity relevant? | Use a property on a stock object. |
| Does placement affect work? | Model a location and placement. |
| Does a group change during execution? | Declare a collection. |

Use the [Starting State reference](/docs/workspec/starting-state/overview/) for exact fields.

## Describe planned work

Create a task for each unit of planned work that has meaningful timing, dependencies, or performer selection. Keep task names about work, not outcomes.

Add only dependencies that express a real ordering requirement. A coincidental order in one observed run is not a dependency.

Use a work definition when the same task template applies to members that appear during execution. See [model dynamic work](./dynamic-work.md).

## Separate state from effects

Starting State describes the world before execution. Changes describe known task-linked effects.

Use a Change when you can state the effect before the run. Examples include consuming three units at completion or marking a machine busy at task start.

Use Generator logic when later behavior reacts to evolving state, time, or seeded random values. The [Changes or Generator guide](./changes-vs-generator.md) provides the decision test.

## State the domain truth

Write a short list of truths that must hold in a good resolved world. Examples include non-negative inventory, qualified performers, and material balance.

Turn the most important truths into Constraints. A Constraint checks resolved evidence. It must not copy the implementation of a Changes handler.

## Test the model in layers

1. Validate the Starting State.
2. Validate the complete project sources.
3. Run through a finite horizon with a fixed seed.
4. Inspect snapshots at meaningful event times.
5. Run Constraints against the same authoritative run.
6. Render the world to find placement or appearance errors.

The [debugging guide](./debug-project.md) explains this workflow. The model is useful when its evidence answers the original question and its Constraints reject plausible damage.

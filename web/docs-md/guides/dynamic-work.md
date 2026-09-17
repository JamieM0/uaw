---
title: "Model dynamic work"
description: "Declare collection-driven work and inspect the runtime instances created from it."
section: "guides"
type: "how-to"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 60
related:
  - /docs/workspec/starting-state/work-definitions/
  - /docs/workspec/runtime/task-instances/
---

# Model dynamic work

Use dynamic work when a task template applies to members that become eligible during execution.

## Separate the three owners

Dynamic work has three distinct owners:

| Concern | Owner |
|---|---|
| Eligible members and task template | Authored Starting State |
| Instance identity, status, and assignment | Runtime |
| Causal state changes that affect membership | Optional Generator |

Generator logic does not directly instantiate tasks. The runtime creates instances from declared work definitions.

## Define the eligible set

Declare a collection that expresses which objects need the work. Keep the membership rule about world state.

Choose collection boundaries deliberately. A close time can prevent later matching members from creating work.

Use the [collections reference](/docs/workspec/starting-state/collections/) for exact membership and boundary fields.

## Declare the work definition

Add one work definition for the collection. Give the definition a stable ID, a member alias, an instantiation rule, and a task template.

Do not put an instance `id` or absolute `start` in the template. The runtime supplies identity and appearance-based timing.

The [work definitions reference](/docs/workspec/starting-state/work-definitions/) owns the full authoring contract.

## Bind member data

Use the declared alias in task expressions that depend on the collection member. This keeps the reusable template separate from each instance.

Check every referenced value on a representative member. A valid template can still produce a runtime Problem when an instance lacks required data.

## Trigger work through state

Changes or Generator logic can create or update an object. That state change can alter collection membership.

At the runtime synchronization point, the declared work definition can create an instance for the new definition-member pair. This causal chain does not transfer authorship to Generator logic.

## Inspect runtime instances

Inspect `task_instances` in a snapshot. Each record can include its generated ID, definition ID, correlation ID, collection, instantiation time, performer, status, and assignment history.

One run creates at most one instance for each definition-member pair. Re-entry does not create a second instance.

If pending work must disappear when a member exits, use the definition's cancellation behavior. See [runtime task instances](/docs/workspec/runtime/task-instances/) for the resolved contract.

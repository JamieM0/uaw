---
title: "The files in a WorkSpec project"
description: "Understand the role and boundary of each canonical WorkSpec 2.2 project file."
section: "start"
type: "explanation"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# The files in a WorkSpec project

A WorkSpec project uses one required file and up to three executable source files.

## File roles

| File | Required | Put this content here | Keep this content out |
|---|---:|---|---|
| `start.workspec.json` | Yes | Initial world, locations, planned tasks, collections, and work definitions | Executable effects and domain checks |
| `changes.workspec.js` | No | Predetermined effects for known task starts and completions | Reads of evolving state and timer logic |
| `constraints.workspec.js` | No | Domain rules over resolved state and history | State mutations and task implementation |
| `generator.workspec.js` | No | Optional behavior that reacts to state, time, or seeded randomness | Direct task-instance creation |

## Starting State is declarative

Starting State declares existing entities and planned work. WorkSpec 2.2 does not put task interactions inside the JSON document.

See the [Starting State overview](/docs/workspec/starting-state/overview/) for its canonical structure.

## Changes are predetermined

Changes attach known effects to declared tasks. A Change can set, change, move, create, or remove a world object.

Changes cannot read evolving state. Use the [Changes boundary](/docs/workspec/changes/boundaries/) to decide whether an effect belongs there.

## Constraints inspect evidence

Constraints read one resolved run. They report domain violations without changing state.

Document validation and Constraints answer different questions. The [Constraints overview](/docs/workspec/constraints/overview/) explains that distinction.

## Generator logic is optional

A Generator can react to current state at the simulation start and at whole-minute updates.

A Generator cannot directly create a task instance. It can change world state, which can change collection membership. A declared work definition then causes the runtime to create an instance.

Learn this model in [collections and dynamic work](/docs/learn/collections-and-dynamic-work/) before you add Generator logic.

## One run connects the files

The runtime combines Starting State, Changes, and optional Generator logic into one authoritative run. Snapshots, Constraints, and rendering inspect that run.

The [project model](/docs/workspec/project-model/) provides the complete architecture.

---
title: "WorkSpec as inspectable world modelling"
description: "Understand how objects, state, time, execution, Constraints, and presentation form an inspectable model."
section: "concepts"
type: "explanation"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 50
related:
  - /docs/workspec/project-model/
  - /docs/workspec/rendering/overview/
---

# WorkSpec as inspectable world modelling

WorkSpec models a changing world whose state and history remain available for inspection.

## World identity

Objects and locations give stable identity to things that matter. Properties describe state, and placement connects objects with space.

Collections add changing sets. Tasks and work definitions describe planned or repeatable work against that world.

## Time and change

Time makes the model more than a static document. Task lifecycle events apply predetermined Changes. Optional Generator logic introduces causal, state-driven behavior.

The runtime combines those sources into one resolved history. A snapshot selects world state at a resolved time.

## Truth and evidence

Constraints inspect snapshots and history. They state domain truth without controlling the execution that produced the evidence.

This separation helps a reviewer distinguish three concerns:

| Concern | Question |
|---|---|
| Authorship | What facts, work, and effects did the author declare? |
| Resolution | What happened under these run controls? |
| Evaluation | Does the resolved world satisfy its domain rules? |

## Presentation

Rendering presents resolved state. State Libraries and asset mappings can change appearance without becoming a second state model.

If a rendered view conflicts with a snapshot, the snapshot remains the runtime evidence. The visual layer must explain its own mapping or layout error.

## Future layers

Solver and optimizer layers can eventually propose authored choices that satisfy Constraints. They would sit around the model rather than redefine its state, history, or domain truth.

The current product does not promise that broader search behavior. The [project model](/docs/workspec/project-model/) owns the current authored and resolved layers. The [rendering model](/docs/workspec/rendering/overview/) owns the presentation boundary.

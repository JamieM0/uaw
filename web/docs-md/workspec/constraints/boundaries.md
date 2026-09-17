---
title: "What belongs in a Constraint"
description: "Separate domain truth from structural validation and implementation checks."
section: "workspec"
type: "explanation"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 50
---

# What belongs in a Constraint

A Constraint states a domain invariant that resolved project evidence can prove or disprove.

## Good Constraint subjects

Use a Constraint for project-specific truth, such as:

- stock stays at zero or more;
- a temperature remains within a validated range;
- a product reaches a required state;
- a process outcome exists by the selected horizon.

Each finding should identify the affected time, objects, property, and expected value when those details apply.

## Structural validation is separate

Do not use Constraints to check JSON shape, required fields, IDs, references, or source syntax. The WorkSpec validator and runtime own those checks.

A structurally valid file can still describe an invalid world. Constraints cover that second question.

## Runtime failures are separate

Do not return violations for failures that prevent reliable evidence. Compilation failures, invalid writes, budget exhaustion, and unresolved query times are Problems.

## Implementation details are separate

Constraints inspect observable state and history. They do not inspect Changes or Generator source.

Do not encode how the project must achieve a result unless that implementation detail is itself a domain requirement.

## Design guidance

This reference defines the boundary. The [design useful Constraints guide](/docs/guides/design-constraints/) covers modeling judgment and rule selection.

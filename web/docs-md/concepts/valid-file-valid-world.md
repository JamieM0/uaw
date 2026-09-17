---
title: "A valid file is not necessarily a valid world"
description: "Understand the difference between structural correctness and domain truth."
section: "concepts"
type: "explanation"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 20
related:
  - /docs/workspec/problems/
  - /docs/workspec/constraints/overview/
---

# A valid file is not necessarily a valid world

Validation and Constraints answer different questions about a WorkSpec project.

## Structural correctness

Document validation asks whether Starting State follows the language contract. It checks facts such as field shape, identifiers, references, and supported values.

Project validation can add source compilation and bounded runtime evidence. These layers can report that code failed or execution reached an invalid operation.

Passing these checks means the project is structurally usable for the checked scope. It does not prove that the modeled process is good.

## Domain truth

A world can be structurally valid and still violate its domain.

Examples include:

- inventory remains non-negative but uses the wrong recipe quantity;
- a task finishes under an unqualified performer;
- output preserves its count but loses material balance;
- a cold store remains well-formed but exceeds its safe temperature;
- two steps occur in a permitted order that violates policy.

Constraints express these truths over resolved state and history. They return domain violations with evidence.

## Why the layers stay separate

The language validator cannot know every recipe, safety threshold, staffing policy, or commercial rule. Encoding those facts as universal syntax rules would make the language specific to one domain.

Constraints let each project state its own definition of a valid world. They also let a reviewer distinguish a malformed document from a meaningful but unacceptable execution.

## A practical interpretation

Use this sequence when you assess a project:

1. Validate the document contract.
2. Compile and run trusted project sources.
3. Inspect the resolved state and history.
4. Run domain Constraints.
5. Review whether the Constraint set covers plausible semantic damage.

The [Problems reference](/docs/workspec/problems/) defines structural and runtime diagnostics. The [Constraints overview](/docs/workspec/constraints/overview/) defines domain checks.

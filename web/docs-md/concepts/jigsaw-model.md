---
title: "The jigsaw model"
description: "Understand WorkSpec as sparse known facts completed and challenged by domain Constraints."
section: "concepts"
type: "explanation"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 40
related:
  - /docs/workspec/constraints/overview/
  - /docs/concepts/world-modelling/
---

# The jigsaw model

The jigsaw model treats a process description as a set of known pieces rather than a complete prescription.

## Sparse known facts

A WorkSpec project can state facts that are already known: objects exist, work takes time, one task depends on another, and completion changes inventory.

The model does not need to invent every physical or commercial detail. It needs enough pieces to answer the current question.

This approach keeps uncertain domain assumptions visible. Missing information remains missing instead of becoming plausible generated detail.

## Constraints shape the solution space

Constraints describe combinations that the domain accepts or rejects. A material-balance rule can reject an impossible result without prescribing each implementation step.

The authored facts and the Constraints therefore serve different roles:

- facts describe known state, work, and effects;
- Constraints describe truths that valid resolved worlds must satisfy;
- resolved history supplies evidence for review.

The empty spaces between those pieces identify modeling uncertainty.

## Adversarial review completes the picture

A healthy example can satisfy a weak Constraint set. Challenge the model with plausible changes that preserve superficial output.

If reduced input stock, an unqualified performer, or reversed quality checks remain undetected, the jigsaw lacks an important boundary piece. Add a Constraint only when a domain owner recognizes the missing rule as real.

## Long-term direction

The same separation supports future optimization or solving. A system can search for arrangements that satisfy declared facts and Constraints without changing their meaning.

That direction does not make the current runtime a general solver. WorkSpec 2.2 resolves authored work and optional causal behavior.

Use the [Constraints overview](/docs/workspec/constraints/overview/) for the current contract. Use [WorkSpec as inspectable world modeling](./world-modelling.md) for the broader architecture.

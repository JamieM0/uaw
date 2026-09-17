---
title: "Constraint surprises"
description: "Diagnose Constraints that do not run, query the wrong time, fire too often, or return weak evidence."
section: "troubleshooting"
type: "troubleshooting"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
related:
  - /docs/workspec/constraints/context/
  - /docs/workspec/constraints/violations/
---

# Constraint surprises

Separate Constraint execution Problems from the domain violations returned by a successful check.

## Symptom: the Constraint never runs

Confirm that the command loads the correct Constraint file. Check that the file registers or exports its check in a supported form.

For the CLI, `workspec constraints` requires `--constraints` and `--yes`. Project validation also requires `--yes` when `--constraints` is present.

If the requested time exceeds `run.resolvedThrough`, the runtime returns `runtime.execution.unresolved_time` without calling the check.

See [authoring Constraints](/docs/workspec/constraints/authoring/) for registration forms.

## Symptom: a rule never reports a known failure

Check the return value first. Boolean `false` means no violation. Return a violation object when the rule fails.

Then inspect the evidence at the selected time. `get()` reads the selected Constraint time. Use `getAt()` or `stateAt()` for another resolved time.

For a rule that must hold throughout history, iterate over `times()` and return the first meaningful violation.

## Symptom: a rule fires too often

Check whether the rule encodes a domain invariant or copies one implementation choice. A valid alternative implementation should not fail unless it violates domain truth.

Also check the time boundary. A minimum-stock policy at final time differs from a non-negative-stock rule throughout history.

## Symptom: the evidence describes the wrong object

`get()` and `getAt()` search objects and locations. They return `undefined` for an unknown target or property.

Check IDs, aliases, and dynamic instance correlation. Use `stateAt()` when the rule needs reservations, task runtime records, or assignment data.

The [Constraint context reference](/docs/workspec/constraints/context/) defines query behavior.

## Symptom: the violation is difficult to act on

Return the relevant time, objects, property, observed value, expected value, and message. Use a stable Constraint ID.

Do not put a source-stack trace in a domain message. Execution failures belong in Problems. The [Constraint violation reference](/docs/workspec/constraints/violations/) defines the normalized evidence fields.

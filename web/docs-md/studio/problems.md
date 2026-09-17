---
title: "Validation and Problems"
description: "Run Studio project validation, filter Problems, inspect provenance, and follow runtime Constraint evidence."
section: "studio"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# Validation and Problems

Studio validates the current Starting State and executable sources as one project. It presents diagnostics in **Simulate** > **Problems**.

## Run validation

Select **Run validation** in **Problems**. You can also select **Validate WorkSpec** in **Editor** or press **Cmd/Ctrl+Enter**.

Automatic validation runs after source edits unless you disable it. The status indicator reports one of these results:

- **✓ Valid WorkSpec**
- **⚠ WorkSpec warnings (N)**
- **✗ WorkSpec errors (N)**
- **✓ JSON syntax valid · WorkSpec checks off**
- **✗ Invalid JSON: MESSAGE**

Studio uses the package project validator for WorkSpec 2.2. It does not substitute legacy flat-model checks when that validator is unavailable.

## Understand diagnostic layers

| Evidence | Typical Studio source | What to inspect |
|---|---|---|
| Document | `start.workspec.json` | JSON shape, fields, references, and schedule. |
| Source | Changes, Generator, or Constraints | Compilation and source references. |
| Runtime | Resolved execution | Reservations, effects, and execution state. |
| Constraint | Constraint execution | Constraint source failures or domain violations. |

Each displayed Problem can include its producing layer and source. Runtime Constraint results can also show time, observed values, and expected values.

The [Problems reference](/docs/workspec/problems/) defines Problem fields, scopes, provenance, and stable metric IDs. The [Constraint violations reference](/docs/workspec/constraints/violations/) defines domain violation results.

## Filter Problems

Use the **Show:** menu or the count buttons.

| Filter | Displayed results |
|---|---|
| **All Metrics** | All reported results. |
| **Errors Only** | Errors. |
| **Warnings Only** | Warnings. |
| **Suggestions Only** | Informational suggestions. |
| **Passed Only** | Passed checks. |
| **Custom Only** | Custom rule results. |
| **Built-in Only** | Built-in results. |

The summary counts show **Total**, **Errors**, **Warnings**, **Suggestions**, and **Passed**.

## Follow a runtime Constraint violation

Select a runtime Constraint Problem with time and object evidence. Studio moves the application clock to the violation time and highlights the affected object.

Studio opens **Timeline** when the affected object is not visible in **Problems**. The temporary highlight remains for three seconds.

This workflow reports evidence only. Studio does not provide automatic remediation or a Constraint query language.

## Apply an available correction

Some dependency-scheduling Problems contain a structured correction. Select the **Apply VALUE** action to update the explicit task start.

The Starting State editor also exposes the same timing correction as a code action. Run validation again after applying it.

## Playback blocking

A `temporal.scheduling.dependency_violation` error disables playback controls. Studio stops playback and resets the clock while that Problem remains.

Other Problem types remain visible but do not use this specific playback block. Fix the dependency schedule, then run validation again.

## Security boundary

Project validation can compile or execute project JavaScript. Do not validate an untrusted project in Studio.

Use the [trusted-code security contract](/docs/workspec/sources/security/) for the complete execution and isolation model.


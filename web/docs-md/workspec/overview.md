---
title: "WorkSpec language overview"
description: "Understand the authored files, resolved run, and inspection surfaces in WorkSpec 2.2."
section: "workspec"
type: "explanation"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# WorkSpec language overview

WorkSpec describes a world, planned work, executable effects, and rules for judging the resolved result.

## Authored project

A WorkSpec 2.2 project can contain four source files.

| File | Role | Required |
|---|---|---:|
| `start.workspec.json` | Declares Starting State and planned work. | Yes |
| `changes.workspec.js` | Declares predetermined task effects. | No |
| `generator.workspec.js` | Adds causal simulation logic. | No |
| `constraints.workspec.js` | Checks domain rules against resolved evidence. | No |

Starting State contains no executable task effects. Put `set`, `change`, `move`, `create`, and `remove` operations in an executable source.

## Resolved project

The runtime combines Starting State with Changes and an optional Generator. One run produces task outcomes, state history, and diagnostics.

Snapshots, Constraints, playback, and rendering can inspect that same run. They do not define separate versions of project state.

## Validation layers

WorkSpec separates four kinds of validation evidence.

| Scope | Evidence |
|---|---|
| `document` | One `start.workspec.json` document |
| `source` | An executable source or cross-source relationship |
| `runtime` | A resolved run and its history |
| `constraint` | A domain rule evaluated against resolved evidence |

Document validation cannot prove general claims about runtime use, profitability, or resource flow.

## Current language

WorkSpec 2.2 is the canonical language for new projects. Compatibility syntax remains separate from the [canonical reference](./language/values-references-expressions.md).

See [versions and compatibility](./versioning-compatibility.md) before you load historical projects.


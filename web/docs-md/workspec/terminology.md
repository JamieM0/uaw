---
title: "Terminology and glossary"
description: "Use the canonical WorkSpec terms and editorial capitalization."
section: "workspec"
type: "reference"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Terminology and glossary

Use each WorkSpec term with the meaning in this page.

## Canonical terms

| Term | Meaning | Avoid as a synonym |
|---|---|---|
| document | One parsed WorkSpec JSON value. | project |
| project | Starting State plus its executable source files and assets. | document |
| Starting State | The declarative `start.workspec.json` input. | initial simulation |
| resolved state | World and runtime data at a resolved logical time. | Starting State |
| task definition | An authored task under `process.tasks`. | task instance |
| task instance | Runtime work created from a work definition. | task definition |
| Change | A predetermined effect attached to a task lifecycle event. | Generator update |
| history entry | Recorded resolved state at a logical time. | snapshot |
| Constraint | An executable domain rule over resolved evidence. | validator |
| Constraint violation | A domain result returned by a Constraint check. | Problem |
| Problem | A structured diagnostic from a document, source, runtime, or Constraint layer. | violation |
| actor | A built-in object type that can perform work. | performer |
| performer | The object selected to perform one task. | actor |
| run | One authoritative execution with history and diagnostics. | snapshot |
| requested horizon | The time through which a caller asks the runtime to resolve. | resolved-through time |
| resolved-through time | The latest time that a run safely resolved. | requested horizon |
| snapshot | A read-only view of one run at one time. | history entry |
| playback model | A reusable model for reading observable state over time. | run |
| asset ID | A project identifier used by an appearance mapping. | asset data |
| asset data | File bytes stored outside the WorkSpec document. | asset ID |
| work definition | An authored template for runtime task instances. | Generator task API |

## Capitalization

Capitalize **WorkSpec**, **Starting State**, **Change**, **Changes**, **Constraint**, **Constraints**, **Generator**, **Problem**, and **State Library**.

Use lowercase for run, snapshot, task definition, task instance, performer, and resolved state.

Use code font for field names, filenames, values, functions, and commands.


---
title: "Executable source files"
description: "Reference shared authoring conventions for Changes, Constraints, and Generator JavaScript sources."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 210
---

# Executable source files

WorkSpec uses separate JavaScript files for Changes, Constraints, and Generator logic.

## Canonical filenames

| File | Purpose | Type declarations |
|---|---|---|
| `changes.workspec.js` | Predetermined task effects | `workspec/workspec-changes` |
| `constraints.workspec.js` | Domain checks over resolved evidence | `workspec/workspec-constraints` |
| `generator.workspec.js` | Optional causal simulation logic | `workspec/workspec-generator` |

These files contain ordinary synchronous JavaScript. They do not share one registration or export mechanism.

## Checked JavaScript

To load source-specific editor types, add `// @ts-check` and a triple-slash declaration reference.

```js
// @ts-check
/// <reference types="workspec/workspec-changes" />
```

Select the declaration that matches the file. Do not load one file's declarations as another source type.

## Ambient API

Each source receives an ambient `WorkSpec` object. Changes also receives ambient operation helpers inside task handlers.

The available registrations and callbacks differ by source. Read the source-specific Changes, Constraints, or Generator reference before authoring.

## Synchronous callbacks

All source callbacks must return synchronously. Do not return a Promise or depend on asynchronous completion.

Callbacks run in the JavaScript environment provided by the caller. Do not assume browser globals, npm imports, or a module loader.

## Compilation Problems

Compilation and source-analysis failures produce Problems with `scope: "source"`. Their provenance identifies the relevant source filename.

Runtime failures can instead use `scope: "runtime"`. Constraint infrastructure failures can use `scope: "constraint"`.

## Source-specific boundary

This page owns shared file and editor conventions. Source-specific registration belongs to each source's authoring reference.

See [trusted code and execution security](./security.md) before you execute a project from an untrusted source.


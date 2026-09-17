---
title: "Tooling and analysis APIs"
description: "Experimental Changes source analysis for editors and developer tools."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "experimental"
experimental: true
order: 130
---

# Tooling and analysis APIs

`runtime.analyzeChanges()` is an experimental source-analysis helper for editor and tooling integrations.

> **Caution:** The analysis result is experimental. Field names and source-detection behavior can change between package releases.

## Signature

```ts
runtime.analyzeChanges(changesSource, options?): ChangesAnalysis
```

| Parameter | Type | Required | Default | Purpose |
|---|---|---:|---|---|
| `changesSource` | `string` | Yes | Empty text for non-string input | Source to inspect |
| `options.taskIds` | iterable of strings | No | No task-ID check | Known Starting State task IDs |

The result contains `taskReferences`, `handlers`, `targetReferences`, and `diagnostics`.

The analyzer identifies supported static source forms. Dynamic references can remain for runtime resolution and produce informational diagnostics.

Do not use this helper as an authorization boundary or as a replacement for runtime execution.


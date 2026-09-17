---
title: "API stability and support policy"
description: "Understand stable, experimental, compatibility, and internal WorkSpec JavaScript API classifications."
section: "api"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 20
---

# API stability and support policy

The package classifies every reachable export before the documentation promises support.

## Classifications

| Classification | Contract |
|---|---|
| Stable/public | Supported for application integration and documented in the API reference. |
| Experimental | Deliberately exposed, but its signature or result can change. |
| Compatibility | Retained for historical callers and not recommended for new code. |
| Internal | Reachable implementation detail with no public stability promise. |

A symbol is not public only because `require("workspec")` can reach it. The [JavaScript API index](/docs/api/reference/) is the support inventory.

## Version scope

The API classification applies to npm package releases. It is separate from the WorkSpec document language version.

Stable/public does not mean that every nested object field is permanent. A named interface or documented field carries the explicit contract.

## Type declaration boundary

`index.d.ts` declares the primary stable API and data interfaces. Some deliberately supported helpers currently rely on README and test evidence.

Do not use the `WorkSpecRuntime` index signature as proof of support for an undocumented runtime member.

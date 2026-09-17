---
title: "Compatibility policy"
description: "Understand how WorkSpec accepts historical projects without promoting historical syntax for new authoring."
section: "workspec"
type: "explanation"
level: "intermediate"
workspec_version: "2.2"
status: "compatibility"
order: 810
---

# Compatibility policy

Compatibility support preserves specific historical inputs. It does not make those inputs canonical WorkSpec 2.2 syntax.

## Status meanings

| Status | Meaning | Use in new projects |
|---|---|---|
| canonical | Current public language contract | Yes |
| compatibility | Accepted for historical projects or migration | No |
| experimental | Exposed without a stability guarantee | Only with explicit risk acceptance |
| internal | Implementation detail | No |

## Acceptance is not full support

The document validator can accept a language version even when another product surface has narrower support.

Evaluate these capabilities separately:

- document validation;
- runtime execution;
- CLI project execution;
- Studio editing;
- migration; and
- recommendation for new work.

## Canonical authoring rule

Write new projects with WorkSpec 2.2 canonical fields and compact references. Do not mix historical syntax into canonical examples.

Use [compatibility-only fields and syntax](./legacy-syntax.md) only when reading or maintaining existing projects.

## No silent upgrade

Loading an older document does not change its language version. Migration is a separate transformation with a declared source and target.

The current migrator targets WorkSpec 2.1. Review and validate its output before any manual upgrade to 2.2.


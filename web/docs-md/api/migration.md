---
title: "Migration API"
description: "Migrate Previous UAW Syntax data to the historical WorkSpec 2.1 shape."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "compatibility"
order: 80
---

# Migration API

`migrate()` converts Previous UAW Syntax data to WorkSpec 2.1.

## Signature

```ts
migrate(documentValue, options?): unknown
```

| Option | Type | Default | Purpose |
|---|---|---|---|
| `addSchema` | `boolean` | `true` | Add `$schema` when the input lacks it. |
| `defaultCurrency` | `string` | `USD` | Supply missing currency configuration. |
| `defaultLocale` | `string` | `en-US` | Supply missing locale configuration. |
| `defaultTimezone` | `string` | `UTC` | Supply missing timezone configuration. |
| `defaultTimeUnit` | `string` | `minutes` | Supply a missing time unit. |
| `fallbackMetaTitle` | `string` | Implementation fallback | Supply a missing title. |
| `fallbackMetaDescription` | `string` | Implementation fallback | Supply a missing description. |
| `fallbackMetaDomain` | `string` | Implementation fallback | Supply a missing domain. |

```js
const { migrate } = require("workspec");
const migrated = migrate(legacyDocument, { addSchema: true });

console.log(migrated.simulation.schema_version); // "2.1"
```

The function clones JSON-compatible input and returns a new document. It does not migrate directly to WorkSpec 2.2.

See [migration behavior](/docs/workspec/compatibility/migration/) for transformations and manual review requirements.


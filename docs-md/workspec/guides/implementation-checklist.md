# WorkSpec v2.0 Implementation Status (UAW)

This is a **practical** checklist for evaluating the `workspec-v2.0` branch against `main`, mapped to the Phase 1–7 issue breakdown.

It intentionally focuses on: **document shape**, **validator correctness**, **playground behavior**, and **tooling outside the UAW platform**.

---

## Summary (what’s different vs `main`)

### Implemented (core transition)

- **WorkSpec v2.0 documentation + pages**
  - Source: `docs-md/workspec/specification/v2.0/*`
  - Built HTML: `web/docs/workspec/specification/v2.0/*`
- **WorkSpec v2.0 JSON Schema**
  - Web: `web/workspec/v2.0.schema.json`
  - Canonical (npm): `packages/workspec/v2.0.schema.json`
- **WorkSpec v1 → v2 migration**
  - Canonical (npm): `packages/workspec/workspec-migrate-v1-to-v2.js`
  - Web mirror: `web/assets/js/workspec-migrate-v1-to-v2.js`
  - Playground UI: `web/assets/js/playground/playground-migration.js`
- **Simulation library migrated to v2**
  - `web/assets/static/simulation-library.json` (currently validator-clean)
- **Playground emits and runs v2 documents**
  - Monaco schema wiring: `web/assets/js/playground/playground-editor.js`
  - Object/task paths: `web/assets/js/playground/playground-objects.js`
  - Save/load supports v2: `web/assets/js/playground/playground-save-load.js`
  - Timeline reads v2 paths: `web/assets/js/playground/playground-timeline.js`
  - Player supports v2 create/delete + temporary: `web/assets/js/simulation-player.js`

### Implemented (major gap closed)

- **Validation accessible outside UAW**
  - Self-contained npm package + CLI: `packages/workspec/*`
  - CLI: `packages/workspec/bin/workspec.js` (`workspec validate|migrate|format`)
  - GitHub Actions publish scaffold: `.github/workflows/npm-publish-workspec.yml`
  - “No duplicate validation code”: browser copies are kept byte-identical via `packages/workspec/scripts/check-sync.js`

---

## Per-Issue Status (Done / Partial / Missing)

### Phase 1 — Foundation

- ✅ **1.1 Schema versioning support** (`simulation.schema_version` required; v1 rejected with migrate guidance)
  - `packages/workspec/workspec-validator.js`
- ✅ **1.2 world/process structure**
  - Validator + library + editors updated for `simulation.world` / `simulation.process`
- ✅ **1.3 Meta section fields**
  - `meta.title|description|domain` required; `meta.article_title` rejected
- ✅ **1.4 JSON Schema**
  - Schema exists and Monaco is wired to local `/workspec/v2.0.schema.json`

### Phase 2 — Object Model

- ✅ **2.1 Top-level object fields** (`id|type|name` required; `location` references validated)
  - Validator enforces required fields + location references
  - Object creation uses `properties` bag (including UI-only hints under `properties.*`)
- ✅ **2.2 Namespaced IDs** (`{type}:{id}` optional; namespace must match `type`)
  - Validator enforces namespace/type match
- ✅ **2.3 Remove type aliases** (`material|ingredient|tool` rejected; migration maps)
- ✅ **2.4 `service` type** (performer allowed in `actor_id`)
- ⚠️ **2.5 Custom type definitions** (Partial)
  - Validator checks presence of `simulation.type_definitions[customType]` and requires `extends`
  - Missing: validating `additional_properties` types/units and enforcing declared properties on objects

### Phase 3 — Task Model

- ✅ **3.1 Dependency operators (`all`/`any`)**
  - Validator supports `{all, any}` and detects circular deps
  - UI dependency-builder is still “comma list” only (JSON editing required for `{all, any}`)
- ✅ **3.2 Flexible duration parsing**
  - Validator supports integers, ISO-8601 durations, and shorthand (`30m`, `1h`, `1d`, `1w`, `1M`)
- ⚠️ **3.3 Multi-day starts** (Partial)
  - Validator supports `start: { day, time }`
  - Timeline displays multi-day minutes as extended hours (doesn’t render distinct days cleanly yet)

### Phase 4 — Interaction System

- ✅ **4.1 `target_id` rename** (`object_id` rejected)
- ✅ **4.2 `temporary` rename** (`revert_after` rejected)
- ⚠️ **4.3 New operators (`multiply`, `append`, `remove`, `increment`, `decrement`)** (Partial)
  - Validator validates operator shape, but runtime/player application is incomplete (mostly handles `from/to`, `set`, and `quantity.delta`)
  - Missing: applying `multiply/append/remove/increment/decrement` during simulation playback and type-checking operator validity per target trait
- ⚠️ **4.4 Action interactions (`create`/`delete`)** (Partial)
  - Playground emits actions; player applies create/delete
  - Missing in validator: lifecycle-aware reference checks (allow referencing objects created earlier; error if referenced after delete)

### Phase 5 — Validation System

- ✅ **5.1 RFC 7807 Problem Details** (validator emits required fields)
- ✅ **5.2 Recipe validation** (missing inputs → warning)
- ✅ **5.3 Strict time validation** (zero-padded HH:MM enforced)
- ⚠️ UI polish (Partial)
  - Playground shows v2 problems, but doesn’t yet surface `problem.suggestions` / `problem.doc_uri` well in the panel

### Phase 6 — Tooling

- ❌ **6.1 Language Server (LSP)** (Not implemented)
- ❌ **6.2 VS Code extension** (Not implemented)
- ✅ **6.3 CLI validator** (`workspec validate`)
- ✅ **6.4 npm package** (`@uaw/workspec` scaffold; programmatic `validate()` / `migrate()`)

### Phase 7 — Migration

- ✅ **7.1 v1 → v2 migration tool**
  - CLI + Playground tool exist
- ✅ **7.2 Simulation library update**
  - Library is migrated and currently validates cleanly

---

## Key Remaining Gaps (to be truly “complete” v2.0)

- **Validator lifecycle semantics**: created objects should become valid targets after `action:create`, and references after `action:delete` should error.
- **Simulation runtime parity**: implement full operator set (`multiply/append/remove/increment/decrement`) in `web/assets/js/simulation-player.js`.
- **Multi-day UX**: timeline rendering and time markers should present day boundaries (not “33:00” style hours).
- **Tooling roadmap**: LSP + VS Code extension are still missing if you want first-class IDE integration beyond CLI/tasks.

# WorkSpec (CLI + Validator)

This package provides:

- A programmatic WorkSpec v2.0 validator (`validate()`) that emits RFC 7807 Problem Details
- A `workspec` CLI with `validate`, `migrate`, and `format` commands

## CLI

Validate:

```bash
workspec validate path/to/file.workspec.json
workspec validate path/to/file.workspec.json --json
```

Migrate v1 → v2:

```bash
workspec migrate legacy.json --out migrated.workspec.json --schema
```

Format JSON:

```bash
workspec format file.json --write
```


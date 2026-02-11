# WorkSpec (CLI + Validator)

This package provides:

- A programmatic WorkSpec v1.1.0 validator (`validate()`) that emits RFC 7807 Problem Details
- A `workspec` CLI with `validate`, `migrate`, and `format` commands

## Install

Install globally to use `workspec` from any terminal/command prompt path:

```bash
npm install -g workspec
```

After install, run:

```bash
workspec --help
```

This follows npm's standard cross-platform CLI pattern via `package.json#bin`:

- macOS/Linux: npm links an executable on your PATH
- Windows: npm creates command shims (`workspec.cmd`/`workspec.ps1`)

## CLI

Validate:

```bash
workspec validate path/to/file.workspec.json
workspec validate path/to/file.workspec.json --json
workspec validate -custom path/to/simulation-validator-custom.js path/to/file.workspec.json
workspec validate path/to/file.workspec.json --custom path/to/custom-validator.js --custom-catalog path/to/metrics-catalog-custom.json
```

`-custom/--custom` supports:
- Metrics Editor-style `validate*` functions in a plain `.js` file
- Node-style exports (`module.exports = function (...) { ... }` or `module.exports.validate = ...`)

If `--custom-catalog` is omitted, the CLI auto-loads `metrics-catalog-custom.json` from the custom validator file's folder when present.

Migrate (Previous UAW Syntax -> WorkSpec v1.0.0):

```bash
workspec migrate legacy.json --out migrated.workspec.json --schema
```

Format JSON:

```bash
workspec format file.json --write
```

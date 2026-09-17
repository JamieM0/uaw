---
title: "Export and sharing"
description: "Export and import portable Studio projects with sources, assets, manifests, and optional custom validation rules."
section: "studio"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 80
---

# Export and sharing

Studio exports a portable `.workspec.zip` archive for sharing or backup. The project folder remains the working copy.

## Export a portable project

1. Open the project.
2. Select **Export WorkSpec** from **Model** or the command palette.
3. Enter the **File name**.
4. Optionally select **Include custom validation rules**.
5. Select **Export**.

Studio downloads `NAME.workspec.zip` when ZIP support is available.

The archive contains these entries:

```text
start.workspec.json
changes.workspec.js
generator.workspec.js
constraints.workspec.js
workspec.manifest.json
assets/ASSET_ID.EXTENSION
```

The manifest records the archive format, WorkSpec version, source filenames, Generator seed, and asset metadata.

Studio removes embedded `assets` objects from exported Starting State. Asset bytes remain separate under `assets/`.

If selected, custom validation adds these files:

```text
metrics-catalog-custom.json
simulation-validator-custom.js
```

Without ZIP support, Studio downloads Starting State, Changes, and Generator as separate files. This fallback omits Constraints, assets, and the manifest.

## Import a Starting State file

1. Open **Projects**.
2. Select **Import WorkSpec**.
3. Choose `start.workspec.json` or another supported JSON file.
4. Enter the new project name.
5. Select a parent folder.

Studio validates the imported document before project creation. A JSON-only import creates blank executable source files.

## Import a project archive

1. Open **Projects**.
2. Select **Import WorkSpec**.
3. Choose a `.workspec.zip` or `.zip` file.
4. Enter the new project name.
5. Select a parent folder.

Studio requires `start.workspec.json` in the archive. It restores the four sources, Generator seed, and files under `assets/`.

Studio reconstructs imported asset IDs from asset filenames. Keep each manifest filename aligned with its asset ID.

## Import limits

Studio applies these archive limits:

| Limit | Value |
|---|---:|
| Compressed upload | 10 MB |
| Archive entries | 1,000 |
| One uncompressed entry | 25 MB |
| Total uncompressed content | 50 MB |

Studio rejects absolute paths and archive paths that contain `..`.

## Handle custom validation code

An archive can contain custom validation rules. Studio asks before replacing the current custom rules.

Studio requires a second acknowledgement before it loads a custom JavaScript validator.

> **Warning:** Review all project JavaScript before import and execution. An archive can contain Changes, Generator, Constraints, and custom validation code.

The [trusted-code security contract](/docs/workspec/sources/security/) owns the complete execution and isolation model.

## Choose a sharing method

| Goal | Method |
|---|---|
| Continue work on the same machine | Keep the project folder and its browser registry entry. |
| Move the working folder manually | Copy all source files, `assets/`, and `.uaw/`. |
| Send a portable copy | Export a `.workspec.zip` archive. |
| Share only Starting State | Send `start.workspec.json`; executable sources and assets are not included. |

Studio has no hosted share-link workflow in the current product. Use exported files or a copied project folder.


---
title: "Projects and source files"
description: "Create, open, duplicate, and manage Studio projects without confusing source files, metadata, and browser records."
section: "studio"
type: "how-to"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 20
---

# Projects and source files

Studio projects use folders that you choose. Studio writes project content to those folders and remembers folder handles in the browser.

## Project storage map

The following stores have different roles:

| Store | Contents | Portable project content? |
|---|---|---:|
| Project folder root | Four WorkSpec source files | Yes |
| Project folder `assets/` | Asset bytes | Yes |
| Project folder `.uaw/` | Studio metadata, asset metadata, recovery data, and checkpoints | Studio-specific |
| Browser project registry | Project ID, display name, and folder handle | No |
| Browser preferences | Onboarding and time-scale preferences | No |

The browser registry does not contain the four project sources. Forgetting a project in Studio leaves its folder unchanged.

## Project folder structure

A complete working folder can contain these entries:

```text
PROJECT_FOLDER/
├── start.workspec.json
├── changes.workspec.js
├── generator.workspec.js
├── constraints.workspec.js
├── assets/
│   └── ASSET_ID.EXTENSION
└── .uaw/
    ├── project.json
    ├── assets.json
    ├── last-valid-start.workspec.json
    └── checkpoints/
```

| Entry | Owner | Purpose |
|---|---|---|
| `start.workspec.json` | WorkSpec | Declarative Starting State. |
| `changes.workspec.js` | WorkSpec | Task-linked Changes source. |
| `generator.workspec.js` | WorkSpec | Optional Generator source. |
| `constraints.workspec.js` | WorkSpec | Constraint source. |
| `assets/` | Studio host | Binary files addressed by asset ID. |
| `.uaw/project.json` | Studio | Project ID, name, settings, seed, and checkpoint index. |
| `.uaw/assets.json` | Studio | Asset IDs, filenames, media types, and update times. |
| `.uaw/last-valid-start.workspec.json` | Studio | Last valid Starting State recovery copy. |
| `.uaw/checkpoints/` | Studio | Up to 20 local source checkpoints. |

The [executable source reference](/docs/workspec/sources/authoring/) defines the four source roles. Studio does not change their WorkSpec semantics.

## Create a blank project

1. Open **Projects**.
2. Select **New project**.
3. Enter the **Project name**.
4. Select **Choose location…**.
5. Choose a parent folder in the browser picker.

Studio creates a dedicated child folder. If that name exists, Studio adds a numeric suffix such as `Project (2)`.

Folder-backed projects require a browser with the File System Access API. Studio reports a compatibility error when the browser lacks this API.

## Create a project from a template

1. Open **Projects**.
2. Select **From template**.
3. Choose a template in **Simulation Library**.
4. Enter the project name.
5. Select a parent folder.

Studio writes the template's Starting State, Changes, Generator, and Constraints sources into the new folder.

## Open an existing project folder

1. Open **Projects**.
2. Select **Open project folder**.
3. Choose the folder that contains `start.workspec.json`.
4. Grant read and write access when the browser asks.

Studio requires `start.workspec.json`. Missing executable source files receive blank source templates when Studio opens the project.

The browser can require renewed folder access after a restart. Select the project card to restore access.

## Duplicate a project

1. Open **Projects**.
2. Select **Duplicate** on the project card.
3. Choose a parent folder.

Studio creates a project named with the suffix `copy`. It copies the four current sources and the Generator seed.

Duplicate does not copy project assets, checkpoints, or other `.uaw` settings. Use [Export WorkSpec](/docs/studio/export-share/) for a portable copy with assets.

## Save a checkpoint

Press **Cmd/Ctrl+S** or run **Save local checkpoint** from the command palette. Studio first saves current sources, then stores the checkpoint under `.uaw/checkpoints/`.

Studio indexes the newest 20 checkpoints. Restoring a checkpoint first creates a checkpoint named `Before checkpoint restore`.

## Forget a remembered project

1. Open **Projects**.
2. Select **Remove Project** on the project card.
3. Confirm the action.

Studio clears only the browser registry record. The folder, source files, assets, and `.uaw` data stay on disk.

To reconnect the project, select **Open project folder** and choose its folder again.

## Migrate a legacy browser project

Studio shows **Move browser projects into folders** when it finds an older browser-stored project.

Select the recovered project and choose a parent folder. Studio clears the browser copy only after the folder write succeeds.

> **Warning:** Select **Delete browser copy** only if you no longer need the recovered data. Studio cannot restore that browser copy.

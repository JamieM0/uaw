---
title: "WorkSpec Studio overview"
description: "Understand Studio workspaces, project storage, and the boundary between Studio and WorkSpec."
section: "studio"
type: "explanation"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# WorkSpec Studio overview

WorkSpec Studio is a browser application for authoring and inspecting local WorkSpec projects.

Studio adds visual editors, project management, Problems, playback, and asset management. WorkSpec remains usable without Studio through the CLI or JavaScript package.

## Studio workspaces

| Workspace | Purpose |
|---|---|
| **Projects** | Create, reconnect, duplicate, import, and remove local projects. |
| **Model** | Edit the process, objects, physical locations, digital locations, and displays. |
| **Editor** | Edit all project sources in two text-editor panes. |
| **Simulate** | Inspect the resolved timeline, Problems, and validation rules. |
| **Assets** | Store project images and map object states to asset IDs. |
| **Settings** | Configure editor docking, the Generator seed, and optional integrations. |

Use the numbered shortcuts `1` through `5` to open the main workspaces. Use **Cmd/Ctrl+K** to search Studio commands.

## One project, four sources

A Studio project has four WorkSpec source files:

```text
start.workspec.json
changes.workspec.js
generator.workspec.js
constraints.workspec.js
```

The Generator source is optional in the WorkSpec model. Studio still creates its file so every project has a stable folder shape.

The [project files guide](/docs/studio/projects/) explains source files, `.uaw` files, browser registry data, and asset files.

## Authoring and inspection flow

1. Create or open a project in **Projects**.
2. Define objects, tasks, and environments in **Model**.
3. Edit **Starting State**, **Changes**, **Generator**, or **Constraints** in **Editor**.
4. Review **Problems** in **Simulate**.
5. Play or scrub the **Timeline** to inspect resolved state.
6. Add project images and state mappings in **Assets**.

Studio saves source changes to the selected project folder. The title bar reports **Saving…**, **Saved to folder**, or **Save failed**.

## Product boundaries

Studio presents WorkSpec but does not define its language rules. Use the [WorkSpec language overview](/docs/workspec/overview/) for the canonical language model.

Studio's visual views are authoring and inspection tools. The [rendering overview](/docs/workspec/rendering/overview/) owns rendering semantics and standalone renderer contracts.

Studio can execute project JavaScript during validation and simulation. Review the [trusted-code security contract](/docs/workspec/sources/security/) before opening untrusted projects.

## Related pages

- [Projects and source files](/docs/studio/projects/)
- [Source editors](/docs/studio/editors/)
- [Validation and Problems](/docs/studio/problems/)
- [Timeline and playback](/docs/studio/timeline/)


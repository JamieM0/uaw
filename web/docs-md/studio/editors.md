---
title: "Source editors"
description: "Use Studio text editors for Starting State, Changes, Generator, Constraints, and the Studio Constraint Library."
section: "studio"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Source editors

Studio provides text editors for every project source. It also provides a Studio-specific **Constraint Library** editor.

## Editor tabs

| Tab | Stored value | Editor language | Role |
|---|---|---|---|
| **Starting State** | `start.workspec.json` | JSON | Declarative project state and structure. |
| **Changes** | `changes.workspec.js` | JavaScript | Task-linked effects. |
| **Generator** | `generator.workspec.js` | JavaScript | Optional causal generation. |
| **Constraints** | `constraints.workspec.js` | JavaScript | Domain checks over resolved history. |
| **Constraint Library** | `.uaw/project.json` setting | JSON | Studio-managed supporting catalog. |

The **Constraint Library** is not a fifth WorkSpec source file. Studio stores it as `.uaw` project metadata under its own setting.

Use the [Starting State reference](/docs/workspec/starting-state/overview/) and [executable source reference](/docs/workspec/sources/authoring/) for language contracts.

## Edit two sources together

1. Open **Editor**.
2. Select a tab in the left pane.
3. Select another tab in the right pane.
4. Edit either source.

New sessions default to **Starting State** on the left and **Changes** on the right. Studio remembers pane selections and scroll positions per project.

Select **Format** to format the focused editor. Select **Undo** to undo its last edit.

## Use source assistance

Studio configures JSON Schema assistance for WorkSpec 2.2 Starting State documents.

The JavaScript editors load declarations for Changes, Constraints, and Generator sources. These declarations provide completion and type information for each source API.

The Changes editor also reports unresolved task references and source diagnostics. Links from **Model** can reveal related task or object references in Changes.

Studio does not make the source APIs interchangeable. Use these references for their separate authoring contracts:

- [Changes authoring](/docs/workspec/changes/authoring/)
- [Constraint authoring](/docs/workspec/constraints/authoring/)
- [Generator authoring](/docs/workspec/generators/authoring/)

## Dock a source beside Model

The source pane beside **Model** uses the same five tabs. Configure its position under **Settings** > **Editor docking**.

| Setting | Result |
|---|---|
| **Split left** | Source pane before the Model canvas. |
| **Split right** | Model canvas before the source pane. |
| **Split below** | Source pane at the bottom of the Model workspace. |
| **Dedicated pane** | Source editor fills the stage. |
| **Hidden in Model** | Source pane stays hidden in **Model**. |

For **Starting State**, use **Context** to focus the JSON around the selected Model entity. Use **Full JSON** to return to the complete document.

Context filtering applies only to **Starting State**. Other tabs remain complete and editable in the docked pane.

## Save and validate edits

Studio schedules a folder save about 700 milliseconds after an edit. It runs project validation after you enable automatic validation.

Select **Validate WorkSpec** or press **Cmd/Ctrl+Enter** for an immediate validation run. Review the result in [Validation and Problems](/docs/studio/problems/).

> **Warning:** Review project JavaScript before validation or simulation. These actions can execute project sources.

The [trusted-code security contract](/docs/workspec/sources/security/) explains the execution boundary and hosting requirements.

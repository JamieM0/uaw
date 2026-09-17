---
title: "Assets and State Libraries"
description: "Store project images, manage asset IDs, and map State Library states to appearance assets in Studio."
section: "studio"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 70
---

# Assets and State Libraries

Studio stores image bytes in the project folder. WorkSpec stores asset IDs and State Library mappings in Starting State.

## Asset storage model

Do not treat these values as interchangeable:

| Value | Storage | Example purpose |
|---|---|---|
| Asset ID | Starting State mapping and `.uaw/assets.json` | Stable reference such as `operator_working`. |
| Asset metadata | `.uaw/assets.json` | Filename, media type, and update time. |
| Asset bytes | `assets/ASSET_ID.EXTENSION` | PNG, JPEG, SVG, WebP, or another stored file. |
| State Library | `simulation.state_libraries` | States and named appearances. |

WorkSpec does not embed the asset bytes in `start.workspec.json`. The [state visuals reference](/docs/workspec/rendering/state-visuals/) defines the canonical ID lookup.

## Upload project images

1. Open **Assets**.
2. Select **Upload images**.
3. Choose one or more image files.

Studio derives an asset ID from the filename when possible. It removes the final extension and converts the name to a lowercase underscore form.

Studio uses a generated ID if filename conversion produces no usable ID. The asset card displays the stored filename and ID.

## Create a State Library

1. In **State visuals**, select **New library**.
2. Enter a unique snake-case **Library ID**.
3. Select **Create**.
4. Enter a comma-separated list in **States**.

A new library starts with the state `available`. Studio blocks removal of a state that an authored object still uses.

State Library meaning belongs to the [State Libraries reference](/docs/workspec/starting-state/state-libraries/). This page documents the Studio editor only.

## Create an appearance mapping

1. Select a library under **Libraries**.
2. Select **+ Appearance**.
3. Enter a unique snake-case appearance ID.
4. Select **Create**.
5. Select **Choose** beside a state.
6. Select an uploaded image.

Studio writes the selected asset ID into that appearance's state mapping. Select **Change** to choose another image or **Clear** to remove the mapping.

The picker shows at most 80 results. Use **Search uploaded images** to narrow a larger asset collection.

## Handle a missing asset

Studio shows **Missing · ASSET_ID** when a mapping names an asset that is absent from project metadata.

Upload the missing file with the expected ID, choose another image, or clear the mapping. Renderers use a fallback glyph when asset data does not resolve.

Removing an asset deletes its stored bytes and metadata. It does not remove WorkSpec mappings that still name the asset ID.

## Remove a project asset

1. Open **Assets**.
2. Find the asset under **Project assets**.
3. Select **Remove**.

> **Caution:** Before removal, inspect State Library mappings that use the asset ID. The removal can leave missing mappings.

## Keep assets portable

Copy the project folder with its `assets/` directory and `.uaw/assets.json` when moving a working folder manually.

For sharing, use **Export WorkSpec**. The `.workspec.zip` export includes asset bytes and an ID-to-file manifest.

See [Export and sharing](/docs/studio/export-share/) for archive contents and import limits.

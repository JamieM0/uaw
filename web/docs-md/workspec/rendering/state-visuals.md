---
title: "State visuals and assets"
description: "Reference State Library visual lookup and renderer asset resolution."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# State visuals and assets

State visuals map semantic object state to a project asset ID. WorkSpec stores the ID, not the asset bytes.

## Lookup contract

An object opts into visual lookup with `state_library` and `appearance`. Its semantic state comes from `properties.state`.

```json
{
  "state_library": "actor_states",
  "appearance": "operator",
  "properties": { "state": "working" }
}
```

The renderer resolves this path:

```text
simulation.state_libraries[object.state_library]
  .appearances[object.appearance]
  [object.properties.state]
```

`resolveStateVisualAssetId(document, object, state?)` returns the trimmed asset ID. It returns `null` when any lookup part is absent or invalid.

## Resolve asset data

Pass an `assetResolver` to the SVG renderer when asset data is available.

```js
const svg = renderSnapshotToSvg(start, snapshot, {
  assetResolver(assetId, object) {
    return assetDataById[assetId] ?? null;
  }
});
```

The resolver returns a string suitable for an SVG image `href`. A missing or empty result uses a fallback glyph.

The renderer does not load files or store asset bytes. Studio and other hosts own asset storage and resolution.

## Fallback glyphs

If no asset data resolves, the renderer uses the object's `emoji`. Without an emoji, it uses a deterministic glyph for the object type.

## Filename helper

`assetIdFromFilename(filename)` removes the final extension, lowercases the name, replaces non-alphanumeric runs with underscores, trims underscores, and limits the result to 250 characters.

This helper creates an ID candidate. It does not load or register an asset.


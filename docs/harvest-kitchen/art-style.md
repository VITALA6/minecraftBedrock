# Harvest Kitchen: art style and icon rules

Rules for every 16×16 texture in the pack: item icons, UI icons and crop stages. They extend plan
§4 (vanilla-like pixel art, family colours reserved for effect accents) and §4.5 (the pipeline).
`tools/gen-textures.mjs` draws to these rules, and `tools/lint-textures.mjs` checks the ones a
script can measure (the **lint** column). The rest is checked by eye on the review sheet.

```sh
node tools/gen-textures.mjs     # regenerate art/harvest_kitchen/generated/
node tools/lint-textures.mjs    # check it, and write generated/review_sheet.png
```

## Icon production rules

### Silhouette

| Rule                                                                                           | Lint                                  |
| ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| The silhouette fills **12–14 px** of the 16 (longest side), with a 1–2 px margin.              | bounding box: longest side 10–15 px   |
| It reads as a **solid black silhouette**: you can name the item from the black row alone.      | review sheet, silhouette row          |
| **Long items run diagonally from bottom-left to top-right** (cucumber, chili, knife, pickaxe). | no                                    |
| **No orphan pixels:** every pixel touches another pixel of the shape.                          | orphan pixels (no opaque 8-neighbour) |
| **Clean line steps:** diagonal edges step evenly (1-1-1, 2-2-2, 1-2-1-2), with no lone jags.   | no                                    |

### Shading and colour

| Rule                                                                                                                                    | Lint                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **No black outline.** The edge is a darker shade of the item's own colour.                                                              | no                                        |
| **Light from the top left, everywhere.** Top and left edges are lighter than bottom and right edges, and highlights sit top-left.       | no                                        |
| **No pillow shading.** Don't darken every edge evenly around a bright centre. The shadow side is the bottom right.                      | no                                        |
| **4–6 colours per item** (a composite like a filled bowl may go up to 10, the vanilla maximum).                                         | colour count 3–10 (crop stages 3–8)       |
| **Hue shifting:** shadows shift cool (toward blue or purple), highlights shift warm (toward yellow). A ramp is not one hue made darker. | no                                        |
| **One dominant hue per item, and distinct across the set.** Two icons with a similar silhouette must not share a dominant hue.          | similar pairs (dominant hue + silhouette) |
| **Enough value contrast:** the icon still reads in grayscale.                                                                           | grayscale range ≥ 80 of 255               |
| **No semi-transparent pixels, no anti-aliasing:** every pixel is fully opaque or fully transparent.                                     | alpha is 0 or 255                         |

### Families of items

- **Bowl dishes share one bowl base.** Only the contents are drawn per dish, so the bowl reads as
  "a bowl dish" before the contents are noticed.
- **Similar dishes differ by texture, not only by colour:** a smooth liquid (one flat colour with a
  highlight streak) vs. a chunky stew (pieces with their own light and shadow) vs. a heap (a
  mound that rises above the rim).
- **Every seed has its own shape and its own colour.** No two seed icons share a seed sprite or a
  layout, and none looks like a vanilla seed.
- Effect family colours (red heal, blue move, yellow work, green explore) stay reserved for the
  family icons and effect accents (plan §1.4).

## Linter

`tools/lint-textures.mjs` checks every PNG in `art/harvest_kitchen/generated/{items,ui,blocks}`.

| Check        | Applies to         | Fails when                                                                                                                                                                                    |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| alpha        | everything         | any pixel has 0 < alpha < 255                                                                                                                                                                 |
| colours      | icons, crop stages | fewer than 3, or more than 10 (icons) or 8 (crop stages) distinct opaque colours                                                                                                              |
| bounding box | icons              | the longest side of the opaque area is under 10 or over 15 px                                                                                                                                 |
| orphans      | icons, crop stages | an opaque pixel has no opaque 8-neighbour                                                                                                                                                     |
| contrast     | icons, crop stages | grayscale (0.299 R + 0.587 G + 0.114 B) max − min is under 80                                                                                                                                 |
| similar pair | icon pairs         | silhouette overlap (IoU) ≥ 0.8 **and** dominant hues within 20°. The hue is taken from the pixels where the two icons differ, so a shared base (the bowl) doesn't make every bowl dish match. |

"Icons" are `items/`, `ui/` and `ingredients/` (our own versions of vanilla ingredients for the book). "Crop stages" are `blocks/*_stage_*`; early stages are small on
purpose, so they skip the bounding-box check. The pot face textures are opaque block faces and only
get the alpha check.

The linter exits with code 1 when anything fails. Thresholds are calibrated on vanilla 1.26.52
icons: their grayscale range is 63–164 (most above 90), their longest side 12–15 px; most use 7–10
colours, which sets the icon limit of 10.

## Review sheet

`art/harvest_kitchen/generated/review_sheet.png`, written by the linter. Each group (produce,
seeds, prepared, dishes, stations, UI) starts with 5 vanilla items for reference (apple, carrot,
wheat seeds, mushroom stew, bread), then shows each icon:

1. at **1×** in an inventory slot (true in-game size);
2. at **4×** on the inventory slot grey `#8B8B8B`, with its name;
3. at 4× in **grayscale** (value contrast);
4. at 4× as a **black silhouette** (shape alone).

Flagged icons get a red frame in the 4× row. The vanilla references need the game installed (see
CLAUDE.md "Versions"); without it the sheet is drawn without them.

# Harvest Kitchen: art style and icon rules

Rules for every 16×16 texture in the pack: item icons, UI icons and crop stages. They extend plan
§4 (vanilla-like pixel art, family colours reserved for effect accents) and §4.5 (the pipeline).
Icons and crop stages are **hand-authored** text grids in `art/harvest_kitchen/pixels/<name>.txt`
(format and the per-icon art loop: `pixels/README.md`). `tools/gen-textures.mjs` uses a grid
whenever one exists and falls back to its procedural drawing otherwise (the pot's block faces). `tools/lint-textures.mjs` checks the rules a script can measure (the
**lint** column). The rest is checked by eye on the review sheet.

```sh
node tools/pixels.mjs --preview <name>   # one icon at 8x next to vanilla items, with its lint
node tools/gen-textures.mjs              # regenerate art/harvest_kitchen/generated/
node tools/lint-textures.mjs             # check it, and write generated/review_sheet.png
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
| **No checkerboard dither:** texture is 1–3 px clusters that follow the form (see Surface).     | no                                    |

### Shading and colour

| Rule                                                                                                                                                                                                                                                                         | Lint                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Selective outline, never black:** every edge pixel is darker than the fill beside it, on every side, using the darkest 1–2 shades of the item's own ramp. The lit (top/left) edge is one step lighter than the shadow (bottom/right) edge, never lighter than the fill.    | edge/inner brightness ≤ 0.85                             |
| **Light from the top left, everywhere.** The top-left of the _form_ is lighter than the bottom right, and highlights sit top-left, inside the outline.                                                                                                                       | no                                                       |
| **No pillow shading.** Don't darken every edge evenly around a bright centre. The shadow side is the bottom right.                                                                                                                                                           | no                                                       |
| **6–10 colours per single item, up to 16 for a composite** (filled bowl, sandwich, basket). Spend them on the main form's ramp first.                                                                                                                                        | colour count 3–16 (crop stages 3–8)                      |
| **Deep main ramp:** the dominant hue gets **5–7 shades**, evenly spaced in value. Small parts (stem, cap) get 2–3 shades each.                                                                                                                                               | no (`ref-sheet.mjs` mainShades)                          |
| **Gentle hue shifting:** the main ramp turns **≤ 25° end to end**. Shadows lean cool, mostly in the darkest 1–2 shades; mid-tones keep the item's own hue; highlights get **paler, not yellower** (≤ 10° warm). A tomato's highlight stays red-pink, never orange.           | no                                                       |
| **One dominant hue per item, and distinct across the set.** Two icons with a similar silhouette must not share a dominant hue.                                                                                                                                               | similar pairs (dominant hue + silhouette)                |
| **Enough value contrast, not harsh:** the icon reads in grayscale with a range of about **110–190** (up to ~205 for white or metal subjects, as in vanilla's iron ingot and bucket): highlights are tinted, not white, and only dark items reach near-black.                 | grayscale range ≥ 80 of 255                              |
| **Surface, not flat fields:** no one-colour patch larger than **14 px**. Big areas are broken into 1–3 px clusters of neighbouring shades that describe the form: curved bands on round produce, layer lines on an onion, veins on leaves, pores on bread, chunks in a stew. | largest flat patch ≤ 14 px; detail ≥ 0.62 (`ui/` ≥ 0.50) |
| **One specular highlight:** 1–4 px of the lightest shade on the most curved part, top-left of centre and at least 1 px inside the outline, with a light band around it.                                                                                                      | no                                                       |
| **No semi-transparent pixels, no anti-aliasing:** every pixel is fully opaque or fully transparent.                                                                                                                                                                          | alpha is 0 or 255                                        |

### Families of items

- **Bowl dishes share one bowl base.** Only the contents are drawn per dish, so the bowl reads as
  "a bowl dish" before the contents are noticed.
- **Similar dishes differ by texture, not only by colour:** a smooth liquid (3–4 shades, a darker
  ring where it meets the back of the bowl, 2–4 floating bits) vs. a chunky stew (pieces with
  their own light and shadow pixel) vs. a heap (a mound that rises above the rim). Contents dome
  **1–3 px above the rim**, so the dish reads as full at 1×.
- **Mixes (D16) are one family:** the shared bowl with raw pieces inside (no broth, so the dark
  inside shows), one whole ingredient sticking out in a place or with a shape no other mix
  uses (the tomato ball and the eggplant bar share the top left), and a light
  metal spoon top right. A shared heap above the rim made every mix the same silhouette; the
  food hues (red, orange, golden, brown) all sit within 50° of each other after hue shifting, so
  mixes are told apart by where their ingredient sticks out.
- **Brown dishes don't fight the bowl.** The bowl sits at ~40°, so a brown broth melts into it:
  cap or garnish the dish instead (onion soup wears a melted-cheese lid).
- **Every seed has its own shape and its own colour.** No two seed icons share a seed sprite or a
  layout, and none looks like a vanilla seed.
- **Fix a similar pair with a visible difference** (silhouette, garnish, pattern, value), never by
  desaturating colours under the lint's 25% cutoff so they stop counting. Both times that was
  tried (the bowl, the farmland soil) the icon read as stone or ash. Shadows of a warm material
  may sit under 25% on their own merits (the bowl's two darkest shades).
- **Block-item cubes share a silhouette by design** (`crafting_table`, `farmland`), so their tops
  must differ in pattern at 1×: the crafting table's "#" grid against farmland's parallel furrows
  with sprouts. Two 2:1 patterns of 2 px lines both turn into a checker.
- Effect family colours (red heal, blue move, yellow work, green explore) stay reserved for the
  family icons and effect accents (plan §1.4).

## Reference study (2026-10-23)

Why do Farmer's Delight, Croptopia and Create icons read richer than ours? We studied their
Java textures (FD 1.21.1-1.3.4, Create 6.0.10, Croptopia at `v4` 935ad80) next to vanilla and
ours. They are references only: they live in the gitignored `art/references/mods/` (setup in
`art/references/README.md`) and are never committed, copied, traced or shipped.

```sh
node tools/ref-sheet.mjs                 # reference sheet + metrics -> art/references/mods/sheets/
node tools/ref-sheet.mjs --originality   # each of our icons vs its closest references (exit 1 = too close)
node tools/ref-sheet.mjs --compare HEAD  # before/after sheet of our sprites -> generated/before_after.png
```

Medians over the compared icons (produce, seeds, prepared food, bowl dishes, tools; 25–42 each):

| Source           | Colours | Main-hue shades | Hue families | Detail | Largest flat patch | Edge/inner | Edge TL−BR | Grey range | Hue shift |
| ---------------- | ------- | --------------- | ------------ | ------ | ------------------ | ---------- | ---------- | ---------- | --------- |
| Farmer's Delight | 12      | 7               | 3            | 0.81   | 7 px               | 0.64       | 44         | 171        | 5°        |
| Croptopia        | 11      | 6               | 3            | 0.73   | 9 px               | 0.59       | 23         | 138        | 5°        |
| Create           | 11      | 7               | 2            | 0.74   | 10 px              | 0.62       | 39         | 151        | 11°       |
| vanilla          | 9       | 7               | 2            | 0.69   | 7 px               | 0.57       | 24         | 146        | 2°        |
| Harvest Kitchen  | 9       | 4               | 4            | 0.57   | 18 px              | 0.83       | 74         | 187        | 14°       |

After the 2D pass on all 117 icons and crop stages (same day, three art-director rounds), ours
measured: 14 colours, 7 main-hue shades, detail 0.74, largest flat patch 7 px, edge/inner 0.67,
edge TL−BR 39, grey range 179. Hue shift (16°) is still the strongest of the set, within our 25°
rule.

_Detail_: share of neighbouring pixel pairs that change colour. _Edge/inner_: brightness of the
outline pixels over the inside. _Edge TL−BR_: how much brighter the top/left outline is than the
bottom/right. Canvas fill and size were not the difference: our coverage (39%) and longest side
(14 px) match theirs.

What makes theirs read richer, and the rule each finding became (in the tables above):

1. **Depth, not breadth, of colour.** They spend 6–7 shades on the main form and 2–3 hue
   families in total; we spent 4 shades and 4 families, so our forms look cut from flat paper.
   Rule: deep main ramp, 5–7 shades.
2. **Surface everywhere.** Their largest one-colour patch is 7–10 px; ours is 18. Tomato skin
   gets mottled bands, onions get curved layer lines, cabbage and lettuce get veins, stews get
   chunks with their own light pixel. Rule: surface, not flat fields.
3. **A dark edge all round.** Their outline is ~60% as bright as the inside on every side and
   only slightly lighter top-left. Ours lit the top-left edge brighter than the fill, so the
   silhouette dissolved there. Rule: selective outline.
4. **Small specular, broad light.** One 1–4 px specular sits inside the shape on the curve,
   surrounded by a lighter band; ours were large light areas touching the edge. Rule: one
   specular highlight.
5. **Gentle hue shift, paler highlights.** Their ramps turn only 2–11°; the darkest shade leans
   cool (tomato shadow toward magenta) and the highlight gets paler. Ours turned 14° on average
   (77° on the cucumber: green into yellow), and the tomato highlight went orange. Rule: gentle
   hue shifting.
6. **Compressed value range.** Grey range ~140–170 against our 187: tinted highlights, coloured
   darks. Rule: contrast 110–190.
7. **Bowl dishes are full.** Contents dome 1–3 px above the rim, liquids have 3–4 shades, a
   back-rim shadow and floating bits. Ours had flat single-colour liquids (onion soup, fish
   chowder).
8. **Crops use the whole block.** Mature crops reach the top rows, have an irregular,
   see-through silhouette with visible stems, leaves as 2–3 shade clusters, and produce with 3
   shades + a highlight pixel. Ours were compact, symmetric round bushes.

Where theirs is _not_ better, we keep our rules: our seeds stay distinct per crop (theirs are
recoloured copies of one scatter), and our icons keep a 1–2 px margin and diagonal long items.

### Crop stages

| Rule                                                                                                                        | Lint |
| --------------------------------------------------------------------------------------------------------------------------- | ---- |
| **The mature stage uses the full height** (top 1–3 rows reached), stage 0 is a 4–6 px sprout, and each stage grows visibly. | no   |
| **Irregular and see-through:** no symmetric round bush; gaps between leaves let the ground show; stems are visible.         | no   |
| **Leaves are 2–3-shade clusters** with a lit top-left pixel; produce has 3 shades + a highlight pixel and its item's ramp.  | no   |
| **Each crop has its own habit:** vine on a stake, bulbs with tall leaves, hanging pods, low runners.                        | no   |

### Originality

Ours must stay our own: no traced shapes, no copied palettes, no copied compositions.

- Never open a reference while drawing an icon. Learn the rules from the sheet, then close it.
- Our subjects, poses and details are our own choice: if a reference already shows the "obvious"
  composition (a tomato with a star-shaped calyx, a soup with a carrot slice on top), pick
  another.
- `tools/ref-sheet.mjs --originality` compares each icon with every reference item, as drawn and
  mirrored, shifted up to 1 px. It flags **traced** (silhouette overlap ≥ 0.85 with brightness
  correlation ≥ 0.8 or ≥ 90% shared colour-region borders), **copied pixels** (≥ 12% same colour at
  the same spot) and **copied palettes** (≥ 50% of our colours found exactly in one reference).
  References that are recolours of a vanilla bowl item don't count: matching them means matching
  vanilla. Calibration: icons drawn before the references were downloaded reach 0.78; a
  hue-rotated copy scores 1.00 on region borders.
- The art director checks every icon against its 4 closest references on
  `art/references/mods/sheets/originality.png` and rejects anything that reads as the same
  drawing, even when the script passes it.

## Linter

`tools/lint-textures.mjs` checks every PNG in `art/harvest_kitchen/generated/{items,ui,blocks}`.

| Check        | Applies to         | Fails when                                                                                                                                                                                    |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| alpha        | everything         | any pixel has 0 < alpha < 255                                                                                                                                                                 |
| colours      | icons, crop stages | fewer than 3, or more than 16 (icons) or 8 (crop stages) distinct opaque colours                                                                                                              |
| flat patch   | icons              | the largest 4-connected one-colour patch is over 14 px                                                                                                                                        |
| edge         | icons              | edge pixels (opaque, with a transparent 4-neighbour) average over 0.85 of the inside pixels' brightness                                                                                       |
| detail       | icons              | under 62% (`ui/`: 50%) of neighbouring opaque pixel pairs change colour. UI symbols are clean metal and paper: vanilla's bucket, map, ingots and compass score 0.54–0.59.                     |
| bounding box | icons              | the longest side of the opaque area is under 10 or over 15 px                                                                                                                                 |
| orphans      | icons, crop stages | an opaque pixel has no opaque 8-neighbour                                                                                                                                                     |
| contrast     | icons, crop stages | grayscale (0.299 R + 0.587 G + 0.114 B) max − min is under 80                                                                                                                                 |
| similar pair | icon pairs         | silhouette overlap (IoU) ≥ 0.8 **and** dominant hues within 20°. The hue is taken from the pixels where the two icons differ, so a shared base (the bowl) doesn't make every bowl dish match. |

"Icons" are `items/`, `ui/` and `ingredients/` (our own versions of vanilla ingredients for the posters). "Crop stages" are `blocks/*_stage_*`; early stages are small on
purpose, so they skip the bounding-box check. The pot face textures are opaque block faces and only
get the alpha check.

The linter exits with code 1 when anything fails. Thresholds are calibrated on vanilla 1.26.52
icons: their grayscale range is 63–164 (most above 90), their longest side 12–15 px. The colour,
flat-patch, edge and detail limits come from the reference study below (Farmer's Delight and
Croptopia items: median 13 colours, p90 flat patch 12–14 px, median edge/inner 0.54–0.66, p10
detail 0.62–0.72).

## Review sheet

`art/harvest_kitchen/generated/review_sheet.png`, written by the linter. Each group (produce,
seeds, prepared, dishes, stations, UI) starts with 5 vanilla items for reference (apple, carrot,
wheat seeds, mushroom stew, bread), then shows each icon:

1. at **1×** in an inventory slot (true in-game size);
2. at **4×** on the inventory slot grey `#8B8B8B`, with its name;
3. at 4× in **grayscale** (value contrast);
4. at 4× as a **black silhouette** (shape alone).

Hand-authored icons show two columns in every row: the procedural drawing they replaced
("before", left of the thin rule) and the grid ("after"). Flagged icons get a red frame on the
after view in the 4× row. The vanilla references need the game installed (see
CLAUDE.md "Versions"); without it the sheet is drawn without them.

## Recipe posters

The recipe posters (D15, `slice.md` "Recipe posters (D15)") are 2×1 wall blocks. Each poster is a
128×64 image drawn 1:1 at **64 texels per block** and shipped as two 64×64 block textures.
`tools/gen-posters.mjs` draws them; `tools/lint-posters.mjs` checks them.

```sh
npm run posters    # render, regenerate the block JSON, lint
```

| Rule                                                                                                                                                              | Lint                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Our own art only:** icons from `generated/{items,ui,ingredients,blocks}`, slots and arrows from `mockups/parts/`, frame and pins drawn from the palette.        | no (the renderer can't load vanilla files)                  |
| **No words in images.** Numbers and symbols only (`? + →`, `s` for seconds); the dish name and effect come from lang keys (use the poster).                       | no (the font has no capitals)                               |
| **Fixed size:** 64×64 per half, two halves per poster.                                                                                                            | size per file                                               |
| **Fully opaque:** the block face is `opaque`, so every pixel has alpha 255 (no transparent or semi-transparent pixels).                                           | alpha 255 everywhere                                        |
| **Icons at least a quarter block** (16 texels). From 4 blocks on a 1080p screen that's ~48 px, an inventory icon at GUI scale 3. The result is 2× (half a block). | every recorded icon ≥ 16 texels                             |
| **Text at least the 7 px font at 1×** (~1.75 world px; ~21 screen px tall from 4 blocks).                                                                         | every glyph run ≥ 7 texels tall                             |
| **Text contrast ≥ 4.5:1** (WCAG) against what's behind it; counts are white with a dark shadow, the duration is the family colour darkened until it passes.       | contrast of the drawn text colour vs its background, in PNG |
| **Icons stand out:** the most contrasting pixel of an icon vs its slot or paper ≥ 2:1.                                                                            | per icon, measured in the PNG                               |
| **Every poster state has both halves, and nothing else.** The list comes from `posters/poster-logic.ts`, as does the block JSON.                                  | missing files, orphan PNGs, `terrain_texture.json` entries  |
| **Up to date:** each PNG equals the current render.                                                                                                               | pixel diff vs an in-memory render                           |
| **Frame in our style:** wooden frame (palette `wood`/`bark`, light from the top left), cream paper with a 1 px shadow, two red pins.                              | no                                                          |

The renderer records every icon and text run it draws (position, scale, colours), and the lint
measures those in the decoded PNGs (both halves stitched back together), so the readability
checks follow the layout automatically. Why 64 texels per block and 2×1: `slice.md` "Texture
resolution".

## Block models and decor (D22)

Rules for 3D blocks: the pot, board and cake, and the kitchen decor. They come from the first art
review of the decor (2026-10-23).

| Rule                                                                                                                                                                                 | Lint              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| **16 texels per block on every face**, as in vanilla. No stretched faces, except 1×1 flat-colour swatches on parts too thin to see.                                                  | no (review)       |
| **Shared ramps:** wood uses the cutting board's oak, metal uses the pot's `pot_iron`/`pot_copper`, stone tops are calcite-like. Light comes from the top left on every face texture. | no                |
| **Model the shape, don't paint it.** A rim, lip or door frame that should read from the side stands 1 px proud of its face. A pan painted on a flat slab reads as a paddle.          | no                |
| **Round things are stepped:** a round outline is 3 stacked cubes with 2 px chamfers (e.g. 8×4, 6×6, 4×8), not 2.                                                                     | no                |
| **Clean metal, no specks:** a metal face is a lit top and left row, a dark bottom and right row, and a flat middle. Scattered light or dark pixels read as noise or rust.            | no                |
| **Small parts say what they are:** a hook is a bent J or a ring, not a cap on a stem (that reads as a nail).                                                                         | no                |
| **Food on blocks uses the item icon's ramp** (tomato `#b41331 → #ffd2a8`), so a tomato in a basket matches the tomato item. Highlights warm toward yellow, never toward pink.        | no                |
| **Faces the player** who places it (front built facing north in Blockbench), and it looks right next to vanilla oak planks, calcite, the furnace and the cauldron.                   | no (in-game test) |

Item icons for blocks follow the icon rules above. Box-shaped blocks need different silhouettes:
four of the decor icons first matched each other, or the farmland and crafting-table icons, on
the similar-pair lint.

## Animated effects (D21)

| Rule                                                                                                                                                                                                                      | Lint                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Motion stays where the action is.** A flipbook animates only what moves (the liquid). Pixels the player sees on a static part (the pot rim) are identical in every frame; flicker there reads as glitter or z-fighting. | `fx-pot.test.ts` (strips)         |
| **Flipbook frames use the still texture's own ramp:** bubbles grow, pop to a ring and fade within about 4 frames, staggered, with no new colours.                                                                         | `fx-pot.test.ts`                  |
| **One of each object.** An effect that shows a tool the block already has (the board's knife) replaces it while it runs; it never adds a second copy.                                                                     | no                                |
| **Effect models match the block's art:** the same ramps, the same 16 texels per block. A handle is a solid ramp with at most one rivet pixel, and a blade spine is one clean highlight line, never alternating pixels.    | no                                |
| **Client animation, short and readable:** a chop rocks on the tip and snaps down with a small bounce, and the crumbs fire on contact. A stir is one slow circle with a bob.                                               | renders in `models/fx_*/renders/` |

## Chapter icons (Kitchen Guide)

The six chapter icons sit side by side on Home and the ribbons, so each needs its own silhouette.
`chapter_crops` and `chapter_what_can_i_make` run diagonally. `chapter_how_to_play` leans the
same way. Its first upright version was a plain capital "I" in silhouette and matched the
cabinet icon on the similar-pair lint.

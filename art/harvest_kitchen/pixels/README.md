# Hand-authored pixel art (Harvest Kitchen)

Every 16×16 icon here is drawn by hand as a text grid, one character per pixel. `tools/gen-textures.mjs`
uses `<name>.txt` instead of its procedural drawing whenever the file exists. Item, UI, poster
ingredient and biome icons and the crop stages all have grids; only the pot's block faces still
come from the generator, which stays as the fallback. Rules: `docs/harvest-kitchen/art-style.md`.

## Format

```
# comments
palette
R tomato.1      a palette.json ramp shade, hue-shifted as the generator does (0 = darkest, -1 = lightest)
r #ff5e69       a hex colour
b bowl_dark     a name from _palette.txt
grid
................   16 rows × 16 characters, '.' = transparent
```

`<name>` is the sprite name (`tomato`, `tomato_soup_mix`, `family_heal`); the output folder
(`items/`, `ui/`) comes from the sprite list in `gen-textures.mjs`. `_palette.txt` holds named
colours shared by several grids (the bowl, the mix spoon).

## Commands

```sh
node tools/pixels.mjs --export <name>       # start a grid from the procedural sprite
node tools/pixels.mjs --preview <name> [--refs apple,bread,carrot] [--out file.png]
node tools/pixels.mjs --vanilla <regex>     # list vanilla item textures for --refs
node tools/pixels.mjs                       # convert all grids into generated/
npm run textures                            # full regenerate + lint + review sheet
```

`--preview` writes an 8× view: 3 vanilla items, the procedural "before", the grid, grayscale and
silhouette, plus the in-game sizes (1×, 2×, 3×), and prints the lint result for that icon and any
similar pair with another icon.

## Art loop (per icon, up to 4 rounds)

1. `--preview` with 3 relevant vanilla items.
2. Look at the PNG and critique it against art-style.md: silhouette (nameable in black), light
   from the top left, hue-shifted ramp (cool shadows, warm highlights), no pillow shading, clean
   line steps and no orphan pixels, readable at 1×, 3–10 colours, longest side 10–15 px.
3. Fix the grid; repeat.

Shared bases stay shared: the bowl (rows below, also `bowl.txt`) is identical in every bowl dish
and bowl mix, and the mix spoon sits top right. Grids use the same digits for them: `1`–`6` the
bowl ramp (`bowl_dark`, `bowl_edge`, `bowl_shade`, `bowl_mid`, `bowl_light`, `bowl_hi` in
`_palette.txt`), `7`–`9` the spoon (`spoon_light`, `spoon_mid`, `spoon_dark`). The bowl is a warm
wood ramp (28-35° mid-tones at ~50% saturation, pale highlight) with a cooler, greyer brown for the
two darkest shades (outline and the shadow inside the mouth, under 25% saturation, so the lint
ignores them). The bowl pixels are identical in every dish and every dish covers rows 7-8 the same
way, so the similar-pair lint compares dishes by their contents. The cooking pot icon keeps the
`pot_iron`/`pot_copper` ramps, which come from the pot model textures.

```
....22222222....   row 6   back rim (outline, lit side 2)     dishes cover rows 2-8 with their
..222333344521..   row 7   inside back wall, lit right     contents, keeping the rim pixels
.21111222334431.   row 8   shadow behind the front lip    at x2/x13 (row 7), x1/x14 (row 8)
.25666555454431.   row 9   lip band, highlight top left
..255444434331..   row 10  body, lit left, grain streaks
...2453343231...   row 11
.....243321.....   row 12  waist
....21221111....   row 13  foot
```

Dishes dome 1-3 px above the back rim (row 6): smooth liquids to row 5, heaps and stews to row 3-4.
Mixes keep the inside dark (no broth) and add the spoon:

```
.............78.   row 1   spoon end
............789.   row 2
...........89...   rows 3-5: one step left per row
....22228922....   row 6   the handle crosses the back rim
..2...89...521..   row 7   and ends among the pieces
```

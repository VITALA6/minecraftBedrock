# Hand-authored pixel art (Harvest Kitchen)

Every 16×16 icon here is drawn by hand as a text grid, one character per pixel. `tools/gen-textures.mjs`
uses `<name>.txt` instead of its procedural drawing whenever the file exists; sprites without a
grid (crop stages, block faces, poster ingredients, biomes) still come from the generator, which
stays as the fallback. Rules: `docs/harvest-kitchen/art-style.md`.

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

Shared bases stay shared: the bowl (rows below) is identical in every bowl dish and bowl mix, and
the mix spoon sits top right. The cooking pot icon keeps the `pot_iron`/`pot_copper` ramps, which
come from the pot model textures.

```
.....DDDDDD.....   row 5   D = bowl_dark (rim back, inside mouth, shadow)
...DDssssssDD...   row 6   s = bowl_dark (mouth: the dish draws its contents here)
..DssssssssssD..   row 7
..LssssssssssD..   row 8   L = bowl_light
..LLLLLLLLLLMD..   row 9   M = bowl_mid
...LMMMMMMMMD...   row 10
....MMMMMMMD....   row 11
......DDDD......   row 12
```

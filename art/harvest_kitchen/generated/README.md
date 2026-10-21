# Generated textures (Harvest Kitchen)

Script output, plan §4.5 step 2. **Don't edit files here by hand**: the next run overwrites
them. Hand touch-ups go to `art/harvest_kitchen/final/`, which the generator never writes to.

## Run

```sh
node tools/gen-textures.mjs             # redraw everything from art/harvest_kitchen/palette.json
node tools/gen-textures.mjs --palette   # re-sample palette.json from the installed game first
```

- Plain Node, no dependencies, deterministic: the same inputs give byte-identical PNGs.
- The normal run needs only `palette.json` and the S8 pot textures in
  `art/harvest_kitchen/models/cooking_pot/textures/`. The pot ramps, the pot icon and the two pot
  variants are read from those files on every run, so they follow a repaint.
- `--palette` reads vanilla textures from the game's resource packs. Since 1.26 they ship inside
  `resource_packs/vanilla*/__brarchive/textures/*.brarchive`, and newer `vanilla_<version>` layers
  override older ones. Override the location with `MC_VERSIONS_DIR` and `MC_GAME_VERSION`.

## What's generated

`contact_sheet.png` shows every texture at 4x on a grey checker. `contact_sheet.txt` says which
file is where.

| Folder    | Files                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `blocks/` | `<crop>_stage_0..3` for `tomato_crop`, `onion_crop`, `cucumber_crop`, `chili_bush`, `strawberry_bush` (cross model, transparent)  |
| `blocks/` | `cooking_pot_liquid_ready`, `cooking_pot_top_hot` (variants of the S8 pot textures)                                               |
| `items/`  | produce, seeds, prepared ingredients, the 13 MUST dishes, `cooking_pot`, `cutting_board`, `recipe_book`                           |
| `ui/`     | `family_heal`, `family_move`, `family_work`, `family_explore`, `locked`, `chapter_crops`, `chapter_what_can_i_make`, `needs_heat` |

All textures are 16×16 with no baked-in words; `locked` uses a single `?` glyph.

## Editing a texture

Shapes live in `tools/gen-textures.mjs` as pixel rows with a legend (one character per pixel, each
mapped to a palette ramp shade), sometimes combined with shape masks that are shaded
automatically (outline, shadow band bottom-right, light band top-left). Bowl dishes share one
`BOWL` and only draw their contents. Change the rows, rerun, and check the contact sheet.

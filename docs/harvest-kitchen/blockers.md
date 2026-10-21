# Harvest Kitchen: blockers and fallbacks

One entry per blocker hit while building the portfolio slice code (2026-10-21/22). Each says what,
why, the fallback taken, and what you need to decide or test.

## B1. Recipe JSON vs. `data/recipes.ts` can't be checked in game

- **What:** the crafting-table dishes exist twice: the shapeless JSON in `behavior/recipes/` (what
  the game crafts) and `CRAFTING_RECIPES` (what the book and "What can I make?" show). The same
  goes for texture files and lang keys: a script can't ask the game whether a PNG or a
  translation exists.
- **Why:** no Script API reads recipes, textures or lang files. A build-time check belongs in
  `tools/build.mjs`, which this batch wasn't allowed to edit.
- **Fallback:** checked offline once with a scratch script (all textures, material slots, bones,
  lang keys, icon paths resolve). `validate.ts` checks everything a script can see.
- **Decide:** whether to add a `tools/` check (recipe JSON ↔ `CRAFTING_RECIPES`, lang keys used in
  `scripts/` ↔ `en_US.lang`, `textures/hk/...` paths ↔ files) to `npm run build`.

## B2. Sneak + use on custom blocks is unproven

- **What:** §2.3/§2.5 need sneak + use (pot: add the whole stack / take all out; board: chop the
  stack). Whether a block's `onPlayerInteract` fires while sneaking with an item in hand isn't
  known; vanilla usually places the held block instead.
- **Fallback:** sneak cases go through `world.beforeEvents.playerInteractWithBlock`, which cancels
  the vanilla action and runs ours next tick. The components skip those cases.
- **Test:** sneak + use the pot with a stack of tomatoes, with an empty hand, and the board with a
  stack of onions. Each should act once. Sneak with dirt next to a pot should still place dirt.

## B3. Flat item icons for pot, board and cake

- **What:** MCPE-185868 breaks held/hotbar rendering of geometry with `bone_visibility`, so these
  blocks need flat icons.
- **Fallback:** a same-id item with `minecraft:block_placer` + `replace_block_item: true` and
  `minecraft:icon` (binary and vanilla `red_shrub` evidence, see slice.md). Not seen in game.
- **Test:** hotbar icon and name of all three; creative menu shows each once. If the replacement
  is rejected (Content Log: "Cannot replace the block item"), the fallback is separate item ids
  (`hk:cooking_pot_item`, …) with plain `block_placer`, which changes the saved/display ids.

## B4. Effect button icon: vanilla effect icon or our family icon

- **What:** the dish page has room for one effect icon. The plan wants both the family colour and
  (optionally) the vanilla effect icon.
- **Fallback:** the button uses the vanilla effect icon; the family shows as a coloured glyph in
  the label and the body, and tapping the button explains the family (`❤ Red food heals you`).
  `EFFECT_BUTTON_ICON = "family"` in `config.ts` switches to our family icons.
- **Decide:** which reads better for kids once the family icons have final art.

## B5. Bush soil

- **What:** the brief asked whether bushes need farmland or grass/dirt.
- **Fallback:** vanilla sweet berries plant on grass, dirt and podzol (1.26.52 vanilla item JSON).
  Ours accept grass block, dirt, coarse dirt, podzol **and farmland**, ignoring hydration.
- **Decide:** drop farmland if bushes should feel distinct from crops.

## B6. Glyphs for the move, work and explore families

- **What:** S2 confirmed ❤ ★ ☆ ■ □ ● ○ ♨ ☕ ⌛ and arrows render; nothing boot-, pickaxe- or
  eye-shaped is in the vanilla glyph pages.
- **Fallback:** `§c❤` heal, `§9▶` move, `§e■` work, `§a●` explore (`FAMILIES` in
  `data/dishes.ts`). `▶` is only confirmed offline (drawn in the 1.26.52 glyph pages, plan §2.2), not in the S2 run.
- **Decide:** keep, or pick other confirmed glyphs.

## B7. Vanilla textures are packed in `.brarchive` files (art pipeline)

- **What:** in 1.26.52.3, vanilla block, item and UI textures are not loose PNG/TGA files. They sit
  inside `resource_packs/vanilla*/__brarchive/textures/{blocks,items,ui,...}.brarchive`, layered
  by version (`vanilla_1.21.90` holds the current item and block art).
- **Fallback:** `tools/gen-textures.mjs --palette` has a small `.brarchive` reader (16-byte header,
  256-byte entries, data blob) and samples the PNGs from there. `art/harvest_kitchen/palette.json`
  is committed, so a normal run doesn't need the game installed.
- **Decide:** nothing. The format is undocumented, so re-run `--palette` after a game update and
  check the ramps still look right.

## B8. Blockbench MCP: `export_model` exports the wrong project; no render-to-file

- **What:** with several projects open, `export_model` exported the MCP session's own project, not
  the one selected, and once overwrote the board files with the cake. Screenshots can't be saved to
  a path, and `delete_offscreen_view` fails with "onContextMenu is not defined".
- **Fallback:** the board was exported through `risky_eval` (`Codecs.bedrock.compile()` + `fs`).
  Renders were copied from the session's auto-saved captures into `models/<name>/renders/`. Model
  sources are regenerable from `art/harvest_kitchen/models/_tools/make-*.mjs`. Re-export and
  post-fix the geo (format 1.26.50, no `visible_bounds_*`) after any change.
- **Decide:** nothing; it's a pipeline note for the next model (oven, pies).

## B9. Model facing after the exporter's x-mirror (untested)

- **What:** the Bedrock exporter mirrors x, the same as for the S8 pot. The knife handle is at +x
  in Blockbench and at x −7..−3 in the geo. The cake's quarters are mirrored the same way.
- **Test:** place the board facing each of the 4 directions and note where the handle tab and the
  knife end up relative to you; decide which way it should face. A wrong side is fixed by rotating
  the permutations, not the model. On the cake, note which corner goes first; any consistent
  order is fine.

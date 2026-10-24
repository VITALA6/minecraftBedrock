# Simmerfield: blockers and fallbacks

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
  `scripts/` ↔ `en_US.lang`, `textures/wm_kitchen/...` paths ↔ files) to `npm run build`.

## B2. Sneak + use on custom blocks is unproven

- **What:** §2.3/§2.5 need sneak + use (pot: add the whole stack / take all out; board: chop the
  stack). Whether a block's `onPlayerInteract` fires while sneaking with an item in hand isn't
  known; vanilla usually places the held block instead.
- **Fallback taken:** sneak cases go through `world.beforeEvents.playerInteractWithBlock`, which
  cancels the vanilla action and runs ours next tick. Both paths end in `handleUse` →
  `routeUse` (`station-logic.ts`). The component passes `sneaking = false` and skips the cases the
  before-event takes (`sneakHandles`), so nothing runs twice.
- **Review assessment (code-review.md, 2026-10-22): likely works.**
  - The before-event replaced `itemUseOn` in 2.x and reports `itemStack` undefined for an empty
    hand, so it should fire for all four cases.
  - It cancels only on our blocks with the narrow predicate. Sneak + dirt isn't cancelled.
  - `isFirstEvent` (documented: false on hold repeats) stops repeats. Repeats are still
    cancelled, so vanilla can't act on them.
  - No cancelled item can be placed on a pot or board face, so no ghost blocks are expected.
  - If the held item changes in the tick between the event and `system.run`, `routeUse` just
    treats it as a plain use (dirt → "Can't cook Dirt"), which is harmless.
- **Remaining risk:** sneaking with a **food** ingredient (tomato, strawberry, onion, carrot,
  bread, beef…) may fall through to the item's own use, so the player starts eating. For the pot
  that's harmless, because the stack goes in at once. On the board the eat timer races the chop
  loop.
- **Test:**
  - Sneak + use the pot with a stack of tomatoes, with an empty hand (pot with items, and an empty
    pot), and the board with a stack of onions. Each should act once.
  - While doing that, watch for the eat animation.
  - Sneak with dirt next to a pot should still place dirt.
- **If sneak can't be made to work:** replace the sneak gestures with hold-to-repeat. Holding use
  keeps adding to the pot or keeps chopping, using the non-first before-events. Take-all becomes a
  "Take all out" button at the bottom of the pot screen's In-the-pot section.

## B3. Flat item icons for pot, board and cake

- **What:** MCPE-185868 breaks held/hotbar rendering of geometry with `bone_visibility`, so these
  blocks need flat icons.
- **Fallback taken:** a same-id item with `minecraft:block_placer` + `replace_block_item: true` and
  `minecraft:icon`. Not seen in game yet.
- **Evidence (code-review.md):**
  - The 1.26.52.3 binary has the `replace_block_item` key and the error "Item identifier %s does not
    match the block identifier %s. Cannot replace the block item."
  - The vanilla 1.26.50 `items.brarchive` (binary MCB format) has exactly two `block_placer` items,
    `minecraft:red_shrub` and `minecraft:shelf_mushroom`. Both share their block's id, use a flat
    icon and a `tile.<id>.name` display name.
  - Both items have menu category **`none`**, while their blocks are in `nature`. Every other
    vanilla JSON item in the archives uses a real category, so `none` marks this pattern.
- **Applied 2026-10-22 (CR review, phase 2):** the three placer items now use
  `menu_category: none` like vanilla. Their blocks keep `items`, so the creative menu gets one
  entry per block, not two. `tests/pack-files.test.ts` ("same-id placer items") keeps it that way.
- **Seen in game 2026-10-22:** with `none`, all four placer items (pot, board, cake, poster) were
  **missing** from the creative menu, and with them their recipes from the recipe book. The items
  are back to `items` (the first "if something's wrong" step below); the test asserts that now.
- **Test:** check the hotbar icon and name of all four, and that the creative menu (Items tab)
  shows each exactly once. If one now shows twice, set its **block** to `none` instead.
- **If something's wrong:**
  - If an entry is **missing** from the creative menu, set the item's category back to `items`
    (one line in each of `behavior/items/{cooking_pot,cutting_board,strawberry_cake}.json`) and
    update the test.
  - If the replacement is rejected (Content Log: "Cannot replace the block item"), the fallback is
    separate item ids (`wm_kitchen:cooking_pot_item`, …) with plain `block_placer`. The block then needs
    an explicit `minecraft:loot` that drops the placer item; otherwise it drops its own 3D item.
  - That changes the saved and display ids, so decide before the first public build.

## B4. Effect button icon: vanilla effect icon or our family icon

- **What:** the dish page has room for one effect icon. The plan wants both the family colour and
  (optionally) the vanilla effect icon.
- **Fallback:** the button uses the vanilla effect icon; the family shows as a coloured glyph in
  the label and the body, and tapping the button explains the family (`❤ Red food heals you`).
  `EFFECT_BUTTON_ICON = "family"` in `config.ts` switches to our family icons.
- **Decide:** which reads better for kids once the family icons have final art.
- **Update 2026-10-22 (D14):** obsolete. The book is a `CustomForm` with page images drawn from our
  own art; the image shows the family badge, and `EFFECT_BUTTON_ICON` is gone.

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
  256-byte entries, data blob) and samples the PNGs from there. `art/simmerfield/palette.json`
  is committed, so a normal run doesn't need the game installed.
- **Decide:** nothing. The format is undocumented, so re-run `--palette` after a game update and
  check the ramps still look right.

## B8. Blockbench MCP: `export_model` exports the wrong project; no render-to-file

- **What:** with several projects open, `export_model` exported the MCP session's own project, not
  the one selected, and once overwrote the board files with the cake. Screenshots can't be saved to
  a path, and `delete_offscreen_view` fails with "onContextMenu is not defined".
- **Fallback:** the board was exported through `risky_eval` (`Codecs.bedrock.compile()` + `fs`).
  Renders were copied from the session's auto-saved captures into `models/<name>/renders/`. Model
  sources are regenerable from `art/simmerfield/models/_tools/make-*.mjs`. Re-export and
  post-fix the geo (format 1.26.50, no `visible_bounds_*`) after any change.
- **Decide:** nothing; it's a pipeline note for the next model (oven, pies).

## B9. Model facing after the exporter's x-mirror (untested)

- **What:** the Bedrock exporter mirrors x, the same as for the S8 pot. The knife handle is at +x
  in Blockbench and at x −7..−3 in the geo. The cake's quarters are mirrored the same way.
- **Review assessment (code-review.md):**
  - The four `cardinal_direction` permutations match vanilla `minecraft:shelf_mushroom` exactly:
    north none, west `[0, 90, 0]`, south `[0, 180, 0]`, east `[0, 270, 0]`. A rotation can't
    mirror, so either all four are right or all four are off by the same angle.
  - The x-mirror is the exporter's normal conversion, so the board renders as Blockbench shows it.
  - The only unknown is whether the trait stores the direction the player looks or its opposite.
- **Fix if it faces the wrong way:** add one line to the trait in
  `behavior/blocks/cutting_board.json`, no model or permutation edits:

  ```json
  "minecraft:placement_direction": {
    "enabled_states": ["minecraft:cardinal_direction"],
    "y_rotation_offset": 180
  }
  ```

  Use `90` or `270` if it's a quarter turn off. The binary confirms the key is valid with
  `cardinal_direction` (its error text says `y_rotation_offset` needs one of the direction
  states enabled). Not applied blind: which way is right needs the game.

- **Test:** place the board facing north and note where the handle tab and knife are relative to
  you; that decides the offset. Placing it facing east confirms the turn direction. On the cake,
  note which corner goes first; any consistent order is fine.

## B10. Dry farmland may revert to dirt under our crops (CR1)

- **What:** vanilla keeps dry farmland from reverting only under its own crop blocks (a
  `crop_block` archetype that custom blocks can't use). If our crops don't count, unwatered
  farmland turns to dirt and the crop's `placement_filter` pops it (it drops seeds).
- **Test:** plant a tomato on farmland at least 5 blocks from water, with no rain. Run
  `/gamerule randomtickspeed 200`, wait 30 s, then `/gamerule randomtickspeed 1`. Expected if
  vanilla protects it: the farmland stays (dry) and the crop grows at half speed.
- **Fallback if it reverts:** add `minecraft:dirt` to the crops' `block_filter` and turn dirt under
  a crop back into dry farmland in `onRandomTick`. The cost is that trampling no longer pops the
  crop. Or accept it and add "needs water nearby" to the crop page.

## B11. Pot screen buttons vs `header()`/`divider()` rows (CR5)

- **What:** `Menu` (`ui/menu.ts`) assumes `ActionFormResponse.selection` counts buttons only, as
  the `.d.ts` says ("index of the button"). S1 tested icon buttons, not headers.
- **Test:** put 2 tomatoes, 1 onion and 1 bowl in a pot. Open the screen and tap the **second**
  "In the pot" button. Expected: the onion comes out, not a tomato, and nothing starts cooking.
- **Fallback:** if the index counts header and divider rows, have `Menu.header`/`divider` push an
  `undefined` action so the indices line up.
- **Update 2026-10-22 (D14):** obsolete. `Menu` and the `ActionFormData` pot screen are gone; the
  `CustomForm` pot screen gives each button its own `onClick`.

## B12. Recipe book use: in the air and at a block (CR2)

> **Obsolete (D15, 2026-10-22):** the recipe book is gone (recipe posters replace it), so there's nothing left to test here.

- **What:** the book opened only through `onUse`. Whether `onUse` fires for an item with no use
  component, and whether it fires while the player looks at a block, was unproven. A child looking
  at the ground would get no book.
- **Applied:** `onUseOn` opens it too. A per-player `TickGate` (`BOOK_OPEN_GAP_TICKS`, 5) makes a
  click that fires both open one book.
- **Test:** use the book pointing at the sky, at grass, and at the pot. The first two should open
  the book exactly once, with no "Close chat" message. The pot should take the click as a normal
  pot use ("Can't cook Recipe Book").
- **Fallback:** if it never opens in the air, add `minecraft:use_modifiers` to the book JSON.

## B13. Holding use on the cake (CR7)

- **What:** block component events have no `isFirstEvent`. If the game repeats the interaction
  while use is held, a held button would eat the whole cake in under a second.
- **Applied:** a per-player bite gate (`SLICE_BITE_GAP_TICKS`, 10 = 0.5 s) in
  `food/sliced-dish.ts`. Single taps are unaffected.
- **Test:** tap a cake 4 times at a normal pace: 4 slices, and the block goes. Hold use on a fresh
  cake for 2 s: at most 4 slices (one per half second), or 1 if the game doesn't repeat.
- **Decide:** if hold-eating should stop after one slice, switch the gate to a debounce: reset the
  timer on every event, not only on bites.

## B14. Sneak-chop doesn't stop when the player stops sneaking (CR8)

- **What:** one sneak-tap with 64 tomatoes chops all 64 (about 19 s) unless the player walks more
  than 4 blocks away or switches items. Sliced tomatoes can't go into the pot or be planted. This
  matches §2.5 as written.
- **Test (S6):** sneak-tap the board once with a full stack, stand up and look away. Note whether
  chopping everything feels right.
- **Option:** add `player.isSneaking &&` to `keepGoing` in `startChopping`
  (`stations/cutting-board.ts`), so releasing sneak stops it.

## B15. The cake can float (CR12)

- **What:** the cake had no `minecraft:placement_filter`. Placed against a wall it hung in mid-air,
  and it stayed when the block under it went. Vanilla cake pops and drops nothing.
- **Research (2026-10-22, 1.26.52.3):**
  - Microsoft Learn (`minecraft:placement_filter`): `block_filter` entries are a block name or a
    block descriptor `{ name, states, tags }`; "if the block is already placed and the conditions
    become invalid (e.g., the supporting block is removed), the block will pop off".
  - The binary accepts the same: "BlockDescriptor requires a string, block object, or any_tag
    object", "Cannot have both a block name and tag expression in a block descriptor". Vanilla
    1.26.50 features and entities use Molang tag descriptors such as
    `{ "tags": "query.any_tag('minecraft:leaves')" }`. No vanilla data-driven block (only slabs
    and stairs are data-driven) has a `placement_filter` to copy.
  - "Any solid block" can't be written as a filter. A negated tag expression
    (`!q.any_tag(...)`) also matches air, which has no tags. A positive allowlist of the tool tags
    vanilla blocks carry (`minecraft:is_{pickaxe,axe,shovel,hoe,shears}_item_destructible`)
    would refuse every block without one of them (glass, maybe others), so it wasn't used.
  - `allowed_faces: ["up"]` alone certainly stops wall and ceiling placement. Whether its
    neighbour-change re-check pops the cake when the block below goes, with an empty
    `block_filter`, is unproven (Microsoft Learn implies it does).
- **Applied:**
  - `strawberry_cake.json`: `placement_filter` `{ "conditions": [{ "allowed_faces": ["up"] }] }`
    and `minecraft:movable` `popped` (vanilla cake breaks when a piston pushes it).
  - Safety net `food/dish-support.ts`: after a player break, an explosion (`blockExplode`, per
    block) or a piston move (its attached blocks, 3 ticks later), it looks at the one block above
    each position. A placed dish standing on air or liquid gets `setblock … air destroy` (break
    particles and sound, its loot table: nothing). No tick, no scan, deduplicated per position.
    Not covered without one of those events: water or lava flowing in, fire, endermen,
    `/setblock`.
  - `tests/pack-files.test.ts` "strawberry cake support (B15)" pins the JSON and the empty loot.
- **Test:**
  1. Try to place a cake against the side of a block and on a ceiling: refused (no cake).
  2. Place a cake on dirt, eat one slice, break the dirt (survival): the cake pops with break
     particles and drops **nothing**.
  3. Place a cake on a block, push that block away with a piston: the cake pops, nothing drops.
     Push the cake itself with a piston: it pops, nothing drops.
  4. Place a cake on TNT and light it: no floating cake afterwards.
  5. Watch the Content Log for errors from `dish-support` or `placement_filter`.
- **If a pop drops a cake item:** that's a free-cake exploit. Switch `minecraft:movable` to
  `immovable` and tell me which step dropped it.
- **Which route popped it** can't be seen (both play the break effect). To prove the JSON route
  alone, comment out `registerDishSupport()` in `main.ts` and repeat step 2. If it then floats,
  keep the script; if not, the script is only a safety net and can stay.

## B16. Pot liquid colours: 27 material permutations (untested)

- **What:** the liquid now follows the contents (`wm_kitchen:liquid`, 7 colours; rule in `liquidOf`,
  `stations/station-logic.ts`). A permutation's `material_instances` replaces the whole component,
  so each colour × ready glint × hot rim combination is its own permutation: 27 plus the base
  (water, not ready, cold), and the light permutation. `tools/gen-pot-block.mjs` writes them;
  `tests/pack-files.test.ts` evaluates every condition for all 224 state combinations and checks
  the liquid/top texture and light each one gets.
- **Unproven:** that 28 permutations on one block load without a Content Log warning, and that the
  light permutation still combines with a material permutation (slice.md untested assumption 3).
- **Test:** see "In-game test: pot liquid" in slice.md.
- **Fallback:** if the game rejects the count, move the colour into the geometry instead: one
  liquid bone per colour and level (`liquid_<colour>_<1..3>`, own material slot each), shown with
  `bone_visibility`. That needs a geometry generator script; the permutations drop back to the
  4 hot × ready ones.

## B17. `ItemFoodComponent` properties throw in game

- **What:** at `worldLoad`, `new ItemStack(<dish>).getComponent(ItemComponentTypes.Food)` returned
  the component, but reading `.nutrition` threw `Failed to get property 'nutrition'` for all 12
  item dishes (1.26.30 item format, `@minecraft/server` 2.10.0). The `.d.ts` marks each property
  "can throw" with no reason given; it's not a privilege error.
- **Applied:** `validate.ts` only checks that each dish item has `minecraft:food`. The values
  (nutrition, can_always_eat, using_converts_to) are compared offline by `tests/pack-files.test.ts`.
- **Test:** the world-load line reads `data check: 0 problem(s)`, and `/wm_kitchen:debug validate` says the
  same.
- **Decide:** nothing. Re-try the read after a game update if a script ever needs food values in
  game (the book uses `DISHES`, not the component).

## B18. Book page images: size on screen and flipping in place (untested)

> **Obsolete (D15, 2026-10-22):** the recipe book is gone (recipe posters replace it), so there's nothing left to test here.

- **What:** the book and pot screen are `CustomForm`s with one pre-rendered image at `width: 1`
  (D14). S1 proved a static `image()` with our RP UUID and a `.png` path, live label updates and
  a self-toggling `disabled` button. Not proven: (a) setting an `ObservableString` `src` after
  `show()` swaps the picture; (b) `visible: ObservableBoolean` hides and shows buttons (the book
  keeps a pool of 13 context buttons and hides the unused ones); (c) how wide a width-1 image is
  on PC, phone and console. The page lint assumes 280 UI px.
- **Test:** open the book, press Next ▶ a few times, open the Pot chapter, tap a dish, tap "→ Tomato".
  The picture must change with every tap. Only the page's own buttons should show: the Home page
  has 5, the Pot chapter 7, and a dish 1–4. Note how big the image is on screen. Is the "8 s" text
  readable, and is a single icon about inventory size?
- **Fallback:** (a) or (b) fails → set `BOOK_FLIP = "reopen"` in `config.ts`. Every page is then a
  fresh form with exactly its own buttons, at the cost of a close/open flicker. (c) too small →
  render at a bigger art scale, or make the canvas narrower (e.g. one page per image) and re-run
  `npm run book`. The lint's `formUiWidth` then gets the measured value.

## B19. `◀` in button labels (untested)

> **Obsolete (D15, 2026-10-22):** the recipe book is gone (recipe posters replace it), so there's nothing left to test here.

- **What:** the Prev button is `◀ Prev` (lang `wm_kitchen.book.prev`). S2 checked `▶` on the vanilla glyph
  pages but not `◀`.
- **Test:** the book's first button shows a left triangle, not a box or nothing.
- **Fallback:** change the lang line to `< Prev` (no code change).

## B20. Long button lists in a CustomForm (untested)

> **Obsolete (D15, 2026-10-22):** the recipe book is gone (recipe posters replace it), so there's nothing left to test here.

- **What:** "What can I make?" lists every dish you can make right now (up to 13), and a full pot
  screen can have up to 7 Cook or 8 Take-out buttons. Under a large image, the buttons may need
  scrolling, which is awkward on a phone.
- **Test:** `/wm_kitchen:debug kit`, open the book → What can I make?. Do all the dishes show, can you
  scroll to the last one, and does Close stay reachable?
- **Fallback:** cap the list (e.g. the first 6) or put the What page's image at `width: 0.5`.

## B21. Page textures loaded only by path (untested)

> **Obsolete (D15, 2026-10-22):** the recipe book is gone (recipe posters replace it), so there's nothing left to test here.

- **What:** `textures/wm_kitchen/book/*.png` and `textures/wm_kitchen/pot/*.png` (310 files, 1 MiB) aren't listed
  in any texture JSON. `image()` loads them by path from our RP, which is how S1 loaded
  `textures/wm_kitchen/items/tomato.png`. That file is also in `item_texture.json`, though.
- **Test:** the first book page shows. If it's blank while the S1-style item texture works, the
  path isn't the cause; check the Content Log for a texture error.
- **Fallback:** none needed if it shows. If a load-time or memory cost shows up with 310 images,
  drop the cold pot variants (the label already says "Needs fire below"): 124 fewer images.

## B22. Ghost ingredient particles (D15, untested)

- **What:** the ghosts above the pot are custom particles (`resource/particles/wm_kitchen/ghost_*.json`,
  written by `tools/gen-ghost-atlas.mjs`) spawned per player every 0.5 s with
  `Player.spawnParticle`. Offline only: the JSON follows the 1.26.52.3 vanilla particle files
  and every API is in the pinned `.d.ts`. Not seen in game:
  (a) `format_version` `1.26.50` with plain-string Molang (vanilla's 1.26.50 particles wrap
  expressions as `{ "expression", "version": 12 }`; its 1.26.10 ones use plain strings);
  (b) particle files load from the `particles/wm_kitchen/` subfolder;
  (c) `variable.wm_kitchen_icon/wm_kitchen_alpha/wm_kitchen_phase` from `MolangVariableMap.setFloat` reach the
  billboard UV, tint and parametric motion, and the `v.x = v.x ?? 0` defaults log nothing;
  (d) `particles_blend` + tint alpha 0.65 looks see-through, and the billboard `size` is a
  half-size (icons ≈ 0.36 blocks wide);
  (e) the 0.6 s lifetime re-spawned every 0.5 s looks continuous (no flicker, no doubled
  brightness), and the bob doesn't jump at re-spawn;
  (f) cost on a phone with 2 pots × 4 ghosts.
- **Test:** slice.md "In-game checks for D15", steps 2–4 and 9.
- **Fallbacks:** (a) set `FORMAT_VERSION` in the generator to `"1.10.0"` (the long-standing
  format, still shipped by vanilla); (b) move the files to `particles/` with `wm_kitchen_` prefixes;
  (c) a Content Log `unknown variable` line → check the name in `GHOST_ICON_VARIABLES`;
  (d) tune `GHOST_ALPHA` / `GHOST_ICON_SIZE` in `config.ts` and run `npm run ghosts`;
  (e) flicker → raise `GHOST_FADE_SECONDS` (overlap) or `GHOST_UPDATE_TICKS`; doubling → lower
  the fade; (f) lower `GHOST_MAX_SPAWNS_PER_UPDATE` or `GHOST_MAX_POTS_PER_PLAYER`. If particles
  can't be made to look right, the alternative is a billboard entity per ghost with the texture
  picked by an entity property (slice.md "Implementation: particles, not entities").

## B23. Pot choice form length (D15, untested)

- **What:** the choice form opens only when two or more dishes are possible: one `ActionFormData`
  button per dish, no body, no Close button. A full pot (8 items) allows at most 4 dishes
  (vegetable stew, tomato soup, chicken soup, fish chowder; `tests/pot-status.test.ts` pins it).
- **Test:** put 2 tomatoes, onion, carrot, potato, raw chicken, raw cod and a bowl in a lit pot,
  use with an empty hand: do 4 buttons show without scrolling on PC and phone?
- **Fallback:** if it scrolls, nothing breaks (the list is short); a later recipe that raises the
  count fails the pinned test, which is the moment to decide.

## B24. Recipe posters (D15, untested)

`wm_kitchen:recipe_poster` is a 2×1 wall multi-block (slice.md "Recipe posters (D15)"). Written offline;
nothing below has been seen in game.

- **What's assumed:**
  1. The stable `minecraft:multi_block` trait with a horizontal `direction` loads at block format
     1.26.50 without an experiment, places both parts and breaks both (Microsoft Learn says so;
     no vanilla block uses it).
  2. With `placement_direction` (`cardinal_direction`, `y_rotation_offset` 90) the second part
     goes **along the wall**. If it goes into or out of the wall, every placement is refused with
     `Look straight at the wall` and the Content Log has `recipe poster parts … aren't side by
side`. Which side it goes to doesn't matter: the script sets `wm_kitchen:right` from the real
     positions (`Block.getParts()`).
  3. `beforeOnPlayerPlace` runs for a `block_placer` item, `face` is the clicked face (the poster
     faces that way), and a replaced `permutationToPlace` (with `wm_kitchen:facing`, `wm_kitchen:right`,
     `wm_kitchen:poster`) is what gets placed, and is copied to the second part. If it isn't copied, the
     second half shows the wrong picture for one tick, until the script syncs it.
  4. Transformation rotation per facing (north 0°, west 90°, south 180°, east 270°, as the cutting
     board) turns the north-facing model to face out of the wall, and the transformation also turns
     the collision and selection boxes.
  5. `material_instances`, `transformation` and per-part states are allowed in multi-block
     permutations (`Component '{}' is not valid in multi block permutations` exists in the binary
     for some components; Microsoft Learn names only movable, placement_filter, replaceable,
     random_offset, precipitation_interactions).
  6. A 64×64 block texture shows at full resolution (vanilla's 64×64 `straw_bed` suggests it) and
     is readable from a few blocks away on PC and phone.
  7. `onBreak` fires once for a multi-block break (Microsoft Learn: "only a single event … for the
     part that was first broken"), also for a pop and for `/setblock … destroy`, and its
     `entitySource` is the player for a player break (so creative breaks drop nothing). If `onBreak`
     doesn't fire for a pop, a poster whose wall goes may be lost; if it fires without
     `entitySource` for player breaks, a creative break drops a poster.
  8. `placement_filter` `allowed_faces: ["side"]` refuses floors and ceilings for both parts and
     pops the poster when its wall goes; the script net (`posters/poster-support.ts`) covers player
     breaks, explosions and pistons otherwise.
  9. Sneak + use reaches `beforeEvents.playerInteractWithBlock` (as on the pot, B2), and plain use
     reaches `onPlayerInteract` once per click.
  10. The `wm_kitchen:crops` tag works as a shapeless ingredient (the old `wm_kitchen:seeds` book recipe was the
      precedent and was itself untested).
- **Test** (re-enter the world after deploying; Content Log file on):
  1. Content Log: no errors for `wm_kitchen:recipe_poster`, its recipe or textures.
  2. `/wm_kitchen:debug reset`, empty inventory, pick up a tomato → `★ You got a Recipe Poster!` and one
     poster; a second Simmerfield item gives no second poster.
  3. Look straight at a stone wall, place it: two blocks wide, the Tomato Soup recipe reads left
     to right, front out of the wall, the frame edges flush. Repeat on north, south, east and west
     walls. Place it standing at a steep angle along the wall: refused with `Look straight at the
wall` and the poster stays in your hand (or comes back).
  4. Place it where only one block of wall is free (the other side air or a door): refused with
     `Needs a 2-block wall`; the poster comes back.
  5. Try a floor and a ceiling: nothing is placed.
  6. Use: `Tomato Soup · ❤ Regeneration 8 s`. With only tomato found, sneak + use: stays Tomato
     Soup with a page-turn sound. Get an onion: sneak + use goes Fish Chowder → Chicken Soup →
     Onion Soup → Vegetable Stew… (only unlocked dishes, in recipe order) and wraps around.
     Sneak + use while holding a block doesn't place the block.
  7. `/wm_kitchen:debug reset` (nothing found), sneak + use: `Break grass to find seeds`, the poster
     doesn't change. A new poster placed now is the blank one (grass → seeds → ?); use on it says
     `Sneak + use: next recipe`.
  8. Creative: sneak + use walks all 13 dishes and wraps to Tomato Soup.
  9. Survival: break the right half → both halves go, exactly one poster drops. Break the left
     half → same. Break the wall block behind one half → both go, one poster drops. Blow it up
     with TNT, push the wall with a piston: no poster half stays on the wall, at most one drops.
     Creative break: nothing drops.
  10. Crafting table: paper + tomato / onion / cucumber / chili pepper / strawberry → 1 poster each.
  11. From 4–5 blocks away the icons and the "8 s" are readable on PC and on a phone.
- **Fallbacks:** (2) wrong direction → change `Y_ROTATION_OFFSET` in `tools/gen-poster-block.mjs`
  (90 ↔ 270), run `npm run posters`. (4) mirrored or backwards on east/west only → swap 90/270 in
  `ROTATION` there and in `pack-files.test.ts`. (5) a component refused in permutations → move it
  to the base and split the permutations. (7) drops wrong → set the base loot to a poster loot
  table on part 0 only and drop the script drop. (6) blurry/too small → the layout is already at
  1/4-block icons; a 3×1 poster is the next step.

- **2026-10-22 in game:** the poster broke right after placing (the log tail wasn't flushed, so
  no line). The placement filter (`allowed_faces` on the side faces, no `block_filter`) was the
  likely cause: it's re-checked on the trait's second part, which isn't placed against any face,
  and after the script's state fix-up. **Removed it.** Floors and ceilings are still refused in
  `beforeOnPlayerPlace`, and the wall going is handled by `posters/poster-support.ts` from
  `wm_kitchen:facing`. Wall maths is now one pure function (`wallPosition` / `posterPosition`, tested for
  all four facings). A refused poster now logs `recipe poster removed (<reason>) at …`.
  **Not covered without the filter:** a wall removed by `/setblock`, `/fill`, fire or an enderman
  leaves the poster hanging.
- **Works in game 2026-10-22 (build `6a6b370`).** Three causes, fixed one by one with chat
  diagnostics (`DEBUG_POSTERS`): `allowed_faces: ["side"]` doesn't load in 1.26.50; the side-face
  placement filter removed the poster on its re-check; and rewriting a part's permutation with
  `BlockPermutation.resolve(getAllStates())` made the whole multi-block vanish. Each half now picks
  its texture from `minecraft:multi_block_part` + `minecraft:cardinal_direction`, and the script
  writes nothing after placing. `face` in `beforeOnPlayerPlace` is the poster's front. Still to
  check: the halves read left to right on all four walls, break/drop, sneak-cycling.

## B25. Kitchen Table (D16, untested)

**Closed 2026-10-23: the Kitchen Table was removed; the mix recipes moved to the vanilla crafting
table (`"tags": ["crafting_table"]`).** The notes below are kept for history.

`wm_kitchen:kitchen_table` is a full block with the stable `minecraft:crafting_table` component
(slice.md "Kitchen Table and mixes (D16)"). Checked offline: Microsoft Learn (released from
Holiday Creator Features in 1.19.50, not marked experimental), the 1.26.52.3 binary (component
name, `crafting_tags`, `table_name`, the "can't have both a container and a crafting_table"
error). Not seen in game:

- **What's assumed:**
  1. The block loads at format 1.26.50 with no experiment, and using it opens the 3×3 crafting
     screen titled with `table_name` ("Kitchen Table" from `tile.wm_kitchen:kitchen_table.name`).
  2. Recipes whose `tags` are only `["wm_kitchen_kitchen"]` craft there and nowhere else (not in the
     inventory grid, not on a vanilla crafting table); `crafting_table` recipes don't craft there.
  3. **The recipe book on that screen lists only the table's recipes** (the mixes). Microsoft
     Learn doesn't say; the vanilla stonecutter and smithing screens filter their own, and custom
     tables are reported to do the same.
  4. Each mix recipe appears in the book once its `unlock` item (its first Simmerfield crop) has been in
     the inventory; both chowder recipes (cod and salmon) show.
  5. The block's own item renders as a 3D cube in the hotbar and creative menu (Items), with the
     tile name.
- **Test:** `tests/round-4-kitchen-table.md` steps 3–8.
- **Fallbacks:** (2) a mix crafts in the inventory grid → the tag isn't honoured; check the
  Content Log for the recipe, keep the tag lowercase without a colon (it is). (3) the book shows
  every recipe → nothing breaks (kitchen recipes still only craft there); posters already show
  what each mix needs, so accept it and note it in the store text. (5) a flat icon is wanted →
  a same-id item with `replace_block_item`, as the pot (B3).

## B26. Batch cooking and the mix hint (D16, untested)

- **What:** the pot holds 4 mixes and cooks every mix of the chosen dish at once (`job.servings`);
  the result can be 4 soups (stack 1), handed out by `giveOrDrop` (hand, inventory, then dropped).
  A raw ingredient used on the pot shows its mixes as ghosts above that pot for 3 s, for that
  player only, also above an empty pot (which isn't in the engine's active list).
- **Test:** `tests/round-4-kitchen-table.md` steps 9–15.
- **Fallbacks:** if a batch feels wrong (too strong, or kids expect one soup), set `servingsOf` to
  1 in `startJob` (one line) and keep capacity 4 as a queue. If the hint row lingers over a broken
  pot, it ends in 3 s anyway; clear it in `spill` (it is) and on break.

## B27. Recipe poster page state (D17, untested)

- **What:** 19 posters don't fit one int state (16 values), so the index is `wm_kitchen:poster` (0–15)
  within `wm_kitchen:poster_page` (0–1). `beforeOnPlayerPlace` sets both in `permutationToPlace`; cycling
  sets both on each part with `setStates` (`withState`, the way that works, B24). The block JSON
  has 151 permutations with both states in every condition.
- **Test:** `tests/round-4-kitchen-table.md` steps 22–24: creative sneak + use walks all 18 dishes
  across the page boundary (Strawberry Cup → Strawberry Cake → Eggplant Salad), both halves always
  match.
- **Fallback:** if writing two states at once makes a part vanish, write them one tick apart; if
  the page state itself is the problem, cap the posters at 16 (drop the blank and two dishes).

## B28. Kitchen Guide book (D19, works in game 2026-10-24)

- **Works in game 2026-10-24** (owner, `tests/round-6-fast.uk.md` step 3–5): home, chapters, ribbons, dish and crop pages, What can I make?, "???" before discovery, Ukrainian text.

- **What:** `wm_kitchen:guide_book` opens a book of `ActionFormData` pages (`ui/guide-screen.ts`) through
  its item component's `onUse`/`onUseOn`. The pages use only a title, a body and icon buttons
  (B11). None of it has run in game yet. The pre-D14 `ActionFormData` book it's based on did open.
- **Test:**
  1. In a new world (or after `/wm_kitchen:debug reset` and a rejoin): chat shows the welcome, and the
     inventory has the Kitchen Guide (red book icon) and a Recipe Poster.
  2. Use the guide in the air and pointing at the ground: it opens once each time, on Home, with a
     page-turn sound. Using it on the pot counts as a pot click (`Can't cook Kitchen Guide`).
  3. How to Play: 14 topics with icons. Each topic's text has its line breaks, with no literal
     `%1$s`. `Next: …` walks to the last topic, and `Back` goes back a page.
  4. Survival, before finding crops: Hot and Cold Dishes show `???` rows. A `???` dish lists the
     crops it needs and where their seeds drop. Finding a tomato unlocks Tomato Soup.
  5. A dish page (Tomato Soup) has the effect and two steps in the body, then these buttons:
     - `2 × Tomato`: opens the Tomato page.
     - `1 × Bowl`: shows `A Minecraft item` in the action bar, and the page stays.
     - `Makes: Tomato Soup Mix`.
     - `Cooking Pot · ♨ fire · 5 s`: opens the Cooking Pot topic.
     - The effect, which shows its hint, then `Back`.

     Fish Chowder shows `Raw Cod / Raw Salmon`. Strawberry Cake mentions its slices.

  6. Creative: every dish, crop and cut shows. What can I make? lists dishes after
     `/wm_kitchen:debug kit`, and shows `Nothing yet…` with an empty inventory.
  7. A book + a carrot in the inventory grid make a Kitchen Guide. The Content Log has no
     `kitchen guide failed` error.
- **Fallbacks:**
  - If `onUse` never fires in the air, add `minecraft:use_modifiers` to the item JSON, as B12
    planned for the old book.
  - If a button label is blank, wrap it in `wm_kitchen.ui.text` like the item names.
  - If a long chapter scrolls badly on a phone, split Hot Dishes by effect family.
- **Update 2026-10-23 (D20):** the guide is now drawn by our JSON UI book (D20), and its first
  in-game look had no chapter names, the book icon on every row and ribbon, and no open ribbon.
  - **Cause:** every fixed-index cell (`collection_index`) sat in a plain `panel`. Vanilla nests
    explicit indexes only in a `stack_panel`, `grid` or `collection_panel`, so every cell read
    collection item 0 (the Home picture, label without text).
  - **Fix:** `tools/gen-guide-ui.mjs` puts every cell in one `collection_panel`. A test fails if an
    index sits anywhere else.
  - **Pages:** they are pure data now (`scripts/guide/guide-model.ts`), with a crop spread and a
    `tabOf()` rule for the open ribbon.
  - **Test:** steps 3–6 above are replaced by
    [`tests/round-5-guide-fx-decor.md`](tests/round-5-guide-fx-decor.md) steps 4–13.
  - **Fallback:** if the book still shows item 0 everywhere, use a `stack_panel` per row of cells
    (the choose_realm pattern) with padding panels for positions.

## B29. Pot and board effects (D21, works in game 2026-10-24)

- **Works in game 2026-10-24** (owner, `tests/round-6-fast.uk.md` step 6, 8): bubbles, spoon, lid with the fire out, one knife on the board.

- **What:** the pot liquid and rim use flipbook textures while cooking over heat
  (`tools/gen-pot-flipbook.mjs`, `flipbook_textures.json`). A `wm_kitchen:fx_spoon` entity stirs in a
  cooking pot, and a `wm_kitchen:fx_knife` entity chops on the board after each chop (`scripts/fx/`).
  **The lid is now off while cooking over heat** and on only while paused without heat.
  The board hides its resting knife while the effect knife chops (state `wm_kitchen:chopping`).
- **Assumed, not seen in game:**
  1. Flipbook shortnames animate in a custom block's `material_instances`. Source: Bedrock Wiki
     "Flipbook Textures", which uses a 1.26.50 block.
  2. Knife yaw per board facing (`FX_BOARD_YAW`): entity yaw 0 faces south, and the model front
     is −z. If east and west come out across the board, swap them.
  3. A 0×0 `minecraft:custom_hit_test` makes the effects unclickable. If clicks land on them, the
     station behind won't react.
  4. `entityLoad` fires for effects saved with a chunk, and the start-up cleanup covers `/reload`.
  5. The board can blink for one frame at pick-up: the state change and the spawn share a tick.
  6. The board gets random ticks without extra JSON, as the pot does. If it doesn't, the check on
     every use still restores a stuck knife.
- **Not saved on purpose:** stable has no "don't save" flag. The effects have no spawn rules and
  despawn by distance and by timer. The script removes them on world load and entity load, and
  removes any effect it didn't spawn itself the next tick. Caps: `FX_CAPS` in
  `scripts/fx/fx-config.ts`.
- **Seen in game (2026-10-23):** with `is_summonable: false`, every spoon spawn failed with
  `'wm_kitchen:fx_spoon' is not summonable`. The flag also blocks the script's own `spawnEntity`, not
  only `/summon`, so both effects are summonable now; a `/summon` one is removed the next tick.
- **Test:** [`tests/round-5-guide-fx-decor.md`](tests/round-5-guide-fx-decor.md) steps 14–28.

## B30. Kitchen decor blocks (D22, works in game 2026-10-24)

- **Works in game 2026-10-24** (owner, `tests/round-6-fast.uk.md` step 9): decor blocks face the player, the pan hangs, the jar stands on a counter.

- **What:** 8 decorative blocks (counter, cabinet, spice shelf, sink, stove, hanging pan, jar of
  pickles, vegetable basket), no scripts. Recipes: `recipes-cheatsheet.md` "Kitchen decor".
- **Assumed, not seen in game:**
  1. **Facing:** `y_rotation_offset: 180` turns a north-built front toward the player (Bedrock
     Wiki "N-Way Rotation"). If all eight face away, set it to 0, one line per block. The cutting
     board has no offset (B9). Whichever of the two is wrong in game, fix the other to match.
  2. **Hanging Pan:** `allowed_faces: ["down"]` means "on the underside of a block". If it pops
     right after placing, as the poster's side filter did (B24), drop the filter.
  3. The facing transformation also turns the collision and selection boxes (the shallow cabinet
     and shelf).
- **Known:**
  - The sink's tap rises 4 px into the block above it.
  - The stove heats a pot only while lit (`wm_kitchen:lit`, toggled by using it, `stations/stove.ts`).
    Assumed: like a furnace, a click without sneaking switches the stove rather than placing the
    held block, so the pot goes on with sneak.
- **Test:** [`tests/round-5-guide-fx-decor.md`](tests/round-5-guide-fx-decor.md) steps 29–38.

## B31. One action per press: the stove and the pot's choice form (audit 2026-10-23, works in game 2026-10-24)

- **Works in game 2026-10-24** (owner, `tests/round-6-fast.uk.md` step 7, 10): one choice form per press, the stove switches once while held.

- **What:** block component events have no `isFirstEvent` (B13). If the game repeats
  `onPlayerInteract` while use is held, every repeat would switch the stove again, so it flickers
  on and off. On the pot, repeats that arrive before the choice form is up would each ask for
  another form, which the game refuses with a `Close chat, then try again.` line.
- **Applied:** `PressGate` (`scripts/lib/tick-gate.ts:32`) treats attempts less than 8 ticks apart
  as one press. It's used in `stations/stove.ts:40` (`STOVE_PRESS_GAP_TICKS`) and
  `ui/pot-screen.ts:50` (`POT_FORM_PRESS_GAP_TICKS`). Tests: "press gate" in
  `tests/tick-gate.test.ts`.
- **Why it can't be settled offline:** whether the game repeats component interactions at all,
  and how fast. If it doesn't, the gate is harmless.
- **Test:** [`tests/round-6-release.md`](tests/round-6-release.md) steps 15 and 23.
- **Fallback:** if a deliberate fast double-click on the stove is swallowed and that feels wrong,
  lower the gap to 5.
- **Decide:** B13's "switch the cake to a debounce" is now one line: use `PressGate` in
  `food/sliced-dish.ts` instead of `TickGate`.

## B32. Station sweep cost with many pots (CR11, partly tested 2026-10-24)

- **Partly tested 2026-10-24** (owner, `tests/round-6-fast.uk.md` step 13): 16 pots cooked on time with no visible lag or watchdog lines. The full 32 pots + 400 crops (round 6 part G) has not run.

- **What:** every 10 ticks, the sweep (`stations/station-engine.ts:379` `sweepOne`) does this for
  each tracked station, meaning any pot with contents, forgotten leftovers and uncollected dishes
  included:
  - one `getDynamicProperty` and a `JSON.parse`;
  - `getBlock`, the block below and `getAllStates`;
  - `possibleRecipes` twice (phase and liquid colour).

  A cooking pot also writes its JSON back (`save`, `:133`) and calls `fxStir`. The ghost update
  (every 10 ticks) filters every tracked pot by distance for each player, but reads state only for
  pots within 6 blocks.

- **Why not changed now:** for 30 pots it's a few hundred cheap calls a second. A cache of the
  parsed state is a correctness risk (it must be invalidated on every write path), so it should
  wait for a measurement.
- **Test:** [`tests/round-6-release.md`](tests/round-6-release.md) steps 28–35: the 10 s cook of
  32 pots must take about 10 s, with no watchdog warnings in the Content Log.
- **Fallback if it lags:** cache the parsed state in `tracked` (set in `save`, dropped in
  `spill`, `clearStation` and `resetPlaced`), and refresh stations that aren't cooking only every
  4th sweep. Heat changes from players already arrive through `refreshAbove`.
- **Decide:** after the stress run, whether this ships before the release or waits for a report.
- **2026-10-24 (round 7 review):** the sweep now hands the station block it already read to
  `refreshVisuals` and `save`, so each tracked station costs one `getBlock` per sweep instead of
  two (three for a cooking pot). No state is cached, so nothing needs invalidating. The parsed
  state cache above is still open.

## B33. Poster drops when one explosion breaks a row of posters (audit 2026-10-23, untested)

- **What:** `dropOnce` (`posters/poster.ts:208`) drops one poster per break and marks the broken
  part and its 4 horizontal neighbours for 2 ticks, so the other part's event doesn't drop a
  second one. If one explosion breaks 3 or more posters hanging side by side, a part of the next
  poster can land inside a mark, depending on the order of the events, and that poster drops
  nothing. One poster is lost; nothing is duplicated.
- **Why not fixed:** the clean fix marks only the other part of the same poster. At break time the
  block is already air, and the code deliberately doesn't assume which side the second part lands
  on (B24).
- **Test:** hang 3 posters side by side on one wall in survival and blow the wall up with TNT.
  Count the posters dropped: 3 is right, and 2 means this happened.
- **Fallback:** mark only the neighbours along the wall, using the facing from
  `brokenBlockPermutation`'s `wm_kitchen:facing`, or accept it as rare.
- **Decide:** fix it or accept it.

## B34. Adding the add-on to an existing world, and removing it (works in game 2026-10-24)

- **Works in game 2026-10-24** (owner, `tests/round-6-fast.uk.md` step 16–18): the world loads with the add-on added, removed and re-added.
- **What removal does (owner, 2026-10-24):** Simmerfield blocks turn into unknown blocks (dirt with
  a question mark) and Simmerfield items turn into vanilla items. Re-adding the add-on restores the
  blocks: the waiting dish can be collected and the cooking pot finishes. Whether the converted
  items come back too wasn't reported. The store pages say only what was seen, and tell players to
  back up first.

- **What:** this is expected but hasn't been seen.
  - **Adding:** no experiment is needed. Each player gets the welcome, a Recipe Poster and the
    Kitchen Guide on their next join, once each (player properties). Grass in old chunks starts
    dropping seeds.
  - **Removing:** the world should still load. Bedrock usually shows blocks from a missing pack as
    unknown blocks and keeps them. Simmerfield items and the effect entities are probably dropped by the
    game. The dynamic properties (station contents, discovery) stay in the save, unread.
  - **Re-adding:** blocks the game kept come back with their saved contents. If a pot's position
    now holds another block (it was broken while the pack was missing, which drops nothing), the
    sweep spills the saved contents there. The contents come back once, not twice.
- **Why it can't be settled offline:** how the game treats missing blocks, items and entities
  isn't in the Script API docs.
- **Test:** [`tests/round-6-release.md`](tests/round-6-release.md) steps 51–54.
- **Fallback:** none in code unless the world fails to load. If Simmerfield items vanish on removal, say so
  in the store text and the README ("removing the add-on deletes its items and blocks").
- **Decide:** the store text wording, after the test.

## B35. Effect caps in a big kitchen (by design, untested)

- **What:** `FX_CAPS` (`fx/fx-config.ts:27`) allows 4 spoons and 4 knives per 16 × 16 area (6
  effects of both kinds), and 32 in the world. In a kitchen with 6 pots cooking in one area, 2 of
  them cook with no spoon. The bubbling flipbook still shows. A pot without a spoon asks again
  every 40 ticks.
- **Why:** the caps keep entity counts bounded on phones. They weren't measured.
- **Test:** [`tests/round-6-release.md`](tests/round-6-release.md) step 30.
- **Fallback:** raise `perAreaKind.spoon` (and `perArea`) to 8 if the frame rate holds.
- **Decide:** whether a pot without a spoon reads as a bug in a big kitchen.

## B36. Two players (LAN), untested

- **What the code assumes:**
  - Discovery, the Kitchen Guide, the starter items and poster cycling are per player
    (player dynamic properties).
  - Ghosts are per-player particles (`Player.spawnParticle`), so each player sees their own row,
    facing them.
  - Spoons, knives, block states, the stove and `✔ … is ready!` (players within 8 blocks) are
    shared.
  - Every station change is a synchronous read-modify-write, and form taps re-validate. Nothing
    in code has run with two players yet.
- **Test:** [`tests/round-6-release.md`](tests/round-6-release.md) steps 40–50.
- **Fallback:** depends on the finding. A duplicated or lost item is a release blocker.
- **Decide:** which second client to use for future multiplayer checks (phone, or a second launcher
  instance).

## B37. Cooking after `/reload` relies on `worldLoad` firing again (review 2026-10-24, works in game 2026-10-24)

- **Works in game 2026-10-24** (owner, `tests/round-6-fast.uk.md` step 11): cooking continues after `/reload` and after leaving and re-entering, so the proposed fix is not needed.

- **What:** the station sweep starts only from `world.afterEvents.worldLoad` (`main.ts` →
  `startStationSweep` in `stations/station-engine.ts`). That one call re-reads the saved
  stations, the fast flag, and starts the sweep and the ghost interval. The pinned 2.10.0 `.d.ts`
  documents `worldLoad` with no text at all, so whether it fires again after `/reload` (the world
  is already loaded then) isn't written anywhere. `fx/fx.ts` already hedges for this with a
  first-tick `system.run` cleanup. The sweep doesn't.
- **If it doesn't fire:** after `/reload`, nothing cooks, no ghosts show and no spoon stirs until
  the world is left and re-entered. The saved contents are safe; only the timer stops. `/reload`
  needs an operator, so this hits test sessions and servers, not normal play.
- **Test:** [`tests/round-6-release.md`](tests/round-6-release.md) section F: start a cook, run
  `/reload`, and the dish must finish. `/wm_kitchen:debug pot` must show the job's ticks counting
  down.
- **Proposed fix if it fails:** make `startStationSweep` idempotent: always merge
  `findSavedStations()` into `tracked` and re-read the fast flag, but start the interval and
  `startGhosts` only once (a module flag). Then also call it from a top-level `system.run` in
  `main.ts`, inside `try` like `registerFx` does. Every call order is then safe. If the
  first-tick call runs before the world is ready, it throws and `worldLoad` does the work. If it
  finds nothing, the later `worldLoad` call still merges the saved stations.
- **Decision (2026-10-24):** not applied blind. If `worldLoad` does fire after `/reload`, which
  is likely, this would only add a second code path.

## B38. A pot blown up by TNT: do its contents survive? (review 2026-10-24, works in game 2026-10-24)

- **Works in game 2026-10-24** (owner, `tests/round-6-fast.uk.md` step 12): all 4 mixes survive TNT next to the pot, so the proposed fix is not needed.

- **What:** a pot destroyed by an explosion spills from `onBreak` (`stations/container-station.ts`
  → `spill`). The saved state is cleared first, and then the items are dropped right away, inside
  the break callback. If the engine damages item entities **after** it has broken the blocks,
  those freshly dropped mixes and dishes are destroyed by the same explosion, so a TNT next to a
  full pot loses its contents. Vanilla chests drop their items after the entity damage, so they
  survive. Our callback's place in that order isn't documented.
- **Test:** put 4 mixes in a pot, or let one finish and leave the dish in it. Light TNT next to
  it, in survival. Count the items on the ground: everything should be there, though some may be
  thrown a few blocks.
- **Proposed fix if they vanish:** in `onBreak` only (a player break has no explosion), clear the
  state at once and drop the items on the next tick (`system.run`). Keep the clear-first order,
  so nothing can be taken twice.
- **Decision (2026-10-24):** not changed. Deferring the drop changes the normal break path, so it
  shouldn't change without a test that shows the problem.

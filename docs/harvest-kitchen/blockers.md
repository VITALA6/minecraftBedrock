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
- **Test:** check the hotbar icon and name of all three, and that the creative menu (Items tab)
  shows each exactly once.
- **If something's wrong:**
  - If an entry is **missing** from the creative menu, set the item's category back to `items`
    (one line in each of `behavior/items/{cooking_pot,cutting_board,strawberry_cake}.json`) and
    update the test.
  - If the replacement is rejected (Content Log: "Cannot replace the block item"), the fallback is
    separate item ids (`hk:cooking_pot_item`, …) with plain `block_placer`. The block then needs
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

- **What:** the liquid now follows the contents (`hk:liquid`, 7 colours; rule in `liquidOf`,
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
- **Test:** the world-load line reads `data check: 0 problem(s)`, and `/hk:debug validate` says the
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

- **What:** the Prev button is `◀ Prev` (lang `hk.book.prev`). S2 checked `▶` on the vanilla glyph
  pages but not `◀`.
- **Test:** the book's first button shows a left triangle, not a box or nothing.
- **Fallback:** change the lang line to `< Prev` (no code change).

## B20. Long button lists in a CustomForm (untested)

> **Obsolete (D15, 2026-10-22):** the recipe book is gone (recipe posters replace it), so there's nothing left to test here.

- **What:** "What can I make?" lists every dish you can make right now (up to 13), and a full pot
  screen can have up to 7 Cook or 8 Take-out buttons. Under a large image, the buttons may need
  scrolling, which is awkward on a phone.
- **Test:** `/hk:debug kit`, open the book → What can I make?. Do all the dishes show, can you
  scroll to the last one, and does Close stay reachable?
- **Fallback:** cap the list (e.g. the first 6) or put the What page's image at `width: 0.5`.

## B21. Page textures loaded only by path (untested)

> **Obsolete (D15, 2026-10-22):** the recipe book is gone (recipe posters replace it), so there's nothing left to test here.

- **What:** `textures/hk/book/*.png` and `textures/hk/pot/*.png` (310 files, 1 MiB) aren't listed
  in any texture JSON. `image()` loads them by path from our RP, which is how S1 loaded
  `textures/hk/items/tomato.png`. That file is also in `item_texture.json`, though.
- **Test:** the first book page shows. If it's blank while the S1-style item texture works, the
  path isn't the cause; check the Content Log for a texture error.
- **Fallback:** none needed if it shows. If a load-time or memory cost shows up with 310 images,
  drop the cold pot variants (the label already says "Needs fire below"): 124 fewer images.

## B22. Ghost ingredient particles (D15, untested)

- **What:** the ghosts above the pot are custom particles (`resource/particles/hk/ghost_*.json`,
  written by `tools/gen-ghost-atlas.mjs`) spawned per player every 0.5 s with
  `Player.spawnParticle`. Offline only: the JSON follows the 1.26.52.3 vanilla particle files
  and every API is in the pinned `.d.ts`. Not seen in game:
  (a) `format_version` `1.26.50` with plain-string Molang (vanilla's 1.26.50 particles wrap
  expressions as `{ "expression", "version": 12 }`; its 1.26.10 ones use plain strings);
  (b) particle files load from the `particles/hk/` subfolder;
  (c) `variable.hk_icon/hk_alpha/hk_phase` from `MolangVariableMap.setFloat` reach the
  billboard UV, tint and parametric motion, and the `v.x = v.x ?? 0` defaults log nothing;
  (d) `particles_blend` + tint alpha 0.65 looks see-through, and the billboard `size` is a
  half-size (icons ≈ 0.36 blocks wide);
  (e) the 0.6 s lifetime re-spawned every 0.5 s looks continuous (no flicker, no doubled
  brightness), and the bob doesn't jump at re-spawn;
  (f) cost on a phone with 2 pots × 4 ghosts.
- **Test:** slice.md "In-game checks for D15", steps 2–4 and 9.
- **Fallbacks:** (a) set `FORMAT_VERSION` in the generator to `"1.10.0"` (the long-standing
  format, still shipped by vanilla); (b) move the files to `particles/` with `hk_` prefixes;
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

`hk:recipe_poster` is a 2×1 wall multi-block (slice.md "Recipe posters (D15)"). Written offline;
nothing below has been seen in game.

- **What's assumed:**
  1. The stable `minecraft:multi_block` trait with a horizontal `direction` loads at block format
     1.26.50 without an experiment, places both parts and breaks both (Microsoft Learn says so;
     no vanilla block uses it).
  2. With `placement_direction` (`cardinal_direction`, `y_rotation_offset` 90) the second part
     goes **along the wall**. If it goes into or out of the wall, every placement is refused with
     `Look straight at the wall` and the Content Log has `recipe poster parts … aren't side by
side`. Which side it goes to doesn't matter: the script sets `hk:right` from the real
     positions (`Block.getParts()`).
  3. `beforeOnPlayerPlace` runs for a `block_placer` item, `face` is the clicked face (the poster
     faces that way), and a replaced `permutationToPlace` (with `hk:facing`, `hk:right`,
     `hk:poster`) is what gets placed, and is copied to the second part. If it isn't copied, the
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
  10. The `hk:crops` tag works as a shapeless ingredient (the old `hk:seeds` book recipe was the
      precedent and was itself untested).
- **Test** (re-enter the world after deploying; Content Log file on):
  1. Content Log: no errors for `hk:recipe_poster`, its recipe or textures.
  2. `/hk:debug reset`, empty inventory, pick up a tomato → `★ You got a Recipe Poster!` and one
     poster; a second HK item gives no second poster.
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
  7. `/hk:debug reset` (nothing found), sneak + use: `Break grass to find seeds`, the poster
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

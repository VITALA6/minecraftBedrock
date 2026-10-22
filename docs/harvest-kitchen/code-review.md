# Harvest Kitchen: code review (portfolio slice)

Reviewed 2026-10-22 against commit `3d40572` (branch `harvest-kitchen-mvp`). Fixes were applied
on top of `390abeb`; each finding's **Status** line says what changed. A refactor was moving pure
logic into `*-logic.ts` modules while this was written, so each finding names the **function**
as well as the `file:line` at `3d40572`. In the new layout the station rules live in
`stations/station-logic.ts`, and `station-engine.ts` keeps the world-facing side.

Scope: all of `packs/harvest_kitchen/` (scripts, BP and RP JSON), checked against plan §2, §3 and
§5, `slice.md` and `blockers.md`. APIs were checked in `@minecraft/server` 2.10.0 and
`@minecraft/server-ui` 2.2.0 `index.d.ts`. Vanilla 1.26.52.3 brarchives and `libminecraftpe.so`
strings were used as evidence.

**Labels:** **clear-fix** means it's safe to apply without an in-game run. **needs-game** means only
a test can decide it.

## Summary

| Severity | Count | Ids                          |
| -------- | ----- | ---------------------------- |
| critical | 0     |                              |
| major    | 2     | CR1, CR2                     |
| minor    | 6     | CR3, CR4, CR5, CR6, CR7, CR8 |
| nit      | 4     | CR9, CR10, CR11, CR12        |

No item duplication was found. Every hand-out in the code goes through `giveOrDrop`, which drops
whatever doesn't fit. There are three exceptions:

- CR6: an exception partway through a hand-out loop loses the rest of the items.
- CR1: if the farmland dries out, the crop pops.
- The cake drops nothing when broken. Vanilla cake does the same, so this isn't counted as a finding.

## Major

### CR1. Dry farmland may revert to dirt under our crops, which then pop (needs-game)

**Status: open → B10.**

- **Where:** `behavior/blocks/{tomato,onion,cucumber}_crop.json:66-70` (`minecraft:placement_filter`
  with `block_filter: ["minecraft:farmland"]`); `crops/crop-growth.ts:72` `isDryFarmland`.
- **Scenario:** a player plants tomatoes on farmland that isn't next to water. Vanilla farmland with
  moisture 0 turns back to dirt on a random tick unless a crop sits on it.
  - Vanilla only knows its own crop blocks. The binary has a `crop_block` block archetype, which
    custom blocks can't use.
  - If our crops don't count, the farmland reverts. The placement filter then pops the crop, which
    drops seeds from the young loot table.
  - The "half speed on dry farmland" rule (`dry_multiplier`) assumes dry farmland stays. The test
    plan (`tests/portfolio-slice.md` step 19) only plants next to water, so this case is untested.
- **Test:** plant one tomato on farmland far from water, with no rain. Run
  `/gamerule randomtickspeed 200`, wait about 30 s, then reset the gamerule to 1.
- **Fallback if it reverts:** add `minecraft:dirt` to the crops' `block_filter` so they survive, and
  in `onRandomTick` turn dirt under a crop back into dry farmland (`moisturized_amount` 0). The
  cost is that trampling no longer pops the crop (step 22 of the test plan). The cheaper option is
  to accept the behaviour and say "needs water" in the book's crop page.

### CR2. The recipe book may not open while the player looks at a block (half clear-fix, half needs-game)

**Status: fixed 2026-10-22** (`book/book-item.ts`: `onUseOn` + per-player `TickGate`, test `tests/tick-gate.test.ts`). In-game check → B12.

- **Where:** `book/book-item.ts:8` `recipeBook.onUse`.
- **Scenario:** a child holds the book and taps use while looking at the ground, which is the
  normal pose. `onUse` is documented as "used by a player". `onUseOn` is the separate hook for "used
  on a block", and the book doesn't implement it.
  - Items with a vanilla use action (food, snowballs) fall back to "use" when the target block does
    nothing. Whether a custom item with **no** use component does the same is unproven. This is
    slice.md untested assumption #8, made worse by the block-target case.
  - The book is the whole onboarding (§2.7: "here's a recipe book"), so a book that only opens when
    pointed at the sky fails the playtest.
- **Fix (clear-fix):** add `onUseOn({ source })` to the same component. It opens the book through the
  same `system.run`, with a per-player guard (`lastOpenTick` map, skip if same tick) so a click
  that fires both hooks opens one book. Interactable blocks (pot, board, crops, chests) still win
  over the item, so nothing else changes.
- **Test (needs-game):** use the book in the air, on grass, and on the pot. If `onUse` never fires
  in the air either, add `minecraft:use_modifiers` to the book JSON and re-test.

## Minor

### CR3. Pot screen reopens almost empty after the last ingredient comes out (clear-fix)

**Status: fixed 2026-10-22** (`showsScreen` in `stations/station-logic.ts`, used by `ui/pot-screen.ts` `show`; tests "the pot screen (CR3)" in `tests/station-logic.test.ts`).

- **Where:** `ui/pot-screen.ts:28-77` `show` loop. In the new layout this is the "reopen" branch.
- **Scenario:** the pot holds one tomato. A player taps "In the pot ×1 Tomato", and `takeOut`
  returns true, so the loop reopens. The new screen has no Cook, no Almost and no In-the-pot
  section, only the Recipe Book button.
  - §2.3 says an idle, empty pot gets `Add ingredients` and **no form**.
- **Fix:** at the top of each loop iteration, after `readStation`, return when the pot has no items
  (`totalItems(state) === 0`). Optionally show `hk.station.add_hint` first.

### CR4. Discovery and the book hand-out miss items already in the inventory (clear-fix)

**Status: fixed 2026-10-22** on initial spawn (`catchUpDiscovery` in `book/discovery.ts`, called from `main.ts`; pure `inventoryDiscovery` in `book/unlock.ts`, tests in `tests/unlock.test.ts`). Not called after `/hk:debug reset`: re-finding the carried items there would defeat the retest. Empty the inventory, or move an item to a new slot, to retest.

- **Where:** `book/discovery.ts:135` `registerDiscovery` and `:127` `giveBookOnce`.
- **Scenario:** the listener only sees slot changes, with `ignoreQuantityChange: true`.
  - After `/hk:debug reset`, the tester still holds tomatoes. Picking up more tomatoes only
    changes a quantity, so no event fires. The book isn't handed out again and the crop isn't
    re-found until the item moves to another slot, so the test looks broken.
  - The same gap hits any player whose `hk:found` or `hk:book_given` property is missing while
    they already carry HK items. Examples: a world that already had HK items before an update, or a
    property reset.
- **Fix:** add a `scanInventory(player)` that runs `countInventory`, then `markFound` for every crop
  key it finds and `giveBookOnce` if any `hk:` item is present.
  - Call it from `playerSpawn` (initial spawn), next to `announceProblems` in `main.ts`.
  - Call it at the end of the debug `reset` action, so the hand-out can be retested by dropping and
    picking up an item.

### CR5. ActionForm `selection` vs `header()`/`divider()` rows (needs-game)

**Status: open → B11.**

- **Where:** `ui/menu.ts:56` `Menu.show` (`this.actions[response.selection]`). The pot screen uses
  `header` ×3 and `divider`, and every book page uses `divider` before Back.
- **Scenario:** `Menu` assumes `selection` counts buttons only. The `.d.ts` says "index of the
  button that was pushed", and S1 tested icon buttons but not headers.
  - If the game counted header and divider rows, every pot-screen tap would run the wrong action:
    "Cook Tomato Soup" would take out an ingredient, for example.
- **Test:** pot with 2 tomatoes, 1 onion and 1 bowl. Tap the **second** ingredient button and check
  that the onion comes out.
- **Fallback:** if the index includes non-button rows, `Menu` also pushes `undefined` for each
  header and divider so the indices line up.

### CR6. Clear-then-give loops lose the remaining items if one hand-out throws (clear-fix)

**Status: fixed 2026-10-22** (`returnItems` in `stations/station-engine.ts`, around every hand-out in `collect`, `takeOut`, `takeAll`, `spill`). Game-facing, no unit test. The `parseItems` filter wasn't added.

- **Where:** `stations/station-engine.ts:328` `spill`, `:311` `takeAll`, `:291` `takeOut`, `:281`
  `collect`; `lib/inventory.ts:55` `dropItems`, `:66` `giveOrDrop`.
- **Scenario:** saved state is cleared first, which is correct because it prevents duplication.
  Then each entry goes through `new ItemStack(id)` and `spawnItem` or `addItem`.
  - If one id doesn't resolve, the loop throws and every later entry is lost, along with the rest
    of the `onPlayerBreak` callback. That happens when a later version removes an HK item that old
    worlds still hold in a pot, or when Mojang renames a vanilla id, as it did with `grass` →
    `short_grass`.
- **Fix:** wrap each entry's drop or give in its own `try`, and on failure log
  `[harvest_kitchen] couldn't return <n>× <id>: <error>`. Keep the clear-first order.
  - Optionally have `parseItems` in `station-store` drop ids for which `ItemTypes.get` returns
    undefined, with a warning.

### CR7. Holding the use button may eat the whole cake (needs-game)

**Status: throttle applied 2026-10-22** (`food/sliced-dish.ts`, `SLICE_BITE_GAP_TICKS` 10; test `tests/tick-gate.test.ts`). Single taps are unchanged. Hold behaviour still open → B13.

- **Where:** `food/sliced-dish.ts:17` `slicedDish.onPlayerInteract`. The same applies, with milder
  effects, to `container-station` `onPlayerInteract` (it adds one per repeat) and
  `crop-growth` `onPlayerInteract`.
- **Scenario:** component events have no `isFirstEvent`. If the engine repeats block interaction
  while use is held, a child holding the button eats 4 slices in under a second. That breaks
  "friends can share it".
- **Test:** hold use on a placed cake for 2 s and count the slices eaten.
- **Fallback:** keep a per-player last-bite tick in `sliced-dish.ts` and ignore bites within about 10
  ticks. This is safe to add even without testing, because it only throttles.

### CR8. Sneak-chop continues after the player stops sneaking, turning the whole stack into slices (needs-game, UX)

**Status: open → B14** (an S6 decision).

- **Where:** `stations/cutting-board.ts:84` `startChopping` (the interval's `keepGoing`).
- **Scenario:** one accidental sneak-tap with 64 tomatoes chops all 64 over about 19 s. That
  happens even if the player stands up and turns away, as long as they stay within 4 blocks.
  - Sliced tomatoes can't go into the pot and can't be planted, so the conversion can't be undone
    and starves pot recipes.
  - This matches §2.5 as written ("chops the whole held stack"). S6 is meant to judge the feel.
- **Option:** add `player.isSneaking &&` to `keepGoing`, so releasing sneak stops the chopping. Decide
  in S6.

## Nit

### CR9. Heat-refresh listener runs on every block interaction in the world (clear-fix)

**Status: fixed 2026-10-22** (`registerStationEvents` in `stations/container-station.ts`).

- **Where:** `stations/container-station.ts:160-162` (`world.afterEvents.playerInteractWithBlock`
  in `registerStationEvents`).
- **Scenario:** every right-click on any block schedules a `runTimeout` that runs two `getBlock`
  calls, including the hold-repeat events, about 5 per second per player.
- **Fix:** destructure `isFirstEvent` and return when it's false. Keeping the "+2 above" check
  matters, because fire lit on netherrack is two below the pot.

### CR10. "Cooking without heat" feedback differs from the spec (clear-fix)

**Status: fixed 2026-10-22** (`showProgress` in `stations/station-engine.ts` calls `noHeat`).

- **Where:** `stations/station-engine.ts:200-211` `showProgress`.
- **Scenario:** using a paused pot plays `bubble.pop` and shows `Needs fire below`. §2.2 says no heat
  gives a fizz plus grey smoke.
- **Fix:** in the no-heat branch, call `noHeat(player, ref)` instead of playing the bubble sound.

### CR11. The sweep re-parses every tracked station each 10 ticks (clear-fix, later)

**Status: open, deferred to M4** (the 200-pot measurement).

- **Where:** `stations/station-engine.ts:387` `sweepOne`.
- **Scenario:** stations that are idle with leftovers, ready, or done stay tracked forever. Each
  sweep does `getDynamicProperty`, then `JSON.parse`, `getBlock`, `below` and `getAllStates`. A
  base with 200 pots each holding a forgotten bowl does 400 parses a second for nothing.
- **Fix (M4, with the 200-pot measurement):** cache the parsed state in `tracked` (set in `save`,
  dropped in `spill`, `clearStation` and `resetPlaced`), and refresh non-cooking stations every
  Nth sweep. Not needed for the slice.

### CR12. Cake and pot can float (needs-game)

**Status: cake fixed 2026-10-22, in-game check → B15** (`placement_filter` `allowed_faces: ["up"]`
and `movable: popped` in `strawberry_cake.json`, plus the script safety net
`food/dish-support.ts`; tests "strawberry cake support (B15)" in `tests/pack-files.test.ts`). The
pot is unchanged, as recommended below.

- **Where:** `behavior/blocks/strawberry_cake.json`, `cooking_pot.json` (no
  `minecraft:placement_filter`).
- **Scenario:** placed against a wall face, the cake sits in mid-air and stays when the block
  under it is removed. Vanilla cake needs support and pops without it.
- **Option:** add `placement_filter` `{ "allowed_faces": ["up"] }` to the cake.
  - Check in game that popping fires `onBreak`. For the pot it matters, because a pot that pops
    without `onBreak` is only spilled by the sweep, and only if it had contents.
  - Leave the pot alone unless the art review asks for it.

## B2. Sneak + use through `beforeEvents.playerInteractWithBlock`

**Status:** re-checked after the refactor (both paths now go through `handleUse` → `routeUse`): the assessment holds. In-game check → B2.

**Assessment: likely works as designed; the residual risk is eating, not double-firing.**

- **Does it fire?** In 2.x this before-event replaced `itemUseOn`, so it covers "use item on block".
  Its `itemStack` is documented as "undefined if empty hand", so it also fires empty-handed. All
  four cases should reach it: sneak with an ingredient, sneak with an empty hand, sneak on the board
  with a crop, and sneak with dirt.
- **Does cancel break other blocks?** No. Both subscribers return unless the block is ours and the
  narrow predicate holds:
  - the pot: sneaking with an empty hand or with a pot ingredient (`sneakHandles`);
  - the board: sneaking with something that has a `CUTTING_RECIPES` entry.
  - Sneak + dirt next to a pot isn't cancelled, so it places dirt.
  - None of the cancelled items can be placed on a pot or board face. Onion, carrot and potato only
    plant on farmland. So no client-side ghost blocks are expected.
- **`isFirstEvent`:** documented as true on the initial press and false on hold repeats. Repeats
  are cancelled too, so vanilla can't act on them, but they don't schedule work.
- **Double fire:** the components skip exactly the same predicate. It's evaluated in the same tick
  on the same held item (`getHeldItem` vs `itemStack`). So the action runs once, whether or not
  `cancel` also suppresses `onPlayerInteract`.
- **Residual risks (needs-game):**
  1. **Food ingredients.** Tomato, strawberry, onion, carrot, bread, beef and others are food.
     Cancelling the use-on might fall through to the item's own use, so the player starts eating
     while sneaking at the pot or board. For the pot it's harmless: the stack is consumed at once.
     For sneak-chop, the eat timer races the chop interval. Watch for the eat animation in the
     test.
  2. If the before-event doesn't fire for sneak with an empty hand, sneak-take-all silently does
     nothing, because the component skips it. Test with an empty hand specifically.
- **Fallback if sneak can't work:** drop the sneak gestures for hold-to-repeat. Use the non-first
  before-events, or the component's repeats if the engine repeats.
  - Holding use with a stack keeps adding to the pot, or keeps chopping on the board.
  - Take-all becomes a "Take all out" button at the bottom of the pot screen's In-the-pot section
    (§2.4 currently rules that out).

## B3. Same-id item with `block_placer` + `replace_block_item` + `minecraft:icon`

**Status:** fallback 1 (item `menu_category: none`, vanilla pattern) applied 2026-10-22, tested by `tests/pack-files.test.ts` "same-id placer items". In-game check → B3.

**Assessment: valid for 1.26.x and matches what vanilla does. The open question is the creative
menu, not the icon.**

- **Evidence from the binary:** the 1.26.52.3 `libminecraftpe.so` has the key `replace_block_item`
  and the error `"minecraft:block_placer": Item identifier %s does not match the block identifier
%s. Cannot replace the block item.` So the engine supports it and requires the same identifier,
  which we have.
- **Evidence from vanilla:** the 1.26.50 `items.brarchive` is in the binary MCB format. It holds
  exactly two `block_placer` items, `minecraft:red_shrub` and `minecraft:shelf_mushroom`.
  - Each has the **same id as its data-driven block** and a flat icon (`default: red_shrub`).
  - Their display names are `tile.<id>.name`, the same pattern as our `tile.hk:cooking_pot.name`.
  - Both have the same flag bytes `00 01 00` after the block id. That's consistent with
    `replace_block_item: true`, but the encoding is undocumented.
- **Difference from vanilla:** vanilla's item has `menu_category` **`none`** while its block has
  `nature`. Ours declares `items` on both block and item. That's the most likely cause of a
  duplicate creative entry, if one appears.
- **Test:** check hotbar icon, name and creative count for pot, board and cake. Search the Content
  Log for `Cannot replace the block item`.
- **Fallbacks, in order:**
  1. If the creative menu shows duplicates, copy vanilla: item `menu_category: none`, and the block
     keeps `items`. Re-test: if that hides it completely, revert.
  2. If the replacement is rejected, use separate placer ids (`hk:cooking_pot_item`, …) with plain
     `block_placer`. The block also needs an explicit `minecraft:loot` that drops the placer item.
     Without it the block drops its own auto-generated item with the 3D icon.
     - That changes saved and display ids, so decide before the first public build.
     - It also touches the `config.ts` `ITEM_*` constants, the recipe results, `icons.ts`, the
       debug kit and lang keys.

## B9. Model facing vs the `cardinal_direction` permutations

**Status:** not applied; the one-line fix and the test are in blockers.md B9.

**Assessment: the four rotations are consistent with vanilla. At worst they're off by one global
angle, fixed with one line.**

- **Evidence:** vanilla 1.26.50 `minecraft:shelf_mushroom` uses exactly our mapping.
  - north has no rotation, west is `[0, 90, 0]`, south `[0, 180, 0]`, east `[0, 270, 0]`
    (`blocks.brarchive`).
  - Since a rotation can't mirror, our permutations can't put different directions on different
    sides. Either all four are right or all four are off by the same angle.
- **The x-mirror:** this is the Bedrock exporter's normal coordinate conversion. The game renders what
  Blockbench shows. Geo x −7..−3 is the handle Blockbench shows at +x, so in the "north" state the
  board looks as it does in Blockbench's default view.
- **Unknown:** whether the trait stores the direction the player looks or its opposite. That only
  decides whether the handle tab (geo −z) points away from the player or toward them.
- **Fix if wrong:** add `"y_rotation_offset": 180` to the `minecraft:placement_direction` trait
  (`behavior/blocks/cutting_board.json:10-11`). Use 90 or 270 if it's a quarter turn.
  - The binary confirms the key is valid with `cardinal_direction` (error text
    `"y_rotation_offset" can only be used when "minecraft:cardinal_direction" … are enabled`).
  - No model or permutation edits are needed.
- **Test:** one placement facing north decides the offset. One more facing east confirms the
  rotation direction.
- **Cake:** it isn't rotated, so the quarter order is cosmetic.

## Checked and fine (so phase 2 doesn't re-check)

- **Early execution and privileges:**
  - Every top-level subscribe is `early-execution-allowed` in the `.d.ts`.
  - Commands and components register only in `startup`.
  - The before-event and command callbacks defer world changes with `system.run`.
  - `onPlayerInteract` isn't restricted: the scripting pack's ruby bank calls `container.setItem`
    there, and it works in game. So opening the pot form directly from it is fine.
  - Every form promise goes through `runForm`.
- **Multiplayer:**
  - Every station change is a synchronous read-modify-write.
  - `takeOut` and `startCooking` re-validate after the form.
  - A break during a deferred sneak action finds `refAt(block)` undefined.
  - A pot re-placed during a stale form starts empty (`onPlace`/`resetPlaced`), so `takeOut` says
    "changed".
  - No duplication path was found.
- **Chunk unload:**
  - `sweepOne` checks `isChunkLoaded` first.
  - `stationBlock` catches `getBlock` errors.
  - Cooking pauses while unloaded, like a vanilla furnace.
  - `findSavedStations` rebuilds the active list at `worldLoad`, and pots in unloaded chunks stay
    tracked until they load.
  - A pot removed without a break event is spilled by the sweep, or reset on re-place.
- **`/reload`:**
  - Intervals, `tracked`, `chopping` and `lastToast` are rebuilt from scratch.
  - The fast flag is re-read from the world property.
  - Jobs resume from the saved `ticks`.
- **JSON:**
  - Every material slot exists in its geometry, and every `bone_visibility` bone exists.
  - Every texture shortname resolves to a PNG.
  - Every lang key used in `scripts/` and every `display_name` value is in the RP `en_US.lang`, and
    no `hk.` key is unused.
  - The 6 crafting JSONs match `CRAFTING_RECIPES` exactly.
  - Permutation-level `minecraft:loot` and `transformation` follow vanilla (shelf mushroom).
  - Food items' `start_using`/`use_modifiers` follow vanilla's apple.
  - The pot is `immovable`, so pistons can't strand its data.

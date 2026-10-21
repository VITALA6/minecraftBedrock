# Harvest Kitchen — MVP vertical slice

Working title. Pack `packs/harvest_kitchen` (BP + RP + scripts), namespace placeholder `hk`.
Stable `@minecraft/server` 2.10.0 and `@minecraft/server-ui` 2.2.0 only, no experiments.

## What's implemented

| Feature         | How                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tomato seeds    | 10% chance when a player breaks short grass, tall grass, fern or large fern (not with shears, not in creative). Script: `crops/seed-drops.ts`.                                             |
| Planting        | `hk:tomato_seeds` has `minecraft:block_placer` with `use_on: farmland`. The crop's `minecraft:placement_filter` also pops it when the farmland goes (trampled to dirt, broken).            |
| Growth          | State `hk:growth` 0–3, one permutation per stage (texture, selection box, loot). Custom component `hk:crop_growth` grows on random ticks; needs light ≥ 9; half speed on dry farmland.     |
| Bone meal       | Same component, `onPlayerInteract`: +1 stage, consumed outside creative, particles + sound.                                                                                                |
| Harvest         | Stages 0–2 drop 1 seed. Stage 3 drops 2–4 tomatoes + 1–2 seeds (`loot_tables/hk/blocks/`).                                                                                                 |
| Cutting board   | Hold a tomato, use the board: 1 tomato → 2 sliced tomatoes (to inventory, or dropped on the board). Sound + particles. Faces the player when placed.                                       |
| Cooking pot     | Use with an item to add it (max 8 items, recipe ingredients only). Empty hand opens a form: contents, recipes you can cook now, other recipes with what's missing, "take out ingredients". |
| Cooking         | 3–8 s. Pot top switches to a "cooking" texture and gives off light 3 and steam. The dish goes to the cook if they're within 8 blocks, otherwise it drops on the pot.                       |
| Dishes          | Tomato Soup (6 food, Regeneration I 8 s), Garden Salad (5, Speed I 60 s), Stuffed Tomato ×2 (8, Absorption I 60 s). Soup and salad return the bowl. All three can be eaten when full.      |
| Crafting        | Cutting Board: stick + 2 planks in a row. Cooking Pot: `IBI` / `III` (iron, bowl). Both unlock in the recipe book on first tomato.                                                         |
| Placeholder art | 16×16 textures and three hand-written block models (`#` crop, board, pot). Generated, meant to be replaced.                                                                                |

Recipes:

| Dish              | Ingredients                                | Time |
| ----------------- | ------------------------------------------ | ---- |
| Tomato Soup       | 2 Tomato, 1 Bowl                           | 5 s  |
| Garden Salad      | 2 Sliced Tomato, 1 Carrot, 1 Bowl          | 3 s  |
| Stuffed Tomato ×2 | 2 Tomato, 1 Baked Potato, 1 Brown Mushroom | 8 s  |

## Code layout

```
scripts/
  main.ts                 wiring: startup registrations, worldLoad
  config.ts               ids, state names, property prefix, tuning numbers
  data/                   content as data; no logic
    crops.ts              where seeds drop from
    recipes.ts            cutting + cooking recipes
    dishes.ts             status effects per dish
    validate.ts           worldLoad check that every id in data/ exists (errors -> Content Log)
  crops/
    crop-growth.ts        block component hk:crop_growth (any crop; params from block JSON)
    seed-drops.ts         grass -> seeds
  stations/
    cutting-board.ts      block component hk:cutting_station
    cooking.ts            pot rules + the one interval that drives all active pots
    cooking-pot.ts        block component hk:cooking_station: routes interactions, spill on break
    pot-store.ts          pot persistence (world dynamic properties)
  food/dish.ts            item component hk:dish: effects on eat
  ui/pot-menu.ts          the pot form (display only)
  lib/                    inventory, custom block states, lang/RawMessage helpers
```

Adding content:

- **A recipe** is one entry in `data/recipes.ts` plus the result item JSON. No station code changes.
- **A crop** is a block JSON that declares `hk:growth` and lists `hk:crop_growth` with its params,
  a seed item with `block_placer`, two loot tables, textures, and an entry in `data/crops.ts` if
  it drops from grass.
- **A dish** is an item JSON with `minecraft:food` and the `"hk:dish": {}` marker, plus its effects
  in `data/dishes.ts`.

This groups modules by feature (`crops/`, `stations/`, ...) instead of the `events/`/`components/`
folders the scripting pack uses, as asked for this project.

## Technical decisions

- **Formats from vanilla 1.26.52.** Blocks use `1.26.50`, items `1.26.30` (vanilla apple), geometry
  `1.26.50` (vanilla straw bed), recipes `1.26.50`. Crop components follow vanilla `red_shrub`:
  `collision_box: false`, `liquid_detection` → popped, `movable` → popped, instant break.
- **Food effects live in a custom item component.** The 1.26.30 `minecraft:food` has no `effects`
  field (only legacy 1.10 items like the golden apple have it), so `hk:dish` applies them in
  `onConsume`.
  - The effect list was first put in the component's JSON params:
    `"hk:dish": { "effects": [{ ... }] }`. The game rejected it with `Failed to parse field
' -> components -> hk:dish -> effects[0]: Exceeded the object and array depth limit'`.
  - It then dropped the whole item: no name, no icon, and dishes that arrived invisible.
  - **Rule:** keep custom component params flat (scalars, maybe flat arrays) and put structured
    data in `data/`.
- **Seeds come from a script, not a loot-table override.** Overriding
  `loot_tables/blocks/short_grass.json` would replace vanilla's table and collide with any other
  add-on that edits it. That matters for a pack meant for existing worlds.
- **Bone meal is handled by the crop.** Bone meal does nothing to custom blocks by itself.
- **Custom block states without casts.** `BlockPermutation.getState`/`withState` are typed against
  vanilla state names only, so `lib/block-states.ts` uses `getAllStates()` and
  `BlockPermutation.resolve()`, which accept any name.
- **Pot storage.** There are no block entities for custom blocks, so each pot is one world dynamic
  property keyed by dimension + position, holding JSON (`items`, `job`). An idle empty pot stores
  nothing. Values are validated on read, and broken data is treated as empty with a warning.
- **Cooking can't lose or duplicate items.** Ingredients stay in the pot, locked, until the dish is
  done, then they're removed and the dish appears in the same step. Breaking a pot mid-cook spills
  the ingredients. Form choices are re-validated after `await`.
- **Timers survive reloads.** A job stores `readyAt` as wall-clock `Date.now()`. One
  `runInterval` (every 10 ticks) walks the active pots. At `worldLoad` it rebuilds that list from
  saved data, so `/reload` or closing the world mid-cook just finishes the dish later.
- **Break coverage.** `onPlayerBreak` and `onBreak` both spill, and the second one finds nothing.
  Pots are immovable (pistons). `/setblock` fires no break: the sweep spills a cooking pot that's
  gone, and `onPlace` wipes stale data, so a new pot never inherits old contents.
- **All text is localized.** Every message and form string is a lang key in
  `resource/texts/en_US.lang`. Item names come from `ItemStack.localizationKey`, so vanilla
  ingredients show in the player's language.

## Limitations and open questions

- **Tested in game on 2026-10-21 (1.26.52.3).** Crop growth, harvest, the cutting board, the pot
  form, cooking, delivery, dish names, icons and effects all work after the dish fix. The Content
  Log was read for the first load only; after the fixes it was 0 bytes (see the 4 KB note in
  CLAUDE.md), so that last session has no clean-log check.
- **Growth speed is a guess.** Bedrock's per-block random-tick rate at `randomtickspeed 1` isn't
  documented, and Microsoft Learn says so too. Tune `growth_chance` in `tomato_crop.json` after
  timing it in game.
- **Bone meal relies on block interaction winning over the item's own use.** If bone meal turns
  out not to trigger `onPlayerInteract`, the fallback is an `hk:` item component, or a
  `beforeEvents.playerInteractWithBlock` handler.
- **Microsoft Learn's block-states page still says custom states need Holiday Creator Features.**
  That page is from 2025 and uses format 1.19.40. The game's own error strings mention only
  state limits, not experiments. The Content Log on first load settles it.
- **Seed drops only on player breaks**, not water, pistons or explosions (see above).
- **Pot data is per position**, roughly 100–200 bytes per non-empty pot. That's fine at survival
  scale; a server with thousands of filled pots would want a size review.
- **No heat source required** under the pot yet. Farmer's Delight-style "needs fire below" is a
  natural next step and fits in `startCooking`.
- **Salad is "cooked" in the pot.** A prep station (mixing bowl) would make more sense once there
  are more no-heat recipes.
- **Placeholder art.** Item icons for the board and pot render the 3D model; they need proper icons
  (`minecraft:item_visual` or a separate item) before release. Textures and models need an artist.
- **Wall-clock timing** means a dish keeps cooking while a single-player game is paused.

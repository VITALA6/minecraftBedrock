# Harvest Kitchen: portfolio slice (code)

Pack `packs/harvest_kitchen`, namespace placeholder `hk`. Stable `@minecraft/server` 2.10.0 and
`@minecraft/server-ui` 2.2.0 only, no experiments. This replaces the MVP code (`mvp.md`, throwaway
per D9, no migration). The spec is `plan.md` §1–§3 and §5.2.

Written 2026-10-21/22 without an in-game run. Everything not yet seen working in game is tagged
**(untested)**. All art is **placeholder** at the final paths (see "Art" below).

## What's implemented

| Feature           | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5 crops           | Tomato, onion, cucumber (`crop`: break to harvest) and chili, strawberry (`bush`: use to pick). One block component `hk:crop_growth` with a flat `type` param. Onion is its own seed.                                                                                                                                                                                                                                                                                                                  |
| Bushes            | Mature (stage 3) + use with anything: drops 1–3 chili / 2–3 strawberries, falls back to stage 2, regrows. Bone meal on a young bush grows it. Planted on grass, dirt, coarse dirt, podzol or farmland (see decisions).                                                                                                                                                                                                                                                                                 |
| Seed drops        | Breaking short grass, tall grass, fern or large fern (not creative, not shears): one roll; each crop has 5 % in its biomes (`Dimension.getBiome()`) and 1 % anywhere else, so a break drops at most one HK seed.                                                                                                                                                                                                                                                                                       |
| Cutting board     | Tomato → 2 Sliced Tomato, Onion → 2 Chopped Onion, Cucumber → 2 Sliced Cucumber. Chop sound + bits in the crop's colour. Sneak + use chops the held stack, one every 6 ticks, stops past 4 blocks, on item switch, or if the board goes. Wrong item: thud, puff, `✘ Can't cut that`. Empty hand: tap, `Hold a vegetable`.                                                                                                                                                                              |
| Station engine    | Generic container station from config (`data/stations.ts`): recipe list, capacity, heat rule, visual-state mapping. One `runInterval` (10 ticks) drives every station with contents. Cook time is stored as ticks left and only counts down with heat, so it pauses without heat and survives `/reload` (the active list is rebuilt at `worldLoad`).                                                                                                                                                   |
| Heat (D5)         | Lit campfire, lit soul campfire (`extinguished` state), fire, soul fire, magma, lava/flowing lava directly below. Cached in the `hk:hot` state for the hot rim; refreshed by the sweep, on use, on random ticks, and when a heat block is placed, broken or interacted with below a pot.                                                                                                                                                                                                               |
| Cooking pot       | S8 model. States `hk:fill` 0–3, `hk:phase` idle/ready/cooking/done, `hk:hot`, `hk:liquid` (7 colours). Bone visibility shows the liquid level and the lid (cooking). The liquid shows what's in the pot (`liquidOf`: the matched dish's colour, else the main ingredient's, else clear water) with a glint when ready or done; the rim glows when hot; light 7 while cooking with heat. Generated permutations (`tools/gen-pot-block.mjs`). All materials `opaque`.                                    |
| Pot interactions  | Exactly §2.3 with D15: add one / sneak adds the stack; refusals; chime + `✔ Dish` when a new dish becomes possible; empty hand auto-cooks the only possible dish, opens the choice form only when several are possible, says `Add <first missing>` (no form) when idle with items and `Add ingredients` when empty; `♨ ■■■□□` while cooking (or `♨ Needs fire below` when paused); done → dish into your hand or inventory, anyone can collect; sneak + empty hand takes everything out; break spills. |
| Pot screen (D15)  | Only when two or more dishes are possible: an `ActionFormData` titled "Cooking Pot", one button per dish (its icon + `Cook <dish>`), no body, no Close button (the X closes it). Cold pot: fizz + `♨ Needs fire below` instead of the form. The tap goes through `startCooking`, which re-validates. See "Ghost ingredients and the choice form (D15)".                                                                                                                                                |
| Ghost ingredients | D15: within 6 blocks of a pot with contents, its closest recipe's missing items float above it as semi-transparent bobbing icons (one per missing item); ready → the dish icon(s) with gold sparkles; done → the dish, nearly solid; empty or cooking → nothing. Adding an item pops its ghost. Per-player particles from one interval, capped. See "Ghost ingredients and the choice form (D15)".                                                                                                     |
| Recipe posters    | `hk:recipe_poster` (D15, replaces the recipe book): a 2×1 wall poster (one `minecraft:multi_block`) showing one recipe: ingredients → result, station (+ flame), effect family badge. Sneak + use cycles through the dishes the player has discovered (all in creative; `Break grass to find seeds` when none); plain use names the dish and its effect. Crafted from paper + any HK crop (tag `hk:crops`); one is handed out the first time a player gets an HK item. See "Recipe posters (D15)".     |
| Discovery (D3)    | Found crops per player (`hk:found` dynamic property), from `playerInventoryItemChange`. A dish unlocks once all its HK crops are found; posters only cycle to unlocked dishes. `★ New recipe!` subtitle + page-turn, at most once per 3 s. Creative: all unlocked. A Recipe Poster is handed out the first time any HK item enters the inventory (`hk:poster_given`).                                                                                                                                  |
| Dishes            | All 13 MUST dishes. Pot: tomato soup, vegetable stew, chili stew, fish chowder (cod **or** salmon), chicken soup, onion soup, strawberry jam. Crafting (shapeless): garden salad, salsa, veggie sandwich, hearty sandwich, strawberry cup, strawberry cake. Effects via `hk:dish`; containers come back via `using_converts_to`.                                                                                                                                                                       |
| Strawberry Cake   | Cake + 2 Strawberry. Item places block `hk:strawberry_cake`, state `hk:slices` 0–3 (slices eaten). Use = eat a slice at any hunger (3 food, saturation 0.4, Regeneration I 5 s), eat sound + chime + hearts; the 4th slice removes the block. Breaking drops nothing (no free cake). Only placeable on top of a block; pops (dropping nothing) when the block below goes or a piston pushes it (B15). Generic `hk:sliced_dish` component.                                                              |
| Validation        | `data/validate.ts` at `worldLoad`; results in the Content Log, via `/hk:debug validate`, and announced to operators on join if there are problems.                                                                                                                                                                                                                                                                                                                                                     |
| `/hk:debug`       | Operator-only custom command (see below).                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Dish table (food values are in the item JSON **and** `data/dishes.ts`; `tests/pack-files.test.ts`
compares them, B17). Pot dishes also have a liquid colour (see "Pot liquid colours"):

| Dish            | Station  | Ingredients                                            | Food  | Effect                 | Always eat | Cook |
| --------------- | -------- | ------------------------------------------------------ | ----- | ---------------------- | ---------- | ---- |
| Tomato Soup     | Pot      | 2 Tomato, Bowl                                         | 6     | Regeneration 8 s       | yes        | 5 s  |
| Vegetable Stew  | Pot      | Tomato, Onion, Carrot, Potato, Bowl                    | 10    | Regeneration 15 s      | yes        | 10 s |
| Chili Stew      | Pot      | Chili, Raw Beef, Tomato, Onion, Bowl                   | 10    | Fire Resistance 120 s  | yes        | 10 s |
| Fish Chowder    | Pot      | Raw Cod or Salmon, Potato, Onion, Bowl                 | 8     | Water Breathing 120 s  | yes        | 8 s  |
| Chicken Soup    | Pot      | Raw Chicken, Onion, Carrot, Bowl                       | 8     | Absorption 60 s        | yes        | 8 s  |
| Onion Soup      | Pot      | 2 Onion, Bread, Bowl                                   | 7     | Night Vision 120 s     | yes        | 6 s  |
| Strawberry Jam  | Pot      | 3 Strawberry, Sugar, Glass Bottle                      | 4     | Speed 60 s             | yes        | 6 s  |
| Garden Salad    | Crafting | 2 Sliced Tomato, Sliced Cucumber, Carrot, Bowl         | 6     | Speed 90 s             | yes        |      |
| Salsa           | Crafting | Sliced Tomato, Chopped Onion, Chili, Bowl              | 4     | Haste 90 s             | yes        |      |
| Veggie Sandwich | Crafting | Bread, Sliced Tomato, Sliced Cucumber                  | 7     | none                   | no         |      |
| Hearty Sandwich | Crafting | Bread, Cooked Porkchop, Sliced Tomato, Sliced Cucumber | 10    | none                   | no         |      |
| Strawberry Cup  | Crafting | 3 Strawberry, Sugar, Bowl                              | 5     | Jump Boost 60 s        | yes        |      |
| Strawberry Cake | Crafting | Cake, 2 Strawberry                                     | 3 × 4 | Regeneration 5 s/slice | yes        |      |

All effects are level I. Station items: Cooking Pot (`IBI`/`III`, iron + bowl), Cutting Board
(stick + 2 planks in a row), Recipe Poster (paper + any HK crop, shapeless).

## Pot liquid colours

`data/liquids.ts` and the `liquid` field in `data/dishes.ts`; rule in `liquidOf`
(`stations/station-logic.ts`):

1. A recipe matches (done: the finished dish; cooking: the job's dish; ready: the first possible
   recipe in recipe order) → that dish's colour.
2. Otherwise → the colour there's most of among the ingredients, counts summed per colour; a tie
   goes to the stronger colour (chili > tomato > jam > stew > broth > cream).
3. Nothing that colours it (empty, or only bowls, bottles, sugar) → clear water.

| Colour (`hk:liquid`) | Dishes                   | Ingredients                       | Texture ramp (palette)   |
| -------------------- | ------------------------ | --------------------------------- | ------------------------ |
| `water` (default)    | none                     | none                              | `glass`                  |
| `tomato`             | Tomato Soup              | Tomato                            | the S8 liquid, unchanged |
| `chili`              | Chili Stew               | Chili Pepper                      | `beet` (deep red)        |
| `jam`                | Strawberry Jam           | Strawberry                        | `strawberry` (pink-red)  |
| `stew`               | Vegetable Stew           | Raw Beef                          | `meat` (brown)           |
| `broth`              | Chicken Soup, Onion Soup | Onion, Carrot, Raw Chicken, Bread | `onion` (golden)         |
| `cream`              | Fish Chowder             | Potato, Raw Cod, Raw Salmon       | `onion_flesh` + `cream`  |

Each colour has `cooking_pot_liquid_<colour>.png` and `_ready.png` (the same sparkle overlay as
before; on `cream` the sparkle is golden so it still shows). No dish is green, so there's no green.

## Identifiers

- **Items:** `hk:tomato`, `hk:onion`, `hk:cucumber`, `hk:chili_pepper`, `hk:strawberry`;
  seeds `hk:tomato_seeds`, `hk:cucumber_seeds`, `hk:chili_pepper_seeds`, `hk:strawberry_seeds`;
  prepared `hk:sliced_tomato`, `hk:chopped_onion`, `hk:sliced_cucumber`; dishes
  `hk:tomato_soup`, `hk:vegetable_stew`, `hk:chili_stew`, `hk:fish_chowder`, `hk:chicken_soup`,
  `hk:onion_soup`, `hk:strawberry_jam`, `hk:garden_salad`, `hk:salsa`, `hk:veggie_sandwich`,
  `hk:hearty_sandwich`, `hk:strawberry_cup`, `hk:strawberry_cake`; `hk:recipe_poster`,
  `hk:cooking_pot`, `hk:cutting_board`.
- **Blocks:** `hk:tomato_crop`, `hk:onion_crop`, `hk:cucumber_crop`, `hk:chili_bush`,
  `hk:strawberry_bush`, `hk:cooking_pot`, `hk:cutting_board`, `hk:strawberry_cake`,
  `hk:recipe_poster`.
- **Block states:** `hk:growth` 0–3 (crops, bushes); `hk:fill` 0–3, `hk:phase`
  idle|ready|cooking|done, `hk:hot` bool, `hk:liquid` water|tomato|chili|jam|stew|broth|cream
  (pot: 2 + 2 + 1 + 3 = 8 bits, 4 × 4 × 2 × 7 = 224 permutations);
  `hk:slices` 0–3 (cake); `minecraft:cardinal_direction` (board); poster: `hk:poster` 0–13,
  `hk:facing` north|south|east|west, `hk:right` bool, plus `minecraft:cardinal_direction` and
  `minecraft:multi_block_part` from its traits (4 + 2 + 1 + 2 + 1 = 10 bits).
- **Custom components:** block `hk:crop_growth`, `hk:cutting_station`, `hk:container_station`,
  `hk:sliced_dish`, `hk:recipe_poster`; item `hk:dish`.
- **Item tags:** `hk:seeds` (4 seeds + onion; no recipe uses it any more), `hk:crops` (the 5
  produce items), used by the poster recipe.
- **Dynamic properties:** world `hk:st:<station>:<dimension>:<x>,<y>,<z>` (station JSON),
  world `hk:debug_fast` (bool); player `hk:found` (comma-separated crop keys), player
  `hk:poster_given` (bool). The old `hk:book_given` stays on players who had the book; nothing
  reads it.
- **Saved ids that freeze at the first public build:** recipe ids (`hk:tomato_soup`, …), crop keys
  (`tomato`, `onion`, `cucumber`, `chili`, `strawberry`), the property keys and the state names.
- **Command:** `/hk:debug`, enum `hk:debug_action`.
- **Particles (D15):** `hk:ghost_icon`, `hk:ghost_sparkle`, `hk:ghost_pop`
  (`resource/particles/hk/`), atlas `textures/hk/particle/ghost_atlas.png`; Molang inputs
  `variable.hk_icon`, `variable.hk_alpha`, `variable.hk_phase`.

## Code layout

```
scripts/
  main.ts                    wiring only: startup registrations, worldLoad, playerSpawn
  config.ts                  ids, states, property keys, tuning numbers, vanilla sound/particle ids
  data/                      content as data; no logic
    crops.ts                 every crop: type, seed, soil, biomes, pick counts, colour, hint key
    recipes.ts               cutting, station (pot) and crafting recipes + matching helpers
    dishes.ts                food values, effects, effect families, slices, pot liquid colour
    liquids.ts               pot liquid colours (hk:liquid values), ingredient colours,
                             dominantLiquid (pure)
    particles.ts             Molang variables each vanilla particle reads (pure)
    stations.ts              container station configs (the pot)
    icons.ts                 vanilla item/effect icon paths, our UI icons
    ghost-atlas.ts           D15 ghost particle atlas: cell order and layout (pure)
    checks.ts                the game-independent data check (pure, unit-tested)
    validate.ts              worldLoad check: checks.ts + items, blocks, states, biomes, food component
  crops/
    crop-growth.ts           hk:crop_growth: reads the block, applies growth-logic.ts
    growth-logic.ts          params, random-tick growth, bone meal, bush picking (pure)
    seed-drops.ts            grass break -> seed-roll.ts -> spawn the seed
    seed-roll.ts             per-biome chances, one roll per break (pure)
  stations/
    station-logic.ts         container station rules and saved form (pure): phase, fill, liquid
                             colour, routing, add/take/start/countdown/finish/collect/spill
    station-engine.ts        reads/saves the state, heat, visuals, feedback, the one sweep
    station-store.ts         station persistence (world dynamic properties)
    container-station.ts     hk:container_station: component and before-event entry points
    ghost-logic.ts           D15 ghosts: what a pot shows, row layout per viewer, nearest pots,
                             pops, particle inputs (pure)
    ghosts.ts                the one ghost interval: per-player particles, pops on add
    heat.ts                  what counts as heat below (pure; a Block fits HeatBlock)
    cutting-board.ts         hk:cutting_station + sneak-chop
  food/
    dish.ts                  hk:dish: effect on eat
    sliced-dish.ts           hk:sliced_dish: eat a slice of a placed dish
    dish-support.ts          pops a placed dish left on air (break/explosion/piston; B15)
    feed.ts                  hunger/saturation/effect helpers
  discovery/
    unlock.ts                crops of each item/dish, unlock rule, hk:found format, toast timing (pure)
    discovery.ts             player property, first-item poster hand-out, toast
  posters/
    poster-logic.ts          poster state <-> dish, textures, the discovered-recipe cycle, wall
                             geometry (pure)
    poster.ts                hk:recipe_poster: place (facing, halves), sneak + use, info, drops
    poster-support.ts        pops a poster whose wall goes (break/explosion/piston)
  ui/
    pot-status.ts            the pot's choice form buttons for a state (pure)
    pot-screen.ts            the pot's choice form (ActionFormData; only for 2+ possible dishes)
  debug/debug-command.ts     /hk:debug
  lib/                       block states, inventory, text (lang keys), feedback (sound/particle),
                             tick-gate (per-player rate limit: poster use, cake bites)
tests/                       node:test unit tests for the pure modules (see "Tests")
```

## How to add content

- **A pot recipe:** one entry in `STATION_RECIPES` (`data/recipes.ts`) and, for a new dish, an
  entry in `DISHES` (`data/dishes.ts`) plus the item JSON (`minecraft:food`, `"hk:dish": {}`),
  texture `textures/hk/items/<name>.png` + `item_texture.json` + lang key. A pot dish needs a
  `liquid` colour (`checks.ts` reports a missing one); a new colour is a `LIQUIDS` entry
  (`data/liquids.ts`, append only), a `POT_LIQUIDS` entry in `tools/gen-textures.mjs`, the two
  PNGs copied + `terrain_texture.json`, then `node tools/gen-pot-block.mjs`. The pot, its choice
  form, the ghosts, the posters and validation pick it up. A new ingredient or dish also needs its
  16×16 art in `art/harvest_kitchen/generated/` (or `final/`) and `npm run ghosts` for the
  ghost atlas (`tests/ghosts.test.ts` fails until then).
- **A crafting dish:** the shapeless JSON in `behavior/recipes/`, the same recipe in
  `CRAFTING_RECIPES` (it's what the posters show; keep both in sync), a `DISHES` entry, item JSON,
  texture, lang. Every new dish gets a poster: `npm run posters` (the 16th `hk:poster` value is
  the last one; a 16th dish needs a second state, see "Recipe posters (D15)").
- **A crop:** a `CROPS` entry (`data/crops.ts`); a block JSON copied from `tomato_crop.json` or
  `chili_bush.json` (`hk:growth` state, `hk:crop_growth` params, per-stage textures and loot);
  seed item (`minecraft:block_placer`, tag `hk:seeds`), produce item, two loot tables under
  `loot_tables/hk/blocks/`, 4 stage textures, lang (`tile.…`, `item.…`, `hk.crop.where.<key>`).
  Optionally a `CUTTING_RECIPES` entry.
- **A station (the oven, v1.1):** add its id to `StationId` and a `STATIONS` entry
  (`data/stations.ts`: block, capacity, `needsHeat`, state names), a block JSON listing
  `"hk:container_station": {}` with the same states and `bone_visibility`, and recipes with
  `station: "oven"`. No engine code. If it needs a different heat rule, that's one branch in
  `stations/heat.ts`.
- **A placeable dish (pie, pizza):** a block JSON with `hk:slices` and `"hk:sliced_dish": {}`,
  an item with `minecraft:block_placer` + `replace_block_item`, and a `DISHES` entry with
  `slices: { block, count, nutrition, saturation }`.
- **A tall crop (SHOULD):** not implemented. The extension point is `GrowthType` in
  `crops/growth-logic.ts` (the comment in `crops/crop-growth.ts` says what it needs).

## Technical decisions

- **Formats from vanilla 1.26.52.3.** Blocks `1.26.50`, items `1.26.30`, geometry `1.26.50`,
  recipes `1.26.50` (vanilla shapeless `suspicious_stew_*` uses `tags`, `ingredients`, `unlock`,
  `result` at 1.26.50). Loot tables have no format version.
- **Flat item icons for pot, board and cake (MCPE-185868):** each block has an item with the
  **same identifier** and `minecraft:block_placer { "block": <id>, "replace_block_item": true }`
  plus `minecraft:icon`. Evidence: the 1.26.52 binary has `replace_block_item` and the error
  text `"minecraft:block_placer": Item identifier %s does not match the block identifier %s.
Cannot replace the block item.`; vanilla 1.26.50 ships a same-id item for its data-driven
  `red_shrub` block. `minecraft:item_visual` exists too, but it renders geometry, not a flat icon.
  **(untested)**
- **Hot vs cold is a state (`hk:hot`), not computed only on use.** It costs 1 bit (8 bits total
  with `hk:liquid`). Heat is still checked live whenever it matters (start cooking, every sweep);
  the state is only the visual cache.
- **Pot liquid colours are a state plus generated permutations** (B16). `hk:liquid` holds one of
  7 colours; `refreshVisuals` sets it from `liquidOf` on every save (add, take out, take all,
  cook start, done, collect) and on every sweep, place and random tick, so it always follows the
  contents. A permutation's `material_instances` replaces the whole component, so each colour ×
  ready glint (phase ready or done) × hot rim is one permutation (27 + the base), written by
  `tools/gen-pot-block.mjs` from `LIQUIDS` and the pot config; a fifth kind adds
  `light_emission: 7` when cooking with heat. Chosen over per-colour liquid bones with
  `bone_visibility` because it needs no geometry change (the S8 model stays as exported) and one
  texture slot; the cost is a long but generated JSON, kept honest by `--check` in `npm test`.
  This still relies on a material permutation and the light permutation applying together.
  **(untested)**
- **Particles get exactly the Molang variables they read** (`data/particles.ts`).
  `water_splash_particle` reads `variable.direction.x/.y/.z` for its emitter direction; spawned
  without it, each pot add logged `unable to find member variable .x/.y/.z` and `unhandled
request for unknown variable`. It now gets `setVector3("variable.direction", up)`. The table
  covers every id in `PARTICLE`, from the 1.26.52.3 vanilla definitions.
- **Cook time is ticks left, saved every sweep.** No wall-clock deadline: it pauses without heat
  and while the game is paused. One `runInterval` for all stations; stations without contents
  aren't tracked (idle empty pots refresh their look on use, place, random tick and heat changes).
- **Finished dishes stay in the pot** as `out` until collected (no auto-delivery). Collecting
  clears the saved state first, then gives (hand first, then inventory, then drop).
- **Concurrency.** Every action is a synchronous read-modify-write in one tick. Forms re-read the
  station after `await` and refuse with `✘ It changed, try again` or `✘ It's gone`.
- **Sneak + use** goes through `world.beforeEvents.playerInteractWithBlock`: for the pot when the
  hand is empty or holds an ingredient, for the board when it holds something cuttable. The
  event is cancelled (no vanilla placement) and the action runs next tick (`system.run`, since
  before-events are restricted). The components skip the same cases, so nothing runs twice.
  Sneaking with an unrelated block still places it as usual.
- **Discovery listens to every HK item** by filtering `typeId.startsWith("hk:")` in the callback,
  not with `includeItems`: the subscription is made in early execution, before item types exist,
  and whether the name filter accepts not-yet-loaded ids is unproven. `ignoreQuantityChange: true`
  keeps the event rare.
- **Finding a crop** means getting its seed, its produce or its prepared ingredient (dishes don't
  count).
- **Bush soil:** vanilla `sweet_berries` lists `plant_at: grass, dirt, podzol` (1.26.52 vanilla
  items JSON). Ours: grass block, dirt, coarse dirt, podzol **and farmland**, so a player who tilled
  the whole field isn't refused. Bushes ignore hydration (`dry_multiplier: 1`). Crops need farmland
  and grow at half speed on dry farmland.
- **Bush pick falls back to stage 2** (plan wording), not stage 1 like vanilla berries; it's
  `pickResetStage` in `data/crops.ts`.
- **Effect family on the posters:** the poster shows our family icon + duration; plain use on it
  names the effect with the vanilla lang key, after the family glyph (❤ red heal, ▶ blue move,
  ■ yellow work, ● green explore). No vanilla effect icons (our own art only).
- **Cake** drops nothing when broken (`loot_tables/hk/blocks/nothing.json`), so a half-eaten cake
  can't be broken into a whole one. Its selection box stays full size as slices go.
- **Feeding from script** uses the stable `minecraft:player.hunger` / `minecraft:player.saturation`
  attribute components with vanilla's rule (saturation += nutrition × modifier × 2, capped at
  hunger).
- **Seeds only drop on player breaks** (as in the MVP), never from a vanilla loot table override.
- **Text:** every player-visible string is a lang key in `resource/texts/en_US.lang` (offline
  check: every key the scripts use exists, no unused `hk.` keys). Effect names use vanilla keys
  (`potion.regeneration`, …). `/hk:debug pot` prints raw data lines (developer output).

## Tests

`npm test` runs the unit tests in `packs/harvest_kitchen/tests/*.test.ts` with Node's built-in
`node:test` (Node 26, no new dependencies). `npm test -- pot` runs only files whose path contains
`pot`; flags after a second `--` go to `node --test` (`npm test -- -- --test-name-pattern=chowder`).

- **Runner (`tools/test.mjs`):** Node's own TypeScript stripping needs `.ts` extensions in imports,
  which the scripts don't use. So the runner bundles each test file with esbuild (as the game build
  does) into a temp dir, keeps `node:*` external, and runs `node --test` on the output from the
  repo root (tests read pack files by repo-relative path). Any `@minecraft/*` import reachable from
  a test fails the bundle and names the importing file, so a pure module can't silently start
  depending on the game. Type-only imports are erased and allowed.
- **Pure modules:** `stations/station-logic.ts`, `stations/heat.ts`, `crops/growth-logic.ts`,
  `crops/seed-roll.ts`, `discovery/unlock.ts`, `posters/poster-logic.ts`, `data/checks.ts`, plus `config.ts` and `data/*.ts` except
  `validate.ts` (`data/liquids.ts` and `data/particles.ts` included). Random numbers and "is this item loaded" come in as parameters.
- **Types:** `tests/node.d.ts` declares the few Node APIs the tests use (there's no `@types/node`,
  and the scripts must not see Node globals). `tsc` and eslint (type-aware) cover `tests/`.
  `tools/build.mjs` copies only `behavior/`, `resource/` and the `scripts/main.ts` bundle, so tests
  never ship.
- **Coverage:** recipe matching (`recipe-matching`), the station rules and saved form
  (`station-logic`), heat (`heat`), crop growth and bush picking (`growth-logic`), seed weighting
  (`seed-roll`), discovery and unlocks (`unlock`), the data check on good and deliberately broken
  data (`checks`), and pack files against the data (`pack-files`: lang keys both ways, display
  names, `textures/hk/` icon PNGs, food values in item JSON, crafting JSON vs `CRAFTING_RECIPES`,
  crop block params/states/loot, pot and cake states), liquid colours (`station-logic`
  "liquid colour", `liquids`), particle variables (`particles`), the pot's generated permutations
  (`pack-files` "cooking pot looks": runs `tools/gen-pot-block.mjs --check` and evaluates every
  condition for all 224 state combinations with the small Molang evaluator in `tests/molang.ts`)
  and the cake's placement filter and empty loot (`pack-files` "strawberry cake support").
  The posters (`posters`): state ↔ dish both ways, recipe order, texture names, the sneak + use
  cycle (skips undiscovered dishes, wraps around, creative shows all, nothing discovered gives no
  next state, from an undiscovered dish it moves on), the first poster on placing, and the wall
  geometry (viewer's right per facing, halves from real part positions, refusing parts that aren't
  side by side, the starting-half guess); `pack-files` "recipe poster": the block JSON is what
  `tools/gen-poster-block.mjs` writes, every state × half has a 64×64 PNG and an `hk_poster_`
  shortname (no orphans), states and the 16-value limit, the multi-block traits, side-face filter,
  pop, empty loot, thin boxes, the 1 px panel geometry, every facing × half × recipe combination
  evaluated through the Molang conditions (one permutation, right texture, right rotation, opaque),
  and the crafting recipe + `hk:crops` tag on exactly the produce.
- **D15 coverage:** the ghosts (`ghosts`): what every pot state shows (empty, missing with partial
  counts, cod-or-salmon turns, ready one/several, cooking, done, and every state of up to 4
  items: ghosts unless empty, capped, each icon has an atlas cell), pops, the row layout per
  viewer, nearest pots per player, the lifetime/update timing and bob continuity, and the shipped
  files (`tools/gen-ghost-atlas.mjs --check`, one particle file per id, atlas size in the JSON,
  `hk:ghost_icon` reads exactly the variables the script sets). The choice form (`pot-status`,
  `station-logic` "the choice form"): only for 2+ possible dishes, never while busy, icons exist,
  routing opens it exactly then; a full pot allows at most 4 dishes (pinned).
- **Pure modules** also include `ui/pot-status.ts`, `stations/ghost-logic.ts`
  and `data/ghost-atlas.ts`.
- What stays game-only (needs the in-game test): everything in `station-engine.ts`,
  `container-station.ts` and the other `@minecraft/server` modules (block reads, heat lookups,
  hand-outs, forms, events), and `validate.ts`'s item/block/biome/effect/food checks.

## Verified offline (2026-10-21/22)

- **APIs** in `node_modules/@minecraft/server@2.10.0/index.d.ts` and `server-ui@2.2.0` (stable
  packages, so no beta): `Dimension.getBiome` → `BiomeType.id`; `BiomeTypes.get`;
  `world.afterEvents.playerInventoryItemChange` (+ `InventoryItemEventOptions`);
  `world.beforeEvents.playerInteractWithBlock` (`cancel`, `isFirstEvent`, `itemStack`);
  `afterEvents.playerPlaceBlock` / `playerBreakBlock` with `blockTypes`; `playerInteractWithBlock`
  after; `playerLeave`, `playerSpawn`; `CustomCommandRegistry.registerCommand` / `registerEnum`
  (both `@privilege early-execution-allowed`), `CustomCommandParamType.Enum`,
  `CommandPermissionLevel.GameDirectors`, `cheatsRequired`; `CustomCommandOrigin.sourceEntity`;
  block component hooks `onPlayerInteract`, `onPlace`, `onRandomTick`, `onPlayerBreak`,
  `onBreak` (`brokenBlockPermutation`); item component `onUse`, `onUseOn`, `onConsume`;
  `EntityComponentTypes.Hunger` / `Saturation` (`EntityAttributeComponent.setCurrentValue`);
  `ItemComponentTypes.Food` (only `getComponent`; its properties throw in game, B17);
  `MolangVariableMap.setColorRGB` / `setVector3`; `world.afterEvents.blockExplode`,
  `pistonActivate` (`BlockPistonComponent.getAttachedBlocksLocations`); `Block.isAir`,
  `isLiquid`; `Dimension.runCommand`; `ScreenDisplay.setTitle` with `subtitle`;
  `ActionFormData.header/divider/button(icon)`; D15: `Player.spawnParticle` (only that player
  sees it; `no-restricted-execution`), `MolangVariableMap.setFloat`, `System.currentTick`,
  `World.getAllPlayers`, `ActionFormData.title/button(text, iconPath)/show` →
  `ActionFormResponse.selection/canceled/cancelationReason` (`FormCancelationReason.UserBusy`),
  `FormRejectError`/`FormRejectReason.PlayerQuit`; `show()` is `no-restricted-execution` (forms
  open one tick later with `system.run`); `Block.above(steps)`; `Player.getBlockFromViewDirection`.
  `tsc` checks every call against these typings.
- **Recipe poster APIs** (D15, `server@2.10.0/index.d.ts`): `BlockCustomComponent.beforeOnPlayerPlace`
  (`BlockComponentPlayerPlaceBeforeEvent`: `cancel`, `face: Direction`, `permutationToPlace`
  settable, `player`), `onBreak` (`brokenBlockPermutation`, `entitySource`; fires for
  `/setblock … destroy`), `onPlayerBreak`, `onPlayerInteract`; `Block.getParts()` (multi-block
  parts, `undefined` without the trait); `Block.offset`, `setType`, `isAir`, `isLiquid`;
  `Dimension.spawnItem`; `Direction` values `North`/`South`/`East`/`West`/`Up`/`Down`. Block
  JSON: the `minecraft:multi_block` trait strings and the error `Component '{}' is not valid in
multi block permutations` are in the 1.26.52.3 binary.
- **CustomForm APIs** (D14, not used since D15; `server-ui@2.2.0/index.d.ts`): `new CustomForm(player, title)` (title
  may be an `ObservableUIRawMessage`), `image(src: ObservableString | string, pack, { width })`,
  `label(text, { visible })`, `button(label, onClick, { disabled, visible })` with observable
  label/disabled/visible, `closeButton()`, `close()`, `isShowing()`, `show()` →
  `DataDrivenScreenClosedReason` (`UserBusy`); `ObservableString/Boolean/UIRawMessage`
  (`setData`); `PlayerLeftError`. All are `@privilege no-restricted-execution`, so the pot screen
  opens one tick later and every button callback only schedules its work with `system.run`.
- **Sounds** (all in the 1.26.52.3 vanilla `sound_definitions.json` files): `block.decorated_pot.insert`,
  `block.decorated_pot.insert_fail`, `note.chime`, `note.bell`, `block.lantern.place`, `bubble.up`,
  `bubble.pop`, `random.pop`, `random.fizz`, `random.click`, `hit.wood`, `mob.slime.squish`,
  `random.eat`, `random.orb`, `item.book.page_turn`, `item.bone_meal.use`,
  `block.sweet_berry_bush.pick`. Block sound types `grass`, `sweet_berry_bush`, `wood`, `copper`,
  `cloth` are in vanilla `blocks.json`.
- **Particles** (vanilla RP `particles.brarchive`, newest layer): `minecraft:water_splash_particle`
  (reads `variable.direction.x/.y/.z`), `minecraft:basic_smoke_particle`,
  `minecraft:villager_happy`, `minecraft:white_smoke_particle`, `minecraft:falling_dust` (reads
  `variable.color.r/.g/.b`), `minecraft:heart_particle`, `minecraft:crop_growth_emitter` (sets its
  own `variable.size`). See `data/particles.ts`.
- **Texture paths** (vanilla `textures_list.json` / `contents.json`): every entry in
  `data/icons.ts`, including `textures/items/beef_raw`, `fish_raw`, `fish_salmon_raw`,
  `chicken_raw`, `potion_bottle_empty`, `porkchop_cooked`, `book_normal`, `campfire`,
  `textures/blocks/crafting_table_front`, `textures/ui/arrow_left`, and all ten
  `textures/ui/<effect>_effect`.
- **Block ids:** `minecraft:campfire`, `soul_campfire`, `fire`, `soul_fire`, `magma`, `lava`,
  `flowing_lava`, `grass_block`, `dirt`, `coarse_dirt`, `podzol`, `farmland`, `short_grass`,
  `tall_grass`, `fern`, `large_fern` (vanilla `blocks.json` files / binary). Campfire state
  `extinguished` (binary). Biome ids: vanilla `biomes/` names; `validate.ts` re-checks them with
  `BiomeTypes.get` in game.
- **Pack consistency** (scratch script): every texture shortname resolves to a PNG, every block's
  material slots match its geometry's faces, every `bone_visibility` bone exists, no block mixes
  render methods, every UI icon path under `textures/hk/` exists, every lang key used exists.

## Untested assumptions

Everything below is unproven in game:

1. Same-id item + `replace_block_item` gives pot, board and cake a flat hotbar icon and the right
   name; the creative menu shows each once (the block declares category `items`, the item
   `none`, as vanilla `red_shrub` does; see blockers.md B3).
2. Sneak + use on the pot and board reaches our before-event handler, the cancel stops vanilla
   placement, and nothing runs twice.
3. Multiple matching permutations combine (material swap + light emission).
4. Named material slots (`top`, `liquid`, `lid`, `knife`, `inner`, `berry`) map to the geometry's
   `material_instance` names (S8 export; S3 proved bone visibility, not these names).
5. Food items that are also placers (onion: `minecraft:food` + `minecraft:block_placer`) eat in
   the air and plant on farmland.
6. The `hk:crops` item tag works as a shapeless recipe ingredient (the poster recipe).
7. `setTitle("§r", { subtitle })` shows only the subtitle.
8. Recipe posters (D15, blockers.md B24): see "In-game checks for the recipe posters".
9. `playerInventoryItemChange` fires for pickups, crafting results and `/give`.
10. The pot's `onRandomTick` fires without a `minecraft:tick` component (the MVP crops proved it
    for crops).
11. `falling_dust` with `variable.color` looks like chop bits (tune or swap the particle).
12. S6 timing (6 ticks per chop, 4-block range) feels right.
13. Cooking, bush and growth numbers (cook 5–10 s, growth 0.5/0.3 per random tick) are guesses.
14. `/hk:debug` with `cheatsRequired: false` shows for operators in a world without cheats.
15. Biome ids such as `minecraft:mesa_plateau_stone` resolve through `BiomeTypes.get` (validation
    reports any that don't).
16. The cake pops when the block below goes, through its `placement_filter` or the script net
    (B15), and a pop drops nothing.
17. The pot's 28 permutations load and the liquid colour shows per state (B16).
18. The water splash with `variable.direction` = up still looks like a splash out of the pot.
19. (Was: the D14 book and pot screen images. Both are gone with D15.)
20. D15 ghosts (blockers.md B22): a `1.26.50` particle with plain-string Molang loads; particles
    under `particles/hk/` load (subfolder); variables set by `MolangVariableMap.setFloat` reach
    the billboard UV and tint expressions; `?? 0` defaults don't log errors; `particles_blend`
    tint alpha makes the icon semi-transparent; the billboard `size` is a half-size (an icon
    ≈ 0.36 blocks wide); the 0.6 s lifetime cross-fades without visible flicker or doubling.
21. `Player.spawnParticle` is visible only to that player, and a spawn every 0.5 s per icon
    (≤ 96 emitters/s total) costs nothing visible on a phone.
22. The choice form with 4 dish buttons fits without scrolling on PC and phone (blockers.md B23).

## In-game checks for D15 (ghosts and the choice form)

Deploy, re-enter the world (new particle files and texture), Content Log file on, `/hk:debug kit`,
a pot on a lit campfire.

1. **Empty pot:** nothing floats above it. Empty hand + use: `Add ingredients`, no form.
2. **One onion:** within ~6 blocks, three ghosts float above the pot, facing you, bobbing slowly
   as a wave: cod (turns into salmon every 2 s), potato, bowl (Fish Chowder is closest).
   Walk round the pot: the row turns to face you. Empty hand + use: `Add Cod / Salmon`, no form.
3. **Add bread:** the ghosts change to the Onion Soup recipe: onion, bowl. Add an onion: a small
   white pop where the onion ghost was, and only the bowl is left.
4. **Add the bowl:** the chime, then the Onion Soup icon floats above with gold sparkles. Empty
   hand + use: cooking starts at once (no form) and the icon is gone while the lid is on.
5. **Done:** the soup icon floats nearly solid, no sparkle. Use: you get the soup, the icon goes.
6. **Several dishes:** 2 tomatoes, 2 onions, bread, bowl: two dish icons with sparkles. Empty hand
   - use: a form "Cooking Pot" with `Cook Tomato Soup` and `Cook Onion Soup` (icons, no body, no
     Close button). Pick one: it cooks. Again with the campfire put out: fizz + `Needs fire below`,
     no form.
7. **Caps:** three pots with items close together: you see ghosts above the nearest two only.
   Step 7+ blocks away: the ghosts stop.
8. **Second player** (if possible): each sees their own row facing them; a pop shows for both.
9. **Content Log:** no particle or Molang errors (`hk:ghost_icon`, `unknown variable`, texture).
   Check that ghosts are see-through at 65 % and readable on grass, planks and at night.

## In-game checks for the recipe posters

Deploy, **re-enter the world** (new block, item, textures), Content Log file on. Expected results
are in the test list in `blockers.md` B24; the short version:

1. Content Log: no error for `hk:recipe_poster` (block, multi-block trait, permutations, recipe).
2. `/hk:debug reset`, drop everything, pick up one tomato: a Recipe Poster arrives with
   `★ You got a Recipe Poster!`; a second tomato gives nothing.
3. Place it on a wall, looking straight at it: two blocks, the Tomato Soup poster reads left to
   right (not mirrored, not facing the wall). Repeat on all four wall directions.
4. Use: `Tomato Soup · ❤ Regeneration 8 s`. Sneak + use with only tomato found: stays Tomato
   Soup. Find an onion, sneak + use: Fish Chowder → Chicken Soup → Onion Soup → … → back.
5. Creative: sneak + use walks all 13 dishes.
6. Break the right half: both go, one poster drops. Break the wall behind one half: both go, one
   poster drops. In creative: nothing drops.
7. Crafting table: paper + any of the 5 crops gives a poster.

## In-game checks for the 2026-10-22 fixes

Deploy, re-enter the world (block JSON and textures changed), enable the Content Log file.

1. **Data check (B17):** the Content Log has `[harvest_kitchen] data check: 0 problem(s)` and no
   `can't read food` lines; `/hk:debug validate` prints 0 problems.
2. **Molang errors:** put ingredients into a pot (each add splashes), chop on the board, eat cake,
   bone-meal a crop, cook something. The Content Log has no `unable to find member variable` /
   `unhandled request for unknown variable` lines. The splash should still look like water
   jumping out of the pot.
3. **Pot liquid** (campfire under the pot, `/hk:debug kit`):
   - Add 1 onion: golden broth. Add 2 tomatoes: red (2 beat 1). Take the tomatoes out on the pot
     screen: golden again. Sneak + empty hand (take all): empty pot.
   - Add 2 tomatoes + a bowl: red with the ready glint. Add 3 onions: still red (a dish matches).
   - Cook (empty hand): lid on, red while cooking. Done: red with the glint. Collect: the 3 onions
     are left, golden broth without the glint.
   - Jam (3 strawberries, sugar, bottle): pink. Chowder (cod, potato, onion, bowl): creamy with a
     golden glint. Chili Stew: deep red. Vegetable Stew: brown. Onion/Chicken Soup: golden.
   - Only a bowl and sugar: clear blue water.
   - Remove the campfire while it shows: the rim cools, the colour stays. Break a full pot: it
     spills as before.
   - Content Log: no error about `hk:cooking_pot` permutations or missing textures.
4. **Cake (B15):** the steps in blockers.md B15.

## Art

Every texture is a **placeholder** (16×16, generated) at its final path; the coordinator copies
final art over them. The pot model and its 4 base textures are the S8 files from
`art/harvest_kitchen/models/cooking_pot/`. The board (`geometry.hk.cutting_board`, bones `board`,
`knife`, slots `*`/`top`/`knife`) and cake (`geometry.hk.strawberry_cake`, bones
`slice_1`–`slice_4`, slots `*`/`top`/`inner`/`berry`) geometries are placeholders with the final
identifiers, bones and slots. Crops and bushes use the `#`-shaped `geometry.hk.crop`.

- `textures/hk/items/<name>.png`, shortname `hk_<name>`: the 5 produce, 4 seeds, 3 prepared, 13
  dishes, `recipe_poster`, `cooking_pot`, `cutting_board` (28 files).
- `textures/hk/blocks/`: `<block>_stage_0..3` for the 5 crops/bushes; `cooking_pot_side`, `_top`,
  `_lid` (S8), `cooking_pot_top_hot`; `cooking_pot_liquid_<colour>` and `_<colour>_ready` for the
  7 liquid colours (the S8 liquid recoloured; `tomato` is the S8 texture itself);
  `cutting_board_side`, `_top`, `_knife`; `strawberry_cake_side`, `_top`, `_inner`, `_berry`
  (45 files, shortnames `hk_<file>`).
- `textures/hk/ui/`: `family_heal`, `family_move`, `family_work`, `family_explore`, `locked`,
  `chapter_crops`, `chapter_what_can_i_make`, `needs_heat` (referenced by path).
- `textures/hk/poster/`: the recipe poster halves (`npm run posters`, see "Recipe posters
  (D15)"). Generated; don't edit by hand. (`textures/hk/book/` and `textures/hk/pot/`, the D14
  page images, are gone with D15.)
- `textures/hk/particle/ghost_atlas.png`: the D15 ghost icons (`npm run ghosts`, see "Ghost
  ingredients and the choice form (D15)"). Generated from our own art; don't edit by hand.

## Ghost ingredients and the choice form (D15)

The pot answers "what do I add now?" in the world, not in a form. Mockups:
`art/harvest_kitchen/mockups/ghost_ingredients.png` and `ghost_ready.png`
(`node art/harvest_kitchen/mockups/render-ghosts.mjs`, drawn from the real atlas and numbers).

### What a pot shows (`ghostsFor`, `stations/ghost-logic.ts`)

| Pot                            | Above it                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| empty                          | nothing                                                                                                                                                                 |
| items, no dish possible (idle) | one ghost per missing item of the closest recipe (`closestRecipe`), in slot order: 1 of 2 onions in → one onion ghost; a "cod or salmon" ghost shows each in turn (2 s) |
| 1+ dishes possible (ready)     | the dish icon(s), with two gold stars twinkling round them every update                                                                                                 |
| cooking                        | nothing: the lid, the steam and `♨ ■■■□□` already say it, and a ghost over steam is clutter                                                                             |
| done                           | the finished dish at 95 % alpha (it's real now, not a ghost), no sparkle: it says _what_ is waiting, which the block's "done" look can't                                |

Ghosts are 65 % alpha, ~0.36 blocks wide with a pale 1 px outline (so a dark bowl reads on a dark
floor), in a row 1.15 blocks above the pot's base, across the viewer's line of sight (each player
gets their own row, first icon on their left), bobbing ±0.05 blocks over 3 s as a gentle wave.
Adding an item pops the ghost it fills (a small white burst where it floated) for every player
who sees it; the next update redraws the row.

### Implementation: particles, not entities

**Chosen: custom particles from one atlas.** `hk:ghost_icon` draws any icon: the script sets
`variable.hk_icon` (atlas cell), `variable.hk_alpha` and `variable.hk_phase` with
`MolangVariableMap.setFloat` and spawns it with `Player.spawnParticle`, so only that player sees
it. The JSON picks the UV from the cell (`math.mod`/`math.floor`), faces the camera
(`lookat_xyz`), fades by tint alpha on `particles_blend`, and bobs with
`particle_motion_parametric`.

- **Why particles:** nothing exists in the world, so nothing is saved, nothing can be left behind
  by a crash or `/reload`, nothing can be hit, pushed, leashed or killed by `/kill @e`, and other
  add-ons' entity logic never sees it. One texture and three small JSON files.
- **Cost of particles:** a particle can't be moved or removed once spawned, so ghosts are
  re-spawned every update with a lifetime of one update plus one fade (0.5 s + 0.1 s): the old
  one fades out while the new one fades in, never more than two overlap. A ghost that's no longer
  wanted just isn't re-spawned, so it lingers up to 0.6 s (the pop covers that for adds). The bob
  phase is world time (`hk_phase`), so re-spawns continue the wave instead of restarting it.
- **Entity alternative (not built):** a billboard entity with the texture chosen by an entity
  property would move and vanish exactly, but it's saved in the world, needs an entity JSON,
  client entity, render controller and spawn/despawn bookkeeping per pot and player, and a stuck
  ghost survives a crash. Switch only if particles look bad in game (blockers.md B22).

### Caps and timing (`config.ts`)

| Constant                      | Value | Why                                                                          |
| ----------------------------- | ----- | ---------------------------------------------------------------------------- |
| `GHOST_UPDATE_TICKS`          | 10    | one `runInterval` (0.5 s) for every ghost of every player                    |
| `GHOST_LIFETIME_SECONDS`      | 0.6   | update period + `GHOST_FADE_SECONDS` (0.1): continuous, at most two overlap  |
| `GHOST_RADIUS`                | 6     | feet to pot centre; covers creative reach, so a pot you use shows its ghosts |
| `GHOST_MAX_POTS_PER_PLAYER`   | 2     | the nearest ones                                                             |
| `GHOST_MAX_SPAWNS_PER_UPDATE` | 48    | emitters per update, all players together (≤ 96/s)                           |
| `GHOST_MAX_ICONS`             | 5     | per pot; with one item in, a recipe misses at most 4                         |

Nothing runs per tick or per block, and nothing scans the world: the pots are the station
engine's active list (stations with contents, `tracked`), the viewers `world.getAllPlayers()`.
Each pot's state is read once per update however many players see it.

### Files

- `data/ghost-atlas.ts`: cell order (star, puff, then every pot ingredient and dish in recipe
  order) and layout (20 px cells: 1 px padding + an 18 px frame = 16 px icon + outline).
- `stations/ghost-logic.ts` (pure, `tests/ghosts.test.ts`): `ghostsFor(station, state, cycle)` →
  `{ mode, icons: { item, accepts }[], recipe? }`; `ghostStyle(mode)` (alpha, sparkle);
  `spawnCost`; `iconVariables` (cell, alpha, phase); `ghostPositions(pot, viewer, count)`;
  `rowCenter`; `nearestPots(viewer, dim, pots, radius, max)`; `popIndices(view, typeId, amount)`;
  `altCycle(tick)`; `GHOST_ICON_VARIABLES`.
- `stations/ghosts.ts`: `startGhosts(() => tracked.values())` (called by `startStationSweep`) and
  `popGhosts(ref, typeId, amount)` (called by `addFromHand` after a successful add).
- `tools/gen-ghost-atlas.mjs` (`npm run ghosts`; `--check` runs in `npm test`) writes
  `resource/textures/hk/particle/ghost_atlas.png` (160×60, 23 cells) and
  `resource/particles/hk/ghost_icon.json`, `ghost_sparkle.json`, `ghost_pop.json` from those
  modules and `config.ts`, so the JSON's sizes, lifetime, fade, bob and UV maths can't drift from
  the script. `format_version` 1.26.50, the newest vanilla 1.26.52.3 ships for particles (its
  poplar leaves; most vanilla particles are now binary). Icons are our own art
  (`art/harvest_kitchen/final/` first, then `generated/{items,ingredients}`); the star and puff
  are drawn by the script. The atlas has only fully opaque or fully transparent pixels: the
  ghosts' transparency is the particle tint, so it's no exception to the texture linter (which
  only reads `generated/` anyway).

### The choice form (`ui/pot-screen.ts`, `ui/pot-status.ts`)

The pot's only form, and only when two or more dishes are possible right now (`choiceOf`):
an `ActionFormData` titled with the station name, one button per dish (its icon +
`Cook <dish>`), no body, no Close button (the form's X). A full pot allows at most 4 dishes, so
it never scrolls on PC (blockers.md B23 for phones). Cold pot: fizz + `♨ Needs fire below`
instead of opening it. The form is a snapshot; the tap goes through `startCooking`, which
re-validates. Every other case has no form (`routeUse`): one dish cooks at once, idle with items
says `Add <first missing>` (lang `hk.station.next`, e.g. "Add 2 × Tomato"; the ghosts show the
rest), empty says `Add ingredients`. Taking one ingredient type out is gone with the old screen;
sneak + empty hand takes everything out.

## Recipe posters (D15)

The recipe book is gone (D15). "What can I cook at all?" is answered on the wall: a **Recipe
Poster** shows one recipe as a picture, and sneak + use turns it to the next recipe the player
has discovered.

```
+--------------------------------------------------------------+   2 blocks wide, 1 tall
| o                                                          o |   o = pins, wooden frame
|  [tomato 2][bowl]          ->        [ tomato soup, 2x ]     |   ingredients -> result
|                                                              |
|  [pot] + [flame]                     [heart] 8 s             |   station (+ fire), effect
+--------------------------------------------------------------+
```

### Using it

| Action                                | Result                                                                                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Place on a wall (side face)           | Both blocks go up together (multi-block). It shows the placer's first discovered dish, else the blank "break grass → seeds → ?" poster.                                                                  |
| Use                                   | Action bar: `Tomato Soup · ❤ Regeneration 8 s` (dish name and effect from lang; `· Filling food` without an effect); on the blank poster `Sneak + use: next recipe`.                                     |
| Sneak + use                           | The next dish **this player** has discovered, in recipe order, wrapping around; undiscovered dishes are skipped. Creative: every dish. Nothing discovered: `Break grass to find seeds`. Page-turn sound. |
| Break either half (or its wall goes)  | Both halves go; one poster drops (none in creative).                                                                                                                                                     |
| Look along the wall / not enough wall | Refused: `Look straight at the wall` / `Needs a 2-block wall` (the poster comes back).                                                                                                                   |

- **Getting one:** the first time any Harvest Kitchen item enters a player's inventory they get
  one poster (`hk:poster_given`, the book's old once-per-player mechanism with a new key), and a
  crafted or `/give` poster counts. Crafting: **paper + any HK crop**, shapeless, 1 poster. The
  crop is the item tag `hk:crops` on the 5 produce items (the tag-as-ingredient precedent is the
  old book recipe's `hk:seeds`, still **untested**, so this shares that risk). It's in the
  creative menu (Items).
- **Discovery** is unchanged (`discovery/unlock.ts`, `hk:found`): a dish counts as discovered once
  all its crops are found. Posters are shared, so anyone sees what a poster shows; only the cycle
  is per player.

### Texture resolution (research, 2026-10-22, game 1.26.52.3)

**Question:** what resolution can a custom block's face use, and does the terrain atlas shrink it?

- **The vanilla RP mixes resolutions in `atlas.terrain`.** Of the block textures in the 1.26.52.3
  vanilla packs (`textures/blocks.brarchive`, read with the reader in `tools/gen-textures.mjs`),
  2139 are 16×16, but `vanilla_1.26.50/straw_bed.png` is **64×64**, the 1.21.110 shelves,
  `decorated_pot_base` and the dried ghast tentacles are **32×32**, and the conduit wind is 64×704;
  `vanilla_1.26.50/terrain_texture.json` registers `straw_bed` in `atlas.terrain` like any block.
  A UV-mapped 64 px bed would look broken if the atlas cut every tile to 16 px, so the atlas keeps
  a tile's own resolution.
- **Downscaling** happens to the **whole atlas, only when it overflows**: Bedrock Wiki "Texture
  Atlases": "If an atlas contains too many sub textures, Minecraft will decrease the resolution of
  textures in the atlas until they all fit." Our 28 poster tiles at 64 px plus 8 px padding add
  about 180 k texels (≈ 9 % of a 16 px vanilla atlas of ~2000 tiles); 128 px tiles would add
  ~580 k (≈ 28 %) and push weaker devices toward the overflow.
- **Non-square** textures are stretched to square in the atlas (same page), so each half is its
  own square 64×64 texture rather than one 128×64 image.
- **Mipmaps:** `num_mip_levels` 4 and `padding` 8 (vanilla's values, ours too; padding must be
  ≥ 2^(levels−1) − 1). Each level halves the texture: 64 → 32 → 16 → 8. Mipmapping picks the level
  whose texels match the screen pixels, so it only drops detail the screen can't show at that
  distance; up close the full 64 px is used. The binary has `atlas_resolution` and `maxTextureSize`
  strings, but no per-texture limit message.
- **Geometry limit:** a block model is at most 30×30×30 px (minecraft.net "Custom block geometry
  release"), so one block can't draw a 2-block poster (32 px); the selection box must stay inside
  (−8, 0, −8)…(8, 16, 8) (binary error text).

**Choice: 2×1 blocks at 64 texels per block** (a 128×64 image, two 64×64 halves).

- A recipe needs up to 5 ingredient slots + arrow + result + station (+ flame) + effect. At 16 px
  per icon that's at least ~120 px wide. On **1×1** it only fits at 128 px per block, with icons
  1/8 block wide; **2×1 at 64** gives the same layout with icons **1/4 block** wide, twice the
  size on screen, and a quarter of the atlas cost.
- Readability: from 4 blocks away on a 1080p screen (FOV 70) a block is ~190 px tall, so a 1/4
  block icon is ~48 px (an inventory icon at GUI scale 3) and the 7 px digits are ~21 px tall. A
  phone at 720p still gets ~32 px icons. 32 px per block would not fit the recipe at all.
- **Two blocks, not one big model:** the 30 px limit rules out one model, and the stable
  **`minecraft:multi_block`** trait (horizontal directions need block format 1.26.50, no
  experiment; Microsoft Learn "Block Traits: multi-block" and "Create a Multi-Block") places both
  parts together and breaks them together, so no hand-made pairing is needed. That's the robust
  option the decision asked for.

### Block design (`hk:recipe_poster`, generated by `tools/gen-poster-block.mjs`)

- **Traits:** `minecraft:multi_block` (2 parts, `minecraft:multi_block_part`) and
  `minecraft:placement_direction` (`minecraft:cardinal_direction`, `y_rotation_offset` 90). The
  multi-block trait allows no other trait (Microsoft Learn), so `minecraft:placement_position` /
  `block_face` can't be used. With `placement_direction` present, the parts run along the stored
  cardinal direction; the 90° offset turns that from "into the wall" to "along the wall".
- **States:** `hk:poster` 0–13 (0 = blank, then the 13 dishes in recipe order:
  `posters/poster-logic.ts`), `hk:facing` north|south|east|west (out of the wall), `hk:right`
  (this part shows the right half). 10 bits with the trait states. The int state allows 16
  values: 15 dishes + blank. A 16th dish needs a second state (e.g. `hk:poster_page`).
- **Facing:** `beforeOnPlayerPlace` (stable `BlockCustomComponent`) reads the clicked face
  (`face`) and sets `hk:facing`, `hk:right` (first guess from the cardinal direction) and the
  first discovered dish in `permutationToPlace`. One tick later the script reads where the parts
  really are (`Block.getParts()`, stable 2.10.0) and sets `hk:right` on each from the viewer's
  right, so the half order doesn't depend on the trait's direction convention. If the parts
  aren't side by side along the wall, or either has no solid block behind it, both are removed
  and the poster comes back with a hint.
- **Permutations:** 4 facings × 2 halves × 14 posters = 112 looks (111 permutations + the base),
  each with **both** `material_instances` (`*` → that half's texture, `opaque`) and
  `transformation` (north 0°, west 90°, south 180°, east 270°), so nothing depends on two
  permutations combining (blockers.md B16). All materials `opaque` (the frame needs no cutout).
- **Shape:** `geometry.hk.recipe_poster`, one 16×16×1 px panel against the south edge of the cell
  (front faces north in model space); collision and selection boxes the same 1 px panel;
  `light_dampening` 0; the edges sample the frame from the same texture.
- **Support:** `placement_filter` `allowed_faces: ["side"]` keeps it off floors and ceilings and
  should pop it when the wall goes (as the cake's filter); `movable: popped`. Because the poster
  has no `block_face` state, whether the filter re-checks the right neighbour is unproven, so
  `posters/poster-support.ts` is the cake's safety net again: after a player break, explosion or
  piston move it looks at the 4 horizontal neighbours for a poster whose wall that was and breaks
  it with `/setblock … destroy`.
- **Drops:** both parts' loot is `nothing.json`; the script drops one poster from `onBreak` /
  `onPlayerBreak` (deduplicated over the two parts and both events, none for a creative player).
  This avoids depending on how the game spreads loot over multi-block parts.
- **Sneak + use** goes through `world.beforeEvents.playerInteractWithBlock` (cancelled, then the
  cycle runs next tick), as on the pot; plain use is the component's `onPlayerInteract`. A
  5-tick per-player gate (`POSTER_USE_GAP_TICKS`) keeps one click one action even if both parts
  report it.

### Textures and art

- `resource/textures/hk/poster/<dish>_left.png` / `_right.png` and `blank_left/right` (28 ×
  64×64, 16 KiB), shortnames `hk_poster_<stem>_<half>` in `terrain_texture.json` (the renderer
  keeps those entries in sync). Generated; don't edit by hand.
- Layout (128×64 texels): wooden frame, paper with two red pins; a 3×2 ingredient grid (18 px
  slots, counts like the inventory, cod/salmon as a split icon) → arrow → the result at 2× in a
  large slot; under them the station (pot + flame, or the crafting table) and the effect family
  icon + duration (sandwiches: the food shank + nutrition). Only numbers and symbols, our own art.
- Item icon `textures/hk/items/recipe_poster.png`: drawn in `tools/gen-textures.mjs` (a framed
  sheet with pins and tomato → soup), linted with the other icons.
- Preview: `art/harvest_kitchen/poster_preview/posters.png`. Mockups:
  `art/harvest_kitchen/mockups/poster_tomato_soup.png` and `poster_on_wall.png`
  (`node art/harvest_kitchen/mockups/poster_mockups.mjs`).

```sh
npm run posters   # gen-posters.mjs (textures + terrain entries + preview), gen-poster-block.mjs, lint-posters.mjs
```

The renderer (`tools/gen-posters.mjs`, the old book page renderer) bundles the pack's own
`posters/poster-logic.ts`, so it draws exactly the textures the block can show and deletes stale
ones. Re-run after changing a dish, recipe or any texture in `art/harvest_kitchen/generated/`. The
lint rules are in `art-style.md` "Recipe posters".

## /hk:debug

Operator-only (`GameDirectors`), works without cheats. One enum argument:

| Command              | Does                                                                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/hk:debug kit`      | Gives every HK item (8 of stackables, 1 of bowl dishes), every vanilla ingredient the recipes use, a campfire, 32 bone meal, a wooden hoe, a water bucket and 2 paper (for the poster recipe). What doesn't fit drops at your feet. Chat: `Kit: N item types`. |
| `/hk:debug grow`     | Sets every HK crop/bush within 8 blocks (±4 vertically) to its last stage. Chat: `Grew N crops.`                                                                                                                                                               |
| `/hk:debug fast`     | Toggles fast cooking (saved in the world): new jobs take 1 s, running ones finish within a second. Chat: `Fast cooking on/off.`                                                                                                                                |
| `/hk:debug pot`      | Prints the station you look at (8 blocks): id, position, phase, block states, items, job ticks, output, what the ghosts show (D15), saved size, number of active stations, fast flag.                                                                          |
| `/hk:debug validate` | Re-runs the data check and prints the count plus up to 40 problems to chat.                                                                                                                                                                                    |
| `/hk:debug reset`    | Forgets your found crops and that you got the starter poster (to retest discovery and the hand-out).                                                                                                                                                           |

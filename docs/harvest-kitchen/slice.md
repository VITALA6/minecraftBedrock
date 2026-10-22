# Harvest Kitchen: portfolio slice (code)

Pack `packs/harvest_kitchen`, namespace placeholder `hk`. Stable `@minecraft/server` 2.10.0 and
`@minecraft/server-ui` 2.2.0 only, no experiments. This replaces the MVP code (`mvp.md`, throwaway
per D9, no migration). The spec is `plan.md` §1–§3 and §5.2.

Written 2026-10-21/22 without an in-game run. Everything not yet seen working in game is tagged
**(untested)**. All art is **placeholder** at the final paths (see "Art" below).

## What's implemented

| Feature           | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 crops           | Tomato, onion, cucumber (`crop`: break to harvest) and chili, strawberry (`bush`: use to pick). One block component `hk:crop_growth` with a flat `type` param. Onion is its own seed.                                                                                                                                                                                                                                                                               |
| Bushes            | Mature (stage 3) + use with anything: drops 1–3 chili / 2–3 strawberries, falls back to stage 2, regrows. Bone meal on a young bush grows it. Planted on grass, dirt, coarse dirt, podzol or farmland (see decisions).                                                                                                                                                                                                                                              |
| Seed drops        | Breaking short grass, tall grass, fern or large fern (not creative, not shears): one roll; each crop has 5 % in its biomes (`Dimension.getBiome()`) and 1 % anywhere else, so a break drops at most one HK seed.                                                                                                                                                                                                                                                    |
| Cutting board     | Tomato → 2 Sliced Tomato, Onion → 2 Chopped Onion, Cucumber → 2 Sliced Cucumber. Chop sound + bits in the crop's colour. Sneak + use chops the held stack, one every 6 ticks, stops past 4 blocks, on item switch, or if the board goes. Wrong item: thud, puff, `✘ Can't cut that`. Empty hand: tap, `Hold a vegetable`.                                                                                                                                           |
| Station engine    | Generic container station from config (`data/stations.ts`): recipe list, capacity, heat rule, visual-state mapping. One `runInterval` (10 ticks) drives every station with contents. Cook time is stored as ticks left and only counts down with heat, so it pauses without heat and survives `/reload` (the active list is rebuilt at `worldLoad`).                                                                                                                |
| Heat (D5)         | Lit campfire, lit soul campfire (`extinguished` state), fire, soul fire, magma, lava/flowing lava directly below. Cached in the `hk:hot` state for the hot rim; refreshed by the sweep, on use, on random ticks, and when a heat block is placed, broken or interacted with below a pot.                                                                                                                                                                            |
| Cooking pot       | S8 model. States `hk:fill` 0–3, `hk:phase` idle/ready/cooking/done, `hk:hot`, `hk:liquid` (7 colours). Bone visibility shows the liquid level and the lid (cooking). The liquid shows what's in the pot (`liquidOf`: the matched dish's colour, else the main ingredient's, else clear water) with a glint when ready or done; the rim glows when hot; light 7 while cooking with heat. Generated permutations (`tools/gen-pot-block.mjs`). All materials `opaque`. |
| Pot interactions  | Exactly §2.3: add one / sneak adds the stack; refusals; chime + `✔ Dish` when a new dish becomes possible; empty hand auto-cooks the only possible dish, opens the pot screen for several or for "idle with items", says `Add ingredients` when empty; `♨ ■■■□□` while cooking (or `♨ Needs fire below` when paused); done → dish into your hand or inventory, anyone can collect; sneak + empty hand takes everything out; break spills.                           |
| Pot screen (§2.4) | `CustomForm` (D14): a pre-rendered status image (the target recipe in the pot with present / "+N" missing slots, lit or cold flame, the result or its ghost) plus buttons: Cook (one per possible dish), Almost! (closest recipe → its book page), Take out (one per ingredient type), Recipe Book, Close. Updates live while open; every tap re-validated. See "Book and pot screen (D14)".                                                                        |
| Recipe book (§3)  | `hk:recipe_book` item (`onUse`). `CustomForm` (D14): one large pre-rendered page image per page, title from lang, one short label, ◀ Prev / Next ▶ / Contents, a few context buttons (dish names or `???`, crops, chapters), Close. 24 pages: Home, What can I make?, Pot chapter + 7 dishes, Board, Crafting chapter + 6 dishes, Crops chapter + 5 crops. See "Book and pot screen (D14)".                                                                         |
| Discovery (D3)    | Found crops per player (`hk:found` dynamic property), from `playerInventoryItemChange`. A dish unlocks once all its HK crops are found; locked entries are `???` with the locked icon. `★ New recipe!` subtitle + page-turn, at most once per 3 s. Creative: all unlocked. Book handed out the first time any HK item enters the inventory; craftable from Book + any HK seed (tag `hk:seeds`, onion included).                                                     |
| Dishes            | All 13 MUST dishes. Pot: tomato soup, vegetable stew, chili stew, fish chowder (cod **or** salmon), chicken soup, onion soup, strawberry jam. Crafting (shapeless): garden salad, salsa, veggie sandwich, hearty sandwich, strawberry cup, strawberry cake. Effects via `hk:dish`; containers come back via `using_converts_to`.                                                                                                                                    |
| Strawberry Cake   | Cake + 2 Strawberry. Item places block `hk:strawberry_cake`, state `hk:slices` 0–3 (slices eaten). Use = eat a slice at any hunger (3 food, saturation 0.4, Regeneration I 5 s), eat sound + chime + hearts; the 4th slice removes the block. Breaking drops nothing (no free cake). Only placeable on top of a block; pops (dropping nothing) when the block below goes or a piston pushes it (B15). Generic `hk:sliced_dish` component.                           |
| Validation        | `data/validate.ts` at `worldLoad`; results in the Content Log, via `/hk:debug validate`, and announced to operators on join if there are problems.                                                                                                                                                                                                                                                                                                                  |
| `/hk:debug`       | Operator-only custom command (see below).                                                                                                                                                                                                                                                                                                                                                                                                                           |

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
(stick + 2 planks in a row), Recipe Book (Book + any HK seed, shapeless).

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
  `hk:hearty_sandwich`, `hk:strawberry_cup`, `hk:strawberry_cake`; `hk:recipe_book`,
  `hk:cooking_pot`, `hk:cutting_board`.
- **Blocks:** `hk:tomato_crop`, `hk:onion_crop`, `hk:cucumber_crop`, `hk:chili_bush`,
  `hk:strawberry_bush`, `hk:cooking_pot`, `hk:cutting_board`, `hk:strawberry_cake`.
- **Block states:** `hk:growth` 0–3 (crops, bushes); `hk:fill` 0–3, `hk:phase`
  idle|ready|cooking|done, `hk:hot` bool, `hk:liquid` water|tomato|chili|jam|stew|broth|cream
  (pot: 2 + 2 + 1 + 3 = 8 bits, 4 × 4 × 2 × 7 = 224 permutations);
  `hk:slices` 0–3 (cake); `minecraft:cardinal_direction` (board).
- **Custom components:** block `hk:crop_growth`, `hk:cutting_station`, `hk:container_station`,
  `hk:sliced_dish`; item `hk:dish`, `hk:recipe_book`.
- **Item tag:** `hk:seeds` (4 seeds + onion), used by the book recipe.
- **Dynamic properties:** world `hk:st:<station>:<dimension>:<x>,<y>,<z>` (station JSON),
  world `hk:debug_fast` (bool); player `hk:found` (comma-separated crop keys), player
  `hk:book_given` (bool).
- **Saved ids that freeze at the first public build:** recipe ids (`hk:tomato_soup`, …), crop keys
  (`tomato`, `onion`, `cucumber`, `chili`, `strawberry`), the property keys and the state names.
- **Command:** `/hk:debug`, enum `hk:debug_action`.

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
    heat.ts                  what counts as heat below (pure; a Block fits HeatBlock)
    cutting-board.ts         hk:cutting_station + sneak-chop
  food/
    dish.ts                  hk:dish: effect on eat
    sliced-dish.ts           hk:sliced_dish: eat a slice of a placed dish
    dish-support.ts          pops a placed dish left on air (break/explosion/piston; B15)
    feed.ts                  hunger/saturation/effect helpers
  book/
    unlock.ts                crops of each item/dish, unlock rule, hk:found format, toast timing (pure)
    discovery.ts             player property, first-item book hand-out, toast
    book-item.ts             hk:recipe_book: open the book
  ui/
    forms.ts                 shared CustomForm helpers (show, close, later, runForm)
    book-pages.ts            page order, Prev/Next, image per player, context buttons (pure)
    book.ts                  the recipe book CustomForm
    pot-status.ts            pot screen image and buttons for a state (pure)
    pot-screen.ts            the pot screen CustomForm
  debug/debug-command.ts     /hk:debug
  lib/                       block states, inventory, text (lang keys), feedback (sound/particle),
                             tick-gate (per-player rate limit: book open, cake bites)
tests/                       node:test unit tests for the pure modules (see "Tests")
```

## How to add content

- **A pot recipe:** one entry in `STATION_RECIPES` (`data/recipes.ts`) and, for a new dish, an
  entry in `DISHES` (`data/dishes.ts`) plus the item JSON (`minecraft:food`, `"hk:dish": {}`),
  texture `textures/hk/items/<name>.png` + `item_texture.json` + lang key. A pot dish needs a
  `liquid` colour (`checks.ts` reports a missing one); a new colour is a `LIQUIDS` entry
  (`data/liquids.ts`, append only), a `POT_LIQUIDS` entry in `tools/gen-textures.mjs`, the two
  PNGs copied + `terrain_texture.json`, then `node tools/gen-pot-block.mjs`. The pot, its screen,
  "Almost!", the book and validation pick it up.
- **A crafting dish:** the shapeless JSON in `behavior/recipes/`, the same recipe in
  `CRAFTING_RECIPES` (it's what the book shows; keep both in sync), a `DISHES` entry, item JSON,
  texture, lang.
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
- **Effect family in the book:** the page image shows our family badge (family icon + duration);
  the label under it names the effect with the vanilla lang key, after the family glyph
  (❤ red heal, ▶ blue move, ■ yellow work, ● green explore), which also prefixes dish buttons.
  No vanilla effect icons (D14: our own art only).
- **No Back button in the book:** Prev/Next walk the book in order, Contents goes Home, and the
  context buttons jump (dish → crop, crop → dish, chapter → dish).
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
  `crops/seed-roll.ts`, `book/unlock.ts`, `data/checks.ts`, plus `config.ts` and `data/*.ts` except
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
  The book and pot screen (`book-pages`, `pot-status`): page order, Prev/Next, locked/unlocked
  image choice for every discovery state, context buttons, "What can I make?", the pot image and
  buttons per state (and every state of up to 4 items reaching an existing image), every image
  path the script can produce exists as a PNG and no PNG is orphaned; `pack-files` checks
  `RP_UUID` equals the RP header UUID.
- **Pure modules** also include `ui/book-pages.ts` and `ui/pot-status.ts`.
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
  `ActionFormData.header/divider/button(icon)`; `show()` is `no-restricted-execution` (the book
  item defers it with `system.run`); `Block.above(steps)`; `Player.getBlockFromViewDirection`.
  `tsc` checks every call against these typings.
- **CustomForm APIs** (D14, `server-ui@2.2.0/index.d.ts`): `new CustomForm(player, title)` (title
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
6. The `hk:seeds` item tag works as a shapeless recipe ingredient.
7. `setTitle("§r", { subtitle })` shows only the subtitle.
8. The recipe book opens once per use, in the air (`onUse`) and while looking at a block
   (`onUseOn`), with no other use component (blockers.md B12).
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
19. The book and pot screen (D14): `image()` with an observable `src` flips in place, button
    `visible`/`disabled` observables work on a pool of 13 buttons, the ◀ glyph renders, and the
    page images are readable at form size on PC, phone and console (blockers.md B18–B21).

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
  dishes, `recipe_book`, `cooking_pot`, `cutting_board` (28 files).
- `textures/hk/blocks/`: `<block>_stage_0..3` for the 5 crops/bushes; `cooking_pot_side`, `_top`,
  `_lid` (S8), `cooking_pot_top_hot`; `cooking_pot_liquid_<colour>` and `_<colour>_ready` for the
  7 liquid colours (the S8 liquid recoloured; `tomato` is the S8 texture itself);
  `cutting_board_side`, `_top`, `_knife`; `strawberry_cake_side`, `_top`, `_inner`, `_berry`
  (45 files, shortnames `hk_<file>`).
- `textures/hk/ui/`: `family_heal`, `family_move`, `family_work`, `family_explore`, `locked`,
  `chapter_crops`, `chapter_what_can_i_make`, `needs_heat` (referenced by path).
- `textures/hk/book/` and `textures/hk/pot/`: the rendered book pages and pot status images
  (`npm run book`, see "Book and pot screen (D14)"). Generated; don't edit by hand.

## Book and pot screen (D14)

Both are `CustomForm`s (`@minecraft/server-ui` 2.2.0) showing one pre-rendered image with
`image(src, RP_UUID, { width: 1 })` and icon-free buttons under it. `src` is the RP-relative path
with `.png` and `RP_UUID` (`config.ts`) is the resource pack's header UUID (S1a; a test keeps it
equal to `resource/manifest.json`). The images contain only numbers and symbols; every word is a
lang key in the title, the label or a button, so localization still works.

### The book (`ui/book.ts`, `ui/book-pages.ts`)

```
title      page name (lang): Recipe Book, Cooking Pot, Tomato Soup, ??? ...
image      the page for this player (locked or unlocked)
label      one short line: "❤ Regeneration · 8 s", "Grass in: Plains, forests", "Find these crops first."
◀ Prev     disabled on the first page
Next ▶     disabled on the last page
Contents   Home (disabled on Home)
context    Home: What can I make? + 4 chapters; chapter: its dishes (name, or ??? when locked)
           or crops; dish: → its crops (+ Cutting Board for sliced ingredients);
           crop: its dishes once found; What can I make?: the dishes you can make now
Close (X)  closeButton()
```

- **Order** (Prev/Next, page numbers in the images): Home, What can I make?, Pot chapter, 7 pot
  dishes, Board chapter, Crafting chapter, 6 crafting dishes, Crops chapter, 5 crops (24).
- **Flipping in place** (`BOOK_FLIP = "in_place"`): title, image `src`, label, Prev/Next disabled
  state and a pool of 13 context buttons (`MAX_CONTEXT_BUTTONS`, observable label + `visible`)
  are observables; a tap changes them, with a page-turn sound. `BOOK_FLIP = "reopen"` closes the
  form and opens a fresh one per page instead (the fallback if observable `src` or `visible`
  misbehaves in game, B18).
- **Discovery** picks the image: `dish_<name>` when unlocked, else `dish_<name>_locked_<missing
crops>`; `crop_<key>` or `crop_<key>_locked`. Creative unlocks everything. Chapter indexes,
  Home and What are the same image for everyone (dish silhouettes with family gems); the
  per-player part is the button labels.
- Every button callback only schedules work (`system.run`, `ui/forms.ts` `later`), and re-checks
  the player.

### The pot screen (`ui/pot-screen.ts`, `ui/pot-status.ts`)

Opens as before from `routeUse` → `"screen"` (several dishes possible, or idle with items), one
tick later. Buttons: **Cook `<dish>`** (one per possible dish; closes, `startCooking` re-validates
and says why if it can't), **Almost! `<dish>`** (only when nothing is possible → the book on that
dish), **Take out `<item>` ×N** (one per ingredient type), **Recipe Book** (→ the pot chapter),
Close. A cold pot adds the label `♨ Needs fire below`. While open it re-reads the pot every
`POT_SCREEN_REFRESH_TICKS` (10): the image and Take-out counts update in place; a different set of
buttons or heat reopens the screen; cooking, done or empty closes it.

**Trade-off: the image shows the target recipe, not the literal contents.** The pot holds up to 8
items of 15 ingredient types, so "every possible contents" can't be pre-rendered, and images can't
be composed side by side (they always stack, S1b). The useful fact is that whatever is in the pot,
the screen is about one recipe: the single possible one, or the closest one ("Almost!"). So the
image is keyed by **recipe × missing count per slot × heat**:

- slot complete: solid icon (with its count if > 1);
- slot partly there: solid icon with a yellow "+N";
- slot not there at all: ghost icon with "+N";
- the flame lit or cold (plus a red "!"), the arrow white when it can cook, and the result solid
  (ready over fire) or ghosted;
- the dish's effect badge under the pot.

That is 123 vectors over the 7 pot recipes × 2 heats + 2 generic "choose" images (several dishes
possible) = **248 images, 0.6 MiB**. What the image can't show: ingredients that belong to no slot of
the target recipe ("extras"); they appear only as Take-out buttons. Composing from stacked strips
(one image per item row) would show the literal contents with ~20 images, but makes a tall form
whose buttons scroll away; one image keeps the screen short.

### Pages and images

| Image                               | Count | Shows                                                                                                                                               |
| ----------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home`                              | 1     | the book, the 4 family badges; right page: What + 4 chapters with entry counts (same order as the buttons)                                          |
| `what`                              | 1     | magnifier; a bag of ingredients → a dish                                                                                                            |
| `chapter_pot`, `chapter_crafting`   | 2     | the station (pot over flame / crafting table), family legend, dish silhouettes with family gems                                                     |
| `chapter_board`                     | 1     | the board; tomato/onion/cucumber → board → ×2 slices                                                                                                |
| `chapter_crops`                     | 1     | seedling; grass → seed → farmland; all 10 biome icons                                                                                               |
| `dish_<name>`                       | 13    | dish on a sunburst, family badge + duration, station (+ flame), food shanks; 3×3 recipe grid → result; "grass in these biomes → seed" for each crop |
| `dish_<name>_locked_<crops>`        | 33    | same layout; dish, badge, food and the missing crops' ingredients and seeds as silhouettes with "?"; only the missing crops in the find strip       |
| `crop_<key>`, `crop_<key>_locked`   | 10    | produce, 4 growth stages, seed → farmland; where to find (grass + all biomes → seed); board recipe or bush pick (1–3)                               |
| `pot_<recipe>_<missing>_<lit/cold>` | 246   | see the trade-off above                                                                                                                             |
| `pot_choose_<lit/cold>`             | 2     | empty pot slots → "?"                                                                                                                               |

62 book pages (1024×640) + 248 pot images (1024×384) = 310 PNGs, **1.0 MiB** in
`resource/textures/hk/book/` and `resource/textures/hk/pot/`.

**Resolution:** pixel art on a 256×160 (book) / 256×96 (pot) canvas, scaled ×4 nearest-neighbour.
Icons are drawn at 1× minimum (64 PNG px; ≈ 17 UI px if the form image is ~280 UI px wide) and
the 7 px font at 1× (≈ 7.7 UI px, game-font size). ×4 keeps edges hard if the game resamples. The
rules and the lint are in `art-style.md` "Book pages".

### Re-rendering

```sh
npm run book     # node tools/gen-book-pages.mjs && node tools/lint-pages.mjs
```

The renderer bundles the pack's own `ui/book-pages.ts` and `ui/pot-status.ts` (esbuild, as
`gen-pot-block.mjs` does), so it draws exactly the images the script can ask for, and removes
stale PNGs. Re-run after changing a dish, crop, recipe, or any texture in
`art/harvest_kitchen/generated/`. Contact sheets: `art/harvest_kitchen/book_preview/book_pages.png`
and `pot_status.png`. Art: our own textures only (`generated/{items,ui,ingredients,blocks}` and
the mockup `parts/`); a missing texture becomes a neutral "?" tile with a warning.

## /hk:debug

Operator-only (`GameDirectors`), works without cheats. One enum argument:

| Command              | Does                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/hk:debug kit`      | Gives every HK item (8 of stackables, 1 of bowl dishes), every vanilla ingredient the recipes use, a campfire, 32 bone meal, a wooden hoe, a water bucket and a book. What doesn't fit drops at your feet. Chat: `Kit: N item types`. |
| `/hk:debug grow`     | Sets every HK crop/bush within 8 blocks (±4 vertically) to its last stage. Chat: `Grew N crops.`                                                                                                                                      |
| `/hk:debug fast`     | Toggles fast cooking (saved in the world): new jobs take 1 s, running ones finish within a second. Chat: `Fast cooking on/off.`                                                                                                       |
| `/hk:debug pot`      | Prints the station you look at (8 blocks): id, position, phase, block states, items, job ticks, output, saved size, number of active stations, fast flag.                                                                             |
| `/hk:debug validate` | Re-runs the data check and prints the count plus up to 40 problems to chat.                                                                                                                                                           |
| `/hk:debug reset`    | Forgets your found crops and that you got the book (to retest discovery and the hand-out).                                                                                                                                            |

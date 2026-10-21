# Harvest Kitchen: project plan

Status on 2026-10-21:

- The MVP vertical slice (`mvp.md`) works in game on 1.26.52.3.
- Decisions D1–D11 are recorded in [§8](#8-decisions).
- **M0 is closed (2026-10-21).** S1–S3 ran in game and are recorded in [§5.3](#53-spikes). The S8
  model half is done; its texture half moves into PS-1. The forms decision (D11) is made:
  `ActionFormData` for the pot screen and the recipe book. `packs/hk_spikes` is deleted.
- The portfolio slice (PS) is in progress. On 2026-10-22 one build session produced the PS-1 and
  PS-2 code, the P1 textures (`tools/gen-textures.mjs`, generator v1) and the board and cake
  models. None of it has been tested in game yet: the test script is
  [`tests/portfolio-slice.md`](tests/portfolio-slice.md), code notes are in [`slice.md`](slice.md),
  open issues in [`blockers.md`](blockers.md). Hand touch-up of the textures hasn't started.

This plan takes the MVP to a Marketplace-quality add-on for a Waypoint Studios application. It
assumes part-time development at 4 evenings a week. Art comes from a palette-driven texture
generator and Blockbench models built through its MCP, finished by hand (see
[§4.5](#45-art-pipeline-d10)). Estimates count developer time only, calibrated on actual velocity
(see [§6](#6-milestones)).

**Order of work (D8):**

1. M0 spikes.
2. The **portfolio slice** for the application.
3. The rest of the MUST scope.
4. QA and marketing.

Priorities: **MUST** ships in v1. **SHOULD** ships in v1 if the milestone budget allows, otherwise
in v1.1. **LATER** is backlog and is not designed in detail here. **[slice]** marks what the
portfolio slice includes.

Facts this plan relies on were checked on 2026-10-21 against the pinned `.d.ts` files
(`@minecraft/server` 2.10.0, `@minecraft/server-ui` 2.2.0), the 1.26.52.3 binary and vanilla files,
and Microsoft Learn. Anything not yet proven in game is tagged **(spike Sx)**.

---

## 0. Product pitch and positioning

**Positioning (D2): the kid-friendly cooking add-on.** Three features carry the positioning, and
the slice must show all three:

- **effect families by colour**: red heals, blue moves, yellow works, green explores;
- **"What can I make?"** in the recipe book;
- **shareable placeable dishes**: a cake you put down and everyone eats a slice.

One line per audience:

- **Kids:** grow funny vegetables, chop them, drop them in a pot, get food that gives you powers.
- **Adults:** a compact farming and cooking loop that fits survival worlds. It has 5–7 crops,
  ~16 dishes with useful effects, and a recipe book. No experiments, and it works in existing worlds.
- **Publisher:** it's stable-API-only, has data-driven content, is fully localized, conflict-free
  (it overrides no vanilla files), and stays polished with a small asset list.

Design pillars, used to settle every UX argument:

1. **World first, form second.** The common actions are all "hold X, use block". A form opens only
   when the player has a real choice to make.
2. **Every state is visible on the block.** The player can tell what the pot is doing from across
   the room.
3. **Every action answers.** Each action gets a sound, a particle, and at most one short line in
   the action bar.
4. **Short text.** Messages are at most 5 words. Lists show icons. No walls of text.

---

## 1. Final scope

### 1.1 Crops (5 MUST + 2 SHOULD = 7)

Cabbage and rice are gone (D2): together with the board and pot they read as a Farmer's Delight
copy. Tomato and onion stay. They're too generic to avoid, so our art and hook carry the
difference.

Replacements, decided 2026-10-21:

- **Cucumber** (D2a) replaces cabbage. It has a unique oblong silhouette, a green no other crop
  uses, and an easy-to-read slice icon.
- **Eggplant** (D2b) replaces rice. It's the only purple crop, so onion art is golden-brown.

| Crop               | Mechanic                                               | Seed source (see 1.5)                        | Prep on board   | Priority     |
| ------------------ | ------------------------------------------------------ | -------------------------------------------- | --------------- | ------------ |
| Tomato             | 4-stage crop, break to harvest (done)                  | grass in temperate biomes                    | Sliced Tomato   | MUST [slice] |
| Onion              | 4-stage root crop; the onion **is** its own seed       | grass in plains, taiga, savanna              | Chopped Onion   | MUST [slice] |
| **Cucumber** (D2a) | 4-stage crop, break to harvest                         | grass in plains, forest, near rivers         | Sliced Cucumber | MUST [slice] |
| Chili Pepper       | bush: **use to harvest**, regrows (like sweet berries) | grass in jungle, savanna, badlands edges     | none            | MUST [slice] |
| Strawberry         | bush, same mechanic as chili (shared component)        | grass in meadow, flower forest, cherry grove | none            | MUST [slice] |
| Corn               | 2-block-tall crop                                      | grass in plains, savanna                     | none            | SHOULD       |
| **Eggplant** (D2b) | 4-stage crop, break to harvest                         | grass in savanna, plains                     | none            | SHOULD       |
| Herbs/garlic       | seasoning ingredient                                   | n/a                                          | n/a             | LATER        |

Dropping rice also drops the waterlogged-crop risk (old spike S4).

Vanilla ingredients carry much of the variety at zero asset cost: wheat, carrot, potato, beetroot,
mushrooms, egg, sugar, raw meats and fish, sweet berries, bread, bowl, glass bottle, cake.

### 1.2 Stations

| Station                  | What it adds                                                                                                                                       | Priority                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Cutting Board            | Prep step: turns a crop into an ingredient. It's instant and needs no menu.                                                                        | MUST [slice] (done, UX pass) |
| Cooking Pot              | Soups, stews and jam. It holds ingredients, cooks over time and shows its state.                                                                   | MUST [slice] (redesign)      |
| Heat source under pot    | The pot cooks only above a campfire, soul campfire, fire, magma or lava (D5). A cold vs. hot visual makes the rule obvious.                        | MUST [slice]                 |
| Crafting table (vanilla) | Cold dishes and **placeable dishes** are shapeless crafting recipes. They need no new station and appear in the vanilla recipe book automatically. | MUST [slice]                 |
| Oven                     | Baked dishes, pies and pizza. **Not in v1 (D4).** The pot engine is written so that an oven is a config, not new code.                             | LATER (v1.1)                 |
| Drying rack              | Passive processing. Showing items on the rack needs entities or many states.                                                                       | LATER                        |
| Knife item               | Friction for kids, and it looks derivative.                                                                                                        | no                           |

**Placeable dishes without an oven:** the hook needs at least one shareable dish in v1. The
**Strawberry Cake** is crafted from a vanilla Cake plus 2 Strawberries, an "upgrade a cake" recipe
kids get immediately. It's a block with a `hk:slices` state (0–3). Each use eats one slice and
heals a little, so a group shares one cake.

### 1.3 Dishes (13 MUST + 3 SHOULD = 16; 5 oven dishes LATER)

Balance rules:

- **Worth cooking:** a dish restores more than its raw ingredients eaten separately (about +20 %
  or more). It never restores more than 10 hunger per serving.
- **One effect per dish, level I.** Durations: Regeneration 5–20 s, utility effects 60–180 s.
- **No Strength, no Resistance II, no Instant Health.** That keeps PvP and boss fights vanilla.
- **Can always eat** only applies to dishes whose effect matters when you're full. Plain filling
  food follows vanilla rules.
- **Containers come back:** bowl dishes return the bowl, and the jam returns its bottle
  (`minecraft:food` `using_converts_to`).
- Numbers are a first pass and get tuned in M4 against vanilla (bread 5, cooked beef 8,
  rabbit stew 10).

| #   | Dish                    | Station  | Ingredients                                            | Food | Effect (family)                  | Priority     |
| --- | ----------------------- | -------- | ------------------------------------------------------ | ---- | -------------------------------- | ------------ |
| 1   | Tomato Soup             | Pot      | 2 Tomato, Bowl                                         | 6    | Regeneration I, 8 s (Heal)       | MUST [slice] |
| 2   | Vegetable Stew          | Pot      | Tomato, Onion, Carrot, Potato, Bowl                    | 10   | Regeneration I, 15 s (Heal)      | MUST         |
| 3   | Chili Stew              | Pot      | Chili, Raw Beef, Tomato, Onion, Bowl                   | 10   | Fire Resistance, 120 s (Explore) | MUST [slice] |
| 4   | Fish Chowder            | Pot      | Raw Cod or Salmon, Potato, Onion, Bowl                 | 8    | Water Breathing, 120 s (Explore) | MUST         |
| 5   | Chicken Soup            | Pot      | Raw Chicken, Onion, Carrot, Bowl                       | 8    | Absorption I, 60 s (Heal)        | MUST         |
| 6   | Onion Soup              | Pot      | 2 Onion, Bread, Bowl                                   | 7    | Night Vision, 120 s (Explore)    | MUST [slice] |
| 7   | Strawberry Jam          | Pot      | 3 Strawberry, Sugar, Glass Bottle                      | 4    | Speed I, 60 s (Move)             | MUST [slice] |
| 8   | Garden Salad            | Crafting | 2 Sliced Tomato, Sliced Cucumber, Carrot, Bowl         | 6    | Speed I, 90 s (Move)             | MUST [slice] |
| 9   | Salsa                   | Crafting | Sliced Tomato, Chopped Onion, Chili, Bowl              | 4    | Haste I, 90 s (Work)             | MUST [slice] |
| 10  | Veggie Sandwich         | Crafting | Bread, Sliced Tomato, Sliced Cucumber                  | 7    | none (cheap filler)              | MUST [slice] |
| 11  | Farmer's Sandwich       | Crafting | Bread, Cooked Porkchop, Sliced Tomato, Sliced Cucumber | 10   | none (best plain food)           | MUST         |
| 12  | Strawberry Cup          | Crafting | 3 Strawberry, Sugar, Bowl                              | 5    | Jump Boost I, 60 s (Move)        | MUST         |
| 13  | Strawberry Cake (block) | Crafting | Cake, 2 Strawberry                                     | 4×3  | Regeneration I, 5 s/slice (Heal) | MUST [slice] |
| 14  | Corn Chowder            | Pot      | Corn, Potato, Onion, Bowl                              | 8    | Slow Falling, 60 s (Move)        | SHOULD       |
| 15  | Popcorn ×4              | Pot      | 2 Corn                                                 | 2    | none (fast snack)                | SHOULD       |
| 16  | Stuffed Eggplant        | Pot      | Eggplant, Raw Mutton, Onion, Tomato                    | 10   | Health Boost I, 180 s (Heal)     | SHOULD       |

LATER, with the oven: Stuffed Tomato, Tomato Pizza (placeable), Strawberry Pie (placeable),
Shepherd's Pie, Corn Bread.

The MVP's Stuffed Tomato and its recipe id are dropped. The MVP is throwaway (D9).

The slice's 8 dishes cover the pot, crafting, a placeable dish and all four effect families.

### 1.4 Effect families (shared by dishes, book and icons)

Kids learn "red = healing" without reading.

| Family  | Colour | Icon idea   | Effects                                        |
| ------- | ------ | ----------- | ---------------------------------------------- |
| Heal    | red    | heart       | Regeneration, Absorption, Health Boost         |
| Move    | blue   | boot        | Speed, Jump Boost, Slow Falling                |
| Work    | yellow | pickaxe     | Haste                                          |
| Explore | green  | compass/eye | Night Vision, Water Breathing, Fire Resistance |

The book's dish page can also show the **vanilla effect icon**. Its paths are verified in the
1.26.52 vanilla pack: `textures/ui/<effect>_effect`, e.g. `textures/ui/speed_effect`,
`textures/ui/regeneration_effect`. The family icon is ours; the effect icon costs no art.

### 1.5 Seed discovery

| Source                                                         | How                                                                                                                                                                                    | Existing worlds | Priority     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------ |
| Breaking grass and ferns, **weighted by biome**                | `seed-drops.ts` extended. `Dimension.getBiome()` is stable in 2.10.0. Each seed lists biomes and a chance. A small "any biome" chance stops a player being stuck in a one-biome world. | yes             | MUST [slice] |
| Recipe book "Crops" page shows where each seed is found        | icon and biome hint (see §3)                                                                                                                                                           | yes             | MUST [slice] |
| Wild crop patches (world generation)                           | Feature rules place mature wild crops in matching biomes. **Only new chunks get them**, so this is never the only source.                                                              | new chunks only | SHOULD (S5)  |
| Traveling Cook (custom wandering NPC with its own trade table) | Sells seeds and buys dishes. It's a custom entity with a namespaced `trade_table`, so there's no vanilla trade override.                                                               | yes             | LATER        |
| Village farmer trades / village chest loot                     | Needs an override of vanilla trade or loot files, which collides with other add-ons. **Out of scope.**                                                                                 | n/a             | no           |

---

## 2. UX redesign: pot and board

### 2.1 What the forms can and cannot do (stable `@minecraft/server-ui` 2.2.0)

| Form                          | Can                                                                                                                                                                                                | Can't                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ActionFormData`              | title, body, `header`/`label`/`divider`; **buttons with an icon** (texture path, ours or vanilla; S1d: renders well at a good size); returns the button index                                      | update while open; images outside buttons; grids; counts on icons; disabled buttons                                                        |
| `ModalFormData`               | toggles, sliders, dropdowns, text fields                                                                                                                                                           | icons of any kind                                                                                                                          |
| `MessageFormData`             | two buttons                                                                                                                                                                                        | anything else                                                                                                                              |
| `CustomForm` (data-driven UI) | **live updates** through `Observable*`; buttons with `onClick`, `tooltip`, `disabled`, `visible`; `close()` from script (S1c: all work); `image()` with **our RP header UUID + `.png` path** (S1a) | **buttons have no icon parameter**; images **always stack vertically** (S1b); vanilla textures via `image()` (S1a: blank with `"vanilla"`) |
| All forms                     | localized `RawMessage` text                                                                                                                                                                        | inventory slots, drag-and-drop, 3D items, staying open while walking, opening over chat (`UserBusy`)                                       |

Stability of `CustomForm`, checked on 2026-10-21:

- Microsoft Learn's server-ui changelog lists CustomForm, MessageBox and the Observables under
  **2.1.0**, and `image()` under **2.2.0**. Neither version has a prerelease suffix. The version we
  pin, 2.2.0, has all of them.
- The "still in pre-release" warning on the Learn page applies only to the constructor overload
  with `options` and to `multiButtonRow`. Both appear only in the experimental docs view and **not
  in our typings**.
- The 1.26.52.3 binary contains `ScriptCustomForm` and DDUI.

So `CustomForm` is allowed under the stable-only rule.

What S1 showed in game (1.26.52, PC):

- `image(src, pack)` renders only with **our resource pack's header UUID as `pack` and the file
  extension in `src`** (`textures/…/tomato.png`).
  - Without the extension, or with the pack name or folder name as `pack`, the image is blank, and
    nothing is thrown.
  - Vanilla textures didn't render with `pack = "vanilla"`.
- Images **always stack vertically**, at widths 0.25 and 0.5 alike. There are no rows of icons.
- Live updates, a button that disables and re-enables itself, and `close()` from script all work.
  Image `onClick` wasn't tested.
- `ActionFormData` icon buttons render vanilla and our own textures at a good size.

Restyling forms with JSON UI (`ui/` overrides) or custom glyph fonts (`font/glyph_XX.png`) is
**ruled out (D7)**: both are global files that collide with other add-ons.

**Decision (D11): `ActionFormData` for the pot screen and the whole recipe book. `CustomForm` is
not used in v1.**

The block itself carries most of the UX (visual states, sounds, particles). Forms are used only
for choices and for the book. The reasons:

- **Icons are the UI.** Only `ActionFormData` puts an icon next to a choice, and it takes any
  texture. Half our ingredients are vanilla items, which `CustomForm.image()` can't show.
- **No rows.** `CustomForm` images stack, so eight ingredient pictures make a tall wall, which is
  the opposite of the goal.
- **Live updates aren't needed.** Cooking progress lives on the block and in the action bar. A
  form is a short-lived choice, and every choice is re-validated after the form closes.
- **One style, learned once:** the pot and the book look and behave the same.

`CustomForm` stays in reserve for a LATER feature that really needs live data, such as a settings
screen or a status panel. Untested: image `onClick`, and vanilla textures through the vanilla
pack's UUID.

Every row in an `ActionFormData` screen is a button, so **every row does something sensible when
tapped**. There are no dead "info" buttons.

### 2.2 Feedback vocabulary (used everywhere, learned once)

Symbols in action bar text come from the **vanilla** bitmap glyph pages, so the add-on ships no
font file.

- **Drawn** (checked offline in 1.26.52's `font/glyph_25/26/27.png`): ✔ ✘ ✖ ■ □ ▮ ▯ ● ○ ★ ☆ ⭐ ❤ ♨ ☕
  ⌛ → ↑ ⬆ ▶.
- **Empty cells:** ⏱ ⏳ ➕.
- Mojangles.ttf has none of these symbols. Whether the HUD falls back to the bitmap pages is S2.

| Event                        | Sound (vanilla first, custom later) | Particle                         | Block visual               | Action bar (≤ 5 words)        |
| ---------------------------- | ----------------------------------- | -------------------------------- | -------------------------- | ----------------------------- |
| Item accepted                | plop (`block.decorated_pot.insert`) | small splash                     | liquid level rises         | none (the visual is enough)   |
| Item refused                 | dull thud (`…insert_fail`)          | grey puff                        | none                       | `§c✘ Can't cook Dirt`         |
| Pot full                     | thud                                | grey puff                        | liquid at the top          | `§c✘ Pot is full`             |
| A recipe now matches         | rising chime                        | sparkle above the pot, repeating | pot glints ("ready" state) | `§a✔ Tomato Soup`             |
| Cooking starts               | lid clank + bubbling                | steam                            | lid on, glow               | none                          |
| Cooking, player uses the pot | short bubble                        | none                             | lid on, steam              | `♨ ■■■□□` (S2)                |
| Done                         | ding + pop                          | burst of happy particles         | lid off, "done" glint      | `§a✔ Soup is ready!` (nearby) |
| Collected                    | pop                                 | none                             | back to empty              | none                          |
| No heat                      | fizz                                | grey smoke                       | cold pot (no glow)         | `§e♨ Needs fire below`        |
| Board: chopped               | wood chop                           | coloured bits of that crop       | none                       | none                          |
| Board: wrong item            | thud                                | grey puff                        | none                       | `§c✘ Can't cut that`          |
| Cake: slice eaten            | eat + small chime                   | hearts                           | one slice fewer            | none                          |

Rules:

- Silence is never the answer to an action.
- Text never says what the visual already shows.
- Action bar lines are lang keys.

### 2.3 Cooking pot, step by step

Block states. `minecraft:geometry` `bone_visibility` (Molang on the states) drives the visuals,
not one permutation per combination **(spike S3)**:

- `hk:fill`: 0–3, computed from the item count, so the liquid layer rises.
- `hk:phase`: `idle | ready | cooking | done`. It replaces the MVP's `hk:cooking`, with no
  migration (D9).

Together that's 4 bits, far under the engine's per-block state budget.

Interactions:

1. **Place the pot over heat** (D5). Without heat it shows the cold look. Using it then fizzes with
   `♨ Needs fire below`. If the heat is removed mid-cook, cooking pauses: the remaining time is
   stored, not a wall-clock deadline.
2. **Hold an ingredient and use the pot.** One item goes in, with a plop and a splash, and the
   liquid rises.
   - Non-ingredients are refused with a thud and `✘ Can't cook <item>`.
   - **Sneak + use** puts in the whole held stack, up to capacity.
3. **The contents match a recipe** (phase `ready`): the pot glints and chimes once, and the action
   bar shows `✔ <Dish>`.
4. **Empty hand + use:**
   - phase `ready` with **exactly one** possible dish: **cooking starts immediately, with no
     form**.
   - phase `ready` with **several** possible dishes: the Pot screen opens, showing only dish
     buttons.
   - phase `idle` with items: the Pot screen opens on "almost" mode (see 2.4).
   - phase `idle` and empty: action bar `Add ingredients`. **No form.**
   - phase `cooking`: progress in the action bar.
   - phase `done`: **the dish goes into your hand or inventory.** Anyone can collect it.
5. **Sneak + empty hand:** everything comes out (when idle or ready).
6. **Breaking the pot:** ingredients spill (idle, ready, cooking), or the dish drops (done).

**Change from the MVP:** finished dishes stay in the pot until collected. There's no 8-block
auto-delivery.

### 2.4 Pot screen (only when there's a choice)

An `ActionFormData` screen (D11), titled "Cooking Pot", with no body text. Sections appear only
when they have something in them, top to bottom, so the next step is always the first button:

| Section        | Buttons (icon + short label)                                                                                  | Tap does                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Cook**       | one per dish possible **right now**: `[soup] Tomato Soup`                                                     | starts cooking (re-validated)                                   |
| **Almost!**    | only when nothing is possible: **one** button for the closest recipe's first missing item: `[onion] +1 Onion` | opens the recipe book on that dish                              |
| **In the pot** | one per ingredient type: `[tomato] ×2`                                                                        | takes that ingredient out, with a pop sound; the screen reopens |
| (bottom)       | `[book] Recipe Book`                                                                                          | opens the book on the pot chapter                               |

"Take all out" isn't a button. It's sneak + empty hand on the pot (§2.3), so the screen stays
short. The screen is a snapshot; a friend's change shows on the block, and every tap is checked
against the current pot state.

### 2.5 Cutting board, step by step

1. **Hold a crop and use the board:** a chop sound, bits of that crop's colour fly up, and the
   output goes to your inventory (or drops on the board if it's full).
2. **Sneak + use:** chops the whole held stack, one item every few ticks with a chop sound each.
   It stops if the player walks away (S6).
3. **Wrong item:** a thud, a grey puff and `✘ Can't cut that`.
4. **Empty hand:** a tap sound and `Hold a vegetable`. There's no form.

### 2.6 Strawberry Cake (placeable)

- Placed like a vanilla cake. Use it to eat one slice (Regeneration I, 5 s). The model loses one
  slice per bite (`hk:slices` 0–3 through bone visibility, the same technique as the pot).
- The last slice removes the block.
- It works when your hunger is full, so friends can share it at any time.

### 2.7 Playtest protocol (exit criteria of the slice's UX work)

Two testers: one child (8–12) and one adult who doesn't play Minecraft much. No explanation is
given beyond "here's a recipe book". Pass when both:

- cook a soup within 3 minutes of being handed a tomato, a bowl, a pot and a campfire;
- find out how to make a second dish from the book on their own;
- never ask "what do I do now?" more than once.

---

## 3. Recipe book

**Item:** `hk:recipe_book`. Using it opens the book, through the stable `onUse` item custom
component.

**How a player gets it:**

- **Automatically**, the first time any Harvest Kitchen item enters their inventory, tracked by
  the stable `playerInventoryItemChange` event and a per-player flag. This works in existing
  worlds.
- **Craftable** (Book + any Harvest Kitchen seed) for replacements.
- In creative it's in the creative menu.

**Structure, station first** ("where do I go?"). Every page is an `ActionFormData` (D11), every
row is an icon button, and **Back** is always the last button:

```
Home          [?] What can I make?   [pot] Pot   [board] Board   [table] Crafting   [seeds] Crops
  Station     one button per dish: [dish] Tomato Soup      locked: [?] ???
    Dish      title: dish name; body: one line, e.g. "§c❤§r Regeneration · 8 s"
              [tomato] ×2 Tomato           -> where it comes from (crop page)
              [sliced tomato] ×1 Sliced… -> the Board page (how to make it)
              [bowl] ×1 Bowl               -> action bar hint "Vanilla item"; page stays open
              [pot] Pot · ♨ needs fire      -> the Pot chapter
  Crops       one button per crop: [tomato] Tomato · Plains   locked: [?] ??? · Jungle grass
  What can I make?   dishes whose ingredients are all in your inventory right now
```

- **Ingredient buttons chain to "how do I get this?"**: a crop leads to its crop page, a prepared
  ingredient to the Board, and a dish ingredient to its own dish page. A child can follow the
  chain from any dish back to a seed.
- **There's no big dish picture.** `ActionFormData` only has button-sized icons; the dish icon
  appears on the button that opened the page.
- Effect family symbols in body text use the vanilla glyphs confirmed in S2 (❤ ★ ♨ …).

**Discovery and unlock (D3):**

- Every dish is listed from the start as a silhouette, with its station shown.
- A dish **unlocks** once the player has obtained every Harvest Kitchen crop it uses. It's tracked
  per player in a dynamic property and updated from `playerInventoryItemChange`.
- Undiscovered crops show a "?" plus the biome hint, which tells the player what to look for next.
- Unlock moment: a page-turn sound plus `★ New recipe!` as a subtitle, at most once per few
  seconds.
- Creative mode: everything is unlocked.

**Data:**

- The book is generated from `data/recipes.ts`, `data/dishes.ts` and `data/crops.ts`. There are no
  hand-written pages.
- `data/icons.ts` maps vanilla item ids to texture paths that don't match the id (cooked beef is
  `textures/items/beef_cooked`, verified). `validate.ts` checks every ingredient has an icon.

---

## 4. Asset list and art pipeline

General style: vanilla-like pixel art. Section 4.5 covers how it's made.

- 16×16 for items and block faces, with no anti-aliasing and no gradients.
- 3–5 shades per hue, lit from the top left, with darker edge shading as in vanilla items rather
  than a black outline.
- Each item must read **by silhouette alone** at 16 px.
- Each crop has one dominant colour: red tomato, **golden-brown** onion, green cucumber, orange-red
  chili, pink strawberry, yellow corn, purple eggplant.
- The family colours (§1.4) are reserved for effect accents.
- Models are made in Blockbench at 16 px per block, within the 1-block bounds.

Pack icon and Marketplace art sizes follow **the publisher's spec** (ask Waypoint).

Priority meaning: **P1** = in the portfolio slice, needed first. **P2** = the rest of MUST.
**P3** = SHOULD and polish.

### 4.1 Blocks and models

| Asset                                | Files                                                                                                                                                                  | Size       | Pri |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --- |
| Cooking pot model                    | **done in S8**: bones `body`, `handles`, `liquid_1`–`liquid_3`, `lid`; material slots `*` (side), `top`, `liquid`, `lid`; "ready" is a liquid texture swap, not a bone | ≤ 1 block  | P1  |
| Cooking pot textures                 | body, lid, liquid, liquid "ready" variant, cold vs. hot rim                                                                                                            | 16×16 each | P1  |
| Cutting board model + texture        | board with a decorative knife on it                                                                                                                                    | 16×16      | P1  |
| Strawberry Cake model + textures     | 4 slice bones; top, side, inner                                                                                                                                        | 16×16 × 3  | P1  |
| Station item icons (pot, board)      | flat icons for the hotbar                                                                                                                                              | 16×16 × 2  | P1  |
| Crop stages: tomato, onion, cucumber | 4 stages each                                                                                                                                                          | 16×16 × 12 | P1  |
| Bush stages: chili, strawberry       | 4 stages each (stage 3 = with fruit)                                                                                                                                   | 16×16 × 8  | P1  |
| Corn (2 tall) and eggplant stages    | corn 4 × 2 halves, eggplant 4                                                                                                                                          | 16×16 × 12 | P3  |
| Oven, pizza and pie models           | v1.1                                                                                                                                                                   | n/a        | n/a |

### 4.2 Items

| Group                         | Items                                                     | Count | Pri |
| ----------------------------- | --------------------------------------------------------- | ----- | --- |
| Produce                       | tomato, onion, cucumber, chili, strawberry                | 5     | P1  |
| Seeds                         | tomato, cucumber, chili, strawberry (onion plants itself) | 4     | P1  |
| Prepared ingredients          | sliced tomato, chopped onion, sliced cucumber             | 3     | P1  |
| Dishes in the slice           | 1, 3, 6, 7, 8, 9, 10, 13 (cake item icon)                 | 8     | P1  |
| Recipe book                   | item icon                                                 | 1     | P1  |
| Remaining MUST dishes         | 2, 4, 5, 11, 12                                           | 5     | P2  |
| SHOULD produce, seeds, dishes | corn, eggplant (+ seeds), dishes 14–16                    | 7     | P3  |

Bowl dishes share one bowl base, so only the contents are drawn per dish.

### 4.3 UI (forms and book)

| Asset                    | Notes                                                    | Size      | Pri |
| ------------------------ | -------------------------------------------------------- | --------- | --- |
| Effect family icons × 4  | heart, boot, pickaxe, eye/compass in family colours      | 16×16     | P1  |
| "Locked" / "?" icon      | for undiscovered dishes and crops                        | 16×16     | P1  |
| Book chapter icons       | reuse station icons; plus "Crops" and "What can I make?" | 16×16 × 2 | P1  |
| Fire / "needs heat" icon | pot page and the cold-pot hint                           | 16×16     | P1  |
| Biome hint icons × 6     | plains, forest, jungle, savanna, meadow, river           | 16×16     | P2  |

Vanilla effect icons (`textures/ui/*_effect`) need no art.

### 4.4 Particles and sounds

| Asset                            | Notes                                                                                          | Pri |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | --- |
| Chop bits particle               | one per crop, using that crop's colours                                                        | P2  |
| Splash and ready-glint particles | small, short-lived, count-capped                                                               | P2  |
| Custom sounds                    | chop, plop, lid clank, ding. Original or licensed only; namespaced `hk.*`. Vanilla until then. | P3  |

**Art budget** (developer time only; generation and models are done by Claude inside build sessions):

| Scope                | Textures | Models                          | Developer evenings             |
| -------------------- | -------- | ------------------------------- | ------------------------------ |
| Portfolio slice (P1) | about 60 | 3 (pot done in S8; board, cake) | about 5 (touch-up 4, review 1) |
| P2 + P3              | about 35 | none                            | about 2.5                      |

### 4.5 Art pipeline (D10)

No AI image service. Textures come from a script, models from Blockbench driven through its MCP,
and the developer touches up.

| Step                       | Who and how                                                    | Output                                                                                                                                                                                                                |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Style palette (once)    | Claude: a script samples vanilla crop, food and metal textures | `art/harvest_kitchen/palette.json`: 3–5-shade ramps for every crop colour, the station materials (copper, iron, wood) and the 4 family colours                                                                        |
| 2. Texture generator       | Claude: a plain Node script in `tools/` with no dependencies   | 16×16 PNGs drawn from shape descriptions and palette ramps: crop stages, produce, seeds, bowl dishes (one shared bowl base), UI icons. Deterministic and re-runnable. Output goes to `art/harvest_kitchen/generated/` |
| 3. Models + model textures | Claude through Blockbench MCP                                  | `art/harvest_kitchen/models/<name>/`: `.bbmodel` source, `.geo.json`, one texture per material slot; bone names match `bone_visibility`                                                                               |
| 4. Touch-up                | developer, in any pixel editor or Blockbench paint mode        | silhouettes, highlights and character fixed by hand; saved to `art/harvest_kitchen/final/`, which the generator never writes to; the pack copies from `final/`                                                        |
| 5. Review                  | developer, in game, during the milestone's test session        | each icon is recognisable in the hotbar and the book; crop stages read as one sequence                                                                                                                                |

Export rules learned in S8 (Blockbench 5.2.1, Bedrock Block format):

- Faces switched off in Blockbench are still exported unless their texture is set to none. Set
  hidden faces to no texture.
- The exporter writes `format_version` 1.12.0 and `visible_bounds_*` fields. Post-fix to the vanilla
  geometry version (1.26.50) and drop the bounds.
- Blockbench's script sandbox has no file access. Save through the MCP `export_model` tool with a
  path.
- UVs are projected from block position (side faces: columns = horizontal position, rows = height
  from the top; top faces: x/z), so each texture is painted like a normal block face.

Risks specific to this pipeline are in §5.4.

---

## 5. Technical risks, limits, architecture

### 5.1 Limits found so far

| Limit                                                                                                                                                                                                                              | Consequence                                                      | Rule                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Custom component params hit "Exceeded the object and array depth limit"** with nested arrays or objects                                                                                                                          | The whole item silently breaks.                                  | Params stay flat. Structured data lives in `data/*.ts`.                                                                                                   |
| **Block states:** an int range state can have at most **16 values**; all states share a **per-block bit budget** (both are game error strings in 1.26.52)                                                                          | Per-ingredient or per-recipe states are out.                     | Small generic states only. Visuals come from bone visibility (S3).                                                                                        |
| **No block entities** for custom blocks                                                                                                                                                                                            | Pot contents live in world dynamic properties.                   | Measure the size with 200 active pots in M4. Keep JSON short.                                                                                             |
| **The Content Log file loses its last 4 KB** under mcpelauncher                                                                                                                                                                    | Errors from short sessions vanish.                               | An operator-only `/hk:debug` custom command prints validation and the state of the pot you look at. The spikes report to chat for the same reason.        |
| **Wall-clock timers**                                                                                                                                                                                                              | Cooking continues during pause.                                  | With heat (D5), store the remaining time and pause without heat.                                                                                          |
| **Bone meal on custom crops** needs our own handling                                                                                                                                                                               | Works in the MVP.                                                | The shared crop component also handles bushes.                                                                                                            |
| **Random tick rate is undocumented**                                                                                                                                                                                               | Growth speed is guessed.                                         | Time it in game and record it.                                                                                                                            |
| **`bone_visibility` vs. `item_display_transforms`** (bug MCPE-185868: transforms fail when the geometry uses `bone_visibility`; inside a permutation it works)                                                                     | Held or hotbar rendering of pot and cake may break.              | Pot and cake use flat item icons instead of a 3D render. Re-check in S3.                                                                                  |
| **All material instances on one block must use the same `render_method`** (1.26.52 Content Log, 2026-10-21: "MaterialInstances can't mix and match opaque and transparent materials", from the S3 spike pot's `alpha_test` marker) | A transparent overlay (glint, steam) can't sit on an opaque pot. | Keep each block's materials all `opaque` (the S8 pot is). Effects such as the ready glint or steam are particles or texture swaps, not transparent bones. |

### 5.2 How the architecture scales

The MVP is already data-first. The full build extends it like this:

- **One station engine.** `cooking.ts` becomes a generic "container station" with a config: recipe
  list, capacity, heat rule, visual-state mapping. The pot is the only v1 config; the oven in v1.1
  is a second config.
- **One crop component, three growth types.** `hk:crop_growth` gains a flat `type` param:
  `crop | bush | tall`.
- **One placeable-dish component** (`hk:sliced_dish`) for the cake now and pies or pizza later.
- **Data files:**
  - `data/crops.ts`: seed sources with biomes and chance.
  - `data/recipes.ts`: cutting and station recipes keyed by station.
  - `data/dishes.ts`: effect, family, flavour lang key.
  - `data/icons.ts`: vanilla icon paths.
  - The book, the pot screen and the "almost" hint are all derived from these.
- **Content generator (D6):** hand-write item JSON until there are 10 dishes, then add
  `tools/gen-content.mjs` (templates plus `data/`). The slice stays below that line, so the
  generator comes in M1.
- **Validation at world load** covers every id, icon, lang key and station, and every recipe that
  is reachable.
- **Saved-data ids freeze at the first public build:** recipe ids, dynamic property keys, block
  state names, and the namespace (D1).

### 5.3 Spikes

The spike pack was `packs/hk_spikes`. It was throwaway, never shipped, and was deleted when M0
closed on 2026-10-21 (S1–S3 and S8's model half done; S5–S7 and S8's texture half carry over to the
milestones named below). Everything reported to chat, which worked around the Content Log tail loss.

| Spike                                   | Question                                                                                                                                      | Offline result (2026-10-21)                                                                                                                                                                                                                                                                          | In game                                                                                                                                                                                                                                                                                                                  | If no                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **S1** `CustomForm` on 1.26.52          | Does it render? Which `pack` id does `image()` take? Do images share a row? Do observables update live?                                       | **Allowed:** stable since 2.1.0/2.2.0 (changelog) and present in the binary. Vanilla icon paths for `ActionFormData` verified.                                                                                                                                                                       | **Done 2026-10-21 (PC):** `image()` works only with the RP header UUID + `src` with `.png`; other guesses and vanilla are blank, with no error. Images stack vertically at any width. Live label, self-toggling disabled button and `close()` work; image click untested. ActionForm icons (vanilla + ours) render well. | **Decision D11:** `ActionFormData` for pot screen and book  |
| **S2** Action bar symbols               | Do ✔ ■ □ ♨ ★ … render in the HUD?                                                                                                             | **Likely yes:** the vanilla bitmap glyph pages draw them; ⏱ ⏳ ➕ are blank; Mojangles.ttf lacks them all.                                                                                                                                                                                           | **Done 2026-10-21 (PC, default font):** ✔ ✘ ✖ ■ □ ● ○ ❤ ★ ☆ arrows ♨ ☕ ⌛ render in chat and the action bar; ⏱ ⏳ ➕ blank as predicted. Phone and smooth font not tested.                                                                                                                                              | use as planned in §2.2 (D7 confirmed)                       |
| **S3** Bone visibility driven by states | Can one geometry show the liquid level and lid by `hk:fill` and `hk:phase`?                                                                   | **Likely yes:** `bone_visibility` is a known key in the 1.26.52 binary.                                                                                                                                                                                                                              | **Done 2026-10-21:** liquid level and phase markers switch on one model through Molang `bone_visibility` on two states. Content Log: only the render_method mix error (§5.1), caused by the spike's transparent marker.                                                                                                  | use as planned (§2.3, §2.6); no permutation fallback needed |
| S5 Wild crop feature rules              | Do custom feature rules place blocks without a toggle?                                                                                        | not started                                                                                                                                                                                                                                                                                          | M1                                                                                                                                                                                                                                                                                                                       | grass drops only                                            |
| S6 Sneak-chop timing                    | Does a multi-tick chop loop feel good?                                                                                                        | not started                                                                                                                                                                                                                                                                                          | slice                                                                                                                                                                                                                                                                                                                    | one item per use                                            |
| S7 Player dynamic property size         | How large can discovery data get?                                                                                                             | not started                                                                                                                                                                                                                                                                                          | slice                                                                                                                                                                                                                                                                                                                    | compact bitstring                                           |
| **S8** Art pipeline                     | Can a generator + touch-up produce vanilla-like 16×16 art, and how long does touch-up take? Can Blockbench MCP build and export block models? | **Model half done 2026-10-21:** the copper cooking pot (26 cubes, 6 bones, 4 material slots, chamfered body, loop handles) was built, rendered and exported in minutes, with no developer time; files in `art/harvest_kitchen/models/cooking_pot/`, export rules in §4.5. Texture half: not started. | texture generator v0 + timed touch-up in PS-1; pot model in game in PS-2                                                                                                                                                                                                                                                 | the slice's touch-up estimate grows                         |

### 5.4 Other risks

- **Originality.**
  - Cabbage and rice are replaced (D2).
  - Tomato, onion, board and pot stay generic. The art, names and the kid-friendly hook have to
    carry the difference.
  - **Don't name or describe anything after Farmer's Delight**, including the store text.
- **The Marketplace review process and Waypoint's requirements aren't known to this plan.** Ask
  them for their spec early in the slice.
- **Script-generated, hand-finished art (D10).**
  - A generator gets the palette, shading and silhouettes consistent. The character comes from
    touch-up, and **touch-up time is the main unknown**. The first crop set in PS-1 measures it.
  - Style drift is low: one palette file and one generator.
  - **Publisher policy:** the art is produced by code and models written by an AI assistant, plus
    manual work. The developer is asking Waypoint whether that's acceptable (2026-10-21). The
    application says so openly.
  - No third-party image service, so there's no tool licence to track.
  - Art is on the critical path in the same evenings as code.
- **Interaction conflicts.** We use only block custom components, which are scoped to our blocks.
  Test with 2–3 popular add-ons in M4.
- **Performance.**
  - One interval drives all pots; there's no per-block `onTick`.
  - Particles are capped.
  - Discovery runs on the inventory event, not by polling.
  - Target: no TPS drop with 200 pots and 2,000 crops.

---

## 6. Milestones

### How estimates are made (calibrated 2026-10-21)

One ~5 h session on 2026-10-21 covered workspace setup, two learning packs, the full Harvest
Kitchen MVP with bug fixes, and this plan (commits 19:44–23:10). That's about 8–10 evenings on the
old scale, so the estimates below count **developer time only**:

- **Code and JSON are near-instant.** Claude writes them inside a working session, which costs the
  developer's attention, not extra evenings.
- **The real costs are:**
  - in-game test sessions;
  - art touch-up;
  - work only a person can do: playtests with other people, video editing, contact with the
    publisher.
- An **evening** is 2–3 hours. **Pace: 4 evenings a week.**

**Batching rule.** Each milestone runs as:

1. one build session;
2. **one long test session**;
3. one fix round with a short re-check.

To make one test session enough, every milestone ships with:

- a **test script**, `docs/harvest-kitchen/tests/<milestone>.md`: numbered steps, each with its
  expected result, so the session is a checklist rather than exploration;
- an operator-only **debug kit** (`/hk:debug kit | grow | fast | pot`). It hands out every item,
  matures nearby crops, skips cooking time and prints pot state, which removes the waiting from
  tests;
- **chat reports** for anything the Content Log might lose (the 4 KB tail).

The developer reports back once, as a numbered list matching the script. Claude fixes everything in
one round.

### M0: Spikes (≈ 1 evening, closed 2026-10-21)

| Work                                                                        | Evenings                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| S1–S3 in-game run with the spike pack + Content Log                         | 1 (done 2026-10-21; the log tail is read after the session ends) |
| S8 model half: the cooking pot, done 2026-10-21 (§5.3)                      | 0                                                                |
| S8 texture half: generator v0 for one crop set and one dish; touch-up timed | moved into PS-1 (touch-up timed in its test session)             |
| Ask Waypoint about AI-assisted art                                          | n/a (open, outside the milestones)                               |
| Delete `packs/hk_spikes` (repo and deployed copies)                         | done 2026-10-21                                                  |

### PS: Portfolio slice (≈ 17 evenings)

| Batch            | Contents                                                                                                                                                                                                                             | Build | Test        | Fixes / handwork | Total    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----------- | ---------------- | -------- |
| PS-1 Content     | station engine + heat rule; `bush` crop type; onion, cucumber, chili, strawberry; biome seed drops; 3 prepared ingredients; 8 slice dishes; Strawberry Cake; debug kit; generated textures for every new item                        | 0.5   | 1           | 0.5              | 2        |
| PS-2 UX          | pot states with the S8 model; auto-cook, collect, sneak shortcuts; pot screen with "Almost!"; board feedback and sneak-chop; recipe book (chapters, dish pages, crops page); discovery and unlock; "What can I make?"; feedback pass | 1     | 1           | 0.5              | 2.5      |
| PS-3 Art         | generator v2 for all P1 textures; board and cake models through the MCP; touch-up of about 60 textures; in-game art review                                                                                                           | 0.5   | 1 (review)  | 4 (touch-up)     | 5.5      |
| PS-4 Playtest    | child + adult playtest (§2.7), one fix round, re-check                                                                                                                                                                               | n/a   | 1           | 1                | 2        |
| PS-5 Application | capture gameplay and 5–6 screenshots; edit a 60–90 s video; review the pitch Claude drafts                                                                                                                                           | n/a   | 1 (capture) | 1.5              | 2.5      |
| Buffer           | S1 fallback, art redo, surprises                                                                                                                                                                                                     |       |             |                  | 2.5      |
| **Total**        |                                                                                                                                                                                                                                      |       |             |                  | **≈ 17** |

With M0 that's about 18 evenings, or **about 4½ weeks at 4 evenings a week**, inside the original
6-week target.

The weakest number is touch-up: 4 evenings for about 60 textures, roughly 15 per evening. The first
crop set in PS-1 measures it. If it's slower, PS-3 grows and the date moves; the scope doesn't.

Exit: the §2.7 playtest passes, there's no placeholder art in the slice, and the application
package is sent.

### After the application (≈ 15 evenings)

| Batch        | Contents                                                                                                                                                                                                                                                                                                                                        | Evenings                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| M1b Content  | 5 remaining MUST dishes; corn (tall crop), eggplant, dishes 14–16; wild patches (S5); content generator (D6); biome icons, chop particles; touch-up of about 35 textures                                                                                                                                                                        | 1 build + 1 test + 0.5 fix + 2.5 touch-up = 5 |
| M4 QA        | three test sessions: (1) multiplayer with 2–4 players: concurrent pots, collect races, cake sharing, per-player book; (2) existing worlds (add mid-game, remove, re-add) + performance (the debug kit places 200 pots and 2,000 crops); (3) controller and touch, balance, conflict test with popular add-ons, clean Content Log; one fix round | 3 + 1.5 = 4.5                                 |
| M5 Marketing | showcase world 1; screenshots 0.5; trailer 2; key art (in-game or Blockbench render + paint-over) 1.5; store text review 0.5                                                                                                                                                                                                                    | 5.5                                           |

**Totals:**

| Path                                             | Evenings | At 4 evenings/week  |
| ------------------------------------------------ | -------- | ------------------- |
| M0 + PS (to the application)                     | ≈ 18     | about 4½ weeks      |
| After the application, through v1 (incl. SHOULD) | ≈ 15     | about 4 weeks       |
| **Whole v1**                                     | **≈ 33** | **about 8–9 weeks** |

---

## 7. Marketplace readiness checklist

Stable and compliant:

- [ ] Only `@minecraft/server` and `@minecraft/server-ui` stable versions; no `-beta`/`-rc`
      (`tools/build.mjs` enforces).
- [ ] No experiment toggles needed: a fresh world with every experiment off loads clean.
- [ ] No experimental-only JSON components, checked against vanilla files and Microsoft Learn.
- [ ] The Content Log is clean on load and after an hour of play.
- [x] `packs/hk_spikes` deleted (2026-10-21), and no spike code left in the product.

Existing worlds:

- [ ] Works when added to a world that's already mid-game: seeds drop from grass and the book is
      delivered on first item.
- [ ] Removing the add-on leaves the world loadable. This is documented in the description.
- [ ] Updating from an older version keeps pots, discovery and recipe ids.

No conflicts:

- [ ] No vanilla file overridden: loot tables, trade tables, `player.json`, `ui/`, fonts and glyphs,
      vanilla sound events.
- [ ] Every identifier, texture shortname, path, dynamic property, scoreboard and command uses the
      **final namespace** (D1).
- [ ] Tested together with 2–3 popular add-ons.

Localization:

- [ ] Every player-visible string is a lang key, including forms, action bar, book and item names.
- [ ] `en_US` complete; extra languages per publisher.
- [ ] No text baked into textures.

Performance:

- [ ] No per-tick world scans and no per-block `onTick`.
- [ ] 200 pots and 2,000 crops without a TPS drop; particles capped.
- [ ] World dynamic property size measured and documented.

Quality and UX:

- [ ] The §2.7 playtest passed with a child and an adult.
- [ ] Every action gives feedback (§2.2), and no message is over 5 words.
- [ ] Works on touch, controller and keyboard and mouse; forms are readable on a phone.
- [ ] Multiplayer: no item duplication or loss under concurrent use.

Naming and originality:

- [ ] Final product name checked for conflicts on the Marketplace and in trademarks.
- [ ] No names, textures, models or store text referencing Farmer's Delight or other mods.
- [ ] All art and sounds are original or licensed, with the licences recorded in the repo.
- [ ] The publisher accepts the art pipeline (script-generated textures and AI-assisted models,
      finished by hand), and the application says so.
- [ ] Pack icon, key art and screenshots per the publisher's spec.

---

## 8. Decisions

Recorded on 2026-10-21.

| #   | Decision                              | Outcome                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Namespace and product name            | Namespace stays `hk` for now; the final namespace and product name come later, before any public build. Working name "Harvest Kitchen".                                                                                                                                                                         |
| D2  | Originality hook                      | Kid-friendly cooking add-on: effect families by colour, "What can I make?", shareable placeable dishes. Cabbage and rice are replaced (§1.1).                                                                                                                                                                   |
| D2a | Cabbage replacement                   | Cucumber.                                                                                                                                                                                                                                                                                                       |
| D2b | Rice replacement                      | Eggplant.                                                                                                                                                                                                                                                                                                       |
| D3  | Recipe unlock style                   | Silhouettes; unlock on crop discovery.                                                                                                                                                                                                                                                                          |
| D4  | Oven in v1                            | No. It moves to v1.1, and the cake carries "placeable dishes" in v1.                                                                                                                                                                                                                                            |
| D5  | Heat under the pot                    | Yes, required.                                                                                                                                                                                                                                                                                                  |
| D6  | Content generator                     | Yes, once there are 10+ dishes, so after the slice.                                                                                                                                                                                                                                                             |
| D7  | Custom glyph font                     | No. Action bar symbols come from vanilla glyph pages (S2).                                                                                                                                                                                                                                                      |
| D8  | Application first                     | Portfolio slice (PS) before the full MUST scope. Target ~6 weeks part-time; the current estimate is about 4½ weeks at 4 evenings/week (§6).                                                                                                                                                                     |
| D9  | MVP pots                              | Throwaway, no migration.                                                                                                                                                                                                                                                                                        |
| D10 | Slice scope and art source            | No cuts. No PixelLab: textures come from a palette-driven generator script, models and model textures from Blockbench MCP, and the developer touches up (§4.5). Estimates are calibrated on the 2026-10-21 velocity and count developer time only, with one test session per batch (§6). Pace: 4 evenings/week. |
| D11 | Forms for the pot screen and the book | `ActionFormData` everywhere (icon buttons, vanilla icons work, one style). `CustomForm` not used in v1: no icons on buttons, no vanilla textures in `image()`, images can't form rows (S1, §2.1).                                                                                                               |

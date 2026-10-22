# Waypoint Studios application (draft)

Draft written 2026-10-22, before the portfolio slice was tested in game. Everything in
`[SQUARE BRACKETS]` is for you to fill in or confirm. The "built today" list reflects 2026-10-22;
update it on the day you send this (see the note at the end of section 1).

---

**Subject:** Application: [PRODUCT NAME], a kid-friendly cooking add-on for Minecraft: Bedrock
Edition

Hello [CONTACT NAME / Waypoint Studios team],

I'm [YOUR NAME], a TypeScript developer building a farming and cooking add-on for Bedrock. I'd like
to publish it through Waypoint Studios. Here is what it is, how it's built, and where it stands.

## 1. What we make

**[PRODUCT NAME]** (working name "Harvest Kitchen") is a compact farming and cooking add-on for
survival worlds. You grow vegetables, chop them on a board, cook them in a pot over a fire, and
eat dishes that give small, useful effects.

**The hook: it's built for kids.** Three features carry it:

- **Effect families by colour.** Red food heals, blue food moves you, yellow food helps you dig,
  green food helps you explore. Kids learn what a dish does without reading.
- **"What can I make?"** The recipe book shows the dishes you can make from what you're carrying
  right now. Ingredient buttons chain back to where each thing comes from, all the way to the seed.
- **Shareable placeable dishes.** A Strawberry Cake you put down; each friend eats a slice.

Design rules we hold to: the common actions are all "hold an item, use a block"; every block shows
its state (you can tell what the pot is doing from across the room); every action answers with a
sound, a particle and at most one short line; no message is longer than five words.

**v1 scope:** 5 crops (tomato, onion, cucumber, chili pepper, strawberry), a Cutting Board, a
Cooking Pot that needs heat below it, 13 dishes (7 from the pot, 6 from the crafting table,
including the placeable cake), and the recipe book with discovery. Corn, eggplant and three more
dishes are planned for v1 if time allows, otherwise v1.1. An oven with baked and placeable dishes
is planned for v1.1.

**Built today vs. planned (as of 2026-10-22):**

| Area                                                                                  | Status                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Earlier MVP (one crop, board, pot)                                                    | Worked in game on 1.26.52                                                       |
| Technical spikes: forms, action bar symbols, block visuals driven by states           | Tested in game; results recorded                                                |
| All 5 crops, board, pot with heat rule, all 13 dishes, cake, recipe book, discovery   | Code written and type-checked; **not yet tested in game**                       |
| Art: about 60 textures from our generator, pot, board and cake models                 | Generated and linted; **hand touch-up not started**; all art is still temporary |
| Playtest with a child and an adult who rarely plays                                   | Planned (exit criterion for the slice)                                          |
| QA: multiplayer, existing worlds, performance, controller and touch, add-on conflicts | Planned after the application                                                   |

`[UPDATE BEFORE SENDING: replace this table with the status on the day you send. The plan's exit
criteria for sending are: the playtest passed, no placeholder art in the slice, video and
screenshots captured.]`

Attached: `[LINK TO VIDEO, 60–90 s]`, `[LINK TO SCREENSHOTS]`, `[LINK TO TEST BUILD, if you want to
share one]`.

## 2. Why us

- **The design is settled before the code.** Every feature has a written spec, a UX rule it must
  pass, and a test script. Decisions and their reasons are recorded, so scope doesn't drift.
- **Built for the Marketplace from day one.** Stable APIs only, no experiments, no overrides of
  vanilla files, every string localizable. These were project rules from the first commit, not
  goals for later. The build itself enforces the API rule.
- **Original on purpose.** We dropped crops that read as too familiar for the genre and chose ones
  with their own silhouette and colour. The kid-friendly hook is the core of the product, not a
  coat of paint.
- **Honest about how it's made.** See the team section.
- `[YOUR OWN REASON: why you want to make Marketplace content, what you bring]`

## 3. Team

- **[YOUR NAME]**, solo developer. Experienced in TypeScript (`[YEARS]` years, `[BACKGROUND /
CURRENT ROLE]`). New to Minecraft content: this is my first Marketplace-quality project.
  `[LINK TO PORTFOLIO]`, `[LINK TO GITHUB / OTHER WORK]`.
- **AI assistance, stated openly.** I work with an AI assistant `[NAME THE TOOL IF YOU WISH]`.
  - It writes most of the code and content data inside working sessions that I direct. I set the
    design, review the changes and test everything in game.
  - The art is produced by code and models written by the AI assistant, plus manual work. A texture
    generator script draws 16×16 pixel art from a palette sampled from vanilla textures. The 3D
    models are built in Blockbench through a scripted connection. I then touch up the textures by
    hand and review every icon in game.
  - No AI image service is used. Nothing is generated from other people's artwork.
  - **Question for you:** is this pipeline acceptable under your art and content policy? If you
    need changes (for example, more hand-drawn work or a specific disclosure), I'd rather know now.
- `[ANY OTHER HELP: playtesters, sound, translation. Leave out if none.]`

## 4. Stack

- **Stable Script API only:** `@minecraft/server` 2.10.0 and `@minecraft/server-ui` 2.2.0, pinned to
  the game version we test on (1.26.52). No beta modules, no experiment toggles. The build fails if
  a manifest asks for a prerelease or a version that differs from the installed package.
- **Data-driven content.** Crops, recipes, dishes and stations are data files. The recipe book, the
  pot's menu and the "Almost!" hint are generated from that data. One station engine runs every
  station: the pot is a config, and the planned oven is a second config, not new code. One crop
  component covers row crops and bushes; one component covers every placeable sliced dish.
- **Validation pipeline:**
  - build: type-check (TypeScript), a parse check of every JSON file, manifest version checks; a
    type-aware linter runs alongside;
  - at world load: the add-on checks every id, icon, translation key, station and recipe and reports
    problems to operators;
  - an operator-only debug command hands out every item, grows nearby crops, speeds up cooking and
    prints a pot's state, so one test session covers a whole milestone;
  - a texture linter checks every icon (silhouette size, colour count, value contrast, stray pixels,
    look-alike pairs) and writes a review sheet next to vanilla references.
- **Art:** a palette-driven texture generator plus hand touch-up; Blockbench models (the pot, the
  board and the cake, with state-driven parts such as the liquid level and the cake slices).
- **Localization-ready:** every player-visible string, including menus and action bar lines, is a
  translation key. English is complete; other languages per your requirements. No text is baked
  into textures.
- **Conflict-free:** no vanilla file is overridden (no loot tables, trade tables, player file, UI
  files or fonts). Seeds come from a script listening to grass breaks, not from a loot table
  override. Every identifier, texture path and saved key is namespaced.
- **Performance:** one timer drives every pot; no per-block ticking and no per-tick world scans. Particles
  are capped. The QA target is 200 pots and 2,000 crops without a tick-rate drop.

## 5. Timeline

Part-time, `[CONFIRM: about 4 evenings a week]`. Estimates come from the project plan and are
calibrated on actual progress so far.

| Phase                                                                                  | Estimate                                |
| -------------------------------------------------------------------------------------- | --------------------------------------- |
| Portfolio slice: in-game testing, art touch-up, playtest, video (this application)     | about 4½ weeks in total                 |
| After the application: remaining content (including corn and eggplant if they make v1) | about 1½ weeks                          |
| QA: multiplayer, existing worlds, performance, controls, conflicts with other add-ons  | about 1 week                            |
| Store assets: showcase world, screenshots, trailer, key art, store text                | about 1½ weeks                          |
| **v1 ready for your review**                                                           | **about 4 weeks after the application** |
| v1.1: the oven and its dishes                                                          | after v1                                |

`[ADD DATES: application sent on ___; v1 target ___]`

The final product name and namespace are still open on purpose. I'd like to set them with you, so
they fit your catalogue and naming rules before anything public ships.

## 6. The ask

1. **Would you consider [PRODUCT NAME] for publishing** through Waypoint Studios?
2. **Your spec**, please: pack icon, key art, screenshot and trailer formats; store text limits;
   anything you require in the description.
3. **Your position on the art pipeline** described above (AI-written generator and models, finished
   by hand).
4. **Your review process and technical requirements**, so QA can test against them, plus which
   languages you need.
5. **Naming:** any rules for the product name and the identifier namespace.
6. **Feedback on the slice**, if you have time to look at it.

Thank you for reading. I'm happy to send a build or walk you through it on a call.

[YOUR NAME]
[EMAIL] · [LINK TO PORTFOLIO]

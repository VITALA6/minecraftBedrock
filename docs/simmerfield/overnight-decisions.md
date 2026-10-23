# Overnight decisions (2026-10-24)

Decisions taken during the unattended overnight batch, each with the safest option picked and the
reason. Newest at the bottom. The morning summary is in `overnight-summary.md`.

## Part 1: small fixes

- **Private TODO list: `.gitignore`, not moved to `~/notes`.** Its path is referenced in this
  folder and it sits next to the store pages it tracks. Ignored files don't count as uncommitted
  changes in `gitHash()` (`git status --porcelain`), so `npm run package` on a commit now gives a
  clean name (`Simmerfield-c1c8d07.mcaddon`, checked).
- **LICENSE.txt: one sentence added, nothing else reworded.** "You may also show it in videos,
  live streams and screenshots." Own worlds and own servers and the not-affiliated line were
  already there. **Monetized videos are not mentioned either way**, because that's a legal choice
  for you. Add "including monetized ones" if you want that (most add-ons allow it).
- **`npm run package` checks the license text, not only that the file exists.** It refuses when
  the BP and RP copies differ or a term is missing: name, copyright Wendermods, all rights
  reserved, no redistribution, own servers, videos/streams, not affiliated. `release.test.ts` runs
  the same check, so `npm test` catches it first.
- **Store pages: "All Rights Reserved (Wendermods)"** plus one plain-language line of what
  players may do. The CurseForge Authors Console setting itself still needs you.

## Batch setup

- **Eight parallel subagents, none of them touch git.** Code review (fresh agent), test
  coverage, localization in four groups (en_US source; de+pl; fr+es+pt_BR; ru+uk), store
  assets, release checklist. Each has an exclusive set of files, so concurrent edits can't
  collide. Commits are made one part at a time from the main session, staging only that part's
  files.
- **Only the code-review agent writes `blockers.md`.** The others report blockers back, and they
  are added here and in the summary, so no two agents write the same file.
- **The coverage agent doesn't edit `scripts/`.** Bugs it finds are reported and fixed (or
  logged) by the main session. That way a coverage test can't race a code fix.
- **The en_US agent may only fix clear errors without changing meaning**, because the
  translations are reviewed against en_US at the same time.

## Part 6: release checklist (committed `930a394`)

- **Upload the `.mcaddon` as is, not zipped.** That's what Bedrock projects on CurseForge ship.
  The ".zip" wording in the moderation policy is a general rule.
- **Markdown editor**, because `curseforge.md` is already Markdown.
- **Slug `simmerfield`.** MCPEDL matches projects by slug, so never change it after the first
  sync.
- **Supported game version 26.50 only**, the only one tested.
- **Project Distribution on.** MCPEDL requires it. The cost: third-party downloads don't count
  toward downloads or rewards.
- **Rewards Program left to you.** It needs your own Twitch 2FA and payout setup.
- **Feedback link = CurseForge comments** until there's an issue tracker.
- **Store pages keep British "colour"** (the docs' house style). Only the meaning was fixed:
  "yellow digs faster" → "yellow speeds up digging", as in en_US.
- **Note for the store images:** CurseForge's moderation policy wants a visible disclaimer on
  AI-altered images. The composed store images are made from our renders and textures by a
  script (see part 5). Whether our AI-assisted art counts is your call (TODO item "Згадка про
  AI-пайплайн").

## Part 4: localization (committed `9c21076`)

- **en_US: 5 values, meaning kept.** "color" (US file, vanilla never writes "colour");
  "Yellow speeds up digging" (Haste is for the player, the food doesn't dig); "helps you explore";
  "cherry grove" (the biome); "Look at a Cooking Pot." (our item names are capitalized).
- **de/pl:** `guide.find` stays a bare `%1$s`. With a label ("Suche:", "Szukaj:") the locked-dish
  footer runs to 4 of 3 lines. Effect family names in German are nouns (Heilung, Bewegung, Arbeit,
  Erkundung) because they appear as "Heilung: Regeneration, 5 s".
- **ru/uk:** mixes are "Заготовка для …" (without "для" it reads as the act of preparing).
  "Обробна дошка" → "Кухонна дошка" (the everyday word). "Кулінарна книга" kept (it's correct
  Ukrainian). Pickle jar: "Банка солоних огірків" / "Банка соленых огурцов".
- **Pot + fire chips stay "+ fire"** in every language: the full text doesn't fit the 49 px chip,
  and the chip shows the pot icon.
- **fr/es/pt:** sneak stays "Agacharse"/"Agachar". Vanilla's control name and most of its tips
  use it; "Acechar"/"Esgueirar-se" is only the options toggle. es/pt cook chip "Cuece 10s" /
  "Ferva 10s" has no space before "s", because with the space it's 1 px too wide for the 55 px
  chip. fr/pt strawberry hint keeps "cherry trees": the full biome name overflows the crop page.
  pt: "cultivo" → "plantação" (vanilla pt_BR wording), Kitchen Counter "Balcão de Cozinha" so it
  can't be confused with the crafting table ("bancada de trabalho"), and our items lowercase in
  running text like vanilla's how-to-play.
- **What a native speaker should check** is listed in `overnight-summary.md`.

## Part 5: store assets (committed)

- **Blockbench was used** (started headless, closed afterwards) to render a pot with tomato soup and
  a spoon, the board with its knife, the cut cake and the kitchen scene on transparent
  backgrounds. The renders are committed in `release/assets/src/`, so `npm run store-assets` works
  without Blockbench. `--render` redoes them.
- **The 3D pot sits on our Kitchen Stove, not a campfire.** The campfire model is vanilla art, not
  ours. The campfire still appears as our own icon in the recipe-flow image, and is named in the
  cook caption.
- **The recipe flow is grow → mix → cook → eat, no slicing.** Pot mixes use whole crops; slices
  only go into cold dishes.
- **No multiplayer or "share" claim in any caption**, because multiplayer isn't tested yet.
- **Captions are pixel-font capitals**, readable at thumbnail size. No banner (optional);
  `curseforge-1-cook.png` can stand in.

## Part 2: code review (committed)

- **The review found no clear bugs to fix with unit tests.** Its three fixes are in game-only code
  (`@minecraft/server`), so they have no unit tests. They are covered by round 6 instead.
- **B37 (`/reload`) and B38 (TNT and pot drops) not applied, only logged with a proposed fix.**
  Both depend on engine behaviour that only a game test shows, and both fixes would change a
  path that works today.
- **The poster's `beforeOnPlayerPlace` re-resolve from `getAllStates()` stays.** CLAUDE.md warns
  against re-resolving an already placed part. This one is the permutation before placement, and
  it worked in game (B24).
- **Saved station records with an unknown id or dimension are skipped, not deleted**, so a
  downgrade keeps its data (they are bounded).

## Part 3: test coverage (committed `0b9f8bd`)

- **Coverage measures the `.ts` files unbundled** (compiled by `tsc` in a module hook, with
  inline source maps). With the esbuild bundles, Node attributes all top-level code to a single
  file. No new npm dependency, and plain `npm test` is unchanged.
- **Fuzz tests use a fixed default seed**, so runs are reproducible. `FUZZ_SEED=random` and
  `FUZZ_RUNS=<n>` give a longer soak.
- **The damaged-save hardening was fixed, not just logged.** The fix is clear and testable: a
  saved job's ticks must be finite and are clamped to the job's length. A damaged or hand-edited
  save could otherwise keep a pot cooking forever.
- **Not changed:** `servingsOf` with negative counts. That's outside its contract (`parseItems`
  already drops non-positive counts).
- **Idea, not a blocker:** the stack split in `lib/inventory.ts` (`giveOrDrop`) needs the game's
  `ItemStack`. Moving the count → stacks math into a pure helper would let it be fuzzed too. Left
  for later, because it's a refactor of working code.
- **Round 6** step 26 is tagged B37 (`/reload` mid-cook), and new step 27a covers B38 (TNT next
  to a full pot).

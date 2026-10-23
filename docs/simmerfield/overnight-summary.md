# Overnight summary (2026-10-24)

All seven parts are done, with everything committed and pushed on `harvest-kitchen-mvp`. Every
decision taken without you, with its reason, is in
[overnight-decisions.md](overnight-decisions.md).

## Do this first (in order)

1. **Round 6 in a new world**: [tests/round-6-release.md](tests/round-6-release.md). Worlds from
   before the rename hold `hk:` content that no longer exists. The build is deployed; you should see
   `Simmerfield build <hash>` on join. Watch these three steps in particular:
   - step 26 (`/reload` mid-cook, B37);
   - the new step 27a (TNT next to a full pot, B38);
   - the book in a couple of languages, since many lang lines changed (see "Native speakers").
2. **Look at the store images** in [release/assets/](release/assets/). Six gallery images and the
   MCPEDL thumbnail. If you don't like one, tell me what to change.
3. **Decide two license/media details**:
   - whether videos may be monetized: `LICENSE.txt` doesn't say either way yet;
   - whether you mention the AI-assisted pipeline: CurseForge's moderation policy wants a visible
     disclaimer on AI-altered images.
4. **Follow [release/checklist.md](release/checklist.md)**: creating the CurseForge project,
   upload, license, categories, Project Distribution for MCPEDL, Rewards. Every step tagged
   **[YOU]** needs you personally.
5. **Native-speaker spot checks** (optional before release): the list is below.

## What changed

| Part            | Commit      | What                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Small fixes  | `c1c8d07`   | The private TODO list is gitignored, so `npm run package` gives a clean name. Store pages say All Rights Reserved. `LICENSE.txt` also allows videos/streams. `npm run package` and `npm test` fail when the license is missing, the BP and RP copies differ, or a term is missing. "досі робоча назва" fixed in the TODO list.                           |
| 2. Code review  | `1d2c827`   | A fresh reviewer found no item dupes, lost items, unbounded dynamic property growth or missing `isValid` checks. Fixes: the station sweep reads each block once (B32); the debug kit survives one id that fails to load; a stale comment. New blockers B37 and B38, each with a proposed fix (in-game test needed). Round 7 section in `code-review.md`. |
| 3. Coverage     | `0b9f8bd`   | `npm run test:coverage` added. Tests 520 → 587, among them 18 property/fuzz tests: recipe matching, pot state transitions, inventory math, fx registry, parsers, discovery, guide navigation. They catch all 9 hand-made mutants tried. Hardening: a damaged saved job can't cook forever.                                                               |
| 4. Localization | `9c21076`   | All 8 languages reviewed against vanilla 1.26.52.3 terms, 142 lines. en_US meaning kept ("color", "speeds up digging", "cherry grove"). The book fit tests stay green.                                                                                                                                                                                   |
| 5. Store assets | `ef6514f`   | `npm run store-assets` makes 6 × 1920×1080 CurseForge images and the 720×340 `MCPEDL.png`, from Blockbench renders of our models plus our icons, in the logo's style.                                                                                                                                                                                    |
| 6. Checklist    | `930a394`   | [release/checklist.md](release/checklist.md): 34 steps in 7 phases, with sources checked 2026-10-24. 6 of the 8 TO VERIFY notes in the store pages are answered.                                                                                                                                                                                         |
| 7. This summary | last commit | This file, the decisions log, and round 6 updated for B37/B38.                                                                                                                                                                                                                                                                                           |

### Coverage of the pure modules (before → after)

|        | Lines   | Branches | Functions |
| ------ | ------- | -------- | --------- |
| Before | 99.54 % | 95.48 %  | 97.69 %   |
| After  | 99.80 % | 97.57 %  | 99.72 %   |

The uncovered branches can't be reached with the shipped data: every pot recipe is a single mix,
and the rest are defensive `??` fallbacks. Node counts comments as lines, so the branch and function
columns are the meaningful ones. Run it with `npm run test:coverage`. It writes
`dist/coverage/lcov.info`.

## Test results (final run)

- `npm test`: 587 tests, 587 pass, 0 fail.
- `npx tsc`, `npm run lint` and `npm run format:check`: clean.
- Every generator `--check` is up to date: pot block, posters, poster block, ghosts, guide UI, fx,
  pot flipbooks, logo, kitchen decor and store assets. `lint-posters` and `lint-textures` pass.
- `npm run build`, `npm run deploy` and `npm run package` ran on the final commit. The `.mcaddon`
  name has no `-dirty`.

## Blockers (new tonight, in [blockers.md](blockers.md))

- **B37:** cooking after `/reload` relies on `worldLoad` firing again; not documented. If round 6
  step 26 shows the pot stops after `/reload`, the fix is written out (idempotent
  `startStationSweep`, also called from a first-tick `system.run`).
- **B38:** TNT may destroy a pot's drops if the explosion damages items after `onBreak`. Round 6
  step 27a tests it, and the fix (drop on the next tick, in `onBreak` only) is written out.
- **B32** (sweep cost) has a note: block reads per sweep are now halved. The parsed-state cache is
  still open.

Nothing blocked the batch itself. The Blockbench MCP server wasn't running, so the store-asset
agent started Blockbench itself for the renders and closed it afterwards.

## Native speakers: worth a quick look

- **uk:** "Кухонна дошка" (was "Обробна дошка"), "Заготовка для …", "Від грядки до тарілки",
  "Банка солоних огірків".
- **ru:** "Заготовка для …", "От грядки до тарелки", "Банка соленых огурцов".
- **de:**
  - "Was kann ich kochen?"
  - "Küchentheke": maybe "Arbeitsplatte"?
  - "Gurkenglas": maybe "Glas Essiggurken"?
  - "Geändert, bitte erneut versuchen": clipped to fit the 5-word action bar.
- **pl:** "Wytwarzanie" (step heading), "Truskawki z cukrem", "Słoik ogórków".
- **pt_BR:**
  - "cultivo" → "plantação" everywhere;
  - "Balcão de Cozinha";
  - "Ferva 10s" on the cook chip;
  - our item names lowercase in running text.
- **es:** "Tomate cortado" (vs "en rodajas", which doesn't fit); "te hace excavar más rápido".
- **fr:** "vous fait creuser plus vite" (Haste); "Prenez sur vous les ingrédients…".

## Still open from before (unchanged)

- The TODO list items: two-player LAN test (B36), add-on into an existing world and removed
  again (B34), stress test (B32), touch and gamepad, release build check.
- Trailer: recording, music, edit.
- Real in-game screenshots and GIFs for the store pages: the composed images don't replace them.
- The `[CREDITS]` and links placeholders on the store pages.
- Merging into `main` and the `v1.0.0` tag, after round 6.

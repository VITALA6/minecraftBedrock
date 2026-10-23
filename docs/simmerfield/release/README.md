# Simmerfield: release listings

Store text and art for publishing Simmerfield 1.0.0 on CurseForge and MCPEDL. Written
2026-10-23. Facts come from the pack code and player docs; anything not confirmed on the web is
marked **TO VERIFY** in the files.

## Files

| File            | What it is                                                                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curseforge.md` | Project fields (class, categories), summary, the full description with How to start, features, install steps, known conflicts, languages, credits and license placeholders, and the 1.0.0 file changelog. |
| `mcpedl.md`     | The same content in simple formatting for MCPEDL, plus how MCPEDL now syncs projects from CurseForge and its rules (thumbnail, distribution setting, download hosts).                                     |
| `logo-400.png`  | 400x400 project logo: the Cooking Pot on a campfire with a Tomato Soup and a Tomato, from the pack's own textures. Regenerate with `node tools/make-logo.mjs` (`--check` compares).                       |
| `assets/`       | Six composed 1920x1080 CurseForge gallery images and the 720x340 MCPEDL thumbnail, from our own textures and Blockbench renders (list in `assets/README.md`). Regenerate with `npm run store-assets`.     |

## What the owner still has to supply

- [x] **Final name.** "Simmerfield" (D1, decided 2026-10-23). Store title "Simmerfield: Farming &
      Cooking", credited "by Wendermods".
- [ ] **License.** All Rights Reserved, filled in on both pages; `LICENSE.txt` ships in both
      packs (`npm run package` checks it). Still to do in the CurseForge Authors Console: pick
      All Rights Reserved, and set Project Distribution to allow third-party distribution (MCPEDL).
- [ ] **Credits.** "Made by Wendermods" is filled in. Still open: who made what, and whether to
      mention the AI-assisted pipeline (placeholders in both files).
- [ ] **GIFs** (placeholders `TODO-gif-*.gif`), matched to the shots in
      `../marketing/trailer.md`:
  - [ ] `TODO-gif-seeds.gif`: breaking grass and finding seeds (trailer shot 2)
  - [ ] `TODO-gif-strawberry-bush.gif`: picking strawberries (shot 4)
  - [ ] `TODO-gif-chopping.gif`: chopping on the Cutting Board (shot 5)
  - [ ] `TODO-gif-cooking.gif`: mix into the pot, cooking, taking the soup out (shots 6 to 8).
        trailer.md predates the two-step mixes (D16): film a Tomato Soup Mix going in, not raw
        tomatoes.
  - [ ] `TODO-gif-guide.gif`: flipping through the Kitchen Guide (shot 9; trailer.md calls it
        the Recipe Book)
- [x] **Composed gallery images** (2026-10-24, no game needed): `assets/curseforge-1-cook.png` to
      `assets/curseforge-6-recipe-flow.png` (cook, chop, cake, kitchen decor, crops and dishes,
      recipe flow). Upload them to the CurseForge Images. They show the content, not gameplay, so
      they don't replace the screenshots and GIFs.
- [ ] **Screenshots** (placeholders `TODO-shot-*.png`): the 8 setups in `../marketing/trailer.md`,
      plus `TODO-shot-9-kitchen-decor.png` (a kitchen built from the decor blocks with the stove
      lit; not in trailer.md yet). Shot 7 (cake shared by three players) needs the multiplayer
      test first. Until they exist, the composed images above can fill the gallery
      (`assets/curseforge-4-kitchen.png` shows the decor blocks, `assets/curseforge-3-cake.png`
      the cake), but real in-game shots are still needed.
- [ ] **Banner** `TODO-banner.png` for the top of the description (optional). Not made yet;
      `assets/curseforge-1-cook.png` could stand in.
- [x] **MCPEDL thumbnail:** `assets/MCPEDL.png`, 720x340 px. When you upload it to the CurseForge
      images, set its title to exactly `MCPEDL`.
- [ ] **Links:** issues or feedback page, Discord or socials, portfolio site.
- [ ] **The `.mcaddon`** from `npm run package` (named `Simmerfield-<hash>.mcaddon`).
- [ ] **TO VERIFY items:** CurseForge summary limit (we used 150 as a safe target), Markdown vs
      HTML in the CurseForge editor, `.mcaddon` vs `.zip` uploads, MCPEDL tags and version picker.
- [ ] **Facts to confirm in game before you publish** (from `../marketing/marketplace.md`):
  - [ ] a fresh world with every experiment off loads clean;
  - [ ] the add-on works when added to an existing world (seeds from grass, the welcome book);
  - [ ] what happens to placed pots, boards, cakes and crops when the add-on is removed; add a
        line to the description once you know;
  - [ ] touch and controller play, before you mention them;
  - [ ] multiplayer, before you add the Multiplayer category or any "share with friends" text.
- [ ] **Languages:** the description lists eight. Make sure all seven translations are in
      `resource/texts/` and `languages.json` before you upload.
- [ ] **Pack names:** the install steps say "Simmerfield BP" and "Simmerfield RP", the current
      `pack.name` values. Update the steps if those change.

# Harvest Kitchen: release listings

Store text and art for publishing Harvest Kitchen 1.0.0 on CurseForge and MCPEDL. Written
2026-10-23. Facts come from the pack code and player docs; anything not confirmed on the web is
marked **TO VERIFY** in the files.

## Files

| File            | What it is                                                                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curseforge.md` | Project fields (class, categories), summary, the full description with How to start, features, install steps, known conflicts, languages, credits and license placeholders, and the 1.0.0 file changelog. |
| `mcpedl.md`     | The same content in simple formatting for MCPEDL, plus how MCPEDL now syncs projects from CurseForge and its rules (thumbnail, distribution setting, download hosts).                                     |
| `logo-400.png`  | 400x400 project logo: the Cooking Pot on a campfire with a Tomato Soup and a Tomato, from the pack's own textures. Regenerate with `node tools/make-logo.mjs` (`--check` compares).                       |

## What the owner still has to supply

- [ ] **Final name.** "Harvest Kitchen" is a working name (D1). Check it for conflicts before you
      publish, and update both files if it changes (the logo has no text).
- [ ] **License.** Pick one in the CurseForge Authors Console and fill in the `[LICENSE]`
      placeholders. For MCPEDL, set Project Distribution to allow third-party distribution.
- [ ] **Credits.** Your name or studio, who made what, and whether to mention the AI-assisted
      pipeline (placeholders in both files).
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
- [ ] **Screenshots** (placeholders `TODO-shot-*.png`): the 8 setups in `../marketing/trailer.md`,
      plus `TODO-shot-9-kitchen-decor.png` (a kitchen built from the decor blocks with the stove
      lit; not in trailer.md yet). Shot 7 (cake shared by three players) needs the multiplayer
      test first.
- [ ] **Banner** `TODO-banner.png` for the top of the description (optional).
- [ ] **MCPEDL thumbnail:** 720x340 px, titled exactly `MCPEDL` in the CurseForge images.
- [ ] **Links:** issues or feedback page, Discord or socials, portfolio site.
- [ ] **The `.mcaddon`** from `npm run package` (named `HarvestKitchen-<hash>.mcaddon`).
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
- [ ] **Pack names:** the install steps say "Harvest Kitchen BP" and "Harvest Kitchen RP", the
      current `pack.name` values. Update the steps if those change.

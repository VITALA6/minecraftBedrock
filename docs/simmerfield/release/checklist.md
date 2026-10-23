# Release checklist: Simmerfield 1.0.0 on CurseForge (and MCPEDL)

Step by step, from a tested build to a live page, for "Simmerfield: Farming & Cooking" by
Wendermods, 1.0.0, All Rights Reserved. Written 2026-10-24. Web facts were checked that day; the
sources are at the bottom.

- **[YOU]** means only the owner can do it: accounts, payments, clicks in the web UI, in-game
  tests, recording, music.
- **Ready:** means the text or file already exists in the repo; the path follows.
- MCPEDL has no upload of its own any more. You publish on CurseForge, and MCPEDL copies the
  project once the first file is approved (phase 4 sets that up).

## 1. Before upload (gates: don't open the Authors Console until these pass)

1. **[YOU] Run round 6 in game.** `docs/simmerfield/tests/round-6-release.md`, 54 steps, one
   session, new worlds only. Fix or accept every failure in `docs/simmerfield/blockers.md`.
   Part J (add, remove, re-add on an existing world) decides one line of store text: add what
   happens to placed blocks when the add-on is removed to the description in `curseforge.md`.
2. **[YOU] Decide the store claims the tests unlock.** Multiplayer passed (part I)? Then you may
   add the Multiplayer category and the "share the cake" captions. Touch or controller not
   tested? Then don't mention them. List in `README.md`, "Facts to confirm in game".
3. **Set the release date.** In `CHANGELOG.md`, change `## 1.0.0 - 2026-10-23` to the upload day.
4. **[YOU] Commit everything,** then check `git status` is clean. The package name carries the
   commit hash, and uncommitted changes add `-dirty`.
5. **[YOU] Run `npm run package`.** Expect `dist/Simmerfield-<hash>.mcaddon` with no `-dirty` and
   no `[package] uncommitted changes` warning. It does a release build (no join chat, no
   `console.log`, no trailer) and refuses to write the file if:
   - either pack lacks `LICENSE.txt`, the two differ, or a license term is missing
     (Ready: `packs/simmerfield/behavior/LICENSE.txt` and `resource/LICENSE.txt`, identical);
   - a source, map, `.md`, test or deploy marker slipped into the packs.
6. **[YOU] Install that exact file on a clean game.** Remove the dev copies first: the
   `simmerfield_BP`/`simmerfield_RP` folders in `development_behavior_packs/` and
   `development_resource_packs/` (otherwise the game may load those instead). Double-click the
   `.mcaddon`; expect two "Successfully imported" messages. Make a new world, activate
   **Simmerfield BP**, check the RP comes along, and play the five "How to start" steps from the
   description. `/wm_kitchen:debug validate` must show the same hash as the file name.
7. **[YOU] Record media.** Shot list: `docs/simmerfield/marketing/trailer.md` (update it first:
   mixes go into the pot, the book is the Kitchen Guide) and `recording-guide.md`. Needed:
   - 9 screenshots (`TODO-shot-*.png` in `curseforge.md`), PNG or JPG;
   - 5 GIFs (`TODO-gif-*.gif`), short loops, a few MB each;
   - the **MCPEDL thumbnail**, 720x340 px (see phase 4);
   - optional: the banner, and the trailer with your music (`npm run trailer:edit -- --music
<file>`). Music must be yours or licensed for redistribution (CurseForge policy).
8. **Fill the placeholders** in `curseforge.md`: credits line, the optional AI-pipeline note
   (decide; if any showcase image is AI-altered, CurseForge requires a visible disclaimer), and
   the links line. For the issues link, use the CurseForge project's comments page (you get the
   URL in phase 2). No download links of any kind: CurseForge forbids external download links.
9. **Keep** `docs/simmerfield/release/logo-400.png` (400x400 PNG). It meets the avatar rule
   (exactly 400x400, not WebP, not a solid colour). Regenerate with `node tools/make-logo.mjs`.

## 2. Create the project

10. **[YOU] Account.** Sign up or log in at https://authors.curseforge.com. If you plan to join
    the Rewards Program, also set up 2FA now (phase 4, step 22).
11. **[YOU] Start a project:** Authors Console → **Start a Project** (or
    https://authors.curseforge.com/#/projects/create/choose-game) → game **Minecraft Bedrock**.
12. **[YOU] Fill the General fields.** Ready: `curseforge.md`, "Project fields" and "Summary".
    - Name: `Simmerfield: Farming & Cooking`. Don't add "Add-on", "Bedrock" or a version number
      (the moderation policy forbids game, class and version in names).
    - Summary: the 132-character line from "Summary". Read the field's character counter; if it
      is shorter, use the 82-character fallback below it.
    - Class: **Addons**. Main category: **Food**. Additional: **Survival**, **Vanilla+** (up to 4
      allowed; Multiplayer only if step 2 allows it).
    - Logo: upload `logo-400.png`. Then **Next**.
13. **[YOU] Description tab.** Switch the editor from WYSIWYG to **Markdown**, then paste
    everything between the two `---` rules under "Description" in `curseforge.md`. Leave the image
    lines for now; phase 3 replaces them with real URLs. If Markdown isn't offered, paste into
    WYSIWYG from a rendered preview (for example the file opened in VS Code's Markdown preview).
14. **[YOU] License tab.**
    - License: **All Rights Reserved** from the dropdown (Bedrock projects show this label, so it
      exists; don't pick "Custom" unless it's missing, and then paste `LICENSE.txt`).
    - **Project Distribution: ON** (allow third-party distribution). New projects have no default,
      so you must set it. MCPEDL only shows projects with it on.
15. **[YOU] Slug.** Under General, set the slug to `simmerfield` if it's free (otherwise keep
    CurseForge's suggestion). Decide now: MCPEDL matches projects by slug, so never change it
    after the first sync.
16. **[YOU] Comments: on** (CurseForge encourages it; it's the feedback channel both stores ask
    for). Copy the project URL and put `<url>/comments` into the links line of `curseforge.md`.

## 3. Upload the file

17. **[YOU] Images first** (Images/Gallery tab). Upload the screenshots and GIFs; give each a
    short title. Upload the 720x340 thumbnail and set its title to exactly `MCPEDL` (only the
    first 20 images go to MCPEDL, so keep the gallery at 20 or fewer, or upload this one early).
    GIF support in the gallery is **not verified**; if it rejects GIFs, insert them through the
    description editor's image button instead.
18. **[YOU] Wire the description images.** Copy each uploaded image's URL into the matching
    `![...](TODO-...)` line of the description. For MCPEDL, don't give images a fixed pixel width
    or height (Markdown images have none; in HTML use `width="50%"`, no height).
19. **[YOU] Files tab → Upload File:** `dist/Simmerfield-<hash>.mcaddon` from step 5, as it is
    (no `.zip` around it; Bedrock projects ship `.mcaddon` files). Max size 2 GB.
    - Display name: `Simmerfield 1.0.0`.
    - Release type: **Release** (only Release files count as the default download).
    - Supported version: **26.50** (the picker's label for 1.26.50; it's what you tested on). Add
      newer lines only after testing on them.
    - Changelog: Ready, the quoted block under "Changelog for the 1.0.0 file" in `curseforge.md`.
      A changelog is required on every file.
    - Release options: **release automatically after approval** (decision: fewer steps; the
      launch posts wait for approval anyway).
    - Related projects: none.

## 4. Settings

20. **[YOU] Re-check the License tab** after saving: All Rights Reserved, Project Distribution on.
    Note the trade-off: with it on, downloads through third-party services count toward neither
    your download total nor rewards. Whether MCPEDL downloads count is not documented.
21. **[YOU] MCPEDL link.** Log in at https://mcpedl.com, open your dashboard profile →
    **Connected Accounts** → connect the CurseForge account. No MCPEDL project to create.
22. **[YOU] Rewards Program (optional; decide).** Bedrock projects take part. To join: user
    profile → Rewards Program settings → read the ToS → toggle on → **Update**. Facts:
    - points come from a monthly pool split by popularity; a project must pass a hidden
      popularity threshold first; 1 point = $0.05; points expire after 3 years;
    - no points accrue while you haven't logged in for 60+ days;
    - redeeming needs 2FA, which currently works through a Twitch login with the same email;
      payouts go through Tremendous (gift cards, PayPal and others, by region) or Payoneer
      (no `+` in the email), from the Rewards Store in the Authors Console;
    - no tax form is needed to join; CurseForge provides no tax documents, so income reporting
      is your own job. **[YOU]** check what your country requires.

## 5. Submit

23. **[YOU] Submit** the project for review (uploading the first file sends it). The file shows
    "Under Review". Moderation is automated checks plus a person looking at the description,
    images and title: "a few minutes to three workdays" (CurseForge blog, 2026-06-24).
24. **If it's rejected or changes are asked:** the reason arrives in the console notifications
    and at https://www.curseforge.com/my-notifications. Fix exactly that, then resubmit. Never
    delete the project or file and upload again (policy). To appeal or ask, reply through the
    notification or open a support ticket.

## 6. After approval

25. **[YOU] Check the live page** logged out: logo, summary, categories, description images,
    license "All Rights Reserved", file listed as Release for 26.50.
26. **[YOU] Download from CurseForge** on a clean game (dev packs removed) and repeat step 6
    quickly: import, activate, cook one soup.
27. **[YOU] Check MCPEDL** once the sync has run (time not documented; give it a day): search for
    Simmerfield on mcpedl.com and look for "Published on CurseForge" next to the date. Tags
    should be Food, Survival, Vanilla+ and the version 26.50. If it's missing, check in order:
    slug, file approved, Project Distribution on, accounts connected, thumbnail titled `MCPEDL`.
28. **Repo:** tag the released commit (`git tag v1.0.0`) and merge `harvest-kitchen-mvp` into
    `main`, as in `TODO-before-release.uk.md` section 8. **[YOU]** run these; agents don't.
29. **[YOU] Post.** Ready: `docs/simmerfield/marketing/launch-posts.md` (r/MCPE, r/Minecraft,
    Discord, Shorts). Replace `[CurseForge link]`, `[MCPEDL link]`, `[trailer link]`, read each
    subreddit's rules first, and use the one-player cake caption unless multiplayer passed.
30. **[YOU] Update the portfolio site** with the store links (`marketing/portfolio-site.md`).

## 7. Ongoing updates

31. **Watch, in the first week daily, then weekly:** CurseForge comments and notifications,
    MCPEDL comments (synced posts keep their own comment section), the posts. Log bugs in
    `docs/simmerfield/blockers.md`; ask reporters for game version, platform and a Content Log.
32. **Ship a fix as a new file on the same project**, never a new project:
    1. Bump `header.version` in both manifests (for example `[1, 0, 1]`), and the BP's RP
       dependency `version` to the same value. Bump the module versions alongside to keep them
       in step.
    2. **Never change any UUID** (headers, modules, the dependency) or any `wm_kitchen:`
       identifier. Worlds find packs by UUID and blocks by id; changing either breaks players'
       worlds.
    3. Add the section to `CHANGELOG.md`; commit; `npm run package` (clean name); install that
       file over the old one on a clean game and load a world made with the previous version.
    4. Upload on the Files tab with its changelog; Release; versions you tested. Keep the old
       files. MCPEDL picks up updates by itself.
33. **When the game updates:** follow "Versions" in `CLAUDE.md` (new `@minecraft/server` pins,
    manifests, maybe `min_engine_version`), test, then upload with the new game version ticked.
    Until then the 26.50 file stays; add newer versions to an existing file only after testing.
34. **Store text changes** (description, images, categories) need no new file, but they go
    through moderation again. Keep `curseforge.md` and `mcpedl.md` in sync with what's live.

## Decisions taken (2026-10-24, owner asleep)

- Upload the `.mcaddon` as is: Bedrock projects on CurseForge ship `.mcaddon` files.
- Markdown editor: the description in `curseforge.md` is already Markdown.
- Slug `simmerfield`: short URL; it must never change once MCPEDL has synced.
- Supported version 26.50 only: the only version tested; more after testing.
- Automatic release after approval: fewer clicks; nothing is posted before approval anyway.
- Project Distribution on: required for MCPEDL, at the cost of uncounted third-party downloads.
- Rewards Program left to the owner: it needs a personal 2FA and payout setup.
- Comments as the feedback channel: no public issue tracker exists yet.
- Display name "Simmerfield 1.0.0", file name kept with the hash so it matches the build id.

## Still not verified

- CurseForge summary character limit (read the field counter).
- Whether the gallery accepts GIFs, and image size limits other than the logo.
- How long the MCPEDL sync takes, and whether MCPEDL downloads count toward rewards.
- Minimum description length or screenshot count on MCPEDL (none found).

## Sources (checked 2026-10-24)

- Creating and submitting a project (fields, 4 extra categories, 2 GB, release types,
  "Under Review"):
  https://support.curseforge.com/en/support/solutions/articles/9000197241-creating-and-submitting-a-project
- Project Submission Guide and Tips (WYSIWYG or Markdown, logo 400x400 PNG, comments, License):
  https://support.curseforge.com/support/solutions/articles/9000199552
- Moderation Policies (avatar 400x400, no WebP, one-sentence summary, no external downloads,
  changelog required, don't re-upload, music rights, AI-image disclaimer):
  https://support.curseforge.com/support/solutions/articles/9000197279-moderation-policies
- Project Distribution Toggle (License tab, no default for new projects, third-party downloads
  uncounted): https://support.curseforge.com/support/solutions/articles/9000207877
- Reward Program FAQ ($0.05 a point, threshold, 60 days, 3-year expiry, no tax form):
  https://support.curseforge.com/support/solutions/articles/9000197902
- How to Join and Redeem Rewards (toggle, Tremendous, Payoneer, Twitch 2FA):
  https://support.curseforge.com/support/solutions/articles/9000197709
- Moderation time, notifications, release options (2026-06-24):
  https://blog.curseforge.com/how-to-become-a-curseforge-author/
- MCPEDL via CurseForge only since 2025-04-30:
  https://blog.curseforge.com/how-to-host-mcpedl-projects-on-curseforge/
- Uploading to MCPEDL (Connected Accounts, distribution, slug, `MCPEDL` thumbnail 720x340, first
  20 images, HTML widths, "Published on CurseForge"): https://mcpedl.com/cf-reward-program/
- Bedrock formats `.mcaddon`/`.mcpack`:
  https://blog.curseforge.com/how-to-install-add-ons-in-minecraft-bedrock/
- Observed projects: https://www.curseforge.com/minecraft-bedrock/addons/verity-bedrock-edition/files
  (`.mcaddon`, versions `26.50`, All Rights Reserved), https://mcpedl.com/ores-booster/ with
  https://www.curseforge.com/minecraft-bedrock/addons/ores-booster (tags = CurseForge categories)

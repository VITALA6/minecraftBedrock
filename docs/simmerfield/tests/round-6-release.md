# Test script, round 6: release check (round 5 carried over, stress, multiplayer, existing worlds)

> **New worlds only (since 2026-10-23).** That day the add-on was renamed from Harvest Kitchen
> (`hk:`) to Simmerfield (`wm_kitchen:`). Worlds made before the rename hold `hk:` blocks and
> items that no longer exist, so don't reuse an old test world for any part of this script.

This round is the last one before a release build goes out. It covers:

- **Round 5 carried over** ([`round-5-guide-fx-decor.md`](round-5-guide-fx-decor.md)): the Kitchen
  Guide, the pot and board effects, the 8 decor blocks and the Kitchen Stove, condensed where
  checks overlap. None of round 5 has run in game yet.
- **Audit fixes (2026-10-23):** the stove switches once per press, the pot's choice form opens once
  per press, and the sweep no longer spills a pot it can't read (`code-review.md`, "Release audit").
- **Stress:** 32 pots and about 400 crops in one area.
- **The release build** (`npm run build:release`): no test chat on join, `/wm_kitchen:debug` for
  operators only.
- **Two players on LAN:** one pot, one board, one stove, two guides, discovery per player.
- **An existing world:** adding the add-on to a world made without it, then removing it again.

It fits one session if you keep to this order: the test world on the test build (parts A–G), the
same world on the release build (parts H–I, with the second player), and then the copy of an
existing world (part J). That's three world entries and two deploys.

Report back with the step numbers: `ok`, or what you saw instead. Screenshots help for the book,
the effects, block facing and anything in part J. Open points: [`../blockers.md`](../blockers.md)
(B28–B30 and B31–B36 are tested here).

## Before you start (5 minutes)

- **A copy of an existing world** made without Simmerfield, for part J. Use any survival world
  you don't mind changing that never had Simmerfield or the old Harvest Kitchen packs on it (no
  `hk:` blocks), then go to Edit → Copy World and use only the copy. Leave it without packs for
  now.
- **A second player** for part I. The easy way is a phone or tablet on the same Wi-Fi, running
  **the same game version** (1.26.52). LAN won't list a world from another version. Sign in with a
  **different Microsoft account** if you can, because the same account twice may be refused or
  kick the first one. A second mcpelauncher instance on the same PC hasn't been tried; note it if
  you use one.
- **The test build** is deployed: `npm run build && npm run deploy`.
- Content Log File is on (Settings → Creator).

How to write a step down: `ok`, or what you saw. Tick the box when it's done.

---

## A. Setup (test build, test world)

**1. Enter the test world**

- Setup: a **new** flat test world made after the rename (Creative, cheats on, no experiments,
  only Simmerfield), not the old test world. If it was open, **leave and re-enter**. Fly for 1–2
  minutes so the Content Log flushes.
- Expect: no pack error dialog. Chat shows `Simmerfield build <hash> <time>` with the hash of the
  build you just made.
- [ ] Notes:

**2. Data check**

- Do: `/wm_kitchen:debug validate`.
- Expect: the build line again, then `Data check: 0 problem(s).`
- [ ] Notes:

**3. Fresh kit**

- Do: `/gamemode s`, `/clear`, `/wm_kitchen:debug reset`, `/wm_kitchen:debug kit`.
- Expect: the kit includes the Kitchen Guide and one of each of the 8 decor blocks.
- [ ] Notes:

## B. Kitchen Guide (round 5 steps 4–13, B28)

**4. Home**

- Do: use the guide in the air, then while looking at the ground.
- Expect: it opens once each time, with a page-turn sound. It's a two-page parchment book, not the
  grey vanilla form. Home has six rows **with names**: `Hot Dishes · n/10`, `Cutting Board`,
  `Cold Dishes · n/8`, `Crops · n/6`, `What can I make?`, `How to Play`. Each row and each
  ribbon on the right edge has a **different icon** (pot, board, crafting table, sprout,
  magnifier, scroll with `?`). No ribbon sticks out on Home.
- [ ] Notes:

**5. Chapters, ribbons, Back and Home**

- Do: tap each Home row in turn. From a deep page, tap each ribbon, then `Back`, then `Home`.
- Expect: each chapter opens with **its** ribbon out (lighter, wider). A ribbon jumps to its
  chapter. `Back` goes to the previous page and `Home` goes Home.
- [ ] Notes:

**6. A dish page and a crop page**

- Do: Hot Dishes → Tomato Soup. Tap the tomato slot. On the crop page tap a dish under `Used in`.
- Expect:
  - Tomato Soup has a big icon, `❤ Heal: Regeneration, 8 s` and the chips `❤ 8 s` and
    `Pot + fire` (with a flame). The right page shows 2 tomatoes (count 2) + bowl → Tomato Soup
    Mix, then `Cook 5 s` → soup. The footer says `2 × Tomato, 1 × Bowl`. ◀ is faded and ▶ goes
    to the next hot dish.
  - The tomato page has the **Crops** ribbon out and shows seed → 4 stages → tomato, where its
    seeds are found, and `Used in`. ◀ ▶ walk the crops, and a dish under `Used in` opens it.
- [ ] Notes:

**7. Cold dish**

- Do: Cold Dishes → Garden Salad.
- Expect: no cook row. There's a `Craft` chip with the crafting table, and the Cold Dishes ribbon
  is out.
- [ ] Notes:

**8. Nothing found yet**

- Do: `/wm_kitchen:debug reset`, `/clear`, then open the guide (survival).
- Expect: undiscovered dishes and crops show `???` with a dark `?` silhouette. Unfound
  ingredients are silhouettes, while vanilla ones (beef, bowl) are visible. The footer says
  `Find: <biomes>`. Crops still say where their seeds are.
- [ ] Notes:

**9. What can I make?**

- Do: `/give @s wm_kitchen:tomato 2`, `/give @s bowl`, then open What can I make?. Then
  `/give @s wm_kitchen:tomato_soup_mix 3` and look again. Then `/clear` and look again.
- Expect: Tomato Soup is listed, then a count of 3, then `Nothing yet…`.
- [ ] Notes:

**10. Fit, input and language**

- Do: walk Home, a chapter, a dish, a crop and What can I make? with mouse and keyboard, then a
  controller if you have one, at the smallest and the largest GUI scale. Switch the game language
  once (for example Deutsch) and open a dish page, then switch back.
- Expect: no text leaves its box, and long names end in `...`. A controller reaches every row,
  slot, chip, ribbon and ◀ Back Home ▶, and can't focus faded buttons. In the other language the
  guide shows translated text, not raw keys like `wm_kitchen.guide...`. Content Log: no JSON UI
  errors (search for `wm_kitchen_guide`, `collection_panel`, `server_form`).
- [ ] Notes:

## C. Pot effects (round 5 steps 14–22, B29) and the choice form (B31)

`/gamemode c`. A pot on a lit campfire. `/wm_kitchen:debug fast` must be **off** (run it once; it
says `off`, or run it again).

**11. Cooking looks**

- Do: add a Tomato Soup Mix, empty hand + use.
- Expect: **lid off**. The red liquid bubbles. The rim ring stays steady while only the handle
  tops show a stepping ember. A wooden spoon circles in the pot, the steam and glow show, and from
  the side the spoon handle doesn't poke through the rim. Content Log: no errors about
  `flipbook_textures.json`, `wm_kitchen:fx_spoon`, `geometry.wm_kitchen.fx_spoon`, animations or the
  render controller.
- [ ] Notes:

**12. Another colour**

- Do: cook a Strawberry Jam Mix.
- Expect: the bubbles are that liquid's colour.
- [ ] Notes:

**13. Heat off mid-cook, then the end**

- Do: start a cook, put the campfire out with a shovel, relight it, then let the cook finish.
- Expect: with the fire out the lid goes on, the liquid is still and the spoon goes within about
  half a second. Relit, the lid comes off, the bubbles come back and so does the spoon. When it's
  done the spoon is gone, there are no bubbles, and the ready glint shows.
- [ ] Notes:

**14. Break mid-cook**

- Do: start a cook and break the pot.
- Expect: the spoon goes with it. In survival, the pot and the mix drop once.
- [ ] Notes:

**15. Choice form, once per press (new)**

- Do: put 1 Tomato Soup Mix and 1 Onion Soup Mix in a pot. Tap use once with an empty hand,
  close the form. Then **hold** use for 2 s.
- Expect: the plain grey vanilla form (not the book) with two `Cook …` buttons each time,
  **one** form for the held button, and no `Close chat, then try again.` line in chat. Pick one:
  it cooks.
- [ ] Notes:

**16. Stray effects**

- Do: `/summon wm_kitchen:fx_spoon`, `/summon wm_kitchen:fx_knife`. Look in the creative menu for
  their spawn eggs.
- Expect: each appears for at most a tick and is removed. There are no spawn eggs.
- [ ] Notes:

## D. Cutting board effects (round 5 steps 23–28, B29)

**17. One chop, four facings**

- Do: place a board while looking north and use it with a tomato. Repeat looking east, south and
  west.
- Expect: the board's own knife rises onto its edge from its slot, chops with pale crumbs on each
  hit, and lies flat in its slot again about 1 s later. **Exactly one knife** is visible at every
  moment (a one-frame blink at pick-up is acceptable, but note it). The knife chops along the
  board every time. If east and west are across or flipped, note it (fix: swap `west`/`east` in
  `FX_BOARD_YAW`, `scripts/fx/fx-config.ts`). Also note which way the board faces you (B9).
- [ ] Notes:

**18. Sneak-chop, break mid-chop**

- Do: sneak + use with a stack of tomatoes. Then sneak-chop again and break the board mid-chop,
  then place a new one.
- Expect: one knife chops the whole time with the resting knife hidden, and it's back about 1 s
  after the last item. The broken board's knife vanishes within about 1 s, and the new board shows
  its knife.
- [ ] Notes:

**19. You can't hit the effects**

- Do: while a knife or spoon is there, click the board or the pot. Let a mob walk through it.
- Expect: the station reacts as usual, the mob walks through, and nothing ever drops.
- [ ] Notes:

## E. Kitchen decor and the stove (round 5 steps 29–38, B30, B31)

**20. Menu and facing**

- Do: open the creative menu's Items tab next to the pot, board and poster. Place a Kitchen
  Counter looking north, east, south and west, then do the same with the stove, sink, cabinet and
  spice shelf. Walk into the cabinet and the shelf from the front.
- Expect: all 8 are listed with icon and name (Kitchen Counter, Kitchen Cabinet, Spice Shelf,
  Kitchen Sink, Kitchen Stove, Hanging Pan, Jar of Pickles, Vegetable Basket). The drawers, doors,
  oven door and shelf front face **you**, and the sink's tap is at the back. If they all face away,
  note it (fix: `y_rotation_offset` 180 → 0 in the 8 block files). The collision matches the
  shallow models.
- [ ] Notes:

**21. Hanging, standing, popping**

- Do: hang the pan under a block, then try a floor and a wall. Put the jar and the basket on a
  counter and on the floor, then try a wall and a ceiling. Break the block each one hangs on or
  stands on.
- Expect: the pan hangs hook up with its front toward you, and the floor and wall are refused.
  The jar and basket stand on the floor and counter, and the wall and ceiling are refused. Each
  one pops and drops itself when its support goes. If the pan pops right after placing, note it
  (B30).
- [ ] Notes:

**22. A small kitchen**

- Do: build counters, the sink with a cabinet **two** blocks above it, the stove, the spice shelf
  on a counter against a wall, the jar and basket on counters, and the pan under a cabinet.
- Expect: textures are as sharp as vanilla blocks, with no flickering faces at the sink basin or
  the doors. The sink tap reaches 4 px into the block above it.
- [ ] Notes:

**23. Stove on and off, once per press (new)**

- Do: place a stove. Use it, use it again, then **hold** use on it for 3 s. Then double-click it
  quickly.
- Expect: unlit, the window is dark and there's no light. One use gives the `fire.ignite` sound,
  an orange window and light in the room. The next use gives a fizz, a dark window and no light.
  Holding switches it **once**, not on-off-on. Note whether a fast double-click switches it twice
  or once (once means it was under 0.4 s; B31).
- [ ] Notes:

**24. Pot on the stove**

- Do: sneak and put a Cooking Pot on the stove (a click without sneaking switches the stove), add a
  Tomato Soup Mix and use the pot. Switch the stove on, and then off mid-cook. Save and quit, then
  reopen.
- Expect: with the stove off you get `♨ Needs fire below` and a cold rim. With it on, the rim goes
  hot and the pot cooks (bubbles, spoon). Switched off mid-cook, the lid goes on and cooking
  pauses. After reopening, the stove keeps its on/off state.
- [ ] Notes:

**25. Drops and recipes**

- Do: `/gamemode s`, break each decor block, then craft each one from
  [`../recipes-cheatsheet.md`](../recipes-cheatsheet.md) "Kitchen decor".
- Expect: each drops itself. The recipe book shows them once you hold a Cooking Pot or the key
  ingredient.
- [ ] Notes:

## F. Save, quit and /reload (round 5 steps 20 and 27)

**26. Mid-cook and mid-chop**

- Do: `/gamemode c`. Start a cook, save and quit, and reopen. Start a cook and run `/reload`.
  Chop once, and within 1 s run `/reload`.
- Expect: the cook carries on from where it was, and never shows a frozen or second spoon.
  `/wm_kitchen:debug fx` says `Effects: 0 knife, 1 spoon.` while it cooks and `0, 0` after. The
  board shows its knife, at the latest on the next use.
- [ ] Notes:

**27. Far away and back**

- Do: start a cook, fly more than 40 blocks away, and come back.
- Expect: the spoon is gone while you're away and back when you return if the pot still cooks. No
  items have popped out of the pot.
- [ ] Notes:

## G. Stress: 32 pots and about 400 crops (B32, B35)

Go to an empty flat area at least 100 blocks from your kitchen, so its effects don't share the
caps. Stand on the ground and face +x (east; F3 isn't needed, the commands are relative). Keep
`/wm_kitchen:debug fast` **off**.

**28. Build the pots**

- Do:
  - `/fill ~2 ~ ~ ~17 ~ ~1 campfire`
  - `/fill ~2 ~1 ~ ~17 ~1 ~1 wm_kitchen:cooking_pot`
  - `/give @s wm_kitchen:vegetable_stew_mix 64` (a 10 s cook)
- Expect: 32 lit campfires with 32 pots on them. No Content Log errors.
- [ ] Notes:

**29. Fill and cook them all**

- Do: plain use (not sneaking) on each pot with the mix stack, one mix each. Then run along the row
  and use each pot with an empty hand.
- Expect: each add gives the splash and chime and a sparkle while ready. Each start gives the lid
  sound and steam. With a stopwatch, the **last** pot you started is done 10 s later, give or take
  1 s. A cook that takes much longer means the game is lagging, so note how long it took.
- [ ] Notes:

**30. Effects under load**

- Do: while most pots cook, run `/wm_kitchen:debug fx` a few times. Count the pots that have a
  spoon.
- Expect: at most 4 spoons per 16 × 16 area (the row spans 2–4 areas, so 8–16 spoons). Pots without a spoon still bubble. That's the cap working as designed (B35); note
  whether it looks wrong. Ghosts show above at most the 2 pots nearest to you. Frame rate: note
  any stutter while all 32 cook.
- [ ] Notes:

**31. Active stations**

- Do: look at a pot and run `/wm_kitchen:debug pot` while they cook, and again once all are done but
  not collected.
- Expect: `active stations` is 32 (plus any pots with contents elsewhere) both times.
- [ ] Notes:

**32. Crops**

- Do: fly about 30 blocks west of the pots and land, so the field doesn't overlap them. Then:
  - `/fill ~-10 ~-1 ~-10 ~10 ~-1 ~10 farmland ["moisturized_amount"=7]`
  - `/fill ~-10 ~ ~-10 ~10 ~ ~-1 wm_kitchen:tomato_crop`
  - `/fill ~-10 ~ ~1 ~10 ~ ~10 wm_kitchen:onion_crop`
  - `/gamerule randomtickspeed 30`, wait 30 s, then `/gamerule randomtickspeed 1`.
  - Fly over the field once, then `/wm_kitchen:debug grow` in its middle.
- Expect: about 400 crops grow through their stages with no growing stutter.
  `/wm_kitchen:debug grow` matures the ones within 8 blocks (`Grew N crops.`). Breaking a few mature
  ones drops produce and seeds.
- [ ] Notes:

**33. Unloaded and back**

- Do: collect a few dishes, then put a mix in 10 pots and start them. While they cook, fly 200+ blocks away for 20 s and come back. Then save and quit,
  reopen, and run `/wm_kitchen:debug fx`.
- Expect: the pots carry on cooking where they were (they pause while unloaded), and the spoons
  come back to the cooking ones. No spoons are stuck in pots that aren't cooking, and the
  spoon count from `/wm_kitchen:debug fx` matches what you see. No items have popped out of pots
  that are still there.
- [ ] Notes:

**34. Pots removed without a break**

- Do: put a mix in each of a few pots without cooking. Stand next to the row and run
  `/fill ~-30 ~-3 ~-30 ~30 ~3 ~30 air replace wm_kitchen:cooking_pot` (it removes only pots, and
  only within 30 blocks, so keep your kitchen farther away).
- Expect: within about half a second the contents of every pot that held something drop as items
  (the sweep spills a station whose block has gone). Look at a new pot and run
  `/wm_kitchen:debug pot`: `active stations` has dropped back. Content Log: no `[simmerfield]`
  errors.
- [ ] Notes:

**35. Content Log after the stress**

- Do: search the Content Log file for `[simmerfield]`, `watchdog` and `slow`.
- Expect: no errors, and no script watchdog warnings. Copy any that appear into your notes.
- [ ] Notes:

## H. The release build (agent A's change)

**36. Build and enter**

- Do: leave the world. Run `npm run build:release && npm run deploy`, then re-enter the same test
  world and fly for a minute.
- Expect: **no** `Simmerfield build …` line and no data-check line in chat.
- [ ] Notes:

**37. Which build is running**

- Do: `/wm_kitchen:debug validate`.
- Expect: the build line shows here (it is still printed on request), then
  `Data check: 0 problem(s).` The hash is the one `npm run build:release` printed.
- [ ] Notes:

**38. Command blocks can't run it**

- Do: give yourself a command block (`/give @s command_block`), set it to `/wm_kitchen:debug kit`
  and power it.
- Expect: it fails, and you get no kit.
- [ ] Notes:

**39. Content Log in a release**

- Do: search the Content Log file for `[simmerfield] build` and `leftover fx`.
- Expect: neither appears, because a release drops `console.log` info lines. Warnings, if there
  are any, still appear.
- [ ] Notes:

## I. Two players on LAN (release build, B36)

**Setup.** On the PC: pause → Settings → Multiplayer → Visible to LAN players on. Put the world in
**Survival** for this part (`/gamemode s @a`) and turn `/wm_kitchen:debug fast` off. On the second
device, on the same Wi-Fi: Play → Friends → LAN Games → this world. Accept the resource pack
download. Below, **P1** is the PC (host, operator) and **P2** is the second device. P1 hands P2 what
a step needs with `/give <P2's name> …` (cheats are on).

**40. P2's first join**

- Expect, on P2: the two welcome lines in chat, plus a Kitchen Guide and a Recipe Poster in the
  inventory. No build line. Content Log on the host: no errors. P2 leaves and rejoins: no second
  welcome, guide or poster.
- [ ] Notes:

**41. /wm_kitchen:debug is operator-only**

- Do: in the pause menu's player list, set P2 to **Member**. P2 runs `/wm_kitchen:debug kit` (on a
  phone, type it in chat). P1 runs `/wm_kitchen:debug fx`.
- Expect: P2 is refused (the game or `Operators only.`) and gets nothing. P1 gets the effect
  count.
- [ ] Notes:

**42. Discovery is per player**

- Do: P1 has found tomatoes (from earlier parts). P2 opens the guide. P1 throws P2 a tomato.
- Expect: P2's guide shows `???` for Tomato Soup until P2 picks up the tomato, then P2 (only)
  gets `★ New recipe!`. P1's guide is unchanged. Both open their guide at the same time and
  navigate on their own, with no `Close chat` line.
- [ ] Notes:

**43. One pot, two players**

- Do: on a pot over a lit campfire, P1 adds a Tomato Soup Mix, then P2 uses it with an empty hand.
  Both watch it cook. When it's done, both use it in the same moment.
- Expect: P2's use starts the cook. Both see the bubbles and **one** spoon. Both get the
  `✔ Tomato Soup is ready!` line if they're within 8 blocks. Exactly one soup comes out, to
  whichever use came first; the other gets the progress or `Add ingredients` line.
- [ ] Notes:

**44. Two forms, one pot**

- Do: put 1 Tomato Soup Mix and 1 Onion Soup Mix in the pot. P1 and P2 both open the choice form.
  P1 picks Tomato Soup, then P2 picks Onion Soup.
- Expect: P1's cook starts. P2 gets `✘ It changed, try again` and nothing else happens.
- [ ] Notes:

**45. Break while the other's form is open**

- Do: refill the pot with the two mixes. P1 opens the choice form and waits. P2 breaks the pot.
  Then P1 taps a dish.
- Expect: the pot and the two mixes drop **once** (count them). P1 gets `✘ It's gone`, and no
  extra soup or mix appears anywhere.
- [ ] Notes:

**46. Sneak-add and take-all race**

- Do: P1 sneak-adds a stack of mixes to an empty pot while P2 sneak-uses it with an empty hand
  right after.
- Expect: the pot holds at most 4, P1 keeps the rest of the stack, and P2's take-all gives back
  exactly what was in. Total mixes before = total after (count them).
- [ ] Notes:

**47. One board, two players**

- Do: P1 and P2 each sneak-chop a stack of 16 tomatoes on the same board at the same time.
- Expect: one knife chops (not two overlapping), each gets 16 slices, and no tomato is lost or
  doubled.
- [ ] Notes:

**48. Leaving mid-action**

- Do: P2 opens the choice form on a pot and then closes the app (or leaves the world). P2 rejoins,
  starts a sneak-chop and leaves mid-chop.
- Expect: the host's Content Log has no errors, the pot is unchanged, and the chopping stops.
- [ ] Notes:

**49. The stove and the cake**

- Do: P1 switches a stove on while P2 watches, and both click it in the same moment once. Then
  both eat from one Strawberry Cake, tapping at a normal pace.
- Expect: both see the same stove state (glow or dark), and a pot on it heats or not to match.
  The cake gives 4 slices in total and then it's gone.
- [ ] Notes:

**50. Posters per player**

- Do: P2 places their poster, then sneak-uses it to cycle. P1 sneak-uses the same poster.
- Expect: P2's first poster shows How to Start, and P2 cycles only through what P2 found. P1
  cycles through what P1 found. Both see the same poster afterwards.
- [ ] Notes:

P2 can leave now.

## J. An existing world: add, remove, re-add (B34)

**51. Add the add-on**

- Setup: the copy of the existing world from "Before you start". Edit → Behavior Packs → activate
  Simmerfield (the resource pack comes along). No experiments.
- Do: enter and fly for a minute.
- Expect: the world loads without a pack error. You get the welcome, the guide and the poster.
  Breaking grass in old chunks drops Simmerfield seeds now and then. A pot and board place and work.
  Content Log: no errors.
- [ ] Notes:

**52. Leave things behind**

- Do: leave in the world a pot that's cooking (over a lit campfire), a pot with a finished dish
  waiting in it, a cutting board, planted crops, a hung poster, a cake, a lit stove, and Simmerfield
  items in your inventory and in a chest. Note what is where. Save and quit.
- [ ] Notes:

**53. Remove the add-on**

- Do: Edit → deactivate both Simmerfield packs, then enter the world.
- Expect: **the world loads.** Note what you see where the Simmerfield blocks were (unknown or `?`
  blocks, air, or something else), what happened to the Simmerfield items in your inventory and the
  chest, and whether any spoon or knife is left standing. Nothing here should crash or refuse to
  load. Quit without changing the area.
- [ ] Notes:

**54. Re-add it**

- Do: activate Simmerfield again and enter.
- Expect, and note what you actually see: the Simmerfield blocks come back as they were, the waiting
  dish can be collected, and the pot that was cooking finishes. Note whether the Simmerfield items
  came back too. There's no second welcome. Content Log: no errors.
- [ ] Notes:

---

## Report back

- The step numbers with `ok`, or what you saw instead (screenshots for 4–7, 11, 17, 20, 30 and
  53).
- Step 29: how long the last of the 32 cooks took, and whether the game stuttered.
- Step 30: the `/wm_kitchen:debug fx` counts, and whether pots without a spoon looked wrong.
- Step 23: whether a quick double-click switched the stove once or twice.
- Step 35: any `[simmerfield]` or watchdog lines from the Content Log.
- Part I: which second client you used (phone or another PC instance) and its game version.
- Part J: what happened to Simmerfield blocks, items and entities when the add-on was removed, and
  what came back when it was re-added. This goes into the store text (B34).

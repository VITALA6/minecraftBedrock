# Test script, round 2: page-image book, pot screen, liquid colour, cake (2026-10-22)

The first round ([`portfolio-slice.md`](portfolio-slice.md)) passed except the book, the pot
screen, the pot liquid colour and B15. This round tests only what changed since then:

- D14: the recipe book and the pot screen are `CustomForm`s showing pre-rendered page images
  (`tools/gen-book-pages.mjs`); the old button-list book is gone.
- The pot liquid colour follows the contents (`hk:liquid`).
- B15: the cake pops off when its support goes.
- Content Log fixes: the food data check and the water-splash Molang errors.

One session, top to bottom. Report back as a numbered list with these step numbers: `ok`, or what
you saw instead (a screenshot helps a lot for the book and pot pictures). Open points are in
[`../blockers.md`](../blockers.md); the ones tested here are marked in bold (B15, B16, B18–B21).

## Setup

1. Settings → Creator → **Enable Content Log File** on.
2. Open the test world (or a new one: Creative, cheats on, every experiment off, only
   **Harvest Kitchen**). **Leave and re-enter** if it was open: the resource pack changed.
   → no pack error dialog.
3. Fly around for 1–2 minutes (pushes load-time messages into the log file).
4. `/hk:debug validate`
   → `Data check: 0 problem(s)` (it said 12 before).

## Recipe book (D14)

5. `/gamemode s`, `/hk:debug reset`, `/clear`, then `/hk:debug kit`.
   → the kit arrives, including a Recipe Book.
6. Use the book.
   → title "Recipe Book"; a **book picture** fills the form (two pages, four family badges, rows
   for: magnifier, pot, board, table, seedling). Buttons under it: `◀ Prev` (greyed), `Next ▶`,
   `Contents` (greyed), What can I make?, Cooking Pot, Cutting Board, Crafting Table, Crops, Close.
   **B19:** note how big the picture is on your screen, and whether the numbers and icons in it
   are easy to read. **B20:** does `◀` show as an arrow?
7. **B18:** tap `Next ▶`.
   → page-turn sound, the **picture changes without the form closing** (no flicker), title
   "What can I make?". With the kit in your bag it lists dish names; tapping one opens that dish.
8. `Contents` → Cooking Pot.
   → 7 dish silhouettes with coloured gems, the label `♨ Needs fire below`, and 7 dish buttons with
   names.
9. Tap Tomato Soup.
   → picture: soup on a sunburst, red `8 s` badge, pot + flame, 3 food shanks; on the right tomato
   ×2 + bowl → soup, and a strip grass + biomes → seed; `4/24` at the bottom. Label
   `❤ Regeneration · 8 s`; a button `→ Tomato`.
10. Tap `→ Tomato`.
    → crop page: tomato, 4 growth stages, seed → farmland, where-to-find strip, tomato → board →
    sliced ×2. Its buttons list the dishes that use tomato.
11. **B21:** walk the whole book with `Next ▶` to `24/24`.
    → `Next ▶` greys out on the last page; buttons change per page with no leftovers from the
    previous page; long button lists scroll.
12. Locked pages: `/hk:debug reset`, throw away every HK item and the book, then
    `/give @s hk:tomato` (the book comes back). Open Cooking Pot.
    → Tomato Soup has its name; the other dishes show `???`.
13. Open Chili Stew.
    → title `???`; dish silhouette with `?`, grey `?` badge; onion and chili slots silhouetted
    (the tomato slot is visible); the find strip shows only the onion and chili biomes. Label
    `Find these crops first.`
14. `/give @s hk:onion`, reopen Chili Stew.
    → the onion slot is now visible; only chili stays silhouetted. (A `★ New recipe!` subtitle may
    show for dishes that just unlocked.)
15. `/gamemode c`, reopen the book.
    → no locked pages anywhere. Back to `/gamemode s`.
16. Use the book while looking at the sky and while looking at the ground.
    → it opens once each time.

## Pot screen (D14)

Put a campfire down and a pot on top of it. Use `/hk:debug kit` again if you need items.

17. Add 1 onion and 1 bread, then use the pot with an empty hand.
    → picture: onion **solid with a yellow `+1`**, bread solid, bowl as a **faded ghost** with
    `+1`, lit flame, Onion Soup faded on the right, a green `120 s` badge. Buttons: Almost! Onion
    Soup, Take out Bread ×1, Take out Onion ×1, Recipe Book, Close.
18. With the screen open, have a second player add an onion (skip if alone).
    → the picture updates in place: the onion loses its `+1`.
19. Break the campfire while the screen is open.
    → within about half a second the screen shows a grey flame with a red `!` and the label
    `♨ Needs fire below`. Put the campfire back.
20. Tap Almost! Onion Soup.
    → the pot screen closes and the book opens on Onion Soup.
21. Empty the pot (sneak + empty hand), then add 2 tomatoes, 2 onions, bread and a bowl. Use with
    an empty hand.
    → the "choose" picture (`?` result, white arrow) and buttons Cook Tomato Soup, Cook Onion Soup.
    Tap one: it starts cooking (lid on) and the screen closes.
22. With only 2 tomatoes and a bowl in a fresh pot, use with an empty hand.
    → it cooks right away with no screen (unchanged).
23. Pot with a carrot and an onion: open the screen, tap Take out Carrot ×1.
    → the carrot comes back and the screen reopens without that button. Take out the last item:
    the screen closes.
24. A pot with ingredients but **no fire below**, use with an empty hand.
    → the picture has the grey flame and red `!`, and you can't start cooking.

## Pot liquid colour

25. Empty pot over a lit campfire: add 1 onion.
    → the liquid is **golden**. Add 2 tomatoes → **red**. Take the tomatoes out (pot screen) →
    golden again. Take everything out → the liquid disappears.
26. 2 tomatoes + a bowl.
    → red with the "ready" glint. Cook it: red under the lid. Done: red with the glint. Collect.
27. `/hk:debug fast`, then cook one of each and check the liquid while it's in the pot:
    - Strawberry Jam → **pink**
    - Fish Chowder → **creamy** (with a golden glint when ready)
    - Chili Stew → **deep red**
    - Vegetable Stew → **brown**
    - Onion Soup and Chicken Soup → **golden**
    - a bowl and sugar only → **clear water**
28. **B16:** remove the fire under a coloured pot.
    → the rim goes cold and the colour stays. No permutation or texture errors in the log
    (step 34).

## Strawberry cake (B15)

29. Try to place a strawberry cake on the side of a block and under a ceiling.
    → refused; only the top of a block works.
30. **B15:** cake on a dirt block, eat one slice, break the dirt underneath.
    → the cake **pops off** with particles and **drops nothing** (no free cake).
31. A piston pushing the block under a cake, and a piston pushing the cake itself.
    → it pops, drops nothing.
32. A cake on TNT, light the TNT.
    → no cake left floating afterwards.

## Wrap-up

33. Play for a minute doing what makes particles: add to a pot (splash), chop on the board, eat a
    cake slice, bone-meal a crop, cook.
    → the splash still looks like a splash.
34. Quit the world and read the newest Content Log file:
    `f=$(ls -t ~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang/logs/ContentLog*.txt | head -1); grep -v '\[verbose\]' "$f" | grep -v '^$' | grep -v 'No sound found' | tail -100`
    → `[harvest_kitchen] data check: 0 problem(s)`; **no** `can't read food` lines; **no**
    `unable to find member variable` / `unknown variable` Molang lines; no `recipe book failed` or
    `pot screen failed`; no texture or permutation errors. Paste every `hk`-related line into the
    report.

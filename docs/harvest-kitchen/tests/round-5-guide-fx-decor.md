# Test script, round 5: Kitchen Guide book, pot and board effects, kitchen decor (D19–D22)

This round covers three things:

- **Kitchen Guide (D19, D20).** The finished guide book: chapter names and icons, the open ribbon, dish, crop and
  "What can I make?" pages, and navigation.
- **Pot and board effects (D21).** The bubbling pot, the stirring spoon and the chopping knife.
- **Kitchen decor (D22).** Eight new decorative blocks.

None of it has run in game yet.

One session, top to bottom. Report back with these step numbers: `ok`, or what you saw instead (a
screenshot helps for the book, the effects and the block facing). Open points:
[`../blockers.md`](../blockers.md) (B28–B30 are tested here).

## Setup

1. Content Log File on. Open the test world (or a new one: Creative, cheats on, no experiments,
   only Harvest Kitchen). **Leave and re-enter** if it was open: blocks, entities, UI and textures
   changed. Fly for 1–2 minutes.
   → no pack error dialog. In chat (you're an operator): `Harvest Kitchen build <hash> <time>`.
2. `/hk:debug validate` → `Data check: 0 problem(s)`.
3. `/gamemode s`, `/clear`, `/hk:debug reset`, then `/hk:debug kit`.
   → the kit includes the Kitchen Guide and one of each of the 8 decor blocks.

## Kitchen Guide (D19, D20, B28)

4. Use the guide in the air.
   → a two-page parchment book (not the grey vanilla form). Home lists six rows **with names**:
   `Hot Dishes · n/10`, `Cutting Board`, `Cold Dishes · n/8`, `Crops · n/6`, `What can I make?`
   (with a count when you carry ingredients), `How to Play`. Each row and each ribbon on the
   right edge has a **different icon**: pot, board, crafting table, sprout, magnifier, scroll with
   a `?`. No ribbon sticks out on Home.
5. Tap each Home row in turn.
   → that chapter opens and **its** ribbon sticks out (lighter, wider). From a deep page, tap each
   ribbon: it jumps to that chapter. `Back` returns to the previous page, `Home` to Home.
6. Hot Dishes → Tomato Soup.
   → title, big soup icon, `❤ Heal: Regeneration, 8 s`; chips `❤ 8 s` and `Pot + fire` (with a
   flame). Right page: 2 tomatoes (count 2) + bowl → Tomato Soup Mix, then `Cook 5 s` → soup.
   Footer `2 × Tomato, 1 × Bowl`. The Hot Dishes ribbon stays out. ◀ is faded, ▶ goes to the next
   hot dish; `Back` returns to the chapter list.
7. Tap the tomato slot.
   → the Tomato crop page with the **Crops** ribbon out: seed → 4 growth stages → tomato, where
   its seeds are found, and `Used in` (sliced tomato and the dishes). ◀ ▶ walk through the other
   crops. Tap a dish under `Used in` → its dish page.
8. Cold Dishes → Garden Salad.
   → no cook row, a `Craft` chip with the crafting table; the Cold Dishes ribbon is out.
9. `/hk:debug reset`, `/clear`, open the guide again (survival, nothing found).
   → undiscovered dishes and crops show `???` and a dark silhouette with `?`; unfound ingredients
   are silhouettes, vanilla ones (beef, bowl) are visible; the footer says `Find: <biomes>`. Crops
   still say where their seeds are.
10. Give yourself 2 tomatoes and a bowl (`/give @s hk:tomato 2`, `/give @s bowl`), open What can I
    make?
    → Tomato Soup is listed. With 3 Tomato Soup Mixes it shows a count of 3. With an empty
    inventory: `Nothing yet…`.
11. Overflow and input types: walk through Home, a chapter, a dish, a crop and What can I make?
    with mouse and keyboard, then touch (if you can), then a controller, at the smallest and largest
    GUI scale. Switch the game to another language (e.g. Deutsch) once.
    → no text leaves its box; long names end in `...`. With a controller, focus reaches every row,
    slot, chip, ribbon and ◀ Back Home ▶; faded buttons can't be focused.
12. Other forms stay vanilla: the pot's dish choice (two dishes possible), `/hk:debug` output and
    any other pack's forms look exactly as before.
13. Content Log file: no JSON UI errors (search for `hk_guide`, `collection_panel`,
    `server_form`).

## Pot effects (D21, B29)

`/gamemode c` for this part. Pot on a lit campfire, `/hk:debug fast` **off**.

14. Add a Tomato Soup Mix and start cooking.
    → **lid off**, the red liquid bubbles (bubbles rise and pop), the rim ring stays steady while only the handle tops show a stepping ember, a
    wooden spoon circles in the pot, steam and glow as before. Content Log: no errors about
    `flipbook_textures.json`, `hk:fx_spoon`, `geometry.hk.fx_spoon`, animations or the render
    controller.
15. Repeat with a dish of another colour (e.g. Strawberry Jam Mix).
    → the bubbles use that liquid's colour.
16. Put the campfire out with a shovel mid-cook.
    → lid on, liquid still, the spoon disappears within about half a second. Relight: lid off,
    bubbling, spoon back.
17. Let it finish.
    → the spoon is gone, no bubbling, the ready glint shows.
18. Start cooking again and break the pot mid-cook.
    → the spoon goes with it.
19. Start cooking, fly more than 40 blocks away and come back.
    → the spoon is gone while you're away and back when you return, if the pot is still cooking.
20. Start cooking, save and quit mid-cook, reopen. Then start cooking and run `/reload`.
    → one spoon at most, never a frozen or duplicate one. `/hk:debug fx` →
    `Effects: 0 knife, 1 spoon` while cooking, `0, 0` after.
21. `/summon hk:fx_spoon` and `/summon hk:fx_knife`.
    → each appears for at most a tick and is removed (the script removes effects it didn't
    spawn). No spawn eggs for them in the creative menu.
22. Look at the pot from the side while it cooks.
    → the spoon handle doesn't poke through the rim.

## Cutting board effects (D21, B29)

23. Cutting board facing north (place it while looking north), use it with a tomato.
    → the board's own knife rises onto its edge from its slot, chops with pale crumbs at each hit,
    and is lying flat in its slot again about 1 s later. **Exactly one knife** is visible at every
    moment (a one-frame blink at pick-up is acceptable; note it).
24. Sneak + use with a stack of tomatoes.
    → one knife chops the whole time and the resting knife stays hidden; it's back about 1 s after
    the last item.
25. Repeat 23 with the board facing east, south and west.
    → the knife chops along the board every time. If east and west are across or flipped, note it
    (fix: swap `west`/`east` in `FX_BOARD_YAW`, `scripts/fx/fx-config.ts`).
26. Break the board mid-chop, then place a new one.
    → the knife vanishes within about 1 s; the new board shows its knife.
27. Chop, then within 1 s save and quit and reopen (or `/reload`).
    → the board shows its knife, at the latest on the next use.
28. While a knife or spoon is there, click the board or pot.
    → the station reacts as usual (you can't hit the effect); a mob walks through it; it never
    drops anything.

## Kitchen decor (D22, B30)

29. Creative menu, Items tab next to the pot, board and poster.
    → all 8 with their icons and names: Kitchen Counter, Kitchen Cabinet, Spice Shelf, Kitchen
    Sink, Kitchen Stove, Hanging Pan, Jar of Pickles, Vegetable Basket.
30. **Facing.** Look north and place a Kitchen Counter; repeat looking east, south and west. Do the
    same with the stove, sink, cabinet and spice shelf.
    → the drawers, doors, oven door and shelf front face **you**; the sink's tap is at the back.
    Note if they all face away (fix: `y_rotation_offset` 180 → 0 in the 8 block files) or are a
    quarter turn off. Place a cutting board the same way and note which way it faces (B9).
31. Walk into the cabinet and the spice shelf from the front in all four facings.
    → the collision matches the shallow model.
32. Hanging Pan: click the underside of a block.
    → it hangs, hook up, front toward you. On a floor or a wall: refused. Break the block above:
    the pan pops and drops itself. (If it pops right after placing, note it: B30.)
33. Jar of Pickles and Vegetable Basket: place on a counter and on the floor; try a wall and a
    ceiling.
    → floor and counter OK, wall and ceiling refused. Break the block below: they pop and drop.
34. Build a small kitchen: counters, the sink with a cabinet **two** blocks above it, the stove,
    the spice shelf on a counter against a wall, the jar and basket on counters, the pan under a
    cabinet.
    → textures as sharp as vanilla blocks, no flickering faces at the sink basin or the doors.
    The sink tap reaches 4 px into the block above it.
35. Place a Kitchen Stove: its oven window is dark and it gives no light. Use it.
    → `fire.ignite` sound, the window glows orange and the block lights up the room. Use it again:
    fizz, dark window, no light.
36. Sneak and put the Cooking Pot on the stove (an unsneaking click switches the stove instead),
    add a Tomato Soup Mix and use the pot.
    → with the stove off: `♨ Needs fire below`, cold rim. Switch the stove on: the rim goes hot
    and the pot cooks (bubbles and spoon). Switch it off mid-cook: the lid goes on and cooking
    pauses, as with a put-out campfire. Save and quit, reopen: the stove keeps its on/off state.
37. `/gamemode s`, break each decor block.
    → each drops itself. Then craft each one from
    [`../recipes-cheatsheet.md`](../recipes-cheatsheet.md) "Kitchen decor": the recipe book shows
    them once you hold a Cooking Pot or the key ingredient.
38. Content Log file, whole session: no errors for the 8 decor blocks, their geometry, textures
    or recipes, nor for the effect entities.

# Test script, round 3: ghost ingredients, recipe posters, pot choice (D15)

D15 replaced the recipe book with ghost ingredients above the pot and recipe posters on the wall;
the pot screen only opens for a real choice. This round also carries the round-2 checks that still
apply (pot liquid colour, cake B15, Content Log). The book steps of
[`round-2-book.md`](round-2-book.md) are obsolete.

One session, top to bottom. Report back with these step numbers: `ok`, or what you saw instead (a
screenshot helps for ghosts and posters). Open points: [`../blockers.md`](../blockers.md) (B15,
B16, B22–B24 are tested here).

## Setup

1. Content Log File on. Open the test world (or a new one: Creative, cheats on, no experiments,
   only Harvest Kitchen). **Leave and re-enter** if it was open: blocks, particles and textures
   changed.
   → no pack error dialog. Fly for 1–2 minutes.
2. `/hk:debug validate` → `Data check: 0 problem(s)`.
3. `/gamemode s`, `/hk:debug reset`, `/clear`, then `/give @s hk:tomato`.
   → **one Recipe Poster** arrives with `★ You got a Recipe Poster!`. `/give @s hk:onion` gives
   no second poster. (There's no recipe book any more.)
4. `/hk:debug kit`.

## Ghost ingredients (D15, B22–B23)

Pot on a lit campfire.

5. Empty pot.
   → nothing floats. Empty hand + use → `Add ingredients`, no form.
6. Add 1 onion.
   → semi-transparent icons bob above the pot (fish switching cod/salmon every 2 s, potato,
   bowl). Walk around the pot: the row turns to face you. Empty hand + use → `Add Cod / Salmon`
   in the action bar, no form.
7. Add bread.
   → ghosts become onion + bowl. Add an onion → a small white pop where its ghost was; only the
   bowl is left.
8. Add the bowl.
   → chime, then the Onion Soup icon with gold sparkles. Empty hand + use → it cooks at once with
   no form; nothing floats while the lid is on.
9. When done.
   → the soup icon floats nearly solid. Use → you get it, the icon goes.
10. 2 tomatoes, 2 onions, bread and a bowl.
    → two dish icons float. Use → a "Cooking Pot" form with two `Cook …` buttons **with icons**,
    no Close button, no scrollbar. Pick one → it cooks. Put the fire out and repeat → fizz +
    `♨ Needs fire below`, no form.
11. Three pots with ingredients close together.
    → ghosts only on the nearest 2. Walk more than 6 blocks away → none.
12. Readability: check the ghosts on grass, on planks and at night.
    → each icon readable; note any that aren't.
13. (Optional, second player) each player sees their own row facing them; both see the pop.
14. `/hk:debug pot` while looking at a pot → includes a `ghosts …` line.

## Recipe posters (D15, B24)

15. Look straight at a 2-block-wide wall and place the poster.
    → **two blocks**, the Tomato Soup recipe reads left to right, front facing out. Repeat on
    north, south, east and west walls.
16. Try at a steep angle along the wall, where only one block of wall is free, and on a floor or
    ceiling.
    → `Look straight at the wall` / `Needs a 2-block wall` (poster kept), nothing on floor or
    ceiling.
17. Use the poster.
    → `Tomato Soup · ❤ Regeneration 8 s` in the action bar.
18. Sneak + use repeatedly (you've found tomato and onion).
    → it steps through the dishes you've unlocked only, in recipe order, then wraps. Holding a
    block while sneaking doesn't place it.
19. `/hk:debug reset`, then sneak + use.
    → `Break grass to find seeds`, no change. A poster placed now shows the blank "grass → seeds →
    ?" poster.
20. `/gamemode c`, sneak + use.
    → all 13 dishes, then wraps. Back to `/gamemode s`.
21. Break either half, then (new poster) break the wall behind one half, then try TNT and a
    piston.
    → both halves go and **exactly one** poster drops each time; nothing is left floating. In
    creative, nothing drops.
22. Crafting table: paper + each of the 5 crops.
    → 1 poster each.
23. From 4–5 blocks away.
    → icons and `8 s` readable (PC; phone if you can).

## Carried over from round 2

24. Pot liquid colour (lit campfire): 1 onion → **golden**; add 2 tomatoes → **red**; take all out
    → gone. With `/hk:debug fast`: jam **pink**, chowder **creamy**, chili stew **deep red**,
    vegetable stew **brown**, onion/chicken soup **golden**, bowl + sugar only **clear water**.
    Remove the fire → rim cold, colour stays (B16).
25. Cake (B15): on a wall or ceiling → refused. On dirt, eat a slice, break the dirt → it pops,
    **drops nothing**. A piston under it → pops, drops nothing.

## Wrap-up

26. Quit, then read the newest Content Log file:
    `f=$(ls -t ~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang/logs/ContentLog*.txt | head -1); grep -v '\[verbose\]' "$f" | grep -v '^$' | grep -v 'No sound found' | tail -100`
    → `data check: 0 problem(s)`; no `can't read food`; no Molang `unknown variable` lines; no
    particle, texture, permutation or multi-block errors (`hk:recipe_poster`, `hk:ghost_icon`).
    Paste every `hk` line into the report.

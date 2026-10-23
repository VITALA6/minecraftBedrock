# Test script, round 4: Kitchen Table, mixes, eggplant, release build (D16–D18)

D16 moved the pot dishes to two steps: their raw ingredients become a **mix** on the new Kitchen
Table (the vanilla crafting screen with only our recipes), and the pot cooks the mix. D17 added
the eggplant crop and 5 dishes; D18 removed the poster debug chat and added release builds. The
round-3 steps ([`round-3-d15.md`](round-3-d15.md)) about putting raw ingredients in the pot and
the "missing" ghosts are obsolete; its poster steps 15–23 still apply.

One session, top to bottom. Report back with these step numbers: `ok`, or what you saw instead (a
screenshot helps for the crafting screen, ghosts and posters). Open points:
[`../blockers.md`](../blockers.md) (B25–B27 are tested here).

## Setup

1. Content Log File on. Open the test world (or a new one: Creative, cheats on, no experiments,
   only Simmerfield). **Leave and re-enter** if it was open: blocks, items, recipes and
   textures changed. Fly for 1–2 minutes.
   → no pack error dialog. In chat (you're an operator): `Simmerfield build <hash> <time>`.
2. `/wm_kitchen:debug validate` → `Data check: 0 problem(s)`.
3. `/gamemode s`, `/clear`, `/wm_kitchen:debug reset`, then `/wm_kitchen:debug kit`.
   → the kit includes a Kitchen Table, 10 mixes, the eggplant items and 5 new dishes.

## Kitchen Table (D16, B25)

4. Look at the Kitchen Table in the hotbar and the creative menu (Items).
   → a 3D cube with a red-and-cream checked cloth on top and drawers on the sides, named
   `Kitchen Table`, listed once.
5. Place it and use it.
   → the vanilla 3×3 crafting screen, titled `Kitchen Table`.
6. Open the recipe book on that screen.
   → **only the mixes** (Tomato Soup Mix, … Eggplant Curry Mix), no vanilla recipes, no cold
   dishes. Note what you see if the book shows everything (B25 item 3).
7. Craft a Tomato Soup Mix (2 tomatoes + a bowl), then a Fish Chowder Mix once with cod and once
   with salmon.
   → each gives one mix; the bowl is used up.
8. Try the same 2 tomatoes + bowl on a vanilla crafting table. Try Garden Salad (2 sliced tomato,
   sliced cucumber, carrot, bowl) on the Kitchen Table.
   → no Tomato Soup Mix on the vanilla table; no Garden Salad on the Kitchen Table. The Garden
   Salad still crafts on the vanilla table.

## Pot with mixes (D16, B26)

Pot on a lit campfire.

9. Hold a **raw tomato** and use the pot.
   → refused: thud, grey puff, `✘ Make a mix first`. Above the pot, for about 3 s: ghosts of the
   mixes a tomato goes into (Tomato Soup Mix first). Also try it on an **empty** pot. Do the same
   with a raw onion (up to 5 ghosts).
10. Hold a Tomato Soup Mix and use the pot.
    → plop + splash, red liquid at the low level, chime + `✔ Tomato Soup`, the soup icon floats
    above with gold sparkles.
11. Sneak + use with 3 more Tomato Soup Mixes.
    → the stack goes in up to 4 (the pot is full at 4); the liquid rises to the top.
12. Empty hand + use.
    → cooking starts at once (no form): lid on, steam, `♨ ■■■□□` on use.
13. When done, use.
    → **4 Tomato Soups**: one in your hand, the rest in your inventory (or dropped if full).
14. One Tomato Soup Mix and one Chili Stew Mix in the pot.
    → liquid deep red (chili is stronger); empty hand + use opens `Cooking Pot` with
    `Cook Tomato Soup` and `Cook Chili Stew`. Pick one: it cooks; after collecting, the other mix
    is still in and the pot glints again.
15. Put the fire out while a mix is in, then use with an empty hand.
    → fizz + `♨ Needs fire below`; no cooking.

## Eggplant and the new dishes (D17)

16. `/give @s wm_kitchen:eggplant_seeds 4`, plant them on farmland, `/wm_kitchen:debug grow`.
    → 4 growth stages read as one plant; the last has purple eggplants. Breaking the mature crop
    drops eggplants and seeds.
17. Survival: break grass in a savanna or plains biome for a while.
    → eggplant seeds drop now and then (5 % per break there).
18. Cutting board: hold an eggplant and use.
    → 2 Sliced Eggplant, purple chop bits.
19. Kitchen Table: Stuffed Eggplant Mix (eggplant, raw mutton, onion, tomato), Ratatouille Mix
    (eggplant, tomato, cucumber, bowl), Eggplant Curry Mix (eggplant, chili, onion, potato, bowl).
    Cook each (`/wm_kitchen:debug fast` helps).
    → Stuffed Eggplant: purple liquid; Ratatouille: red; Eggplant Curry: green. Each dish arrives.
20. Vanilla crafting table: Eggplant Salad (sliced eggplant, sliced cucumber, chopped onion, bowl)
    and Veggie Skewer (stick, sliced eggplant, sliced tomato, chopped onion).
    → one of each.
21. Eat each new dish (when full, too).
    → Stuffed Eggplant: Health Boost 3 min; Ratatouille: Slow Falling 1 min; Eggplant Curry: Haste
    2 min; Eggplant Salad: Water Breathing 90 s; Veggie Skewer: Night Vision 90 s, and the stick
    comes back. Bowls come back from the bowl dishes.

## Posters (D16/D17, B27)

22. Place a poster and use it on the Tomato Soup page.
    → the poster shows tomato ×2 + bowl → soup, and under it **Kitchen Table → pot + flame**.
23. `/gamemode c`, sneak + use repeatedly.
    → all 18 dishes in order (10 pot dishes, then garden salad … strawberry cake, eggplant salad,
    veggie skewer), then back to Tomato Soup. Both halves always show the same recipe, especially
    from Strawberry Cup to Strawberry Cake (where the second state starts). Back to
    `/gamemode s`.
24. `/wm_kitchen:debug reset`, get one eggplant, sneak + use.
    → only the dishes whose crops you've found; with only eggplant found: none yet (every eggplant
    dish needs a second crop), `Break grass to find seeds`.

## Release build (D18)

25. (At the desk, no game needed) `npm run build:release`, deploy, re-enter the world as an
    operator.
    → **no** `Simmerfield build …` line in chat; `/wm_kitchen:debug validate` still works and prints
    the build id. Placing a poster prints nothing in chat. Then `npm run build` and deploy again
    for normal test sessions.

## Wrap-up

26. Quit, then read the newest Content Log file:
    `f=$(ls -t ~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang/logs/ContentLog*.txt | head -1); grep -v '\[verbose\]' "$f" | grep -v '^$' | grep -v 'No sound found' | tail -100`
    → `data check: 0 problem(s)`; no errors for `wm_kitchen:kitchen_table`, `minecraft:crafting_table`,
    the mix recipes, `wm_kitchen:eggplant_crop`, `wm_kitchen:cooking_pot` permutations or `wm_kitchen:recipe_poster`
    (`wm_kitchen:poster_page`). Paste every `wm_kitchen` line into the report.

# Test script: portfolio slice (PS-1 + PS-2 code, PS-3 art v2)

One session, top to bottom. Each step has an expected result. Report back as a numbered list using
these step numbers: `ok`, or what you saw instead (a screenshot helps for visuals). Quoted messages
come from the code; small wording differences are fine, but text longer than 5 words isn't.

Built and deployed on 2026-10-22 (`npm run build && npm run deploy`), after the unit tests
(`npm test`, 198 passing) and the code-review fixes ([`../code-review.md`](../code-review.md)).
Known open points are in [`../blockers.md`](../blockers.md); the ones that need the game (B2, B3,
B9–B15) are tested below and marked in bold.

## Setup

1. **Before launching:** Settings → Creator → **Enable Content Log File** on (and the GUI on).
2. **New world:** Creative, **cheats on**, every experiment off. Behavior packs: only
   **Harvest Kitchen** (its resource pack comes along). Flat or normal terrain both work; normal is
   needed for the seed-drop steps.
   → The world loads with no pack error dialog.
3. Fly around for 1–2 minutes (this pushes the load-time messages into the log file; see
   CLAUDE.md).
4. `/hk:debug validate`
   → chat: `Data check: 0 problem(s)`. Any problem lines: copy them into the report.

## Recipe book and discovery (Survival, before the kit)

5. `/gamemode s`, then `/hk:debug reset`, then `/clear`.
   → chat confirms the reset. Inventory empty.
6. `/give @s hk:tomato 2`
   → a **Recipe Book** appears in the inventory, and chat says `★ You got a Recipe Book!`.
7. **B12:** hold the book and use it pointing at the sky, then again while looking at the grass.
   → the book opens **once** each time (no double screen, no `Close chat, then try again`).
   Home: What can I make? / Cooking Pot / Cutting Board / Crafting Table / Crops. No Back button on
   Home. Icons on every button.
8. Book → Cooking Pot.
   → First row `♨ Needs fire below` (tap → `Campfire, fire, magma, lava` hint). Then dishes:
   **Tomato Soup** unlocked, the rest `???` with the locked icon. Back is the last button.
9. Tap Tomato Soup.
   → Body like `❤ Regeneration · 8 s` (red heart). Buttons: effect (vanilla effect icon; tap →
   family hint), `×2 Tomato` (→ Tomato crop page), `×1 Bowl` (→ `Vanilla item` hint, page stays
   open), `Cooking Pot · ♨ needs fire` (→ pot page), Back last.
10. Book → Crops.
    → `Tomato · Plains, forests`-style row unlocked; the other four `???` with a biome hint (e.g.
    `Jungle, savanna, badlands`).
11. `/give @s hk:chili_pepper` and `/give @s hk:onion`.
    → subtitle `★ New recipe!` with a page-turn sound, at most once per ~3 s (not once per item).
    Book → Crafting Table now shows Salsa unlocked.
12. `/give @s bowl` (you still have 2 tomatoes). Book → What can I make?
    → Tomato Soup is listed. With an empty inventory except the book it says `Nothing yet. Grow more!`.

## Seed drops (Survival)

13. In a plains biome, break ~50 short grass by hand.
    → Mostly tomato seeds, onions and cucumber seeds (≈ 5 % each), a rare other seed (≈ 1 %).
14. `/locate biome jungle`, `/tp` there, break ~50 grass.
    → Mostly chili seeds. (Optional: `/locate biome meadow` or `cherry_grove` → strawberry seeds.)
15. Break grass with shears, and in Creative.
    → No HK seeds.

## Kit and item art

16. `/gamemode s` (if not already), `/hk:debug kit`.
    → chat `Kit: N item types given.` Overflow drops at your feet.
17. **B3:** look at the hotbar/inventory icons: Cooking Pot, Cutting Board and Strawberry Cake show
    **flat 2D icons** and their proper names. Then `/gamemode c`, open the creative menu's Items
    tab: each of the three appears **exactly once** (not missing, not twice). Back to
    `/gamemode s`.
18. Art review: every HK item has its own icon (no magenta/black checkerboard, no blank). Note any
    that don't read at hotbar size. Weakest per the review sheet: strawberry seeds (faint), salsa vs
    vegetable stew, the small berry on the cake slice, the fish tail in fish chowder.

## Crops (Survival)

19. Till farmland next to water. Plant tomato seeds, an onion (use the onion on farmland) and
    cucumber seeds, **two of each**. Leave one of each alone and **note the time** (growth-speed
    timing, checked in step 67).
20. Bone meal the other one of each, step by step.
    → each use advances one stage, green particles + sound. The four stages read as one plant
    growing (art review).
21. Break each mature crop.
    → tomato: 2–4 tomatoes + 1–2 seeds; onion: 2–4 onions; cucumber: 2–3 cucumbers + seeds. A young
    crop drops 1 seed (or 1 onion).
22. Plant one more tomato and jump on its farmland until it turns to dirt.
    → the crop pops off.

## Bushes

23. Plant chili and strawberry seeds on grass, dirt and podzol (farmland also works, see B5). Try
    stone or sand.
    → planting works on the soils, is refused on stone/sand.
24. Bone meal one of each to the fruit stage, then use it with an empty hand.
    → fruit pops out (1–3 chili, 2–3 strawberries), berry-pick sound, coloured bits; the bush goes
    back to the full-without-fruit stage.
25. Break a mature bush.
    → fruit + 1 seed.
26. Plant two more of anything, `/hk:debug grow` nearby.
    → `Grew N crops.`; they show the final stage.

## Cutting board

27. **B9:** place the board 4 times, facing north/east/south/west.
    → it turns to face you each time. Note which side the handle tab and knife are on, and whether
    that looks right. (A wrong but consistent direction is a one-line fix, see B9.)
28. Hold a tomato, use the board.
    → 2 Sliced Tomato into the inventory, chop sound, red bits.
29. Same with an onion (→ 2 Chopped Onion) and a cucumber (→ 2 Sliced Cucumber).
30. Hold dirt, use the board.
    → thud, grey puff, `✘ Can't cut that`.
31. Empty hand, use the board.
    → click sound, `Hold a vegetable`.
32. **B2:** sneak + use with 8 tomatoes.
    → one chop every ~0.3 s until the stack is gone, **each chop happens once**. Repeat and walk 5
    blocks away, or switch slot, mid-way: it stops.
33. **B14:** start a sneak-chop with 8 onions and release sneak right away.
    → note whether it keeps chopping the whole stack (current design) and whether that felt like a
    mistake.
34. Sneak + use the board with dirt in hand **next to** the board (on the ground).
    → dirt is placed normally (vanilla still works).

## Cooking pot: heat and visuals

35. Place a pot on plain ground.
    → cold rim. `/hk:debug pot` while looking at it: `hk:hot` false.
36. Place a campfire, then a pot on top of it.
    → hot rim right away.
37. Put out the campfire with a shovel, then light it (flint and steel), then put it out again by
    **holding** use with the shovel.
    → the rim goes cold / hot / cold within a moment each time, with no lag while holding.
38. Heat sources: pot over magma, over lava (`/give @s lava_bucket`), and over fire
    (`/give @s netherrack` + flint and steel, pot directly on top of the fire block).
    → hot each time. Over a soul campfire → hot.

## Cooking pot: ingredients, cooking, collecting

Use the pot over a lit campfire from here on.

39. Hold a tomato, use the pot.
    → plop sound, splash, liquid layer 1, **no text**.
40. Add a second tomato, then a bowl.
    → after the bowl: chime, sparkles, liquid switches to the "ready" look, action bar
    `✔ Tomato Soup`. Sparkles repeat while it waits.
41. Hold dirt, use the pot. Then hold the recipe book and use the pot (not sneaking).
    → `✘ Can't cook Dirt`, thud, grey puff. With the book: `✘ Can't cook Recipe Book`, and the book
    does **not** open.
42. Empty hand, use the pot (exactly one dish possible).
    → cooking starts **with no form**: lid on, clank + bubbling, steam, the block gives off light.
43. Use it again while cooking.
    → action bar `♨ ■■□□□`-style progress, with a short bubble sound.
44. Break the campfire mid-cook, then use the pot with an empty hand.
    → fizz, grey puff, `♨ Needs fire below` (**no** bubble sound); the lid stays on, the light goes
    off, progress pauses. Put the campfire back and light it: using the pot shows progress again,
    resuming from where it stopped (not from zero).
45. Run `/reload` mid-cook.
    → it keeps cooking and finishes.
46. When it's done (≈ 5 s of heated time):
    → ding + pop, particle burst, lid off, nearby action bar `✔ Tomato Soup is ready!`.
47. Empty hand, use the pot.
    → the soup goes into your hand/inventory with a pop; the pot is empty again.
48. Fill the pot to capacity (8 items) with any ingredients.
    → the next one: `✘ Cooking Pot is full`.
49. **B2:** sneak + empty hand on the pot.
    → everything comes out.
50. **B2:** sneak + use with a stack of onions.
    → adds up to the capacity in one go, each item once. Note whether the eating animation also
    starts (onions are food).
51. Empty pot, empty hand, use.
    → click + `Add ingredients`, **no form**.
52. On a pot with no heat below, add tomato-soup ingredients and use with an empty hand.
    → fizz, smoke, `♨ Needs fire below`; it doesn't start.

## Pot screen

53. Put in 2 tomatoes, 2 onions, bread and a bowl (both Tomato Soup and Onion Soup possible). Use
    with an empty hand.
    → form "Cooking Pot": Cook section with both dishes; In the pot rows (`×2 Tomato`…); Recipe
    Book last. Every button has an icon.
54. **B11:** tap the **second** "In the pot" row (not the first).
    → exactly that ingredient comes back with a pop (not its neighbour), and the screen reopens.
55. Tap a dish.
    → it cooks (lid on).
56. Pot with only 1 onion, empty hand.
    → "Almost!" with one `+1 …` button for the closest recipe. Tapping it opens the book on that
    dish.
57. Pot with only 1 onion again: open the screen and tap `In the pot ×1 Onion`.
    → the onion comes back with a pop and the screen **closes** (it doesn't reopen nearly empty).
    Using the pot again: `Add ingredients`, no form. With 1 tomato + 1 onion, taking out the tomato
    reopens the screen showing the onion.
58. Break a pot with ingredients in it, one mid-cook, and one with a finished dish.
    → ingredients spill / the dish drops, and the pot item drops. Nothing is lost or doubled.

## All dishes

59. `/hk:debug fast`.
    → `Fast cooking on.` New jobs take about 1 s.
60. Cook and eat each pot dish. Eat each **at full hunger** too.
    - Vegetable Stew: tomato, onion, carrot, potato, bowl
    - Chili Stew: chili, raw beef, tomato, onion, bowl
    - Fish Chowder: raw cod, potato, onion, bowl; **again with raw salmon**
    - Chicken Soup: raw chicken, onion, carrot, bowl
    - Onion Soup: 2 onion, bread, bowl
    - Strawberry Jam: 3 strawberry, sugar, glass bottle

    → each gives its effect (see the dish table in `../slice.md`); bowl dishes give the bowl back,
    jam gives the bottle back. Effect dishes can be eaten at full hunger.

61. Crafting table, shapeless: Garden Salad (2 sliced tomato, sliced cucumber, carrot, bowl), Salsa
    (sliced tomato, chopped onion, chili, bowl), Veggie Sandwich (bread, sliced tomato, sliced
    cucumber), Farmer's Sandwich (bread, cooked porkchop, sliced tomato, sliced cucumber),
    Strawberry Cup (3 strawberry, sugar, bowl), Strawberry Cake (cake, 2 strawberry), Recipe Book
    (book + any HK seed, or book + onion).
    → each crafts, and appears in the vanilla recipe book. The sandwiches give no effect and
    **can't** be eaten at full hunger.

## Strawberry cake

62. Place the cake. Look at it from all sides (art review: pink coat, berries on top).
63. Tap it 4 times at a normal pace, at full hunger too.
    → each tap: eat sound + chime, hearts, Regeneration I for 5 s, some food, one quarter gone. The
    cut faces show the cake inside (no holes). The 4th tap removes the block.
64. **B13:** place a new cake and **hold** use for 2 s.
    → at most about 1 slice per 0.5 s (so ≤ 4), or just 1 if the game doesn't repeat the use. Note
    which.
65. Place another cake, eat one slice, break it.
    → drops nothing.
66. **B15:** place a cake on a dirt block, then break the dirt underneath.
    → note whether the cake floats or pops off.

## Wrap-up

67. Go back to the crops from step 19. Note how far each un-boned crop has grown and how many
    minutes have passed (this tunes `growth_chance`).
68. **B10:** till farmland **away from water** (at least 5 blocks), plant a tomato, then
    `/gamerule randomtickspeed 200` for about 30 s, then `/gamerule randomtickspeed 1`.
    → note whether the dry farmland turns to dirt and pops the crop (vanilla keeps dry farmland
    under its own crops).
69. **Discovery catch-up (CR4):** `/gamemode s`, throw away (or `/clear @s hk:recipe_book`) your
    book, keep a tomato and the cooking pot, `/hk:debug reset`, then leave the world and rejoin.
    → within ~2 s of joining: a Recipe Book and `★ You got a Recipe Book!`; tomato dishes are
    unlocked in the book. Rejoin once more with the book in your inventory: no second book.
70. `/gamemode c`, open the book.
    → everything is unlocked. What can I make? lists what your inventory allows.
71. `/hk:debug fast` again → `Fast cooking off.`
72. (Optional, needs a second player) Both add to one pot and both try to collect: one dish, no
    duplicates. One opens the pot screen while the other starts cooking; tapping in the stale form
    says `✘ It changed, try again`. Both tap the same cake at once: both get a slice.
73. Quit the world, then read the newest Content Log file:
    `f=$(ls -t ~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang/logs/ContentLog*.txt | head -1); grep -v '\[verbose\]' "$f" | grep -v '^$' | tail -100`
    → look for `[harvest_kitchen] data check: 0 problem(s)` and for any error mentioning `hk:`.
    Paste every `hk`-related error into the report (the first one first).

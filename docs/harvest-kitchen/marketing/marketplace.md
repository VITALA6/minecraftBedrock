# Marketplace description (draft)

Draft written 2026-10-22 from `plan.md` (v1 **MUST** scope) and `slice.md`. "Harvest Kitchen" is the
working name (D1). Replace it everywhere once the final name is chosen.

Audience: kids and parents first, adults second. Every line below describes a v1 MUST feature. None
of it has been checked in game yet, so read "Facts to confirm" before publishing.

## Short description

> Grow tomatoes, strawberries and chili peppers, chop them on a board and cook them in a pot. Every
> dish gives you a small power, and its colour tells you which one.

Shorter variant, if the card has less room:

> Grow, chop and cook 13 dishes. Each one gives you a small power.

## Long description

> Plant five new crops: tomato, onion, cucumber, chili pepper and strawberry. Break grass to find
> their seeds. Each crop grows best in its own kind of place, from sunny plains to warm jungles and
> flowery meadows.
>
> Chop your vegetables on the Cutting Board. Put ingredients in the Cooking Pot and set it over a
> campfire. You can see what the pot is doing from across the room: the soup rises, the lid goes on,
> and a chime tells you when dinner is ready. Bowls and bottles come back when you eat, so nothing
> goes to waste.
>
> There are 13 dishes to make, and most of them give you a power. The colour tells you what kind:
> red food heals you, blue food helps you move, yellow food helps you dig, and green food helps you
> explore. Try a Chili Stew before you walk near lava.
>
> Your Recipe Book shows every dish and what goes in it. Tap "What can I make?" to see what you can
> cook right now. New recipes open up as you find new crops, and the book tells you where to look
> next.
>
> Turn a cake into a Strawberry Cake, put it down and share it. Everyone takes a slice. Harvest
> Kitchen works in the worlds you already have, with no experimental settings.

## Feature bullets

- 5 new crops, with seeds hidden in the grass of different biomes
- A Cutting Board and a Cooking Pot that show what they're doing
- 13 dishes; their colours show the power: heal, move, dig or explore
- A Recipe Book that answers "What can I make?"
- A Strawberry Cake you place and share, one slice at a time

## Wording notes

- "Most of them give you a power" is true: 11 of the 13 dishes have an effect. The two sandwiches
  are plain filling food.
- "Yellow food helps you dig" is the Work family (Haste). The book's own hint says "Yellow food digs
  faster", so the store text matches the game.
- "Chili Stew before you walk near lava" refers to Fire Resistance (120 s). Keep it only if the
  publisher is fine with a lava hint in a kids' description.
- The text names no other product and compares to nothing. Keep it that way in edits (plan §5.4).
- "Minecraft" isn't used above. Add it only where the publisher's store style asks for it.

## Do not claim (not in v1 MUST)

These are SHOULD or LATER in `plan.md`. Leave them out of the store text, screenshots and trailer
until they ship:

- the oven and anything baked in it: pies, pizza, Stuffed Tomato, Shepherd's Pie, Corn Bread
  (LATER, v1.1);
- corn, eggplant, Corn Chowder, Popcorn, Stuffed Eggplant (SHOULD);
- the Slow Falling and Health Boost effects (only SHOULD dishes have them);
- wild crop patches in new chunks (SHOULD), the Traveling Cook (LATER);
- custom sounds (P3; v1 uses vanilla sounds);
- languages other than English (§7: "extra languages per publisher");
- the plan's "5–7 crops" and "~16 dishes" (§0, adults line): those counts include SHOULD items.
  The v1 counts are **5 crops and 13 dishes**.

## Facts to confirm before publishing

1. **Product name** (D1). "Harvest Kitchen" is a working name. Check the final name for conflicts on
   the Marketplace and in trademarks (§7).
2. **Dish and crop counts.** 5 crops and 13 dishes are the v1 MUST counts. If SHOULD items ship in
   v1 (plan §6, M1b), update the counts and the bullets. If anything is cut, update them too.
3. **Dish names.** Dish 11 was renamed to "Hearty Sandwich" on 2026-10-22 (plan §5.4: no names
   that echo another mod). Re-check every dish name against that rule before release.
4. **"Works in the worlds you already have"** needs the M4 existing-worlds test (§7: seeds drop from
   grass and the book is delivered on first item in a mid-game world).
5. **"No experimental settings"** needs the §7 check: a fresh world with every experiment off loads
   clean.
6. **"Everyone takes a slice"** and any other multiplayer wording need the M4 multiplayer session
   (2–4 players: cake sharing, collect races, per-player book).
7. **Platforms and controls.** Don't claim touch or controller support until M4 tests them (§7:
   touch, controller, keyboard and mouse; forms readable on a phone).
8. **Removing the add-on.** §7 says the description must document what happens when the add-on is
   removed. Write that line after the M4 remove/re-add test, for example:
   `[WHAT HAPPENS TO PLACED POTS, BOARDS, CAKES AND CROPS WHEN THE PACK IS REMOVED]`.
9. **Effect durations and food values** may change in the M4 balance pass. The text above gives no
   numbers on purpose.
10. **"You can see what the pot is doing from across the room"** depends on the pot's visual states
    working in game (slice.md untested items 3 and 4).
11. **Publisher limits.** Character limits, required sections and tone come from Waypoint's spec.

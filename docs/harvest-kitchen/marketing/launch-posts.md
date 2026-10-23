# Harvest Kitchen: launch posts (draft)

Draft written 2026-10-23 for the free release on CurseForge and MCPEDL. Every claim comes from the
player docs (`packs/harvest_kitchen/docs/`), `scripts/data/{crops,dishes,recipes}.ts`, the BP
manifest and `resource/texts/en_US.lang`. Replace the `[... link]` placeholders before posting.

Facts used, so edits stay honest:

- 6 crops: Tomato, Onion, Cucumber, Chili Pepper, Strawberry, Eggplant. Seeds drop from grass,
  more often in each crop's biomes, and any seed can drop anywhere. Chili and strawberry grow on
  bushes you pick and that regrow.
- 18 dishes (10 from the pot, 8 from the crafting table). 16 give an effect; the two sandwiches
  don't. The dish colour shows the kind of effect.
- The Cutting Board takes tomatoes, onions, cucumbers and eggplants.
- Pot dishes are two steps: a mix on the crafting table, then the Cooking Pot. The pot needs heat
  under it (campfire, fire, lava, magma block or a lit Kitchen Stove) and cooks up to four mixes
  at once.
- The Strawberry Cake is placed and eaten in 4 slices.
- 8 decor blocks. Only the Kitchen Stove does something (it heats the pot).
- New players get a Kitchen Guide and a Recipe Poster on first join. Recipes unlock as you find
  each crop.
- Stable Script API only, so no experiment toggles. `min_engine_version` is 1.26.50.

## Reddit: r/MCPE

> Check the sub's current rules and flair before posting.

I tried to read the r/MCPE and r/Minecraft rules on 2026-10-23, but reddit.com blocked the fetch,
so nothing here assumes a specific rule. Read the sidebar and pick the add-on flair if there is one.

**Title:**

I made a free farming and cooking add-on for Bedrock (6 crops, a cooking pot, 18 dishes, no
experiments needed)

**Body:**

Hi all. I've been building a farming and cooking add-on called Harvest Kitchen, and it's out now
for free.

Here's what you can do with it:

- Break grass to find seeds for six new crops: tomato, onion, cucumber, chili pepper, strawberry
  and eggplant. Each one shows up more in the biomes it likes (chili in the jungle, strawberries
  in meadows and cherry groves), but any seed can drop anywhere.
- Chop tomatoes, onions, cucumbers and eggplants on a Cutting Board.
- Craft a soup or stew mix on the normal crafting table, then cook it in a Cooking Pot over a
  campfire. Fire, lava, a magma block or the Kitchen Stove work too. The pot takes up to four
  mixes and cooks them together.
- Cook or craft 18 dishes. 16 of them give you an effect, like Fire Resistance from Chili Stew
  or Night Vision from Onion Soup, and the dish's colour tells you what kind of effect it is.
- Put a Strawberry Cake down and eat it one slice at a time.
- Build a kitchen out of 8 decor blocks (counters, cabinets, a sink, a spice shelf, and a stove
  that actually heats the pot).

When you join you get a Kitchen Guide book and a Recipe Poster. Recipes unlock as you find each
crop, so you can play without a wiki open.

It only uses the stable Script API, so you don't have to turn on any experiments. It needs
1.26.50 or newer. It's translated into English, Ukrainian, Polish, German, Spanish, Brazilian
Portuguese, French and Russian.

Trailer: [trailer link]
CurseForge: [CurseForge link]
MCPEDL: [MCPEDL link]

This is the first public release, so I'd like to hear what breaks, what feels too slow or grindy,
and which dish you'd want added next.

## Reddit: r/Minecraft

> Check the sub's current rules and flair before posting.

This sub is broader and stricter about self-promotion. Post the clip itself (upload the 30 s cut
or a GIF of one moment natively), keep the title about what's on screen, and put links in a
comment only if the rules allow it.

**Title (pick one):**

- I made a cooking pot for Bedrock that you can actually cook soup in
- Chopping, cooking and sharing a strawberry cake in a farming add-on I made for Bedrock

**Post:** the video or GIF, no body text.

**First comment:**

This is Harvest Kitchen, a free add-on I made for Bedrock. You grow six new crops, chop them on a
cutting board and cook them in a pot over a fire, and most of the 18 dishes give you an effect
(the chili stew gives Fire Resistance). It runs on the stable Script API, so it needs no
experiments, on 1.26.50 or newer.

If anyone wants to try it: [CurseForge link] / [MCPEDL link]. Happy to answer questions about how
it works.

## Discord announcement

Bedrock add-on servers. Under 1000 characters (this one is about 690).

```text
**Harvest Kitchen** is out, a free farming and cooking add-on for Bedrock.

It uses the stable Script API, so you don't need any experiments. Needs 1.26.50 or newer.

- 6 new crops, with seeds you find by breaking grass
- Cutting Board, and a Cooking Pot that cooks over a campfire or the Kitchen Stove
- 18 dishes, 16 of them with an effect (the colour shows which kind)
- A Strawberry Cake you place and eat slice by slice
- 8 kitchen decor blocks
- A Kitchen Guide book and Recipe Poster, recipes unlock as you find crops
- 8 languages

Trailer: [trailer link]
CurseForge: [CurseForge link]
MCPEDL: [MCPEDL link]

Bug reports and ideas are welcome, here or in the comments on either page.
```

## Shorts / TikTok captions

Each one goes with a different trailer moment from `trailer.md`.

**1. Chopping (trailer shot 5, screenshot 3)**

Tomato on the board, slices in your pocket. Harvest Kitchen is a free farming and cooking add-on
for Bedrock.

#minecraft #minecraftbedrock #mcpe #minecraftaddon #minecraftfarming #minecraftcooking

**2. The pot at night (shots 6 to 8, screenshot 4)**

Night shift at the campfire. The pot glows while it cooks and the spoon keeps stirring. Free on
CurseForge and MCPEDL, and you don't need experiments.

#minecraft #minecraftbedrock #mcpe #minecraftaddon #minecraftcooking #cozyminecraft #minecraftnight

**3. Sharing the cake (shot 12, screenshot 7)**

Put the Strawberry Cake down and everyone grabs a slice. There are only four, so be quick.

#minecraft #minecraftbedrock #mcpe #minecraftaddon #minecraftwithfriends #cozyminecraft

## Notes before posting

- `trailer.md` (written 2026-10-22) is older than the current pack. It shows tomatoes going
  straight into the pot and a Recipe Book with "What can I make?". Now a mix goes into the pot,
  and the book is the Kitchen Guide. The pot's lid only appears when cooking pauses without heat,
  so captions here don't mention a lid. Check the footage matches before using a caption.
- Caption 3 and the r/Minecraft cake title assume the cake works with several players. Multiplayer
  testing (plan M4) isn't ticked off yet. If it hasn't been tested, use the one-player version:
  "Four slices of Strawberry Cake. Eat them all yourself, nobody's watching."
- "8 languages" needs the translations to be in the pack at release (`resource/texts/`).
- No claim here about existing worlds, touch or controller support. Those also wait on M4.

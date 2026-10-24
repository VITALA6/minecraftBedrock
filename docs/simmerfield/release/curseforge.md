# CurseForge listing: Simmerfield

Copy-ready text for the CurseForge project (game: Minecraft Bedrock). Written 2026-10-23 from the
pack code and player docs. The project title is "Simmerfield: Farming & Cooking" (final name, D1);
the body text uses the plain name. Counts come from `packs/simmerfield/scripts/data/` (6 crops in
`crops.ts`, 18 dishes in `dishes.ts`, 10 mixes and 4 cut ingredients in `recipes.ts`); names come
from `resource/texts/en_US.lang`.

Lines starting with **TO VERIFY** were not confirmed on the web. Check them in the Authors Console
before you publish.

## Project fields

| Field                 | Value                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Name                  | Simmerfield: Farming & Cooking                                                                       |
| Class                 | Addons                                                                                               |
| Main category         | Food                                                                                                 |
| Additional categories | Survival, Vanilla+                                                                                   |
| Logo                  | `logo-400.png` (this folder)                                                                         |
| License               | All Rights Reserved. For the MCPEDL sync, set Project Distribution to allow third-party distribution |
| Summary               | see below                                                                                            |

**Categories, checked on curseforge.com/minecraft-bedrock/addons on 2026-10-23.** The Addons
filter lists: Armor, Tools, and Weapons; Cosmetics; Data Packs; Fantasy; Food; Horror; Magic;
Maps; Minecraft Addon Maker; ModJam 2025; Multiplayer; Performance; Roleplay; Skins; Survival;
Technology; Texture Packs; Utility; Vanilla+. CurseForge's support article ("Creating and
submitting a project") says you pick one main category and up to 4 additional ones. It lists no
free-form tags field, so categories are the tags on CurseForge.

- Food fits the core of the pack. Survival and Vanilla+ fit the farming loop and the
  vanilla-style art.
- Leave out Multiplayer until the multiplayer test session (plan.md, M4) has passed.

**Summary limit.** CurseForge describes the summary as "a short blurb" shown in search results, but
neither its support pages nor its moderation blog give a character limit. **TO VERIFY (still open,
rechecked 2026-10-24):** read the counter on the summary field in the Authors Console. The
Moderation Policies only say "preferably no longer than 1 sentence" and not a copy of the
description. The summary below is 132 characters, kept under 150 as a safe target.

## Summary

> Grow six new crops, chop them and cook 18 dishes with potion effects in a pot over a campfire. No experiments needed.

117 characters. "Potion effects" instead of "helpful effects": players know the word, and
the old line read as if the effects were in the pot. Shorter fallback (82 characters): "Grow six
new crops and cook 18 dishes in a pot over a fire. No experiments needed."

## Description

Paste everything between the two rules below. **Verified 2026-10-24:** the CurseForge editor has
two modes, WYSIWYG (the default) and Markdown ("Project Submission Guide and Tips"). Switch it to
Markdown before you paste. MCPEDL receives the rendered HTML, which is why its upload guide talks
about HTML. If the Markdown option is missing for Bedrock, paste into WYSIWYG from a rendered
Markdown preview instead.

**Images.** The image paths below are files in `screenshots/`. Upload them to the project's Images
first, then replace each path with the image's CurseForge URL. Order (rewritten 2026-10-24 for the
first screen): hook, a picture, the feature list, then the tutorial; the long install and conflict
notes come last.

---

![The Simmerfield kitchen at sunset, with the pot on a campfire](04-kitchen-sunset.png)

**Simmerfield** adds six new crops to Minecraft and a kitchen to cook them in. Grow tomatoes,
onions, cucumbers, eggplants, chili peppers and strawberries, chop them on a Cutting Board, and
cook them into soups, stews and curries in a pot over the fire. Most dishes give you a potion
effect.

**No experiments needed. Works in new and existing worlds.**

![GIF: the spoon stirs Chili Stew on the Kitchen Stove](cooking.gif)

### Features

- **Six new crops:** Tomato, Onion, Cucumber, Eggplant, Chili Pepper and Strawberry. Their seeds
  drop from grass, and each one is easier to find in its own biomes. Chili peppers and
  strawberries grow on bushes you can pick again and again.
- **Cutting Board:** slices tomatoes, cucumbers and eggplants and chops onions. A knife chops on
  the board while you work.
- **Cooking Pot:** cooks over a campfire, fire, lava, a magma block or a lit Kitchen Stove. Put in
  up to four mixes of the same dish and get four bowls in the time of one. The liquid takes the
  colour of the dish, and a spoon stirs while it cooks.
- **18 dishes.** Hot dishes take two steps: craft a mix on the crafting table, then cook it in the
  pot. Cold dishes are crafted straight away.
  - Cooked in the pot: Tomato Soup, Vegetable Stew, Chili Stew, Fish Chowder, Chicken Soup, Onion
    Soup, Strawberry Jam, Stuffed Eggplant, Ratatouille and Eggplant Curry.
  - Made on the crafting table: Garden Salad, Salsa, Veggie Sandwich, Hearty Sandwich, Strawberry
    Cup, Eggplant Salad, Veggie Skewer, and a Strawberry Cake you place and eat one slice at a
    time.
- **Effects by colour.** 16 dishes give an effect, and the colour tells you what kind:
  - **red** heals you: Regeneration, Absorption, Health Boost;
  - **blue** moves you: Speed, Jump Boost, Slow Falling;
  - **yellow** digs faster: Haste;
  - **green** helps you explore: Night Vision, Water Breathing, Fire Resistance.
- **Nothing goes to waste:** you get the bowl, the jam bottle and the skewer stick back.
- **Kitchen Guide:** an in-game recipe book with every recipe, every crop and where to find it,
  and a "What can I make?" page that checks what you carry. You get one free when you first join.
- **Recipe Poster:** a two-block poster for your kitchen wall. Sneak and use it to flip through
  your recipes.
- **Recipes unlock as you go.** Each new crop you find unlocks its recipes in the guide, on the
  poster and in the crafting table's recipe book. In Creative everything is unlocked.
- **Eight kitchen decor blocks:** Kitchen Counter, Kitchen Cabinet, Spice Shelf, Kitchen Sink,
  Kitchen Stove, Hanging Pan, Jar of Pickles and Vegetable Basket.
- **Eight languages** (see below).

![Tomato, onion and cucumber rows at golden hour](08-farm.png)

### Your first soup

1. **Find seeds.** Break grass or ferns. Tomatoes like plains and forests, chili peppers like
   jungles, savannas and badlands, strawberries like meadows, flower forests and cherry groves.
   Any seed can still turn up anywhere, just less often. The onion has no seed: plant the onion
   itself.
2. **Plant them.** Tomato, cucumber and eggplant seeds and onions go on farmland, like wheat.
   Break a fully grown crop to get the crop and some seeds back. Chili peppers and strawberries
   grow on bushes: plant them on grass, dirt or farmland and use a ripe bush to pick it. Bone meal
   works on all of them.
3. **Make a Cutting Board** from a stick and two planks in a row. Hold a tomato, onion, cucumber
   or eggplant and use the board to cut it. Sneak to cut the whole stack.
4. **Make a Cooking Pot** from five iron ingots and a bowl. It only cooks with heat right below
   it: a campfire, fire, lava or a magma block. Or build a Kitchen Stove, use it to switch it on,
   and sneak to put the pot on top.
5. **Cook.** Craft two tomatoes and a bowl into a Tomato Soup Mix. Use the pot with the mix in your
   hand to put it in, then with an empty hand to start cooking. A few seconds later, use it with
   an empty hand again to take out your Tomato Soup.

Everything else is in the **Kitchen Guide**. Lost it? Craft a new one from a book and a carrot.

![GIF: chopping cucumbers on the Cutting Board](chopping.gif)

### Screenshots

_The screenshots show the add-on's real blocks, items and models, exactly as they look in the
game. The art itself was made with AI-assisted tools and finished by hand._

![Strawberry and chili bushes among flowers](05-strawberry-bushes.png)
![The kitchen decor blocks, with a pot on the lit stove](03-kitchen-decor.png)
![A Strawberry Cake on a table between lanterns](06-cake-table.png)
![The Kitchen Guide's Chicken Soup page](10-guide-recipe.png)

### Installation

You need **Minecraft Bedrock Edition 1.26.50 or newer**. No experiments are needed.

1. Download the `.mcaddon` file.
2. Open it with Minecraft:
   - **Windows:** double-click it.
   - **Android:** tap the file in your downloads and choose Minecraft.
   - **iOS:** open it in the Files app, tap Share and choose Minecraft.
3. Wait for the two "Successfully imported" messages.
4. Create a world, or open the settings of one you have. Go to **Behavior Packs**, find
   **Simmerfield** under Available and tap **Activate**. The resource pack (**Simmerfield
   Resources**) comes along by itself; leave it on.

**Removing it later** turns the add-on's blocks into unknown blocks and its items into vanilla
items. Adding it back restores the blocks. Back up your world first.

### Known conflicts

The Kitchen Guide's book screen replaces one vanilla UI file, `ui/server_form.json`: the screen
for menus that add-ons and servers open with scripts. Simmerfield shows the book only for its own
pages and keeps the normal menu everywhere else. Other packs that restyle these menus (chest-style
inventory menus, custom server form packs) usually replace the same file, and the pack **higher**
in the resource pack list wins:

- **Other pack higher:** the Kitchen Guide shows as a plain list of buttons with odd codes in the
  text. The rest of Simmerfield still works.
- **Simmerfield higher:** the other pack's menus fall back to the plain vanilla look.

**Fix:** in the world's **Resource Packs** settings, move the pack whose menus you want to keep to
the top. A global resource pack that changes menus can cause the same problem.

### Languages

English, Українська (Ukrainian), Polski (Polish), Deutsch (German), Español (Spanish), Português do
Brasil (Brazilian Portuguese), Français (French), Русский (Russian). Minecraft picks the language
from your game settings.

### For server owners

Operators can use `/wm_kitchen:debug` to check a world: a kit with every item, instant crop
growth, fast cooking and the state of a pot.

### Credits

- Made by Wendermods.
- Art: hand-finished pixel art, made with AI-assisted tools.
- Sounds are vanilla Minecraft sounds.

### License

All Rights Reserved (Wendermods). Play it in your own worlds and on your own servers, and show it in
videos, streams and screenshots, monetized ones included. Please don't re-upload or redistribute it;
link to this page instead. The full text is in `LICENSE.txt` inside both packs. Simmerfield is not
affiliated with or endorsed by Mojang or Microsoft.

### Support

Found a bug, or have an idea? Tell us on our [Discord server](DISCORD_URL).

Need a custom add-on? [wendermods.team](https://wendermods.team)

---

## Changelog for the 1.0.0 file

Paste this into the file's changelog field when you upload the `.mcaddon`. The full list is in
`CHANGELOG.md` at the repository root.

> **1.0.0** First release.
>
> - Six new crops: tomato, onion, cucumber, eggplant, chili pepper and strawberry.
> - Cutting Board and Cooking Pot. The pot cooks over a campfire, fire, lava, a magma block or a
>   lit Kitchen Stove.
> - 18 dishes and 10 mixes; 16 dishes give an effect, shown by colour.
> - Kitchen Guide book and Recipe Poster, with recipes that unlock as you find crops.
> - Eight kitchen decor blocks.
> - English, Ukrainian, Polish, German, Spanish, Brazilian Portuguese, French and Russian.

**File details.** Game version: 1.26.50 or newer (the CurseForge picker labels it `26.50`).
Release type: Release. **Verified 2026-10-24:** upload the `.mcaddon` from `npm run package` as
it is, without a `.zip` around it. The support article's ".zip" rule is for "most games"; Bedrock
projects on CurseForge ship `.mcaddon` files (Verity, Ores Booster), and CurseForge's own Bedrock
install guide names `.mcaddon` and `.mcpack` as the formats.

## Sources checked

- https://www.curseforge.com/minecraft-bedrock/addons (category list, 2026-10-23)
- https://support.curseforge.com/en/support/solutions/articles/9000197241-creating-and-submitting-a-project
  (fields, up to 4 additional categories, English titles and descriptions)
- https://blog.curseforge.com/how-to-pass-moderation-review-on-curseforge-2/ (summary, logo,
  description and links guidance; no numeric limits)
- https://support.curseforge.com/support/solutions/articles/9000199552 (Project Submission Guide
  and Tips: WYSIWYG or Markdown editor, logo at least 400x400 PNG; 2026-10-24)
- https://support.curseforge.com/support/solutions/articles/9000197279-moderation-policies
  (avatar 400x400, no WebP; summary one sentence; no external download links; 2026-10-24)
- https://blog.curseforge.com/how-to-install-add-ons-in-minecraft-bedrock/ (`.mcaddon` and
  `.mcpack`, 2026-04-29) and https://www.curseforge.com/minecraft-bedrock/addons/verity-bedrock-edition/files
  (`.mcaddon` files, versions labelled `26.50`; 2026-10-24)

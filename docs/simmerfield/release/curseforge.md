# CurseForge listing: Simmerfield

Copy-ready text for the CurseForge project (game: Minecraft Bedrock). Written 2026-10-23 from the
pack code and player docs. The project title is "Simmerfield: Farming & Cooking" (final name, D1);
the body text uses the plain name. Counts come from `packs/simmerfield/scripts/data/` (6 crops in
`crops.ts`, 18 dishes in `dishes.ts`, 10 mixes and 4 cut ingredients in `recipes.ts`); names come
from `resource/texts/en_US.lang`.

Lines starting with **TO VERIFY** were not confirmed on the web. Check them in the Authors Console
before you publish.

## Project fields

| Field                 | Value                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Name                  | Simmerfield: Farming & Cooking                                                                                              |
| Class                 | Addons                                                                                                                      |
| Main category         | Food                                                                                                                        |
| Additional categories | Survival, Vanilla+                                                                                                          |
| Logo                  | `logo-400.png` (this folder)                                                                                                |
| License               | `[LICENSE: choose in the Authors Console]`. For the MCPEDL sync, set Project Distribution to allow third-party distribution |
| Summary               | see below                                                                                                                   |

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
neither its support pages nor its moderation blog give a character limit. **TO VERIFY:** read the
counter on the summary field in the Authors Console. The summary below is 132 characters, kept
under 150 as a safe target.

## Summary

> Grow six new crops, cut them on a Cutting Board and cook 18 dishes with helpful effects in a pot
> over a fire. No experiments needed.

132 characters. Shorter fallback (82 characters): "Grow six new crops and cook 18 dishes in a
pot over a fire. No experiments needed."

## Description

Paste everything between the two rules below. **TO VERIFY:** whether the CurseForge editor for
Bedrock projects accepts Markdown. MCPEDL's upload guide says the CurseForge description is HTML.
If there's no Markdown option, paste it into the editor's visual mode, or convert it to HTML
first.

---

![Logo banner: the Cooking Pot on a campfire](TODO-banner.png)

**Simmerfield** adds six new crops to Minecraft and a kitchen to cook them in. Grow tomatoes,
onions, cucumbers, eggplants, chili peppers and strawberries. Cut them on a Cutting Board, craft
them into mixes and cook them in a Cooking Pot over a fire. Every dish fills you up, and most of
them also give you a helpful effect.

It runs on the stable Script API, so you don't need to turn on any experiments.

![GIF: putting a mix in the pot and taking out Tomato Soup](TODO-gif-cooking.gif)

### How to start

1. **Find seeds.** Break grass or ferns and you will sometimes find a seed. Each crop is easier to
   find in the places it likes: tomatoes in plains and forests, chili peppers in jungles, savannas
   and badlands, strawberries in meadows, flower forests and cherry groves. Every seed can still
   turn up anywhere, just less often. The onion has no seed: plant an onion itself.
2. **Plant them.** Tomato, cucumber and eggplant seeds and onions go on farmland, like wheat.
   Break the crop when it's fully grown to get the crop and some seeds back. Chili peppers and
   strawberries grow on bushes: plant them on grass, dirt or farmland, and use a ripe bush to pick
   the fruit. Bone meal helps everything grow.
3. **Make a Cutting Board** from a stick and two planks in a row. Hold a tomato, onion, cucumber or
   eggplant and use the board to get slices or chopped pieces. Sneak and use it to cut the whole
   stack.
4. **Make a Cooking Pot** from five iron ingots and a bowl. The pot only cooks with heat right
   below it: put it on a campfire, fire, lava or a magma block. Or build a Kitchen Stove, use it to
   switch it on, and sneak to put the pot on top.
5. **Cook your first dish.** Craft two tomatoes and a bowl into a Tomato Soup Mix on the crafting
   table. Use the pot with the mix in your hand to put it in, then use it with an empty hand to
   start cooking. A few seconds later, use it with an empty hand again to take out your Tomato
   Soup.

Everything else is in the **Kitchen Guide**, the in-game recipe book. You get one free the first
time you join a world with the add-on, together with a Recipe Poster. If you lose it, craft a new
one from a book and a carrot.

![GIF: breaking grass and finding seeds](TODO-gif-seeds.gif)

### Features

- **Six new crops:** Tomato, Onion, Cucumber, Eggplant, Chili Pepper and Strawberry. Four grow on
  farmland; chili peppers and strawberries grow on bushes that you pick and that grow new fruit.
- **Seeds from grass**, with each crop easier to find in its own biomes.
- **Cutting Board:** turns tomatoes, onions, cucumbers and eggplants into Sliced Tomato, Chopped
  Onion, Sliced Cucumber and Sliced Eggplant. A knife chops on the board while you work.
- **Cooking Pot:** cooks over a campfire, fire, lava, a magma block or a lit Kitchen Stove. It
  holds up to four mixes and cooks every mix of the same dish at once, so four mixes give you four
  bowls in the time of one. The liquid takes the colour of the dish, and a spoon stirs while it
  cooks.
- **18 dishes.** Hot dishes take two steps: craft the raw ingredients into a mix on the crafting
  table, then cook the mix in the pot. Cold dishes are crafted straight away.
  - Cooked in the pot: Tomato Soup, Vegetable Stew, Chili Stew, Fish Chowder, Chicken Soup, Onion
    Soup, Strawberry Jam, Stuffed Eggplant, Ratatouille and Eggplant Curry.
  - Made on the crafting table: Garden Salad, Salsa, Veggie Sandwich, Hearty Sandwich, Strawberry
    Cup, Eggplant Salad, Veggie Skewer, and a Strawberry Cake you place and eat one slice at a
    time.
- **Effects by colour.** 16 of the 18 dishes give an effect, and its colour tells you what kind:
  red heals you (Regeneration, Absorption, Health Boost), blue moves you (Speed, Jump Boost, Slow
  Falling), yellow digs faster (Haste), green helps you explore (Night Vision, Water Breathing,
  Fire Resistance). The two sandwiches are plain filling food.
- **Nothing goes to waste:** bowl dishes give the bowl back, the jam gives its bottle back, and the
  skewer gives its stick back.
- **Kitchen Guide:** a book with every recipe and its steps, the crops and where to find them,
  how to play, and a "What can I make?" page that shows the dishes you can make from what you
  carry.
- **Recipe Poster:** a poster two blocks wide for your kitchen wall. Its first page shows how to
  get started; sneak and use it to flip through the recipes you have unlocked.
- **Recipes unlock as you go.** Each new crop you find unlocks the recipes that use it, in the
  guide, on the poster and in the crafting table's recipe book. In Creative mode everything is
  unlocked from the start.
- **Eight kitchen decor blocks:** Kitchen Counter, Kitchen Cabinet, Spice Shelf, Kitchen Sink,
  Kitchen Stove, Hanging Pan, Jar of Pickles and Vegetable Basket. The Kitchen Stove also heats a
  pot.
- **Eight languages** (see below).

![GIF: chopping on the cutting board](TODO-gif-chopping.gif)

### Screenshots

![Screenshot: the farm at sunset, with the pot on a campfire](TODO-shot-1-farm.png)
![Screenshot: strawberry bushes in a meadow](TODO-shot-2-strawberries.png)
![Screenshot: chopping a cucumber on the Cutting Board](TODO-shot-3-chopping.png)
![Screenshot: the pot cooking at night](TODO-shot-4-pot-night.png)
![Screenshot: the Kitchen Guide's "What can I make?" page](TODO-shot-5-what-can-i-make.png)
![Screenshot: dishes on a wall, sorted by effect colour](TODO-shot-6-dishes-by-colour.png)
![Screenshot: a Strawberry Cake on a table, a few slices gone](TODO-shot-7-cake.png)
![Screenshot: Chili Stew's Fire Resistance next to lava](TODO-shot-8-dish-power.png)
![Screenshot: a kitchen built from the decor blocks, with the stove lit](TODO-shot-9-kitchen-decor.png)

![GIF: picking strawberries from a bush](TODO-gif-strawberry-bush.gif)
![GIF: flipping through the Kitchen Guide](TODO-gif-guide.gif)

### Installation

You need **Minecraft Bedrock Edition 1.26.50 or newer**. No experiments are needed.

**Windows (PC):**

1. Download the `.mcaddon` file.
2. Double-click it. Minecraft opens and imports both packs. Wait for the "Successfully imported"
   messages.

**Android and iOS (phone or tablet):**

1. Download the `.mcaddon` file.
2. Open it with Minecraft. On Android, tap the file in your downloads and choose Minecraft. On iOS,
   open it in the Files app, tap Share and choose Minecraft.
3. Wait for the "Successfully imported" messages.

**Turn it on for a world:**

1. Create a new world, or open the settings of a world you already have.
2. Go to **Behavior Packs**, find **Simmerfield BP** under Available and tap **Activate**.
3. The resource pack (**Simmerfield RP**) is added for you, because the behavior pack depends
   on it. Leave it on.
4. Play. You don't need to turn on any experiments.

### Known conflicts

The Kitchen Guide's book screen is drawn by the add-on's resource pack. To do that, it replaces
one vanilla UI file, `ui/server_form.json`: the screen the game uses for menus that add-ons and
servers open with scripts. The pack keeps the normal menu for everything else and only shows the
book for the guide's own pages. It changes no other vanilla UI file.

Other packs that restyle these script menus (for example chest-style inventory menus, or custom
server form packs) usually replace the same file. Only one version of that screen can win, and
the pack that sits **higher** in the world's resource pack list wins:

- **If the other pack is higher,** the Kitchen Guide opens as a plain list of buttons with some
  odd codes in the text instead of a book. The rest of Simmerfield still works.
- **If Simmerfield is higher,** the guide looks right, but the other pack's custom menus fall
  back to the plain vanilla look.

**Fix:** open the world's settings, go to **Resource Packs**, and move the pack whose menus you
want to keep to the top of the active list. If you use both often, keep Simmerfield on top
while you cook and swap the order when you need the other pack. A global resource pack (Settings,
Global Resources) that changes menus can cause the same problem.

### Languages

The add-on's text is available in:

- English
- Українська (Ukrainian)
- Polski (Polish)
- Deutsch (German)
- Español (Spanish)
- Português do Brasil (Brazilian Portuguese)
- Français (French)
- Русский (Russian)

Minecraft picks the language from your game settings.

### For server owners

Operators can use `/wm_kitchen:debug` to check a world: a kit with every item, instant crop
growth, fast cooking and the state of a pot.

### Credits

- Made by Wendermods.
- Code, textures and models: `[CREDITS: who made what]`.
- `[OPTIONAL: a note on the AI-assisted code and art pipeline, as in the Waypoint pitch]`
- Sounds are vanilla Minecraft sounds.

### License

`[LICENSE: e.g. All Rights Reserved, or the license you pick in the Authors Console]`

Links (put these at the bottom, per CurseForge's moderation guidance):
`[ISSUES / FEEDBACK LINK]` · `[DISCORD OR SOCIAL LINKS]` · `[PORTFOLIO SITE]`

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

**File details.** Game version: 1.26.50 or newer. Release type: Release. **TO VERIFY:** CurseForge's
support article says uploaded files must be `.zip` archives. Check whether the Bedrock upload
accepts the `.mcaddon` from `npm run package` as it is (many Bedrock projects offer `.mcaddon`
downloads), or whether it needs a `.zip` around it.

## Sources checked

- https://www.curseforge.com/minecraft-bedrock/addons (category list, 2026-10-23)
- https://support.curseforge.com/en/support/solutions/articles/9000197241-creating-and-submitting-a-project
  (fields, up to 4 additional categories, English titles and descriptions)
- https://blog.curseforge.com/how-to-pass-moderation-review-on-curseforge-2/ (summary, logo,
  description and links guidance; no numeric limits)

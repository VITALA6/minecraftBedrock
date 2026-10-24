# MCPEDL listing: Simmerfield

Copy-ready text for mcpedl.com. Written 2026-10-23 from the same sources as `curseforge.md`, with
the same facts in simpler formatting: plain paragraphs, short lists and bold labels only, so it
survives MCPEDL's editor and the CurseForge sync. The title is "Simmerfield: Farming & Cooking"
(final name, D1); the body text uses the plain name.

Lines starting with **TO VERIFY** were not confirmed on the web.

## How a project gets onto MCPEDL now

MCPEDL's own guide, "Uploading to MCPEDL" (https://mcpedl.com/cf-reward-program/, read 2026-10-23),
says projects are created in the **CurseForge Authors Console** (game: Minecraft Bedrock) and then
synced to MCPEDL. What it asks for:

1. Connect your CurseForge account in your MCPEDL dashboard profile (Connected Accounts).
2. In the CurseForge project's License section, set **Project Distribution** to allow third-party
   distribution. MCPEDL says this must be on, or the project doesn't show up there.
3. If the project already exists on MCPEDL, the slug must be the same on both sites.
4. Upload a thumbnail under Images, ideally **720x340 px**, among the first 20 images, with its
   title set to exactly **MCPEDL**.
5. The CurseForge description is HTML. Use relative image widths (`width="50%"`) and no fixed
   height. Spoilers use `<h2>Title</h2><div class="spoiler">...</div>`.
6. The project syncs once the first file is approved on CurseForge; later updates sync on their
   own. Check for a "Published on CurseForge" note next to the date on the MCPEDL post.
7. Third-party download links aren't allowed there: MCPEDL replaces them with the CurseForge file
   downloads. So don't add your own download links.

The Author Rewards Program toggle and 2FA on CurseForge are part of the same guide; they're
optional for the listing itself.

**Verified 2026-10-24: no direct upload.** CurseForge's "How to host MCPEDL projects on
CurseForge" (https://blog.curseforge.com/how-to-host-mcpedl-projects-on-curseforge/) says that
since 30 April 2025 new projects and updates go "only ... via the CurseForge Authors Console".
The fields below match what a published mcpedl.com project page shows (Description, Latest
Changes, Installation, Downloads, Supported Minecraft Versions, Tags); keep them as a reference.

Notes from MCPEDL's moderation guidelines (https://mcpedl.com/moderation-guidelines/):

- The name, avatar (logo), summary and description must be your own and distinct from other
  projects.
- No `.exe` files or third-party installers.
- Download hosts: at most 1 action and 1 redirect to reach the file, at most 30 seconds of waiting,
  no Linkvertise-style downloaders, no pop-up ads. Link shorteners are allowed only if they meet
  these rules and never lead to an error page. With the CurseForge sync this doesn't apply, since
  the downloads come from CurseForge.
- A feedback channel (bug reports, ideas) is strongly recommended.
- **TO VERIFY (still open, rechecked 2026-10-24):** neither page gives a minimum description
  length or a screenshot count. (mcpedl.org, a different site, asks for 3 to 6 screenshots; that
  is not mcpedl.com.) Tags are answered below: they come from the CurseForge categories.

Thumbnail: `screenshots/MCPEDL-thumbnail.png` (720x340, cropped from the pot on the campfire;
`assets/MCPEDL.png` is the composed alternative). The 400x400 `logo-400.png` is the avatar, not the
thumbnail.

## Title

Simmerfield: Farming & Cooking

## Short description

Grow six new crops, chop them and cook 18 dishes with potion effects in a pot over a campfire. No
experiments needed.

(The synced post uses the CurseForge summary, so this is the same line.)

## Description

**The synced post uses the CurseForge description** (`curseforge.md`, rewritten 2026-10-24), so
there is nothing to paste on MCPEDL. The text below is the older 2026-10-23 version, kept only as
a fallback in case MCPEDL ever accepts direct uploads again; update it from `curseforge.md` first.

[TODO-banner.png: logo banner, the Cooking Pot on a campfire]

Simmerfield adds six new crops to Minecraft and a kitchen to cook them in. Grow tomatoes,
onions, cucumbers, eggplants, chili peppers and strawberries. Cut them on a Cutting Board, craft
them into mixes and cook them in a Cooking Pot over a fire. Every dish fills you up, and most of
them also give you a helpful effect.

It runs on the stable Script API, so you don't need to turn on any experiments.

[TODO-gif-cooking.gif: putting a mix in the pot and taking out Tomato Soup]

**How to start**

1. Find seeds. Break grass or ferns and you will sometimes find a seed. Each crop is easier to find
   in the places it likes: tomatoes in plains and forests, chili peppers in jungles, savannas and
   badlands, strawberries in meadows, flower forests and cherry groves. Every seed can still turn
   up anywhere, just less often. The onion has no seed: plant an onion itself.
2. Plant them. Tomato, cucumber and eggplant seeds and onions go on farmland, like wheat. Break the
   crop when it's fully grown to get the crop and some seeds back. Chili peppers and strawberries
   grow on bushes: plant them on grass, dirt or farmland, and use a ripe bush to pick the fruit.
   Bone meal helps everything grow.
3. Make a Cutting Board from a stick and two planks in a row. Hold a tomato, onion, cucumber or
   eggplant and use the board to get slices or chopped pieces. Sneak and use it to cut the whole
   stack.
4. Make a Cooking Pot from five iron ingots and a bowl. The pot only cooks with heat right below
   it: put it on a campfire, fire, lava or a magma block. Or build a Kitchen Stove, use it to
   switch it on, and sneak to put the pot on top.
5. Cook your first dish. Craft two tomatoes and a bowl into a Tomato Soup Mix on the crafting
   table. Use the pot with the mix in your hand to put it in, then use it with an empty hand to
   start cooking. A few seconds later, use it with an empty hand again to take out your Tomato
   Soup.

Everything else is in the Kitchen Guide, the in-game recipe book. You get one free the first time
you join a world with the add-on, together with a Recipe Poster. If you lose it, craft a new one
from a book and a carrot.

[TODO-gif-seeds.gif: breaking grass and finding seeds]

**Features**

- Six new crops: Tomato, Onion, Cucumber, Eggplant, Chili Pepper and Strawberry. Four grow on
  farmland; chili peppers and strawberries grow on bushes that you pick and that grow new fruit.
- Seeds from grass, with each crop easier to find in its own biomes.
- Cutting Board: turns tomatoes, onions, cucumbers and eggplants into slices and chopped pieces. A
  knife chops on the board while you work.
- Cooking Pot: cooks over a campfire, fire, lava, a magma block or a lit Kitchen Stove. It holds
  up to four mixes and cooks every mix of the same dish at once. The liquid takes the colour of the
  dish, and a spoon stirs while it cooks.
- 18 dishes. Hot dishes take two steps: craft a mix on the crafting table, then cook it in the
  pot. Cold dishes are crafted straight away.
- Cooked in the pot: Tomato Soup, Vegetable Stew, Chili Stew, Fish Chowder, Chicken Soup, Onion
  Soup, Strawberry Jam, Stuffed Eggplant, Ratatouille and Eggplant Curry.
- Made on the crafting table: Garden Salad, Salsa, Veggie Sandwich, Hearty Sandwich, Strawberry
  Cup, Eggplant Salad, Veggie Skewer, and a Strawberry Cake you place and eat one slice at a time.
- Effects by colour: red heals you, blue moves you, yellow speeds up digging, green helps you
  explore. 16 of the 18 dishes give an effect; the two sandwiches are plain filling food.
- Bowl dishes give the bowl back, the jam gives its bottle back, and the skewer gives its stick
  back.
- Kitchen Guide: every recipe and its steps, the crops and where to find them, how to play, and a
  "What can I make?" page.
- Recipe Poster for your kitchen wall: sneak and use it to flip through the recipes you have
  unlocked.
- Recipes unlock as you find each crop. In Creative mode everything is unlocked from the start.
- Eight kitchen decor blocks: Kitchen Counter, Kitchen Cabinet, Spice Shelf, Kitchen Sink, Kitchen
  Stove, Hanging Pan, Jar of Pickles and Vegetable Basket.
- Eight languages: English, Українська, Polski, Deutsch, Español, Português do Brasil, Français,
  Русский. Minecraft picks the language from your game settings.

[TODO-gif-chopping.gif: chopping on the cutting board]

About the images: they show the add-on's real blocks, items and models, exactly as they look
in the game. The art itself was made with AI-assisted tools and finished by hand.

[TODO-shot-1-farm.png: the farm at sunset, with the pot on a campfire]
[TODO-shot-3-chopping.png: chopping a cucumber on the Cutting Board]
[TODO-shot-4-pot-night.png: the pot cooking at night]
[TODO-shot-5-what-can-i-make.png: the Kitchen Guide's "What can I make?" page]
[TODO-shot-6-dishes-by-colour.png: dishes on a wall, sorted by effect colour]
[TODO-shot-9-kitchen-decor.png: a kitchen built from the decor blocks, with the stove lit]

**Known conflicts**

The Kitchen Guide's book screen replaces one vanilla UI file, ui/server_form.json (the screen for
menus that add-ons open with scripts). Other packs that restyle those menus, such as chest-style
menu packs, often replace the same file. The pack higher in the world's resource pack list wins:

- If the other pack is higher, the Kitchen Guide shows as a plain list of buttons with odd codes
  in the text. Everything else in Simmerfield still works.
- If Simmerfield is higher, the other pack's menus fall back to the plain vanilla look.

Fix: in the world's settings, open Resource Packs and move the pack whose menus you want to keep
to the top. A global resource pack that changes menus can do the same.

**Credits**

Made by Wendermods. Art: hand-finished pixel art, made with AI-assisted tools. Sounds are vanilla
Minecraft sounds.

License: All Rights Reserved (Wendermods). Play it in your own worlds and on your own servers, and
show it in videos, streams and screenshots, monetized ones included. Please don't re-upload or
redistribute it. The full text is in LICENSE.txt inside both packs. Not affiliated with Mojang or
Microsoft. Feedback and bug reports: [LINK].

## Installation

(MCPEDL also links its own install guides for Android, iOS and Windows under each post.)

You need Minecraft Bedrock Edition 1.26.50 or newer. No experiments are needed.

Windows: download the .mcaddon file and double-click it. Minecraft opens and imports both packs.

Android: tap the downloaded .mcaddon file and open it with Minecraft.

iOS: open the .mcaddon file in the Files app, tap Share and choose Minecraft.

Then turn it on for a world: create a world or edit one you have, go to Behavior Packs, find
Simmerfield under Available and tap Activate. The resource pack (Simmerfield Resources) is added for
you. Leave it on, and play.

Removing it later: this turns the add-on's blocks into unknown blocks and its items into vanilla
items. Adding it back restores the blocks. Back up your world first.

## Supported Minecraft versions

1.26.50 and newer (the `min_engine_version` in both manifests). **Checked 2026-10-24:** there is
no MCPEDL version picker for synced projects. The post shows versions taken from the CurseForge
files (a synced post, mcpedl.com/ores-booster, shows "26.30", one of the four versions on its
CurseForge files; which one MCPEDL picks isn't documented). Pick `26.50` in the CurseForge
upload form.

## Downloads

[DOWNLOAD: synced from CurseForge; the .mcaddon from `npm run package`]

Don't add a separate download link or shortener. If you ever upload directly instead of syncing,
link a direct download that meets the host rules above.

## Tags

**Checked 2026-10-24:** synced posts take their tags from the CurseForge categories (on
mcpedl.com/ores-booster the tags are exactly the CurseForge project's four categories). There is
nothing to fill in on MCPEDL: the tags will be Food, Survival and Vanilla+ from `curseforge.md`.

## Changelog (Latest Changes)

1.0.0: First release. Six new crops, the Cutting Board and Cooking Pot, 18 dishes and 10 mixes,
the Kitchen Guide and Recipe Poster, eight kitchen decor blocks, eight languages.

## Sources checked

- https://mcpedl.com/cf-reward-program/ (Uploading to MCPEDL, read 2026-10-23)
- https://mcpedl.com/moderation-guidelines/ (read 2026-10-23)
- A published mcpedl.com project page, for the section names
- https://blog.curseforge.com/how-to-host-mcpedl-projects-on-curseforge/ (CurseForge-only
  uploads since 2025-04-30; read 2026-10-24)
- https://mcpedl.com/ores-booster/ and https://www.curseforge.com/minecraft-bedrock/addons/ores-booster
  (a synced project: same slug, tags = CurseForge categories; read 2026-10-24)

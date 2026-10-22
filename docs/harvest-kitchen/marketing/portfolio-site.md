# Portfolio site copy (draft)

Short blocks for your own portfolio site. "Harvest Kitchen" is the working name (D1); swap in the
final name when it exists. Keep the AI-assistance line if you keep the art blurb: the pitch to the
publisher says the same thing, and the two should match.

## Tagline

> A kid-friendly farming and cooking add-on for Minecraft: Bedrock Edition.

## Project summary (~50 words)

> Harvest Kitchen is a farming and cooking add-on for Minecraft: Bedrock Edition, aimed at a
> Marketplace release. Players grow five crops, chop them, cook or craft 13 dishes and share a
> placeable cake. Dish effects are colour-coded so young players learn them without reading. It
> uses only stable APIs and data-driven content.

## Case study (~120 words)

> **Problem.** I wanted a cooking add-on that a young player can use without reading: no long
> recipe lists, no menus to learn first, and nothing that breaks when the game updates.
>
> **Approach.** I set four rules: actions happen in the world, every block shows its state, every
> action answers with sound and particles, and no message is longer than five words. Effects are
> grouped into four colour families. The recipe book answers "What can I make?". In the code, one
> data-driven station engine runs every cooking station, and the add-on checks its own data when the
> world loads.
>
> **Result.** `[FILL IN AFTER THE PLAYTEST: for example, "In playtests, a child and an adult new to
the game both cooked a soup within three minutes, with no help."]`

## Technical highlights

**One station engine; an oven is just a config.** The cooking pot is a generic container station:
a recipe list, a capacity, a heat rule and a mapping to the block's visual states. Adding the
planned oven means adding a config entry and a block file, not new engine code. Cooking time is
stored as ticks left, so it pauses when the fire goes out and survives reloads.

**Validation at world load, plus a debug kit.** On load, the add-on checks every id, icon,
translation key, station and recipe, and tells operators if something is wrong. An operator-only
command hands out every item, grows nearby crops, speeds up cooking and prints a pot's saved
state. One test session covers a whole milestone.

**A palette-driven texture generator with a linter.** A small Node script samples colour ramps from
the game's own textures and draws every 16×16 icon from shape descriptions. A linter checks
silhouette size, colour count, value contrast, stray pixels and look-alike pairs, and renders a
review sheet next to vanilla items. The code and models are written with an AI assistant; I review
the output and finish the art by hand.

**Stable APIs only.** No beta modules and no experiment toggles. The build fails if a manifest asks
for a prerelease version or one that differs from the installed package. No vanilla files are
overridden, so the add-on doesn't collide with others.

## In progress / what's next

> In progress: in-game testing, hand-finished art and a playtest with kids. Next: the publisher
> application, then multiplayer QA and an oven in v1.1.

`[UPDATE AS MILESTONES CLOSE. Don't claim "published" or "on the Marketplace" until it is.]`

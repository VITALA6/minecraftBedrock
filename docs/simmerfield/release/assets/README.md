# Simmerfield: store images

Composed images for the CurseForge gallery and the MCPEDL thumbnail, made 2026-10-24 without
running the game. They're built only from our own art and match the 400x400 logo
(`../logo-400.png`): warm rays on an 8 px grid, tilled soil with a grass edge, our 16x16 textures
scaled by whole numbers, and captions in a 5x7 pixel font drawn in code.

They don't replace the in-game screenshots and GIFs in `../README.md`. Store visitors expect
real gameplay too.

```sh
npm run store-assets                                   # compose the images (no Blockbench needed)
node tools/make-store-assets.mjs --check               # exit 1 if an image is out of date
flock <lockfile> node tools/make-store-assets.mjs --render   # re-render src/ first (running Blockbench)
```

## Files

| File                            | Pixels    | File size | What it shows                                                                                                                                                                          |
| ------------------------------- | --------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curseforge-1-cook.png`         | 1920x1080 | 36 KB     | "COOK IN THE POT": the Cooking Pot full of Tomato Soup, with the stirring spoon, on a lit Kitchen Stove. A Tomato Soup Mix goes in on the left and Tomato Soup comes out on the right. |
| `curseforge-2-chop.png`         | 1920x1080 | 37 KB     | "CHOP ON THE CUTTING BOARD": the board with its knife. Tomato, onion, cucumber and eggplant on the left; the four cut ingredients on the right.                                        |
| `curseforge-3-cake.png`         | 1920x1080 | 40 KB     | "STRAWBERRY CAKE": the placed cake with one slice eaten, so the layers show, next to its recipe (cake + 2 strawberries).                                                               |
| `curseforge-4-kitchen.png`      | 1920x1080 | 61 KB     | "BUILD A KITCHEN": the decor scene (counters, cabinets, spice shelf, sink, lit stove with the pot of soup, hanging pan, pickle jar, cutting board, vegetable basket).                  |
| `curseforge-5-crops-dishes.png` | 1920x1080 | 36 KB     | "6 NEW CROPS, 18 DISHES": all 18 dish icons above the six mature crops growing out of the soil.                                                                                        |
| `curseforge-6-recipe-flow.png`  | 1920x1080 | 29 KB     | "GROW, MIX, COOK, EAT": tomato plant, then 2 tomatoes + bowl into a Tomato Soup Mix, then the pot on a campfire (as on the logo), then Tomato Soup.                                    |
| `MCPEDL.png`                    | 720x340   | 9 KB      | MCPEDL thumbnail: "SIMMERFIELD / FARMING & COOKING / BY WENDERMODS" next to the pot of soup on the lit stove.                                                                          |

Each gallery image also has a small "SIMMERFIELD" mark in the bottom-right corner, so it still
says what it is when it's shared on its own.

**MCPEDL thumbnail:** upload `MCPEDL.png` to the CurseForge project's Images and set its
**title** to exactly `MCPEDL`. The title is what MCPEDL looks for, not the file name. Keep it
among the first 20 images (see `../mcpedl.md`).

## Sources

- Item and block textures: `packs/simmerfield/resource/textures/wm_kitchen/{items,blocks}/`.
- Our own drawings of vanilla things: `art/simmerfield/generated/ingredients/` (campfire, cake,
  bowl).
- `src/`: 3D renders of our Blockbench models (`art/simmerfield/models/`), made by `--render` with
  an orthographic camera on a transparent background and trimmed to their pixels:

  | File                  | Scene                                                                                   |
  | --------------------- | --------------------------------------------------------------------------------------- |
  | `pot_stove.png`       | Kitchen Stove + Cooking Pot (no lid, top liquid layer, `tomato_ready`, hot rim) + spoon |
  | `pot_stove_small.png` | the same, smaller, for the MCPEDL thumbnail                                             |
  | `board.png`           | Cutting Board with its knife                                                            |
  | `cake.png`            | Strawberry Cake with the front slice (`slice_4`) hidden                                 |
  | `kitchen.png`         | `kitchen_deco/kitchen_group.bbmodel`, the pot's lid hidden and its soup shown           |

Nothing comes from `art/references/` (third-party, never used).

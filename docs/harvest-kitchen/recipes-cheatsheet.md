# Harvest Kitchen: crafting cheat sheet (tools and blocks)

Every crafting recipe whose result isn't food. All four are made on the **vanilla crafting table**
(recipe tag `crafting_table`). Source: `packs/harvest_kitchen/behavior/recipes/`.
`tests/pack-files.test.ts` ("station recipes unlock in the recipe book") keeps the unlock lists in
step with the crops.

Not here:

- Dishes and the Strawberry Cake: see `slice.md`.
- The 10 mixes: food steps, also crafted on the vanilla crafting table (D16; they had their own
  Kitchen Table block until 2026-10-23).
- Sliced and chopped ingredients: made on the Cutting Board, not crafted.
- The Recipe Book: replaced by the Recipe Poster (D15). (The Kitchen Guide below is a book again,
  with recipes, D19.)

| Block         | Recipe             | Grid        | Unlocks in the recipe book when you get…                                        |
| ------------- | ------------------ | ----------- | ------------------------------------------------------------------------------- |
| Cooking Pot   | shaped, 3 × 2      | 3 × 3 table | an iron ingot, a bowl, any Harvest Kitchen seed, or an onion                    |
| Cutting Board | shaped, 3 × 1      | 3 × 3 table | any Harvest Kitchen seed, or an onion                                           |
| Recipe Poster | shapeless, 2 items | 2 × 2 too   | any Harvest Kitchen crop (tomato, onion, cucumber, chili, strawberry, eggplant) |
| Kitchen Guide | shapeless, 2 items | 2 × 2 too   | a book or a carrot                                                              |

"Any Harvest Kitchen seed" is tomato, cucumber, chili pepper, strawberry or eggplant seeds. The
onion has no seed; it's planted itself. In Creative every recipe is unlocked.

## Cooking Pot

Shaped, `["IBI", "III"]`. The two rows can sit in the top or bottom of the grid.

```
┌──────┬──────┬──────┐
│ Iron │ Bowl │ Iron │
├──────┼──────┼──────┤
│ Iron │ Iron │ Iron │
├──────┼──────┼──────┤
│      │      │      │
└──────┴──────┴──────┘
```

`I` = `minecraft:iron_ingot`, `B` = `minecraft:bowl`. Uses 5 iron ingots and 1 bowl.

## Cutting Board

Shaped, `["S##"]`: one row, in any of the three rows. The mirror `##S` should work too (Bedrock
mirrors shaped recipes unless `assume_symmetry` is false).

```
┌───────┬────────┬────────┐
│ Stick │ Planks │ Planks │
├───────┼────────┼────────┤
│       │        │        │
├───────┼────────┼────────┤
│       │        │        │
└───────┴────────┴────────┘
```

`S` = `minecraft:stick`, `#` = any planks (tag `minecraft:planks`; types can be mixed).

## Recipe Poster

Shapeless: any slots, also the 2 × 2 grid in the inventory.

```
Paper + any Harvest Kitchen crop
```

`minecraft:paper` + one item with the tag `hk:crops` (Tomato, Onion, Cucumber, Chili Pepper,
Strawberry or Eggplant). One poster is also given free the first time a player joins.

## Kitchen Guide

Shapeless: any slots, also the 2 × 2 grid in the inventory.

```
Book + Carrot
```

`minecraft:book` + `minecraft:carrot` make `hk:guide_book`, the Kitchen Guide; using it opens the
guide (D19, `slice.md` "Kitchen Guide (D19)"). One
guide is also given free the first time a player joins.

## Recipe book and Creative menu

- Recipes are only listed for items that are in the Creative menu. Until 2026-10-22, the Pot, Board,
  Poster and Strawberry Cake items used `menu_category: none` (copied from vanilla's `red_shrub`,
  code-review.md B3). That hid them from the Creative menu, and so from the recipe book. They now
  use `items`.
- Unlock rule: a station unlocks with the first Harvest Kitchen seed, because that is what a
  survival player finds first, from grass. The pot also unlocks on its key ingredients (iron, bowl),
  like vanilla's cauldron unlocks on a water bucket. Planks and sticks don't unlock the board:
  every player has them in the first minute, and the board is useless before the first crop.
- **In-game check (not yet done):** in a new Survival world, open the recipe book before picking
  anything up: none of the three is listed. Pick up a bowl: the Pot appears. Break grass until a
  seed drops: the Cutting Board appears. Harvest a crop: the Recipe Poster and that crop's mixes
  appear. In Creative, the Items tab shows the Pot, Board, Poster and Cake once each.

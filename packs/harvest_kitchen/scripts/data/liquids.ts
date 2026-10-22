import { ITEM_CHILI, ITEM_ONION, ITEM_STRAWBERRY, ITEM_TOMATO } from "../config";

// The colours a container station's liquid can show: the values of its liquid block state
// (hk:liquid on the pot). Each one has a texture pair in the resource pack,
// textures/hk/blocks/cooking_pot_liquid_<id>.png and _<id>_ready.png (tools/gen-textures.mjs),
// and tools/gen-pot-block.mjs writes the pot's permutations from this list.
//
// The ids are block state values, saved in the world: never rename or remove one after the first
// public build; add new ones at the end. The first one is the state's default (an empty pot).

export const LIQUIDS = ["water", "tomato", "chili", "jam", "stew", "broth", "cream"] as const;

export type Liquid = (typeof LIQUIDS)[number];

/** Clear water: nothing that colours the liquid is in the pot. */
export const DEFAULT_LIQUID: Liquid = "water";

/**
 * Strongest colour first: when two colours have the same count, the earlier one wins (a single
 * chili reddens a pot as much as a tomato would; cream only shows when it's the most).
 */
export const LIQUID_STRENGTH: readonly Liquid[] = [
  "chili",
  "tomato",
  "jam",
  "stew",
  "broth",
  "cream",
];

/**
 * The colour an ingredient gives the liquid while no dish matches yet. Ingredients not listed
 * (bowl, glass bottle, sugar) don't colour it. Ingredients with the same colour add up.
 */
export const INGREDIENT_LIQUIDS: Readonly<Record<string, Liquid>> = {
  [ITEM_TOMATO]: "tomato",
  [ITEM_CHILI]: "chili",
  [ITEM_STRAWBERRY]: "jam",
  [ITEM_ONION]: "broth",
  "minecraft:carrot": "broth",
  "minecraft:chicken": "broth",
  "minecraft:bread": "broth",
  "minecraft:beef": "stew",
  "minecraft:potato": "cream",
  "minecraft:cod": "cream",
  "minecraft:salmon": "cream",
};

/** The colour of whatever there's most of (summed per colour); water if nothing colours it. */
export function dominantLiquid(items: Readonly<Record<string, number>>): Liquid {
  const totals = new Map<Liquid, number>();
  for (const [id, count] of Object.entries(items)) {
    const liquid = INGREDIENT_LIQUIDS[id];
    if (liquid && count > 0) totals.set(liquid, (totals.get(liquid) ?? 0) + count);
  }
  let best: Liquid = DEFAULT_LIQUID;
  let most = 0;
  for (const liquid of LIQUID_STRENGTH) {
    const n = totals.get(liquid) ?? 0;
    if (n > most) {
      best = liquid;
      most = n;
    }
  }
  return best;
}

import {
  ITEM_SALAD,
  ITEM_SLICED_TOMATO,
  ITEM_STUFFED_TOMATO,
  ITEM_TOMATO,
  ITEM_TOMATO_SOUP,
} from "../config";

// Station recipes as plain data. The station code never names an item; adding a recipe is one
// entry here (plus the result item's JSON). data/validate.ts checks every id at world load.

export interface CuttingRecipe {
  readonly input: string;
  readonly output: string;
  readonly count: number;
}

export const CUTTING_RECIPES: readonly CuttingRecipe[] = [
  { input: ITEM_TOMATO, output: ITEM_SLICED_TOMATO, count: 2 },
];

export interface CookingRecipe {
  /** Stable id, saved in pots that are cooking it. Never rename one that has shipped. */
  readonly id: string;
  readonly result: string;
  readonly count: number;
  /** item id -> how many. A pot may hold extra items; they stay in the pot. */
  readonly ingredients: Readonly<Record<string, number>>;
  readonly seconds: number;
}

export const COOKING_RECIPES: readonly CookingRecipe[] = [
  {
    id: "hk:tomato_soup",
    result: ITEM_TOMATO_SOUP,
    count: 1,
    ingredients: { [ITEM_TOMATO]: 2, "minecraft:bowl": 1 },
    seconds: 5,
  },
  {
    id: "hk:salad",
    result: ITEM_SALAD,
    count: 1,
    ingredients: { [ITEM_SLICED_TOMATO]: 2, "minecraft:carrot": 1, "minecraft:bowl": 1 },
    seconds: 3,
  },
  {
    id: "hk:stuffed_tomato",
    result: ITEM_STUFFED_TOMATO,
    count: 2,
    ingredients: {
      [ITEM_TOMATO]: 2,
      "minecraft:baked_potato": 1,
      "minecraft:brown_mushroom": 1,
    },
    seconds: 8,
  },
];

export function findCookingRecipe(id: string): CookingRecipe | undefined {
  return COOKING_RECIPES.find((recipe) => recipe.id === id);
}

export function findCuttingRecipe(input: string): CuttingRecipe | undefined {
  return CUTTING_RECIPES.find((recipe) => recipe.input === input);
}

/** Every item some cooking recipe uses. Anything else is refused by the pot. */
export const COOKING_INGREDIENTS: ReadonlySet<string> = new Set(
  COOKING_RECIPES.flatMap((recipe) => Object.keys(recipe.ingredients)),
);

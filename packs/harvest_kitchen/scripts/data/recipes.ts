import {
  ITEM_CHILI,
  ITEM_CHICKEN_SOUP,
  ITEM_CHILI_STEW,
  ITEM_CHOPPED_ONION,
  ITEM_CUCUMBER,
  ITEM_FARMERS_SANDWICH,
  ITEM_FISH_CHOWDER,
  ITEM_GARDEN_SALAD,
  ITEM_ONION,
  ITEM_ONION_SOUP,
  ITEM_SALSA,
  ITEM_SLICED_CUCUMBER,
  ITEM_SLICED_TOMATO,
  ITEM_STRAWBERRY,
  ITEM_STRAWBERRY_CAKE,
  ITEM_STRAWBERRY_CUP,
  ITEM_STRAWBERRY_JAM,
  ITEM_TOMATO,
  ITEM_TOMATO_SOUP,
  ITEM_VEGETABLE_STEW,
  ITEM_VEGGIE_SANDWICH,
} from "../config";
import type { StationId } from "./stations";

// Recipes as plain data. Station code never names an item: adding a recipe is one entry here
// (plus the result item's JSON). The recipe book, the pot screen and "Almost!" are all derived
// from these lists. data/validate.ts checks every id at world load.

/** One ingredient slot: `count` items, any mix of `items` (e.g. raw cod or raw salmon). */
export interface Ingredient {
  readonly items: readonly string[];
  readonly count: number;
}

/** `ing(2, "hk:tomato")`, `ing(1, "minecraft:cod", "minecraft:salmon")` */
export function ing(count: number, ...items: string[]): Ingredient {
  return { items, count };
}

// --- cutting board -------------------------------------------------------------------------------

export interface CuttingRecipe {
  readonly input: string;
  readonly output: string;
  readonly count: number;
}

export const CUTTING_RECIPES: readonly CuttingRecipe[] = [
  { input: ITEM_TOMATO, output: ITEM_SLICED_TOMATO, count: 2 },
  { input: ITEM_ONION, output: ITEM_CHOPPED_ONION, count: 2 },
  { input: ITEM_CUCUMBER, output: ITEM_SLICED_CUCUMBER, count: 2 },
];

export function findCuttingRecipe(input: string): CuttingRecipe | undefined {
  return CUTTING_RECIPES.find((recipe) => recipe.input === input);
}

// --- container stations (the pot; an oven later is another station id) ---------------------------

export interface StationRecipe {
  /** Stable id, saved in stations that are cooking it. Never rename one that has shipped. */
  readonly id: string;
  readonly station: StationId;
  readonly result: string;
  readonly count: number;
  /** An item appears in at most one slot per recipe (validate.ts checks). */
  readonly ingredients: readonly Ingredient[];
  readonly seconds: number;
}

const BOWL = "minecraft:bowl";

export const STATION_RECIPES: readonly StationRecipe[] = [
  {
    id: "hk:tomato_soup",
    station: "pot",
    result: ITEM_TOMATO_SOUP,
    count: 1,
    ingredients: [ing(2, ITEM_TOMATO), ing(1, BOWL)],
    seconds: 5,
  },
  {
    id: "hk:vegetable_stew",
    station: "pot",
    result: ITEM_VEGETABLE_STEW,
    count: 1,
    ingredients: [
      ing(1, ITEM_TOMATO),
      ing(1, ITEM_ONION),
      ing(1, "minecraft:carrot"),
      ing(1, "minecraft:potato"),
      ing(1, BOWL),
    ],
    seconds: 10,
  },
  {
    id: "hk:chili_stew",
    station: "pot",
    result: ITEM_CHILI_STEW,
    count: 1,
    ingredients: [
      ing(1, ITEM_CHILI),
      ing(1, "minecraft:beef"),
      ing(1, ITEM_TOMATO),
      ing(1, ITEM_ONION),
      ing(1, BOWL),
    ],
    seconds: 10,
  },
  {
    id: "hk:fish_chowder",
    station: "pot",
    result: ITEM_FISH_CHOWDER,
    count: 1,
    ingredients: [
      ing(1, "minecraft:cod", "minecraft:salmon"),
      ing(1, "minecraft:potato"),
      ing(1, ITEM_ONION),
      ing(1, BOWL),
    ],
    seconds: 8,
  },
  {
    id: "hk:chicken_soup",
    station: "pot",
    result: ITEM_CHICKEN_SOUP,
    count: 1,
    ingredients: [
      ing(1, "minecraft:chicken"),
      ing(1, ITEM_ONION),
      ing(1, "minecraft:carrot"),
      ing(1, BOWL),
    ],
    seconds: 8,
  },
  {
    id: "hk:onion_soup",
    station: "pot",
    result: ITEM_ONION_SOUP,
    count: 1,
    ingredients: [ing(2, ITEM_ONION), ing(1, "minecraft:bread"), ing(1, BOWL)],
    seconds: 6,
  },
  {
    id: "hk:strawberry_jam",
    station: "pot",
    result: ITEM_STRAWBERRY_JAM,
    count: 1,
    ingredients: [
      ing(3, ITEM_STRAWBERRY),
      ing(1, "minecraft:sugar"),
      ing(1, "minecraft:glass_bottle"),
    ],
    seconds: 6,
  },
];

export function findStationRecipe(id: string): StationRecipe | undefined {
  return STATION_RECIPES.find((recipe) => recipe.id === id);
}

export function recipesFor(station: StationId): readonly StationRecipe[] {
  return STATION_RECIPES.filter((recipe) => recipe.station === station);
}

const ingredientSets = new Map<StationId, ReadonlySet<string>>();

/** Every item some recipe of `station` uses. Anything else is refused by that station. */
export function ingredientsOf(station: StationId): ReadonlySet<string> {
  let set = ingredientSets.get(station);
  if (!set) {
    set = new Set(recipesFor(station).flatMap((r) => r.ingredients.flatMap((i) => i.items)));
    ingredientSets.set(station, set);
  }
  return set;
}

// --- crafting table ------------------------------------------------------------------------------
// The real recipes are JSON in behavior/recipes/ (shapeless, so they also show in the vanilla
// recipe book). These entries mirror them for our book and "What can I make?"; keep both in sync.

export interface CraftingRecipe {
  readonly id: string;
  readonly result: string;
  readonly count: number;
  readonly ingredients: readonly Ingredient[];
}

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
  {
    id: "hk:garden_salad",
    result: ITEM_GARDEN_SALAD,
    count: 1,
    ingredients: [
      ing(2, ITEM_SLICED_TOMATO),
      ing(1, ITEM_SLICED_CUCUMBER),
      ing(1, "minecraft:carrot"),
      ing(1, BOWL),
    ],
  },
  {
    id: "hk:salsa",
    result: ITEM_SALSA,
    count: 1,
    ingredients: [
      ing(1, ITEM_SLICED_TOMATO),
      ing(1, ITEM_CHOPPED_ONION),
      ing(1, ITEM_CHILI),
      ing(1, BOWL),
    ],
  },
  {
    id: "hk:veggie_sandwich",
    result: ITEM_VEGGIE_SANDWICH,
    count: 1,
    ingredients: [
      ing(1, "minecraft:bread"),
      ing(1, ITEM_SLICED_TOMATO),
      ing(1, ITEM_SLICED_CUCUMBER),
    ],
  },
  {
    id: "hk:farmers_sandwich",
    result: ITEM_FARMERS_SANDWICH,
    count: 1,
    ingredients: [
      ing(1, "minecraft:bread"),
      ing(1, "minecraft:cooked_porkchop"),
      ing(1, ITEM_SLICED_TOMATO),
      ing(1, ITEM_SLICED_CUCUMBER),
    ],
  },
  {
    id: "hk:strawberry_cup",
    result: ITEM_STRAWBERRY_CUP,
    count: 1,
    ingredients: [ing(3, ITEM_STRAWBERRY), ing(1, "minecraft:sugar"), ing(1, BOWL)],
  },
  {
    id: "hk:strawberry_cake",
    result: ITEM_STRAWBERRY_CAKE,
    count: 1,
    ingredients: [ing(1, "minecraft:cake"), ing(2, ITEM_STRAWBERRY)],
  },
];

// --- shared helpers ------------------------------------------------------------------------------

export type Counts = Readonly<Record<string, number>>;

/** How many of `ingredient` the counts can supply, capped at what the slot needs. */
function supplied(counts: Counts, ingredient: Ingredient): number {
  return ingredient.items.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
}

export function canMake(counts: Counts, ingredients: readonly Ingredient[]): boolean {
  return ingredients.every((i) => supplied(counts, i) >= i.count);
}

/** Slots still short, with how many are missing. */
export function missingFor(
  counts: Counts,
  ingredients: readonly Ingredient[],
): { ingredient: Ingredient; missing: number }[] {
  return ingredients
    .map((ingredient) => ({ ingredient, missing: ingredient.count - supplied(counts, ingredient) }))
    .filter(({ missing }) => missing > 0);
}

/** `counts` minus one serving of `ingredients`, taking alternatives in list order. */
export function consume(
  counts: Counts,
  ingredients: readonly Ingredient[],
): Record<string, number> {
  const left: Record<string, number> = { ...counts };
  for (const { items, count } of ingredients) {
    let need = count;
    for (const id of items) {
      const take = Math.min(need, left[id] ?? 0);
      if (take > 0) left[id] = (left[id] ?? 0) - take;
      if (left[id] === 0) delete left[id];
      need -= take;
    }
  }
  return left;
}

/** Recipe that makes `itemId`, at a station or the crafting table. */
export function recipeMaking(
  itemId: string,
):
  | { kind: "station"; recipe: StationRecipe }
  | { kind: "crafting"; recipe: CraftingRecipe }
  | undefined {
  const station = STATION_RECIPES.find((r) => r.result === itemId);
  if (station) return { kind: "station", recipe: station };
  const crafting = CRAFTING_RECIPES.find((r) => r.result === itemId);
  return crafting ? { kind: "crafting", recipe: crafting } : undefined;
}

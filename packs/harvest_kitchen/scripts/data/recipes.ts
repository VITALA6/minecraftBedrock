import {
  ITEM_CHICKEN_SOUP,
  ITEM_CHICKEN_SOUP_MIX,
  ITEM_CHILI,
  ITEM_CHILI_STEW,
  ITEM_CHILI_STEW_MIX,
  ITEM_CHOPPED_ONION,
  ITEM_CUCUMBER,
  ITEM_EGGPLANT,
  ITEM_EGGPLANT_CURRY,
  ITEM_EGGPLANT_CURRY_MIX,
  ITEM_EGGPLANT_SALAD,
  ITEM_FISH_CHOWDER,
  ITEM_FISH_CHOWDER_MIX,
  ITEM_GARDEN_SALAD,
  ITEM_HEARTY_SANDWICH,
  ITEM_ONION,
  ITEM_ONION_SOUP,
  ITEM_ONION_SOUP_MIX,
  ITEM_RATATOUILLE,
  ITEM_RATATOUILLE_MIX,
  ITEM_SALSA,
  ITEM_SLICED_CUCUMBER,
  ITEM_SLICED_EGGPLANT,
  ITEM_SLICED_TOMATO,
  ITEM_STRAWBERRY,
  ITEM_STRAWBERRY_CAKE,
  ITEM_STRAWBERRY_CUP,
  ITEM_STRAWBERRY_JAM,
  ITEM_STRAWBERRY_JAM_MIX,
  ITEM_STUFFED_EGGPLANT,
  ITEM_STUFFED_EGGPLANT_MIX,
  ITEM_TOMATO,
  ITEM_TOMATO_SOUP,
  ITEM_TOMATO_SOUP_MIX,
  ITEM_VEGETABLE_STEW,
  ITEM_VEGETABLE_STEW_MIX,
  ITEM_VEGGIE_SANDWICH,
  ITEM_VEGGIE_SKEWER,
} from "../config";
import type { StationId } from "./stations";

// Recipes as plain data. Station code never names an item: adding a recipe is one entry here
// (plus the result item's JSON). The pot's choice form, the ghost ingredients and the recipe
// posters are all derived from these lists. data/validate.ts checks every id at world load.
//
// A pot dish takes two steps (D16): its raw ingredients become a mix on the crafting table, and
// the pot cooks the mix into the dish. (The mixes had their own Kitchen Table block until
// 2026-10-23.)

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
  { input: ITEM_EGGPLANT, output: ITEM_SLICED_EGGPLANT, count: 2 },
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
  /** Per serving: a station cooks every serving it holds at once (see servingsOf). */
  readonly count: number;
  /** An item appears in at most one slot per recipe (validate.ts checks). */
  readonly ingredients: readonly Ingredient[];
  readonly seconds: number;
}

const BOWL = "minecraft:bowl";

/** A pot recipe: one mix in, one dish out. */
const pot = (result: string, mix: string, seconds: number): StationRecipe => ({
  id: result,
  station: "pot",
  result,
  count: 1,
  ingredients: [ing(1, mix)],
  seconds,
});

export const STATION_RECIPES: readonly StationRecipe[] = [
  pot(ITEM_TOMATO_SOUP, ITEM_TOMATO_SOUP_MIX, 5),
  pot(ITEM_VEGETABLE_STEW, ITEM_VEGETABLE_STEW_MIX, 10),
  pot(ITEM_CHILI_STEW, ITEM_CHILI_STEW_MIX, 10),
  pot(ITEM_FISH_CHOWDER, ITEM_FISH_CHOWDER_MIX, 8),
  pot(ITEM_CHICKEN_SOUP, ITEM_CHICKEN_SOUP_MIX, 8),
  pot(ITEM_ONION_SOUP, ITEM_ONION_SOUP_MIX, 6),
  pot(ITEM_STRAWBERRY_JAM, ITEM_STRAWBERRY_JAM_MIX, 6),
  pot(ITEM_STUFFED_EGGPLANT, ITEM_STUFFED_EGGPLANT_MIX, 10),
  pot(ITEM_RATATOUILLE, ITEM_RATATOUILLE_MIX, 8),
  pot(ITEM_EGGPLANT_CURRY, ITEM_EGGPLANT_CURRY_MIX, 10),
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

// --- crafting: the vanilla crafting table ------------------------------------------------------
// The real recipes are JSON in behavior/recipes/ (shapeless, so they also show in the vanilla
// recipe book). These entries mirror them for the recipe posters; keep both in sync
// (tests/pack-files.test.ts compares them).
//
// A slot with alternatives ("cod or salmon") is one JSON recipe per alternative: the first keeps the
// id, the others get "_<alternative>" appended (hk:fish_chowder_mix_salmon), see craftingJsonIds.

export interface CraftingRecipe {
  readonly id: string;
  readonly result: string;
  readonly count: number;
  readonly ingredients: readonly Ingredient[];
}

/** A mix recipe: the raw ingredients of a pot dish become its mix. */
const mix = (result: string, ingredients: readonly Ingredient[]): CraftingRecipe => ({
  id: result,
  result,
  count: 1,
  ingredients,
});

const craft = (result: string, ingredients: readonly Ingredient[]): CraftingRecipe => ({
  id: result,
  result,
  count: 1,
  ingredients,
});

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
  // mixes: one per pot dish
  mix(ITEM_TOMATO_SOUP_MIX, [ing(2, ITEM_TOMATO), ing(1, BOWL)]),
  mix(ITEM_VEGETABLE_STEW_MIX, [
    ing(1, ITEM_TOMATO),
    ing(1, ITEM_ONION),
    ing(1, "minecraft:carrot"),
    ing(1, "minecraft:potato"),
    ing(1, BOWL),
  ]),
  mix(ITEM_CHILI_STEW_MIX, [
    ing(1, ITEM_CHILI),
    ing(1, "minecraft:beef"),
    ing(1, ITEM_TOMATO),
    ing(1, ITEM_ONION),
    ing(1, BOWL),
  ]),
  mix(ITEM_FISH_CHOWDER_MIX, [
    ing(1, "minecraft:cod", "minecraft:salmon"),
    ing(1, "minecraft:potato"),
    ing(1, ITEM_ONION),
    ing(1, BOWL),
  ]),
  mix(ITEM_CHICKEN_SOUP_MIX, [
    ing(1, "minecraft:chicken"),
    ing(1, ITEM_ONION),
    ing(1, "minecraft:carrot"),
    ing(1, BOWL),
  ]),
  mix(ITEM_ONION_SOUP_MIX, [ing(2, ITEM_ONION), ing(1, "minecraft:bread"), ing(1, BOWL)]),
  mix(ITEM_STRAWBERRY_JAM_MIX, [
    ing(3, ITEM_STRAWBERRY),
    ing(1, "minecraft:sugar"),
    ing(1, "minecraft:glass_bottle"),
  ]),
  mix(ITEM_STUFFED_EGGPLANT_MIX, [
    ing(1, ITEM_EGGPLANT),
    ing(1, "minecraft:mutton"),
    ing(1, ITEM_ONION),
    ing(1, ITEM_TOMATO),
  ]),
  mix(ITEM_RATATOUILLE_MIX, [
    ing(1, ITEM_EGGPLANT),
    ing(1, ITEM_TOMATO),
    ing(1, ITEM_CUCUMBER),
    ing(1, BOWL),
  ]),
  mix(ITEM_EGGPLANT_CURRY_MIX, [
    ing(1, ITEM_EGGPLANT),
    ing(1, ITEM_CHILI),
    ing(1, ITEM_ONION),
    ing(1, "minecraft:potato"),
    ing(1, BOWL),
  ]),
  // vanilla crafting table: cold dishes
  craft(ITEM_GARDEN_SALAD, [
    ing(2, ITEM_SLICED_TOMATO),
    ing(1, ITEM_SLICED_CUCUMBER),
    ing(1, "minecraft:carrot"),
    ing(1, BOWL),
  ]),
  craft(ITEM_SALSA, [
    ing(1, ITEM_SLICED_TOMATO),
    ing(1, ITEM_CHOPPED_ONION),
    ing(1, ITEM_CHILI),
    ing(1, BOWL),
  ]),
  craft(ITEM_VEGGIE_SANDWICH, [
    ing(1, "minecraft:bread"),
    ing(1, ITEM_SLICED_TOMATO),
    ing(1, ITEM_SLICED_CUCUMBER),
  ]),
  craft(ITEM_HEARTY_SANDWICH, [
    ing(1, "minecraft:bread"),
    ing(1, "minecraft:cooked_porkchop"),
    ing(1, ITEM_SLICED_TOMATO),
    ing(1, ITEM_SLICED_CUCUMBER),
  ]),
  craft(ITEM_STRAWBERRY_CUP, [ing(3, ITEM_STRAWBERRY), ing(1, "minecraft:sugar"), ing(1, BOWL)]),
  craft(ITEM_STRAWBERRY_CAKE, [ing(1, "minecraft:cake"), ing(2, ITEM_STRAWBERRY)]),
  craft(ITEM_EGGPLANT_SALAD, [
    ing(1, ITEM_SLICED_EGGPLANT),
    ing(1, ITEM_SLICED_CUCUMBER),
    ing(1, ITEM_CHOPPED_ONION),
    ing(1, BOWL),
  ]),
  craft(ITEM_VEGGIE_SKEWER, [
    ing(1, "minecraft:stick"),
    ing(1, ITEM_SLICED_EGGPLANT),
    ing(1, ITEM_SLICED_TOMATO),
    ing(1, ITEM_CHOPPED_ONION),
  ]),
];

const shortName = (id: string) => id.slice(id.indexOf(":") + 1);

/**
 * The JSON recipes behind one entry, as [identifier, one item per slot]: one per alternative of
 * its (single) multi-item slot, the first keeping the entry's id.
 */
export function craftingJsonIds(recipe: CraftingRecipe): { id: string; items: string[] }[] {
  const multi = recipe.ingredients.find((i) => i.items.length > 1);
  const pick = (alt: string | undefined) =>
    recipe.ingredients.flatMap(({ items, count }) =>
      Array<string>(count).fill((items.length > 1 ? alt : items[0]) ?? ""),
    );
  if (!multi) return [{ id: recipe.id, items: pick(undefined) }];
  return multi.items.map((alt, i) => ({
    id: i === 0 ? recipe.id : `${recipe.id}_${shortName(alt)}`,
    items: pick(alt),
  }));
}

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

/** Recipe that makes `itemId`, at a station or a crafting table. */
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

/**
 * The items `station` takes that are made from `typeId` (crafted): the mixes a raw
 * ingredient goes into, for the "make a mix first" hint when it's used on the pot.
 */
export function stationInputsMadeFrom(station: StationId, typeId: string): string[] {
  return [...ingredientsOf(station)].filter((input) => {
    const made = recipeMaking(input);
    return made?.recipe.ingredients.some((i) => i.items.includes(typeId)) ?? false;
  });
}

/** How many servings of `ingredients` the counts hold (0 if one slot is short). */
export function servingsOf(counts: Counts, ingredients: readonly Ingredient[]): number {
  if (ingredients.length === 0) return 0;
  return Math.min(...ingredients.map((i) => Math.floor(supplied(counts, i) / i.count)));
}

/** `counts` minus `servings` servings of `ingredients`. */
export function consumeServings(
  counts: Counts,
  ingredients: readonly Ingredient[],
  servings: number,
): Record<string, number> {
  let left: Record<string, number> = { ...counts };
  for (let i = 0; i < servings; i++) left = consume(left, ingredients);
  return left;
}

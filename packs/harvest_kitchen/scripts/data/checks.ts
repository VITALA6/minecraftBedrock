import {
  ITEM_COOKING_POT,
  ITEM_CUTTING_BOARD,
  ITEM_GUIDE_BOOK,
  BLOCK_KITCHEN_STOVE,
  BLOCK_RECIPE_POSTER,
  ITEM_RECIPE_POSTER,
  STATE_FACING,
  STATE_GROWTH,
  STATE_LIT,
  STATE_POSTER,
  STATE_POSTER_PAGE,
  STATE_SLICES,
} from "../config";
import { HEAT_BLOCK_IDS } from "../stations/heat";
import { CROPS, SEED_DROP_BLOCKS, SOIL_BLOCKS, type Crop } from "./crops";
import { DISHES, EFFECTS, FAMILIES, type Dish, type EffectInfo, type FamilyInfo } from "./dishes";
import { itemIcon } from "./icons";
import {
  CRAFTING_RECIPES,
  CUTTING_RECIPES,
  STATION_RECIPES,
  type CraftingRecipe,
  type CuttingRecipe,
  type Ingredient,
  type StationRecipe,
} from "./recipes";
import { STATIONS, type ContainerStation } from "./stations";

// The half of the data check that needs no game API: duplicate ids, counts, capacity, icons,
// lang key prefixes, effect families, and that every recipe and ingredient can be reached. Pure,
// so tests run it in Node, also on deliberately broken copies of the data. validate.ts adds the
// game-side half at world load (items, blocks, states, biomes, effects, food components) using
// referencedItems/referencedBlocks below.

/** Everything the check reads, so tests can feed broken data. */
export interface Content {
  readonly crops: readonly Crop[];
  readonly cuttingRecipes: readonly CuttingRecipe[];
  readonly stationRecipes: readonly StationRecipe[];
  readonly craftingRecipes: readonly CraftingRecipe[];
  readonly dishes: readonly Dish[];
  readonly stations: readonly ContainerStation[];
  readonly effects: Readonly<Record<string, EffectInfo>>;
  readonly families: Readonly<Record<string, FamilyInfo>>;
  /** Items that exist outside any recipe (poster, pot, board, guide book). */
  readonly extraItems: readonly string[];
  /** Vanilla blocks the scripts name (grass, soils, heat). */
  readonly vanillaBlocks: readonly string[];
  readonly icon: (typeId: string) => string | undefined;
}

export const CONTENT: Content = {
  crops: CROPS,
  cuttingRecipes: CUTTING_RECIPES,
  stationRecipes: STATION_RECIPES,
  craftingRecipes: CRAFTING_RECIPES,
  dishes: DISHES,
  stations: STATIONS,
  effects: EFFECTS,
  families: FAMILIES,
  extraItems: [ITEM_RECIPE_POSTER, ITEM_COOKING_POT, ITEM_CUTTING_BOARD, ITEM_GUIDE_BOOK],
  vanillaBlocks: [
    ...SEED_DROP_BLOCKS,
    ...SOIL_BLOCKS,
    ...HEAT_BLOCK_IDS.filter((id) => id.startsWith("minecraft:")),
  ],
  icon: itemIcon,
};

const positiveInt = (n: number) => Number.isInteger(n) && n > 0;

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const id of ids) (seen.has(id) ? twice : seen).add(id);
  return [...twice];
}

export function checkContent(content: Content = CONTENT): string[] {
  const problems: string[] = [];
  const say = (problem: string) => problems.push(problem);
  const icon = (id: string, where: string) => {
    if (!content.icon(id)) say(`${where}: no icon for "${id}" (add it to data/icons.ts)`);
  };
  const ingredients = (list: readonly Ingredient[], where: string) => {
    const seen = new Set<string>();
    for (const { items, count } of list) {
      if (!positiveInt(count)) say(`${where}: bad count ${count}`);
      if (items.length === 0) say(`${where}: ingredient with no items`);
      for (const id of items) {
        icon(id, where);
        if (seen.has(id)) say(`${where}: "${id}" is in two ingredient slots`);
        seen.add(id);
      }
    }
  };
  const stationById = (id: string) => content.stations.find((s) => s.id === id);

  // Crops
  for (const crop of content.crops) {
    const where = `crop ${crop.key}`;
    icon(crop.produce, where);
    icon(crop.seed, where);
    if (!crop.whereKey.startsWith("hk.crop.where.")) say(`${where}: odd lang key ${crop.whereKey}`);
    if (crop.type === "bush" && !crop.pick) say(`${where}: bush without pick counts`);
    const pick = crop.pick;
    if (pick && !(positiveInt(pick.min) && Number.isInteger(pick.max) && pick.max >= pick.min)) {
      say(`${where}: bad pick counts ${pick.min}..${pick.max}`);
    }
    const reset = crop.pickResetStage;
    if (reset !== undefined && !(Number.isInteger(reset) && reset >= 0)) {
      say(`${where}: bad pickResetStage ${reset}`);
    }
    if (crop.biomes.length === 0) say(`${where}: no biomes`);
  }
  for (const [what, ids] of [
    ["key", content.crops.map((c) => c.key)],
    ["block", content.crops.map((c) => c.block)],
    ["seed", content.crops.map((c) => c.seed)],
  ] as const) {
    for (const id of duplicates(ids)) say(`crops: duplicate ${what} "${id}"`);
  }

  // Cutting board
  for (const recipe of content.cuttingRecipes) {
    const where = `cutting ${recipe.input}`;
    icon(recipe.output, where);
    if (!positiveInt(recipe.count)) say(`${where}: bad count ${recipe.count}`);
  }
  for (const id of duplicates(content.cuttingRecipes.map((r) => r.input))) {
    say(`cutting: duplicate input "${id}"`);
  }

  // Stations and their recipes
  for (const station of content.stations) {
    const where = `station ${station.id}`;
    icon(station.icon, where);
    if (!station.nameKey.startsWith("hk.")) say(`${where}: odd lang key ${station.nameKey}`);
    if (!positiveInt(station.capacity)) say(`${where}: bad capacity ${station.capacity}`);
    const fill = station.states.fill;
    if (fill && !positiveInt(fill.levels)) say(`${where}: bad fill levels ${fill.levels}`);
    if (!content.stationRecipes.some((r) => r.station === station.id)) say(`${where}: no recipes`);
  }
  for (const id of duplicates(content.stations.map((s) => s.id))) {
    say(`stations: duplicate id "${id}"`);
  }
  for (const id of duplicates(content.stations.map((s) => s.block))) {
    say(`stations: duplicate block "${id}"`);
  }
  for (const recipe of content.stationRecipes) {
    const where = `station recipe ${recipe.id}`;
    const station = stationById(recipe.station);
    if (!station) say(`${where}: unknown station "${recipe.station}"`);
    icon(recipe.result, where);
    ingredients(recipe.ingredients, where);
    if (!positiveInt(recipe.count)) say(`${where}: bad result count ${recipe.count}`);
    const size = recipe.ingredients.reduce((sum, i) => sum + i.count, 0);
    if (station && size > station.capacity) {
      say(`${where}: needs ${size} > capacity ${station.capacity}`);
    }
    if (!(recipe.seconds > 0)) say(`${where}: bad cook time`);
    const dish = content.dishes.find((d) => d.id === recipe.result);
    if (station?.states.liquid && !dish?.liquid) {
      say(`${where}: dish ${recipe.result} has no liquid colour (data/dishes.ts)`);
    }
  }
  for (const recipe of content.craftingRecipes) {
    const where = `crafting recipe ${recipe.id}`;
    icon(recipe.result, where);
    ingredients(recipe.ingredients, where);
    if (!positiveInt(recipe.count)) say(`${where}: bad result count ${recipe.count}`);
    if (recipe.ingredients.filter((i) => i.items.length > 1).length > 1) {
      say(`${where}: two slots with alternatives (one JSON recipe per alternative of one slot)`);
    }
  }
  const recipeIds = [...content.stationRecipes, ...content.craftingRecipes].map((r) => r.id);
  for (const id of duplicates(recipeIds)) say(`recipes: duplicate id "${id}"`);

  // Dishes
  const made = new Set(
    [...content.stationRecipes, ...content.craftingRecipes].map((r) => r.result),
  );
  for (const dish of content.dishes) {
    const where = `dish ${dish.id}`;
    icon(dish.id, where);
    if (dish.effect) {
      if (!content.effects[dish.effect.effect]) say(`${where}: effect has no family`);
      if (!(dish.effect.seconds > 0)) say(`${where}: bad effect duration`);
    }
    if (!made.has(dish.id)) say(`${where}: no recipe makes it`);
    if (dish.slices && !positiveInt(dish.slices.count)) say(`${where}: bad slice count`);
  }
  for (const id of duplicates(content.dishes.map((d) => d.id))) say(`dishes: duplicate id "${id}"`);
  for (const [name, family] of Object.entries(content.families)) {
    for (const key of [family.nameKey, family.hintKey]) {
      if (!key.startsWith("hk.family.")) say(`family ${name}: odd lang key ${key}`);
    }
  }

  // Reachability: every Harvest Kitchen ingredient comes from a crop, the board or a recipe.
  const obtainable = new Set<string>([
    ...content.crops.flatMap((c) => [c.produce, c.seed]),
    ...content.cuttingRecipes.map((r) => r.output),
    ...made,
  ]);
  for (const recipe of [...content.stationRecipes, ...content.craftingRecipes]) {
    for (const id of recipe.ingredients.flatMap((i) => i.items)) {
      if (id.startsWith("hk:") && !obtainable.has(id)) {
        say(`recipe ${recipe.id}: "${id}" can't be obtained`);
      }
    }
  }
  for (const recipe of content.cuttingRecipes) {
    if (!obtainable.has(recipe.input)) say(`cutting ${recipe.input}: input can't be obtained`);
  }
  for (const id of content.extraItems) icon(id, "station items");

  return problems;
}

/** Every item id the data names, with where (validate.ts checks each one is loaded). */
export function referencedItems(content: Content = CONTENT): { id: string; where: string }[] {
  const refs: { id: string; where: string }[] = [];
  const add = (where: string, ...ids: string[]) => {
    for (const id of ids) refs.push({ id, where });
  };
  for (const crop of content.crops) add(`crop ${crop.key}`, crop.produce, crop.seed);
  for (const r of content.cuttingRecipes) add(`cutting ${r.input}`, r.input, r.output);
  for (const station of content.stations) add(`station ${station.id}`, station.icon);
  for (const r of content.stationRecipes) {
    add(`station recipe ${r.id}`, r.result, ...r.ingredients.flatMap((i) => i.items));
  }
  for (const r of content.craftingRecipes) {
    add(`crafting recipe ${r.id}`, r.result, ...r.ingredients.flatMap((i) => i.items));
  }
  for (const dish of content.dishes) add(`dish ${dish.id}`, dish.id);
  add("station items", ...content.extraItems);
  return refs;
}

/** Every block id the data names, with the block states the scripts drive on it. */
export function referencedBlocks(
  content: Content = CONTENT,
): { id: string; where: string; states: string[] }[] {
  const refs: { id: string; where: string; states: string[] }[] = [];
  for (const crop of content.crops) {
    refs.push({ id: crop.block, where: `crop ${crop.key}`, states: [STATE_GROWTH] });
  }
  for (const station of content.stations) {
    const { fill, phase, hot, liquid } = station.states;
    const states = [fill?.name, phase, hot, liquid].filter((n): n is string => n !== undefined);
    refs.push({ id: station.block, where: `station ${station.id}`, states });
  }
  for (const dish of content.dishes) {
    if (dish.slices)
      refs.push({ id: dish.slices.block, where: `dish ${dish.id}`, states: [STATE_SLICES] });
  }
  refs.push({
    id: BLOCK_RECIPE_POSTER,
    where: "recipe poster",
    states: [STATE_POSTER, STATE_POSTER_PAGE, STATE_FACING],
  });
  refs.push({ id: BLOCK_KITCHEN_STOVE, where: "kitchen stove (heat)", states: [STATE_LIT] });
  for (const id of content.vanillaBlocks)
    refs.push({ id, where: "vanilla block list", states: [] });
  return refs;
}

import {
  BiomeTypes,
  BlockPermutation,
  BlockTypes,
  EffectTypes,
  ItemComponentTypes,
  ItemStack,
  ItemTypes,
} from "@minecraft/server";
import {
  ITEM_COOKING_POT,
  ITEM_CUTTING_BOARD,
  ITEM_RECIPE_BOOK,
  STATE_GROWTH,
  STATE_SLICES,
} from "../config";
import { HEAT_BLOCK_IDS } from "../stations/heat";
import { CROPS, SEED_DROP_BLOCKS, SOIL_BLOCKS } from "./crops";
import { DISHES, EFFECTS } from "./dishes";
import { itemIcon } from "./icons";
import {
  CRAFTING_RECIPES,
  CUTTING_RECIPES,
  STATION_RECIPES,
  recipeMaking,
  type Ingredient,
} from "./recipes";
import { STATIONS, stationById } from "./stations";

// The data modules are plain TS, so a typo in an id would only show up when a player hits it.
// This checks everything once at world load: ids, icons, lang key references, stations, block
// states the JSON must declare, food values against the item JSON, and that every recipe can be
// reached. Problems go to the Content Log, and because the log file loses its last 4 KB under
// mcpelauncher, they're also kept for /hk:debug validate and announced to operators on join.
//
// What a script can't check: whether a texture file exists or a lang key has a translation.
// Those were checked offline (see docs/harvest-kitchen/slice.md).
//
// Call from worldLoad: item, block and biome types aren't available during early execution.

let lastResult: readonly string[] = [];

export function lastValidation(): readonly string[] {
  return lastResult;
}

export function validateData(): readonly string[] {
  const problems: string[] = [];
  const say = (problem: string) => problems.push(problem);

  const item = (id: string, where: string) => {
    if (!ItemTypes.get(id)) say(`${where}: unknown item "${id}"`);
  };
  const block = (id: string, where: string) => {
    if (!BlockTypes.get(id)) say(`${where}: unknown block "${id}"`);
  };
  const icon = (id: string, where: string) => {
    if (!itemIcon(id)) say(`${where}: no icon for "${id}" (add it to data/icons.ts)`);
  };
  const states = (blockId: string, names: readonly string[], where: string) => {
    if (!BlockTypes.get(blockId)) return; // already reported
    try {
      const all = BlockPermutation.resolve(blockId).getAllStates();
      for (const name of names) {
        if (all[name] === undefined) say(`${where}: block ${blockId} lacks state "${name}"`);
      }
    } catch (error) {
      say(`${where}: can't resolve ${blockId}: ${String(error)}`);
    }
  };
  const ingredients = (list: readonly Ingredient[], where: string) => {
    const seen = new Set<string>();
    for (const { items, count } of list) {
      if (!Number.isInteger(count) || count < 1) say(`${where}: bad count ${count}`);
      if (items.length === 0) say(`${where}: ingredient with no items`);
      for (const id of items) {
        item(id, where);
        icon(id, where);
        if (seen.has(id)) say(`${where}: "${id}" is in two ingredient slots`);
        seen.add(id);
      }
    }
  };

  // Crops
  for (const crop of CROPS) {
    const where = `crop ${crop.key}`;
    item(crop.produce, where);
    item(crop.seed, where);
    icon(crop.produce, where);
    icon(crop.seed, where);
    block(crop.block, where);
    states(crop.block, [STATE_GROWTH], where);
    if (!crop.whereKey.startsWith("hk.crop.where.")) say(`${where}: odd lang key ${crop.whereKey}`);
    if (crop.type === "bush" && !crop.pick) say(`${where}: bush without pick counts`);
    if (crop.biomes.length === 0) say(`${where}: no biomes`);
    for (const biome of crop.biomes) {
      if (!BiomeTypes.get(biome)) say(`${where}: unknown biome "${biome}"`);
    }
  }
  for (const id of [...SEED_DROP_BLOCKS, ...SOIL_BLOCKS, ...HEAT_BLOCK_IDS]) {
    block(id, "vanilla block list");
  }
  if (new Set(CROPS.map((c) => c.key)).size !== CROPS.length) say("crops: duplicate key");

  // Cutting board
  for (const recipe of CUTTING_RECIPES) {
    const where = `cutting ${recipe.input}`;
    item(recipe.input, where);
    item(recipe.output, where);
    icon(recipe.output, where);
  }

  // Stations and their recipes
  for (const station of STATIONS) {
    const where = `station ${station.id}`;
    block(station.block, where);
    item(station.icon, where);
    const names = [station.states.fill?.name, station.states.phase, station.states.hot];
    states(
      station.block,
      names.filter((n): n is string => n !== undefined),
      where,
    );
    if (!STATION_RECIPES.some((r) => r.station === station.id)) say(`${where}: no recipes`);
  }
  for (const recipe of STATION_RECIPES) {
    const where = `station recipe ${recipe.id}`;
    const station = stationById(recipe.station);
    if (!station) say(`${where}: unknown station "${recipe.station}"`);
    item(recipe.result, where);
    icon(recipe.result, where);
    ingredients(recipe.ingredients, where);
    const size = recipe.ingredients.reduce((sum, i) => sum + i.count, 0);
    if (station && size > station.capacity) say(`${where}: needs ${size} > capacity`);
    if (!(recipe.seconds > 0)) say(`${where}: bad cook time`);
  }
  for (const recipe of CRAFTING_RECIPES) {
    const where = `crafting recipe ${recipe.id}`;
    item(recipe.result, where);
    icon(recipe.result, where);
    ingredients(recipe.ingredients, where);
  }
  const recipeIds = [...STATION_RECIPES, ...CRAFTING_RECIPES].map((r) => r.id);
  if (new Set(recipeIds).size !== recipeIds.length) say("recipes: duplicate id");

  // Dishes: effect, recipe, food values against the item JSON
  for (const dish of DISHES) {
    const where = `dish ${dish.id}`;
    item(dish.id, where);
    if (dish.effect) {
      if (!EffectTypes.get(dish.effect.effect)) say(`${where}: unknown effect`);
      if (!EFFECTS[dish.effect.effect]) say(`${where}: effect has no family`);
    }
    if (!recipeMaking(dish.id)) say(`${where}: no recipe makes it`);
    if (dish.slices) {
      block(dish.slices.block, where);
      states(dish.slices.block, [STATE_SLICES], where);
      continue;
    }
    if (!ItemTypes.get(dish.id)) continue;
    try {
      const food = new ItemStack(dish.id).getComponent(ItemComponentTypes.Food);
      if (!food) say(`${where}: item has no minecraft:food`);
      else {
        if (food.nutrition !== dish.nutrition) {
          say(`${where}: nutrition ${food.nutrition} in JSON, ${dish.nutrition} in data`);
        }
        if (food.canAlwaysEat !== dish.canAlwaysEat) say(`${where}: can_always_eat differs`);
        const container = dish.container?.split(":")[1];
        if (container && !food.usingConvertsTo.includes(container)) {
          say(`${where}: returns "${food.usingConvertsTo}", data says ${dish.container}`);
        }
      }
    } catch (error) {
      say(`${where}: can't read food: ${String(error)}`);
    }
  }

  // Reachability: every Harvest Kitchen ingredient comes from a crop, the board or a recipe.
  const obtainable = new Set<string>([
    ...CROPS.flatMap((c) => [c.produce, c.seed]),
    ...CUTTING_RECIPES.map((r) => r.output),
    ...STATION_RECIPES.map((r) => r.result),
    ...CRAFTING_RECIPES.map((r) => r.result),
  ]);
  for (const recipe of [...STATION_RECIPES, ...CRAFTING_RECIPES]) {
    for (const id of recipe.ingredients.flatMap((i) => i.items)) {
      if (id.startsWith("hk:") && !obtainable.has(id)) {
        say(`recipe ${recipe.id}: "${id}" can't be obtained`);
      }
    }
  }
  for (const recipe of CUTTING_RECIPES) {
    if (!obtainable.has(recipe.input)) say(`cutting ${recipe.input}: input can't be obtained`);
  }
  for (const id of [ITEM_RECIPE_BOOK, ITEM_COOKING_POT, ITEM_CUTTING_BOARD]) {
    item(id, "station items");
    icon(id, "station items");
  }

  for (const problem of problems) console.warn(`[harvest_kitchen] data: ${problem}`);
  console.log(`[harvest_kitchen] data check: ${problems.length} problem(s)`);
  lastResult = problems;
  return problems;
}

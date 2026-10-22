import {
  BiomeTypes,
  BlockPermutation,
  BlockTypes,
  EffectTypes,
  ItemComponentTypes,
  ItemStack,
  ItemTypes,
} from "@minecraft/server";
import { checkContent, referencedBlocks, referencedItems } from "./checks";
import { CROPS } from "./crops";
import { DISHES } from "./dishes";

// The data modules are plain TS, so a typo in an id would only show up when a player hits it.
// This checks everything once at world load. The game-independent half (duplicates, counts,
// capacity, icons, lang key prefixes, reachability) is checkContent in checks.ts, which the tests
// also run; this adds what needs the game: every item, block, block state, biome and effect the
// data names, and food values against the item JSON. Problems go to the Content Log, and because
// the log file loses its last 4 KB under mcpelauncher, they're also kept for /hk:debug validate
// and announced to operators on join.
//
// What a script can't check: whether a texture file exists or a lang key has a translation.
// Those were checked offline (see docs/harvest-kitchen/slice.md) and are covered by
// packs/harvest_kitchen/tests/pack-files.test.ts.
//
// Call from worldLoad: item, block and biome types aren't available during early execution.

let lastResult: readonly string[] = [];

export function lastValidation(): readonly string[] {
  return lastResult;
}

export function validateData(): readonly string[] {
  const problems: string[] = checkContent();
  const say = (problem: string) => problems.push(problem);

  for (const { id, where } of referencedItems()) {
    if (!ItemTypes.get(id)) say(`${where}: unknown item "${id}"`);
  }
  for (const { id, where, states } of referencedBlocks()) {
    if (!BlockTypes.get(id)) {
      say(`${where}: unknown block "${id}"`);
      continue;
    }
    if (states.length === 0) continue;
    try {
      const all = BlockPermutation.resolve(id).getAllStates();
      for (const name of states) {
        if (all[name] === undefined) say(`${where}: block ${id} lacks state "${name}"`);
      }
    } catch (error) {
      say(`${where}: can't resolve ${id}: ${String(error)}`);
    }
  }
  for (const crop of CROPS) {
    for (const biome of crop.biomes) {
      if (!BiomeTypes.get(biome)) say(`crop ${crop.key}: unknown biome "${biome}"`);
    }
  }

  // Dishes: effect type, food values against the item JSON
  for (const dish of DISHES) {
    const where = `dish ${dish.id}`;
    if (dish.effect && !EffectTypes.get(dish.effect.effect)) say(`${where}: unknown effect`);
    if (dish.slices || !ItemTypes.get(dish.id)) continue;
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

  for (const problem of problems) console.warn(`[harvest_kitchen] data: ${problem}`);
  console.log(`[harvest_kitchen] data check: ${problems.length} problem(s)`);
  lastResult = problems;
  return problems;
}

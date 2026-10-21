import { EffectTypes, ItemTypes } from "@minecraft/server";
import { SEED_SOURCES } from "./crops";
import { DISH_EFFECTS } from "./dishes";
import { COOKING_RECIPES, CUTTING_RECIPES } from "./recipes";

// The data modules are plain TS, so a typo in an item id would only show up when a player hits
// that recipe. Check every id once at world load and report problems to the Content Log.
// Call from worldLoad: item types aren't available during early execution.

export function validateData(): void {
  const problems: string[] = [];
  const item = (id: string, where: string) => {
    if (!ItemTypes.get(id)) problems.push(`${where}: unknown item "${id}"`);
  };

  for (const source of SEED_SOURCES) item(source.seed, "seed source");
  for (const recipe of CUTTING_RECIPES) {
    item(recipe.input, "cutting recipe input");
    item(recipe.output, "cutting recipe output");
  }
  for (const recipe of COOKING_RECIPES) {
    item(recipe.result, `cooking recipe ${recipe.id}`);
    for (const [id, count] of Object.entries(recipe.ingredients)) {
      item(id, `cooking recipe ${recipe.id}`);
      if (!Number.isInteger(count) || count < 1) {
        problems.push(`cooking recipe ${recipe.id}: bad count ${count} for "${id}"`);
      }
    }
  }

  for (const [dish, effects] of Object.entries(DISH_EFFECTS)) {
    item(dish, "dish");
    for (const { effect } of effects) {
      if (!EffectTypes.get(effect)) problems.push(`dish ${dish}: unknown effect "${effect}"`);
    }
  }

  for (const problem of problems) console.error(`[harvest_kitchen] data: ${problem}`);
}

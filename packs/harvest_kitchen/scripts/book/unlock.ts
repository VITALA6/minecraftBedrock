import { ITEM_COOKING_POT, ITEM_CUTTING_BOARD, ITEM_RECIPE_BOOK } from "../config";
import { CROPS } from "../data/crops";
import { DISHES } from "../data/dishes";
import { CRAFTING_RECIPES, CUTTING_RECIPES, STATION_RECIPES, recipeMaking } from "../data/recipes";

// The discovery rules (D3) as pure functions: which crop an item counts as finding, which crops a
// dish needs, the saved form of the found set, and when a dish unlocks. No @minecraft/server
// import, so tests run them in Node; discovery.ts reads and writes the player's property.

/** item id -> crop key, for every item that counts as finding a crop. */
const CROP_OF_ITEM = new Map<string, string>();
for (const crop of CROPS) {
  CROP_OF_ITEM.set(crop.produce, crop.key);
  CROP_OF_ITEM.set(crop.seed, crop.key);
}
for (const recipe of CUTTING_RECIPES) {
  const key = CROP_OF_ITEM.get(recipe.input);
  if (key) CROP_OF_ITEM.set(recipe.output, key);
}

/** The crop that getting `itemId` counts as finding: its seed, produce or prepared ingredient. */
export function cropOfItem(itemId: string): string | undefined {
  return CROP_OF_ITEM.get(itemId);
}

/** Crop keys a dish needs, through prepared ingredients and dish ingredients. */
function cropsFor(itemId: string, seen = new Set<string>()): Set<string> {
  const crops = new Set<string>();
  if (seen.has(itemId)) return crops;
  seen.add(itemId);
  const direct = CROP_OF_ITEM.get(itemId);
  if (direct) crops.add(direct);
  const made = recipeMaking(itemId);
  for (const ingredient of made?.recipe.ingredients ?? []) {
    for (const id of ingredient.items) for (const key of cropsFor(id, seen)) crops.add(key);
  }
  return crops;
}

const CROPS_OF_DISH = new Map<string, ReadonlySet<string>>(
  DISHES.map((dish) => [dish.id, cropsFor(dish.id)]),
);

export function cropsOfDish(dishId: string): ReadonlySet<string> {
  return CROPS_OF_DISH.get(dishId) ?? new Set();
}

/** Every Harvest Kitchen item id (the debug kit hands these out). */
export const HK_ITEM_IDS: readonly string[] = [
  ...new Set([
    ...CROPS.flatMap((crop) => [crop.produce, crop.seed]),
    ...CUTTING_RECIPES.map((recipe) => recipe.output),
    ...STATION_RECIPES.map((recipe) => recipe.result),
    ...CRAFTING_RECIPES.map((recipe) => recipe.result),
    ...DISHES.map((dish) => dish.id),
    ITEM_RECIPE_BOOK,
    ITEM_COOKING_POT,
    ITEM_CUTTING_BOARD,
  ]),
];

// --- the saved form: "tomato,onion" ---------------------------------------------------------------

/** Reads the hk:found property. Anything that isn't a string counts as nothing found. */
export function parseFound(raw: unknown): Set<string> {
  return new Set(typeof raw === "string" && raw.length > 0 ? raw.split(",") : []);
}

export function serializeFound(found: ReadonlySet<string>): string {
  return [...found].join(",");
}

// --- unlocking -----------------------------------------------------------------------------------

/** A dish unlocks once every HK crop it uses is found. Creative unlocks everything. */
export function isUnlocked(dishId: string, found: ReadonlySet<string>, creative: boolean): boolean {
  if (creative) return true;
  for (const key of cropsOfDish(dishId)) if (!found.has(key)) return false;
  return true;
}

/**
 * Adds `keys` to `found`. Returns the new set and the dishes that unlocked because of it, or
 * undefined when nothing was new (so nothing needs saving).
 */
export function addFound(
  found: ReadonlySet<string>,
  keys: readonly string[],
  creative: boolean,
): { found: Set<string>; unlocked: string[] } | undefined {
  const fresh = keys.filter((key) => !found.has(key));
  if (fresh.length === 0) return undefined;
  const next = new Set([...found, ...fresh]);
  const unlocked = DISHES.filter(
    (d) => !isUnlocked(d.id, found, creative) && isUnlocked(d.id, next, creative),
  ).map((d) => d.id);
  return { found: next, unlocked };
}

/** The "★ New recipe!" toast shows at most once per `cooldown` ticks per player. */
export function toastDue(lastTick: number | undefined, now: number, cooldown: number): boolean {
  return lastTick === undefined || now - lastTick >= cooldown;
}

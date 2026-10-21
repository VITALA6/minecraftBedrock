import { system, world, type Player } from "@minecraft/server";
import {
  ITEM_COOKING_POT,
  ITEM_CUTTING_BOARD,
  ITEM_RECIPE_BOOK,
  PLAYER_BOOK_GIVEN,
  PLAYER_FOUND_CROPS,
  SOUND,
  UNLOCK_TOAST_COOLDOWN_TICKS,
} from "../config";
import { CROPS } from "../data/crops";
import { DISHES } from "../data/dishes";
import { CRAFTING_RECIPES, CUTTING_RECIPES, STATION_RECIPES, recipeMaking } from "../data/recipes";
import { giveOrDrop, isCreative } from "../lib/inventory";
import { t } from "../lib/text";

// Discovery and unlock (D3). Every dish is listed in the book from the start; it unlocks once the
// player has found every Harvest Kitchen crop it uses (seed, produce or prepared ingredient all
// count as finding the crop). Found crops are a per-player dynamic property, updated from the
// stable playerInventoryItemChange event, so it works in existing worlds. Creative unlocks all.
//
// The same event hands out the recipe book the first time any Harvest Kitchen item enters a
// player's inventory.

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

export function foundCrops(player: Player): Set<string> {
  const raw = player.getDynamicProperty(PLAYER_FOUND_CROPS);
  return new Set(typeof raw === "string" && raw.length > 0 ? raw.split(",") : []);
}

export function isCropFound(player: Player, key: string): boolean {
  return isCreative(player) || foundCrops(player).has(key);
}

export function isDishUnlocked(player: Player, dishId: string, found = foundCrops(player)) {
  if (isCreative(player)) return true;
  for (const key of cropsOfDish(dishId)) if (!found.has(key)) return false;
  return true;
}

/** Marks crops found; returns the dishes that unlocked because of it. */
export function markFound(player: Player, keys: readonly string[]): string[] {
  const found = foundCrops(player);
  const fresh = keys.filter((key) => !found.has(key));
  if (fresh.length === 0) return [];
  const before = DISHES.filter((d) => isDishUnlocked(player, d.id, found)).map((d) => d.id);
  for (const key of fresh) found.add(key);
  player.setDynamicProperty(PLAYER_FOUND_CROPS, [...found].join(","));
  return DISHES.filter((d) => !before.includes(d.id) && isDishUnlocked(player, d.id, found)).map(
    (d) => d.id,
  );
}

/** Forgets what the player found and that they got the book (for tests). */
export function resetDiscovery(player: Player): void {
  player.setDynamicProperty(PLAYER_FOUND_CROPS, undefined);
  player.setDynamicProperty(PLAYER_BOOK_GIVEN, undefined);
}

const lastToast = new Map<string, number>();

function toastNewRecipe(player: Player): void {
  const now = system.currentTick;
  const last = lastToast.get(player.id);
  if (last !== undefined && now - last < UNLOCK_TOAST_COOLDOWN_TICKS) return;
  lastToast.set(player.id, now);
  // A title needs title text for the subtitle to show; "§r" renders nothing visible.
  player.onScreenDisplay.setTitle("§r", {
    subtitle: t("hk.toast.new_recipe"),
    fadeInDuration: 5,
    stayDuration: 40,
    fadeOutDuration: 10,
  });
  player.playSound(SOUND.pageTurn);
}

function giveBookOnce(player: Player, arrivedId: string): void {
  if (player.getDynamicProperty(PLAYER_BOOK_GIVEN) === true) return;
  player.setDynamicProperty(PLAYER_BOOK_GIVEN, true); // first, so the book's own arrival is a no-op
  if (arrivedId === ITEM_RECIPE_BOOK) return;
  giveOrDrop(player, ITEM_RECIPE_BOOK, 1, player.dimension, player.location);
  player.sendMessage(t("hk.book.given"));
}

export function registerDiscovery(): void {
  world.afterEvents.playerInventoryItemChange.subscribe(
    ({ player, itemStack }) => {
      // Filtered here rather than with includeItems: the subscription runs in early execution,
      // before item types exist, so a name filter there is an unproven risk.
      if (!itemStack?.typeId.startsWith("hk:") || !player.isValid) return;
      try {
        giveBookOnce(player, itemStack.typeId);
        const key = CROP_OF_ITEM.get(itemStack.typeId);
        if (key && markFound(player, [key]).length > 0 && !isCreative(player)) {
          toastNewRecipe(player);
        }
      } catch (error) {
        console.warn(`[harvest_kitchen] discovery for ${player.name}: ${String(error)}`);
      }
    },
    { ignoreQuantityChange: true },
  );
  world.afterEvents.playerLeave.subscribe(({ playerId }) => lastToast.delete(playerId));
}

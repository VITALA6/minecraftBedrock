import { system, world, type Player } from "@minecraft/server";
import {
  ITEM_RECIPE_BOOK,
  PLAYER_BOOK_GIVEN,
  PLAYER_FOUND_CROPS,
  SOUND,
  UNLOCK_TOAST_COOLDOWN_TICKS,
} from "../config";
import { countInventory, giveOrDrop, isCreative } from "../lib/inventory";
import { t } from "../lib/text";
import {
  addFound,
  cropOfItem,
  inventoryDiscovery,
  isUnlocked,
  parseFound,
  serializeFound,
  toastDue,
} from "./unlock";

// Discovery and unlock (D3). Every dish is listed in the book from the start; it unlocks once the
// player has found every Harvest Kitchen crop it uses (seed, produce or prepared ingredient all
// count as finding the crop). Found crops are a per-player dynamic property, updated from the
// stable playerInventoryItemChange event, so it works in existing worlds. Creative unlocks all.
//
// The same event hands out the recipe book the first time any Harvest Kitchen item enters a
// player's inventory. The rules (crops of a dish, unlocking, the saved form) are in unlock.ts.

export function foundCrops(player: Player): Set<string> {
  return parseFound(player.getDynamicProperty(PLAYER_FOUND_CROPS));
}

export function isCropFound(player: Player, key: string): boolean {
  return isCreative(player) || foundCrops(player).has(key);
}

export function isDishUnlocked(player: Player, dishId: string, found = foundCrops(player)) {
  return isUnlocked(dishId, found, isCreative(player));
}

/** Marks crops found; returns the dishes that unlocked because of it. */
export function markFound(player: Player, keys: readonly string[]): string[] {
  const result = addFound(foundCrops(player), keys, isCreative(player));
  if (!result) return [];
  player.setDynamicProperty(PLAYER_FOUND_CROPS, serializeFound(result.found));
  return result.unlocked;
}

/** Forgets what the player found and that they got the book (for tests). */
export function resetDiscovery(player: Player): void {
  player.setDynamicProperty(PLAYER_FOUND_CROPS, undefined);
  player.setDynamicProperty(PLAYER_BOOK_GIVEN, undefined);
}

const lastToast = new Map<string, number>();

function toastNewRecipe(player: Player): void {
  const now = system.currentTick;
  if (!toastDue(lastToast.get(player.id), now, UNLOCK_TOAST_COOLDOWN_TICKS)) return;
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

/**
 * Catches up on what the player already carries. The inventory event only reports slots whose
 * item changes (quantity changes are ignored), so HK items held from before (a missing or reset
 * property, an older version of the pack) would never count. Call on the initial spawn.
 */
export function catchUpDiscovery(player: Player): void {
  try {
    const seen = inventoryDiscovery(Object.keys(countInventory(player)));
    if (seen.anyHk) giveBookOnce(player, seen.hasBook ? ITEM_RECIPE_BOOK : "");
    if (markFound(player, seen.crops).length > 0 && !isCreative(player)) toastNewRecipe(player);
  } catch (error) {
    console.warn(`[harvest_kitchen] discovery catch-up for ${player.name}: ${String(error)}`);
  }
}

export function registerDiscovery(): void {
  world.afterEvents.playerInventoryItemChange.subscribe(
    ({ player, itemStack }) => {
      // Filtered here rather than with includeItems: the subscription runs in early execution,
      // before item types exist, so a name filter there is an unproven risk.
      if (!itemStack?.typeId.startsWith("hk:") || !player.isValid) return;
      try {
        giveBookOnce(player, itemStack.typeId);
        const key = cropOfItem(itemStack.typeId);
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

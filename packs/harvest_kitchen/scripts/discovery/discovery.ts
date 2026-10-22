import { system, world, type Player } from "@minecraft/server";
import {
  ITEM_RECIPE_POSTER,
  PLAYER_FOUND_CROPS,
  PLAYER_POSTER_GIVEN,
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

// Discovery and unlock (D3). A dish unlocks once the player has found every Harvest Kitchen crop
// it uses (seed, produce or prepared ingredient all count as finding the crop); recipe posters
// cycle through the unlocked ones (posters/). Found crops are a per-player dynamic property,
// updated from the stable playerInventoryItemChange event, so it works in existing worlds.
// Creative unlocks all.
//
// The same event hands out one Recipe Poster the first time any Harvest Kitchen item enters a
// player's inventory (D15; it replaced the recipe book hand-out). The rules (crops of a dish,
// unlocking, the saved form) are in unlock.ts.

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

/** Forgets what the player found and that they got the starter poster (for tests). */
export function resetDiscovery(player: Player): void {
  player.setDynamicProperty(PLAYER_FOUND_CROPS, undefined);
  player.setDynamicProperty(PLAYER_POSTER_GIVEN, undefined);
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

function givePosterOnce(player: Player, arrivedId: string): void {
  if (player.getDynamicProperty(PLAYER_POSTER_GIVEN) === true) return;
  // Set first, so the poster's own arrival below is a no-op; a crafted or /give poster counts.
  player.setDynamicProperty(PLAYER_POSTER_GIVEN, true);
  if (arrivedId === ITEM_RECIPE_POSTER) return;
  giveOrDrop(player, ITEM_RECIPE_POSTER, 1, player.dimension, player.location);
  player.sendMessage(t("hk.poster.given"));
}

/**
 * Catches up on what the player already carries. The inventory event only reports slots whose
 * item changes (quantity changes are ignored), so HK items held from before (a missing or reset
 * property, an older version of the pack) would never count. Call on the initial spawn.
 */
export function catchUpDiscovery(player: Player): void {
  try {
    const seen = inventoryDiscovery(Object.keys(countInventory(player)));
    if (seen.anyHk) givePosterOnce(player, seen.hasPoster ? ITEM_RECIPE_POSTER : "");
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
        givePosterOnce(player, itemStack.typeId);
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

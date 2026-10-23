import {
  EntityComponentTypes,
  EquipmentSlot,
  GameMode,
  ItemStack,
  type Container,
  type Dimension,
  type Player,
  type Vector3,
} from "@minecraft/server";

export function getHeldItem(player: Player): ItemStack | undefined {
  return player.getComponent(EntityComponentTypes.Equippable)?.getEquipment(EquipmentSlot.Mainhand);
}

/**
 * Removes `count` of the held item. Returns false (and changes nothing) if the hand no longer
 * holds at least that many of `typeId`, so callers can pass a stale reading safely.
 */
export function consumeHeldItem(player: Player, typeId: string, count = 1): boolean {
  const equippable = player.getComponent(EntityComponentTypes.Equippable);
  const held = equippable?.getEquipment(EquipmentSlot.Mainhand);
  if (!equippable || held?.typeId !== typeId || held.amount < count) return false;
  if (held.amount === count) {
    equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
  } else {
    held.amount -= count;
    equippable.setEquipment(EquipmentSlot.Mainhand, held);
  }
  return true;
}

export function isCreative(player: Player): boolean {
  return player.getGameMode() === GameMode.Creative;
}

export function inventoryOf(player: Player): Container | undefined {
  const container = player.getComponent(EntityComponentTypes.Inventory)?.container;
  return container?.isValid ? container : undefined;
}

/** item id -> total count across the player's inventory (hotbar included). */
export function countInventory(player: Player): Record<string, number> {
  const counts: Record<string, number> = {};
  const container = inventoryOf(player);
  if (!container) return counts;
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item) counts[item.typeId] = (counts[item.typeId] ?? 0) + item.amount;
  }
  return counts;
}

/** Drops `count` of `typeId` as item entities at `location`, in max-size stacks. */
export function dropItems(dimension: Dimension, location: Vector3, typeId: string, count: number) {
  const stackSize = new ItemStack(typeId).maxAmount;
  for (let left = count; left > 0; left -= stackSize) {
    dimension.spawnItem(new ItemStack(typeId, Math.min(stackSize, left)), location);
  }
}

/**
 * Puts `count` of `typeId` in the player's hand if it's empty, else in the inventory; whatever
 * doesn't fit drops at `dropAt`. Never loses items: anything not placed is dropped, and a player
 * who left in the meantime (a deferred hand-out) gets it all dropped at `dropAt` instead of an
 * error halfway through.
 */
export function giveOrDrop(
  player: Player,
  typeId: string,
  count: number,
  dimension: Dimension,
  dropAt: Vector3,
  preferHand = false,
) {
  if (!player.isValid) {
    dropItems(dimension, dropAt, typeId, count);
    return;
  }
  const stackSize = new ItemStack(typeId).maxAmount;
  let left = count;

  if (preferHand) {
    const equippable = player.getComponent(EntityComponentTypes.Equippable);
    if (equippable && !equippable.getEquipment(EquipmentSlot.Mainhand)) {
      const batch = Math.min(stackSize, left);
      equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack(typeId, batch));
      left -= batch;
    }
  }

  const container = inventoryOf(player);
  if (!container && left > 0) {
    console.warn(`[simmerfield] ${player.name}'s inventory unavailable; dropping ${typeId}`);
  }
  while (left > 0 && container) {
    const batch = Math.min(stackSize, left);
    const leftover = container.addItem(new ItemStack(typeId, batch));
    left -= batch - (leftover?.amount ?? 0);
    if (leftover) break;
  }
  if (left > 0) dropItems(dimension, dropAt, typeId, left);
}

export function distance(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

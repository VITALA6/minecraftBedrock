import {
  EntityComponentTypes,
  EquipmentSlot,
  GameMode,
  ItemStack,
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

/** Drops `count` of `typeId` as item entities at `location`, in max-size stacks. */
export function dropItems(dimension: Dimension, location: Vector3, typeId: string, count: number) {
  const stackSize = new ItemStack(typeId).maxAmount;
  for (let left = count; left > 0; left -= stackSize) {
    dimension.spawnItem(new ItemStack(typeId, Math.min(stackSize, left)), location);
  }
}

/** Puts `count` of `typeId` in the player's inventory; whatever doesn't fit drops at `dropAt`. */
export function giveOrDrop(
  player: Player,
  typeId: string,
  count: number,
  dimension: Dimension,
  dropAt: Vector3,
) {
  const container = player.getComponent(EntityComponentTypes.Inventory)?.container;
  if (!container?.isValid) {
    console.warn(`[harvest_kitchen] ${player.name}'s inventory unavailable; dropping ${typeId}`);
  }
  const stackSize = new ItemStack(typeId).maxAmount;
  let left = count;
  while (left > 0 && container?.isValid) {
    const batch = Math.min(stackSize, left);
    const leftover = container.addItem(new ItemStack(typeId, batch));
    left -= batch - (leftover?.amount ?? 0);
    if (leftover) break;
  }
  if (left > 0) dropItems(dimension, dropAt, typeId, left);
}

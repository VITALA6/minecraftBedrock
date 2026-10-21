import { EntityComponentTypes, ItemStack, type Container, type Player } from "@minecraft/server";

export function getContainer(player: Player): Container | undefined {
  const container = player.getComponent(EntityComponentTypes.Inventory)?.container;
  return container?.isValid ? container : undefined;
}

/** How many items of `typeId` still fit: empty slots plus room left in matching stacks. */
export function capacityFor(container: Container, typeId: string): number {
  const probe = new ItemStack(typeId);
  let room = 0;
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (!item) room += probe.maxAmount;
    else if (item.isStackableWith(probe)) room += item.maxAmount - item.amount;
  }
  return room;
}

/** Adds `count` items in max-size stacks. Returns how many did NOT fit (0 on success). */
export function giveItems(container: Container, typeId: string, count: number): number {
  const stackSize = new ItemStack(typeId).maxAmount;
  let remaining = count;
  while (remaining > 0) {
    const batch = Math.min(stackSize, remaining);
    const leftover = container.addItem(new ItemStack(typeId, batch));
    remaining -= batch - (leftover?.amount ?? 0);
    if (leftover) break;
  }
  return remaining;
}

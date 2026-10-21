import { system, world, type Block } from "@minecraft/server";
import { BLOCK_RUBY, OWNER_PROPERTY_PREFIX } from "../config";

// Who placed each ruby block, stored as world dynamic properties keyed by position:
//   "myteam:owner:minecraft:overworld:10,64,-3" -> '{"id":"-4294967295","name":"Steve"}'
// Limitation: blocks placed by commands have no owner (anyone can break them), and an explosion
// or piston leaves a stale entry, which the next placement at that spot overwrites.

interface Owner {
  readonly id: string;
  readonly name: string;
}

function ownerKey(block: Block): string {
  const { x, y, z } = block.location;
  return `${OWNER_PROPERTY_PREFIX}${block.dimension.id}:${x},${y},${z}`;
}

function isOwner(value: unknown): value is Owner {
  if (typeof value !== "object" || value === null) return false;
  const { id, name } = value as Record<string, unknown>;
  return typeof id === "string" && typeof name === "string";
}

function readOwner(block: Block): Owner | undefined {
  const raw = world.getDynamicProperty(ownerKey(block));
  if (typeof raw !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isOwner(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function registerBlockProtection(): void {
  world.afterEvents.playerPlaceBlock.subscribe(
    ({ block, player }) => {
      const owner: Owner = { id: player.id, name: player.name };
      world.setDynamicProperty(ownerKey(block), JSON.stringify(owner));
    },
    { blockTypes: [BLOCK_RUBY] },
  );

  // Before-events run before the action happens and can cancel it, but in restricted
  // ("read-only") mode: reading is fine, changing the world is not. Defer changes with system.run.
  world.beforeEvents.playerBreakBlock.subscribe(
    (event) => {
      const owner = readOwner(event.block);
      if (!owner || owner.id === event.player.id) return;

      event.cancel = true;
      const { player } = event;
      system.run(() => {
        if (player.isValid) player.sendMessage(`§cThis ruby block belongs to ${owner.name}.`);
      });
    },
    { blockTypes: [BLOCK_RUBY] },
  );

  // After the break, the block is already air, so check the permutation that was broken.
  world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (brokenBlockPermutation.type.id !== BLOCK_RUBY) return;
    world.setDynamicProperty(ownerKey(block), undefined);
  });
}

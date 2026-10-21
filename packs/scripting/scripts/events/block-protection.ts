import { system, world, type Block } from "@minecraft/server";
import { BLOCK_RUBY, OWNER_PROPERTY_PREFIX } from "../config";

// Who placed each ruby block, stored as world dynamic properties keyed by position:
//   "myteam:owner:minecraft:overworld:10,64,-3" -> '{"id":"-4294967295","name":"Steve"}'
//
// Ways around the protection, and how each is closed:
//   - pistons:    the block JSON sets minecraft:movable to "immovable"
//   - explosions: owned ruby blocks are removed from the explosion's impacted blocks below
//   - commands (/setblock, /fill): operators only, which is intended
// Blocks placed by commands have no owner, so anyone can break them.
// Each placed block costs one property (~90 bytes); ruby blocks cost coins or rubies, which keeps
// the registry small for this learning pack.

interface Owner {
  readonly id: string;
  readonly name: string;
}

// Stands in for an owner record that exists but can't be read: treat the block as protected.
const UNKNOWN_OWNER: Owner = { id: "", name: "an unknown player" };

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
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return UNKNOWN_OWNER;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isOwner(parsed) ? parsed : UNKNOWN_OWNER;
  } catch {
    return UNKNOWN_OWNER;
  }
}

export function registerBlockProtection(): void {
  world.afterEvents.playerPlaceBlock.subscribe(
    ({ block, player }) => {
      const owner: Owner = { id: player.id, name: player.name };
      try {
        world.setDynamicProperty(ownerKey(block), JSON.stringify(owner));
      } catch (error) {
        console.error(`[protection] could not record owner: ${String(error)}`);
        player.sendMessage("§cCouldn't record you as this block's owner; it is unprotected.");
      }
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

  // Explosions don't go through playerBreakBlock. Spare owned ruby blocks, let the rest blow up.
  world.beforeEvents.explosion.subscribe((event) => {
    const impacted = event.getImpactedBlocks();
    const kept = impacted.filter((block) => block.typeId !== BLOCK_RUBY || !readOwner(block));
    if (kept.length !== impacted.length) event.setImpactedBlocks(kept);
  });

  // After the break, the block is already air, so check the permutation that was broken.
  world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (brokenBlockPermutation.type.id !== BLOCK_RUBY) return;
    world.setDynamicProperty(ownerKey(block), undefined);
  });
}

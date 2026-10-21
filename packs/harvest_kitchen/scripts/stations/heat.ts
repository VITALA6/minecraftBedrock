import type { Block } from "@minecraft/server";

// Heat below a station (D5): campfire and soul campfire (lit only), fire, soul fire, magma and
// lava. Block ids checked on 2026-10-21 against the 1.26.52.3 vanilla blocks.json files; the
// campfire's "extinguished" state name is in the 1.26.52.3 binary.

const HEAT_BLOCKS: ReadonlySet<string> = new Set([
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:magma",
  "minecraft:lava",
  "minecraft:flowing_lava",
]);

export const HEAT_BLOCK_IDS: readonly string[] = [...HEAT_BLOCKS];

export function isHeatSource(block: Block | undefined): boolean {
  if (!block || !HEAT_BLOCKS.has(block.typeId)) return false;
  // A campfire put out with a shovel or water keeps its id; only the state changes.
  return block.permutation.getAllStates().extinguished !== true;
}

export function hasHeatBelow(block: Block): boolean {
  try {
    return isHeatSource(block.below());
  } catch {
    return false; // below the world, or an unloaded chunk
  }
}

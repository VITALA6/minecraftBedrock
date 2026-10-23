// Heat below a station (D5): campfire and soul campfire (lit only), fire, soul fire, magma and
// lava, and our Kitchen Stove while it's switched on (D22). Block ids checked on 2026-10-21
// against the 1.26.52.3 vanilla blocks.json files; the campfire's "extinguished" state name is in
// the 1.26.52.3 binary.
//
// No @minecraft/server import: a Block fits HeatBlock structurally, so tests can pass plain
// objects (packs/harvest_kitchen/tests/heat.test.ts).

/** The parts of a Block the heat rule reads. */
export interface HeatBlock {
  readonly typeId: string;
  readonly permutation: { getAllStates(): Record<string, boolean | number | string> };
  below(): HeatBlock | undefined;
}

import { BLOCK_KITCHEN_STOVE, STATE_LIT } from "../config";

const HEAT_BLOCKS: ReadonlySet<string> = new Set([
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:magma",
  "minecraft:lava",
  "minecraft:flowing_lava",
  BLOCK_KITCHEN_STOVE,
]);

export const HEAT_BLOCK_IDS: readonly string[] = [...HEAT_BLOCKS];

/** Whether a block with this id and these states heats a station above it. */
export function isHeat(
  typeId: string,
  states: Readonly<Record<string, boolean | number | string>>,
): boolean {
  // A campfire put out with a shovel or water, or a stove switched off, keeps its id; only the
  // state changes.
  return HEAT_BLOCKS.has(typeId) && states.extinguished !== true && states[STATE_LIT] !== false;
}

export function isHeatSource(block: HeatBlock | undefined): boolean {
  return (
    !!block &&
    HEAT_BLOCKS.has(block.typeId) &&
    isHeat(block.typeId, block.permutation.getAllStates())
  );
}

export function hasHeatBelow(block: HeatBlock): boolean {
  try {
    return isHeatSource(block.below());
  } catch {
    return false; // below the world, or an unloaded chunk
  }
}

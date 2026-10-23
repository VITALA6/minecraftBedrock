import {
  system,
  type Block,
  type BlockComponentRegistry,
  type BlockCustomComponent,
} from "@minecraft/server";
import { BLOCK_KITCHEN_STOVE, COMPONENT_STOVE, SOUND, STATE_LIT } from "../config";
import { sound } from "../lib/feedback";
import { getState, setState } from "../lib/block-states";
import { refreshAbove } from "./container-station";

// hk:stove: the Kitchen Stove (D22) is a heat source only while it's switched on (heat.ts reads
// hk:lit). Using it switches it on or off; the block JSON swaps the oven window and the light.
// Sneak to place a block, such as the cooking pot, on top of it.

function toggle(block: Block): void {
  if (!block.isValid || block.typeId !== BLOCK_KITCHEN_STOVE) return; // broken within the tick
  const lit = getState(block, STATE_LIT) === true;
  setState(block, STATE_LIT, !lit);
  const centre = block.center();
  sound(block.dimension, lit ? SOUND.fizz : SOUND.ignite, centre);
  refreshAbove(block);
}

const stove: BlockCustomComponent = {
  onPlayerInteract({ block }) {
    // setPermutation can't run in restricted execution: switch on the next tick.
    system.run(() => toggle(block));
  },
};

export function registerStove(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_STOVE, stove);
}

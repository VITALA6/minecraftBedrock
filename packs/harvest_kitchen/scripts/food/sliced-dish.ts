import type { BlockComponentRegistry, BlockCustomComponent } from "@minecraft/server";
import { COMPONENT_SLICED_DISH, PARTICLE, SOUND, STATE_SLICES } from "../config";
import { dishBySliceBlock } from "../data/dishes";
import { getNumberState, setState } from "../lib/block-states";
import { particle, sound } from "../lib/feedback";
import { applyEffect, feed } from "./feed";

// Placeable dishes eaten one slice at a time (plan §2.6, §5.2): the Strawberry Cake now, pies and
// pizza later. The block JSON declares "hk:slices" (slices eaten, 0..count-1), drives the model
// with bone_visibility, and lists the "hk:sliced_dish": {} marker. Slice count, food and effect
// come from the dish's entry in data/dishes.ts, so a new placeable dish is config only.
//
// Anyone can eat a slice at any hunger level, so a group shares one cake. The last slice removes
// the block.

const slicedDish: BlockCustomComponent = {
  onPlayerInteract({ block, dimension, player }) {
    if (!player) return;
    const dish = dishBySliceBlock(block.typeId);
    const slices = dish?.slices;
    if (!dish || !slices) {
      console.warn(`[harvest_kitchen] ${block.typeId} has ${COMPONENT_SLICED_DISH} but no dish`);
      return;
    }
    const eaten = getNumberState(block, STATE_SLICES) ?? 0;
    const center = block.center();

    feed(player, slices.nutrition, slices.saturation);
    applyEffect(player, dish.effect);
    sound(dimension, SOUND.eat, center);
    sound(dimension, SOUND.chime, center, { volume: 0.5, pitch: 1.4 });
    particle(dimension, PARTICLE.hearts, { ...center, y: center.y + 0.3 }, 2, 0.3);

    if (eaten + 1 >= slices.count) block.setType("minecraft:air");
    else setState(block, STATE_SLICES, eaten + 1);
  },
};

export function registerSlicedDish(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_SLICED_DISH, slicedDish);
}

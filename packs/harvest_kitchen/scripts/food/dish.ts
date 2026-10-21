import {
  TicksPerSecond,
  type ItemComponentRegistry,
  type ItemCustomComponent,
} from "@minecraft/server";
import { COMPONENT_DISH } from "../config";
import { DISH_EFFECTS } from "../data/dishes";

// Status effects for dishes. The 1.26.30 item format's minecraft:food has no "effects" field, so
// each dish's JSON lists the "hk:dish": {} marker and the effects come from data/dishes.ts.

const dish: ItemCustomComponent = {
  onConsume({ itemStack, source }) {
    const effects = DISH_EFFECTS[itemStack.typeId];
    if (!effects) {
      console.warn(`[harvest_kitchen] ${itemStack.typeId} has ${COMPONENT_DISH} but no effects`);
      return;
    }
    for (const { effect, seconds, amplifier } of effects) {
      source.addEffect(effect, Math.round(seconds * TicksPerSecond), { amplifier });
    }
  },
};

export function registerDish(registry: ItemComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_DISH, dish);
}

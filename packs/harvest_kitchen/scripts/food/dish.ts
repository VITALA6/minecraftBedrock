import type { ItemComponentRegistry, ItemCustomComponent } from "@minecraft/server";
import { COMPONENT_DISH } from "../config";
import { findDish } from "../data/dishes";
import { applyEffect } from "./feed";

// Status effects for dishes. The 1.26.30 item format's minecraft:food has no "effects" field, so
// each dish's JSON lists the "hk:dish": {} marker and the effect comes from data/dishes.ts.
// Food, saturation, "can always eat" and the returned container are plain minecraft:food JSON.

const dish: ItemCustomComponent = {
  onConsume({ itemStack, source }) {
    const entry = findDish(itemStack.typeId);
    if (!entry) {
      console.warn(`[harvest_kitchen] ${itemStack.typeId} has ${COMPONENT_DISH} but no dish entry`);
      return;
    }
    applyEffect(source, entry.effect);
  },
};

export function registerDish(registry: ItemComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_DISH, dish);
}

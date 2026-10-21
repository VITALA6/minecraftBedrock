import { ITEM_SALAD, ITEM_STUFFED_TOMATO, ITEM_TOMATO_SOUP } from "../config";

// Status effects granted when a dish is eaten. Nutrition and saturation live in each item's JSON
// (minecraft:food), which also lists the "hk:dish": {} marker component that triggers these.
// The effects can't go in that component's JSON params: the game rejects params nested as deep
// as a list of objects ("Exceeded the object and array depth limit") and drops the whole item.

export interface DishEffect {
  readonly effect: string;
  readonly seconds: number;
  /** 0 = level I. */
  readonly amplifier: number;
}

export const DISH_EFFECTS: Readonly<Record<string, readonly DishEffect[]>> = {
  [ITEM_TOMATO_SOUP]: [{ effect: "minecraft:regeneration", seconds: 8, amplifier: 0 }],
  [ITEM_SALAD]: [{ effect: "minecraft:speed", seconds: 60, amplifier: 0 }],
  [ITEM_STUFFED_TOMATO]: [{ effect: "minecraft:absorption", seconds: 60, amplifier: 0 }],
};

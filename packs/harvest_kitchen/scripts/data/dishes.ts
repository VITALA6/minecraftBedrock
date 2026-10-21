import {
  BLOCK_STRAWBERRY_CAKE,
  ITEM_CHICKEN_SOUP,
  ITEM_CHILI_STEW,
  ITEM_FARMERS_SANDWICH,
  ITEM_FISH_CHOWDER,
  ITEM_GARDEN_SALAD,
  ITEM_ONION_SOUP,
  ITEM_SALSA,
  ITEM_STRAWBERRY_CAKE,
  ITEM_STRAWBERRY_CUP,
  ITEM_STRAWBERRY_JAM,
  ITEM_TOMATO_SOUP,
  ITEM_VEGETABLE_STEW,
  ITEM_VEGGIE_SANDWICH,
} from "../config";

// Every dish (plan §1.3). Nutrition, saturation and "can always eat" also live in each item's
// JSON (minecraft:food); they are repeated here so the book can show them and data/validate.ts
// can catch the two drifting apart. The effect lives only here: the 1.26.30 item format has no
// food effects, and custom component params can't hold a list of objects (plan §5.1), so the
// "hk:dish" item component applies it on eat.

/** Effect families by colour (plan §1.4). */
export type Family = "heal" | "move" | "work" | "explore";

export interface FamilyInfo {
  /** Coloured glyph from the vanilla glyph pages (S2: renders in the HUD and forms). */
  readonly glyph: string;
  readonly nameKey: string;
  /** Book hint shown when the effect button is tapped. */
  readonly hintKey: string;
  readonly icon: string;
}

export const FAMILIES: Readonly<Record<Family, FamilyInfo>> = {
  heal: {
    glyph: "§c❤§r",
    nameKey: "hk.family.heal",
    hintKey: "hk.family.heal.hint",
    icon: "textures/hk/ui/family_heal",
  },
  move: {
    glyph: "§9▶§r",
    nameKey: "hk.family.move",
    hintKey: "hk.family.move.hint",
    icon: "textures/hk/ui/family_move",
  },
  work: {
    glyph: "§e■§r",
    nameKey: "hk.family.work",
    hintKey: "hk.family.work.hint",
    icon: "textures/hk/ui/family_work",
  },
  explore: {
    glyph: "§a●§r",
    nameKey: "hk.family.explore",
    hintKey: "hk.family.explore.hint",
    icon: "textures/hk/ui/family_explore",
  },
};

export interface EffectInfo {
  readonly family: Family;
  /** Vanilla lang key for the effect's name, so it's localized for free. */
  readonly nameKey: string;
}

/** Effects dishes may give, with their family. No Strength, Resistance II or Instant Health. */
export const EFFECTS: Readonly<Record<string, EffectInfo>> = {
  "minecraft:regeneration": { family: "heal", nameKey: "potion.regeneration" },
  "minecraft:absorption": { family: "heal", nameKey: "potion.absorption" },
  "minecraft:health_boost": { family: "heal", nameKey: "potion.healthBoost" },
  "minecraft:speed": { family: "move", nameKey: "potion.moveSpeed" },
  "minecraft:jump_boost": { family: "move", nameKey: "potion.jump" },
  "minecraft:slow_falling": { family: "move", nameKey: "potion.slowFalling" },
  "minecraft:haste": { family: "work", nameKey: "potion.digSpeed" },
  "minecraft:night_vision": { family: "explore", nameKey: "potion.nightVision" },
  "minecraft:water_breathing": { family: "explore", nameKey: "potion.waterBreathing" },
  "minecraft:fire_resistance": { family: "explore", nameKey: "potion.fireResistance" },
};

export interface DishEffect {
  readonly effect: string;
  readonly seconds: number;
  /** 0 = level I. */
  readonly amplifier: number;
}

/** A placeable dish eaten one slice at a time (block component "hk:sliced_dish"). */
export interface Slices {
  readonly block: string;
  readonly count: number;
  readonly nutrition: number;
  readonly saturation: number;
}

export interface Dish {
  readonly id: string;
  /** Per serving; for a sliced dish, per slice (see `slices`). */
  readonly nutrition: number;
  readonly canAlwaysEat: boolean;
  /** What's left in the hand after eating (minecraft:food using_converts_to). */
  readonly container?: string;
  readonly effect?: DishEffect;
  readonly slices?: Slices;
}

const effect = (id: string, seconds: number): DishEffect => ({
  effect: `minecraft:${id}`,
  seconds,
  amplifier: 0,
});

export const DISHES: readonly Dish[] = [
  // pot
  {
    id: ITEM_TOMATO_SOUP,
    nutrition: 6,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("regeneration", 8),
  },
  {
    id: ITEM_VEGETABLE_STEW,
    nutrition: 10,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("regeneration", 15),
  },
  {
    id: ITEM_CHILI_STEW,
    nutrition: 10,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("fire_resistance", 120),
  },
  {
    id: ITEM_FISH_CHOWDER,
    nutrition: 8,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("water_breathing", 120),
  },
  {
    id: ITEM_CHICKEN_SOUP,
    nutrition: 8,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("absorption", 60),
  },
  {
    id: ITEM_ONION_SOUP,
    nutrition: 7,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("night_vision", 120),
  },
  {
    id: ITEM_STRAWBERRY_JAM,
    nutrition: 4,
    canAlwaysEat: true,
    container: "minecraft:glass_bottle",
    effect: effect("speed", 60),
  },
  // crafting table
  {
    id: ITEM_GARDEN_SALAD,
    nutrition: 6,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("speed", 90),
  },
  {
    id: ITEM_SALSA,
    nutrition: 4,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("haste", 90),
  },
  { id: ITEM_VEGGIE_SANDWICH, nutrition: 7, canAlwaysEat: false },
  { id: ITEM_FARMERS_SANDWICH, nutrition: 10, canAlwaysEat: false },
  {
    id: ITEM_STRAWBERRY_CUP,
    nutrition: 5,
    canAlwaysEat: true,
    container: "minecraft:bowl",
    effect: effect("jump_boost", 60),
  },
  // placeable: 4 slices, each 3 food + Regeneration I 5 s, edible at full hunger
  {
    id: ITEM_STRAWBERRY_CAKE,
    nutrition: 3,
    canAlwaysEat: true,
    effect: effect("regeneration", 5),
    slices: { block: BLOCK_STRAWBERRY_CAKE, count: 4, nutrition: 3, saturation: 0.4 },
  },
];

export function findDish(id: string): Dish | undefined {
  return DISHES.find((dish) => dish.id === id);
}

export function dishBySliceBlock(blockId: string): Dish | undefined {
  return DISHES.find((dish) => dish.slices?.block === blockId);
}

export function familyOf(dish: Dish): FamilyInfo | undefined {
  const info = dish.effect && EFFECTS[dish.effect.effect];
  return info && FAMILIES[info.family];
}

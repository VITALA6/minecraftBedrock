// Texture paths for ActionFormData button icons (forms take a texture path, ours or vanilla).
//
// - Our items follow the texture layout: hk:<name> -> textures/hk/items/<name>.
// - Vanilla items often don't match their id (cooked beef is textures/items/beef_cooked), so each
//   vanilla item the recipes use is listed here. validate.ts checks every ingredient has one.
//
// Every vanilla path below was checked against the 1.26.52.3 vanilla resource pack
// (textures_list.json / contents.json): on 2026-10-21, mutton_raw and stick on 2026-10-22. The
// game can't tell a script whether a texture exists, so new paths must be checked the same way.

export const VANILLA_ITEM_ICONS: Readonly<Record<string, string>> = {
  "minecraft:bowl": "textures/items/bowl",
  "minecraft:carrot": "textures/items/carrot",
  "minecraft:potato": "textures/items/potato",
  "minecraft:beef": "textures/items/beef_raw",
  "minecraft:cod": "textures/items/fish_raw",
  "minecraft:salmon": "textures/items/fish_salmon_raw",
  "minecraft:chicken": "textures/items/chicken_raw",
  "minecraft:mutton": "textures/items/mutton_raw",
  "minecraft:bread": "textures/items/bread",
  "minecraft:sugar": "textures/items/sugar",
  "minecraft:glass_bottle": "textures/items/potion_bottle_empty",
  "minecraft:cooked_porkchop": "textures/items/porkchop_cooked",
  "minecraft:cake": "textures/items/cake",
  "minecraft:stick": "textures/items/stick",
  "minecraft:campfire": "textures/items/campfire",
};

/** Vanilla HUD effect icons: textures/ui/<effect>_effect. */
export const EFFECT_ICONS: Readonly<Record<string, string>> = {
  "minecraft:regeneration": "textures/ui/regeneration_effect",
  "minecraft:absorption": "textures/ui/absorption_effect",
  "minecraft:health_boost": "textures/ui/health_boost_effect",
  "minecraft:speed": "textures/ui/speed_effect",
  "minecraft:jump_boost": "textures/ui/jump_boost_effect",
  "minecraft:slow_falling": "textures/ui/slow_falling_effect",
  "minecraft:haste": "textures/ui/haste_effect",
  "minecraft:night_vision": "textures/ui/night_vision_effect",
  "minecraft:water_breathing": "textures/ui/water_breathing_effect",
  "minecraft:fire_resistance": "textures/ui/fire_resistance_effect",
};

/** Our UI icons (textures/hk/ui/) plus the few vanilla ones the forms reuse. */
export const UI_ICONS = {
  locked: "textures/hk/ui/locked",
  crops: "textures/hk/ui/chapter_crops",
  whatCanIMake: "textures/hk/ui/chapter_what_can_i_make",
  howToPlay: "textures/hk/ui/chapter_how_to_play",
  needsHeat: "textures/hk/ui/needs_heat",
  pot: "textures/hk/items/cooking_pot",
  board: "textures/hk/items/cutting_board",
  crafting: "textures/blocks/crafting_table_front",
  back: "textures/ui/arrow_left",
  guide: "textures/hk/items/guide_book",
} as const;

/** Button icon for an item id, or undefined if none is known (validate.ts reports those). */
export function itemIcon(typeId: string): string | undefined {
  const [namespace, name] = typeId.split(":");
  if (namespace === "hk" && name) return `textures/hk/items/${name}`;
  return VANILLA_ITEM_ICONS[typeId];
}

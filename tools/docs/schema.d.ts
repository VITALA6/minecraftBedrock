// Mod docs export format, version 1: what `npm run docs:export` writes for each mod, and what the
// docs site (docs.<domain>) reads. Generic: nothing here is specific to one mod, so every mod's
// export has the same shape. Copied as-is into each export folder:
//
//   <modId>/
//     data.json       ModDocs (below)
//     schema.d.ts     this file
//     icons/          every icon the data names, 16 px art upscaled 8× nearest-neighbour (128 px)
//     pages/<id>.md   prose pages; see "Pages" at the bottom for the reference syntax
//
// Conventions:
// - Ids are the game's namespaced ids ("wm_kitchen:tomato", "minecraft:bowl"); mod-defined ids that
//   aren't game ids (crops, stations, families, pages) are plain snake_case ("tomato",
//   "cooking_pot").
// - Every id one record uses to point at another exists in the matching collection; the exporter
//   refuses to write data that breaks this.
// - Icon paths are relative to the mod folder ("icons/items/tomato.png"). null: no icon of ours.
// - Text is plain (no Minecraft § codes), in English.

/** Bump when a change breaks readers; additions within a version are optional fields. */
export type DocsFormat = 1;

export interface ModDocs {
  format: DocsFormat;
  mod: ModInfo;
  /** Every item and block the data mentions, by game id, the mod's own and vanilla ones. */
  items: Record<string, ItemInfo>;
  /** Groups an ingredient or grid cell can name instead of one item ("minecraft:planks"). */
  tags: Record<string, TagInfo>;
  biomes: Record<string, BiomeInfo>;
  effects: Record<string, EffectInfo>;
  /** Effect families: how the mod groups effects for players (colour-coded). May be empty. */
  families: FamilyInfo[];
  crops: CropInfo[];
  stations: StationInfo[];
  /** Everything the mod lets players make, in the mod's own order. */
  recipes: RecipeInfo[];
  /** The mod's tools and blocks as crafting-table grids (food and mixes are in `recipes`). */
  crafting: CraftingGrid[];
  /** The prose pages, in reading order. */
  pages: PageInfo[];
}

export interface ModInfo {
  /** Folder name and URL slug: kebab-case ("simmerfield"). */
  id: string;
  name: string;
  /** The mod's id namespace ("wm_kitchen"). */
  namespace: string;
  /** Pack version, "1.0.0". */
  version: string;
  /** One or two sentences for the docs hub. */
  summary: string;
  /** Lowest Minecraft: Bedrock Edition version it runs on (the pack's min_engine_version). */
  minecraft: string;
  /** Icon standing for the mod on the hub. */
  icon: string;
  /** Source build the export came from (git short hash; "+" = uncommitted changes). */
  build: string;
  /** Icon files: `size` px square, from 16 px art at `scale` ×. */
  icons: { size: number; scale: number };
}

export interface ItemInfo {
  id: string;
  name: string;
  icon: string | null;
  /** True for the game's own items and blocks. */
  vanilla: boolean;
  /** Free-form grouping chosen by the mod ("produce", "seed", "dish", "mix", "station", …). */
  category: string | null;
  /** Set when the item can be eaten. */
  food: FoodInfo | null;
}

export interface FoodInfo {
  /** Hunger points restored (2 = one full shank). */
  nutrition: number;
  /** Can be eaten with a full hunger bar. */
  canAlwaysEat: boolean;
  /** What stays in the hand after eating ("minecraft:bowl"). */
  leaves: string | null;
  /** Placed as a block and eaten a slice at a time (a cake): slices per block. */
  slices: number | null;
}

export interface TagInfo {
  id: string;
  /** "Any planks". */
  name: string;
  items: string[];
  /** A representative icon (the first item's), or null. */
  icon: string | null;
}

export interface BiomeInfo {
  id: string;
  name: string;
  icon: string | null;
}

export interface EffectInfo {
  /** Game effect id, "minecraft:speed". */
  id: string;
  name: string;
  /** What it does, in a few plain words for players. */
  description: string;
  /** FamilyInfo.id, or null when the mod doesn't group effects. */
  family: string | null;
}

export interface FamilyInfo {
  id: string;
  name: string;
  /** "#d8453b": the colour the mod uses for this family in game. */
  color: string;
  icon: string | null;
  /** One short line for players ("Red food heals you"). */
  hint: string;
}

export interface CropInfo {
  id: string;
  name: string;
  /** What harvesting gives (item id). */
  produce: string;
  /** What plants it (item id); may equal `produce` (an onion is planted itself). */
  seed: string;
  /** The crop's block id. */
  block: string;
  /** "crop": break when ripe; "bush": use when ripe to pick, it regrows. */
  growth: "crop" | "bush";
  /** Blocks it can be planted on. */
  plantOn: string[];
  /** Grown-stage picture (a block texture), if there is one. */
  icon: string | null;
  /** Where its seed comes from. */
  seedSource: {
    /** Blocks that drop it when broken ("minecraft:short_grass"). */
    blocks: string[];
    /** Biomes where it drops more often. Empty: the same everywhere. */
    biomes: string[];
    /** Chance per break (0..1) inside `biomes`, and anywhere else. */
    chanceInBiome: number;
    chanceElsewhere: number;
  } | null;
  /** What one harvest (crop) or one pick (bush) gives. */
  harvest: { item: string; min: number; max: number }[];
}

export interface StationInfo {
  id: string;
  name: string;
  /** The item that places it. */
  item: string;
  icon: string | null;
  /**
   * cutting: use an item on it, get pieces back (one input, one output).
   * crafting: a crafting grid (the vanilla table, or a table with its own recipe list).
   * cooking: holds ingredients and cooks them over time.
   */
  kind: "cutting" | "crafting" | "cooking";
  /** Cooking stations: needs one of `heatSources` directly below. */
  needsHeat: boolean;
  heatSources: string[];
  /** Cooking stations: how many ingredient items it holds at once. null: not a container. */
  capacity: number | null;
  /** One or two sentences: what it's for. */
  description: string;
}

export interface Ingredient {
  /** Any one of these per item needed (alternatives: "raw cod or raw salmon"). Item or tag ids. */
  items: string[];
  count: number;
}

export interface RecipeInfo {
  /** Unique within the mod. */
  id: string;
  /** StationInfo.id. */
  station: string;
  ingredients: Ingredient[];
  result: { item: string; count: number };
  /** Cooking time in seconds, for cooking stations; null otherwise. */
  seconds: number | null;
  /** The result's food values (the same as items[result].food), or null if it isn't food. */
  food: FoodInfo | null;
  /** What eating the result gives, or null. */
  effect: {
    effect: string;
    /** FamilyInfo.id, or null. */
    family: string | null;
    seconds: number;
    /** 1 = level I. */
    level: number;
  } | null;
}

export interface CraftingGrid {
  /** The result's item id (one grid per result). */
  id: string;
  /** StationInfo.id of the table it's made on. */
  station: string;
  result: { item: string; count: number };
  /** shaped: `grid` rows (item or tag id per cell, null = empty); shapeless: `ingredients`. */
  shape: "shaped" | "shapeless";
  /** Shaped only, at its own size (it can go anywhere in the 3×3); otherwise null. */
  grid: (string | null)[][] | null;
  /** Shapeless only; otherwise null. */
  ingredients: Ingredient[] | null;
  /** Mirrored shaped recipes work too. */
  mirrored: boolean;
  /** Fits the 2×2 grid in the player's inventory. */
  fitsInventory: boolean;
  /** Getting any of these unlocks it in the recipe book (item ids). */
  unlockedBy: string[];
}

// --- Pages ---------------------------------------------------------------------------------------
//
// pages/<id>.md is plain Markdown (CommonMark): prose written for players. It starts with one
// "# Title" heading. It points at data instead of repeating it:
//
// - Inline links with a data scheme, readable in any Markdown viewer:
//     [Tomato](item:wm_kitchen:tomato)   [Cooking Pot](station:cooking_pot)   [Heal](family:heal)
//     [Tomato](crop:tomato)      [Tomato Soup](recipe:wm_kitchen:tomato_soup)  [Crops](page:crops)
//     [Plains](biome:minecraft:plains)   [Cooking Pot](crafting:wm_kitchen:cooking_pot)
//   A docs site renders them as chips (icon + name) or links; the link text is the fallback.
//
// - Embedded blocks: a fenced code block with the info string `embed`, one directive inside:
//     ```embed
//     recipes station=cooking_pot
//     ```
//   Directives (arguments optional, all must match):
//     crops                                  every crop
//     stations                               every station
//     recipes [station=<id>] [family=<id>]   recipes, in data order
//     crafting [id=<item id>]                crafting grids
//     families                               the effect families with their effects
//     loop                                   the getting-started steps (PageInfo.steps)
//   A plain Markdown viewer shows the directive as a code block.

export interface PageInfo {
  /** File name without .md; also the URL slug. */
  id: string;
  /** The page's "# Title". */
  title: string;
  /** One sentence for navigation and previews. */
  summary: string;
  /** Getting-started style pages: the steps of the game loop, each with the items it shows. */
  steps: { text: string; items: string[] }[] | null;
}

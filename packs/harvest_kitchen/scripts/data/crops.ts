import {
  BLOCK_CHILI_BUSH,
  BLOCK_CUCUMBER_CROP,
  BLOCK_EGGPLANT_CROP,
  BLOCK_ONION_CROP,
  BLOCK_STRAWBERRY_BUSH,
  BLOCK_TOMATO_CROP,
  ITEM_CHILI,
  ITEM_CHILI_SEEDS,
  ITEM_CUCUMBER,
  ITEM_CUCUMBER_SEEDS,
  ITEM_EGGPLANT,
  ITEM_EGGPLANT_SEEDS,
  ITEM_ONION,
  ITEM_STRAWBERRY,
  ITEM_STRAWBERRY_SEEDS,
  ITEM_TOMATO,
  ITEM_TOMATO_SEEDS,
} from "../config";

// Every crop as data. Growth tuning lives in each block's JSON ("hk:crop_growth" params, which
// must stay flat, see plan §5.1); everything the scripts need to know about a crop is here:
// seeds from grass, bush harvests, discovery and the recipe posters.

/**
 * - crop: break to harvest (loot table per stage).
 * - bush: use when mature to pick, drops back one stage and regrows (like sweet berries).
 * - tall (SHOULD, not implemented): two-block crop. See crops/crop-growth.ts.
 */
export type CropType = "crop" | "bush";

/** What the seed is planted on: farmland only, or the bush soils (see SOIL_BLOCKS). */
export type PlantOn = "farmland" | "soil";

export interface Crop {
  /** Saved in each player's discovery data. Never rename one that has shipped. */
  readonly key: string;
  readonly block: string;
  readonly type: CropType;
  readonly produce: string;
  /** Item that plants the crop. The onion is its own seed. */
  readonly seed: string;
  readonly plantOn: PlantOn;
  /** Biomes where grass drops this seed at SEED_CHANCE_IN_BIOME. Vanilla ids. */
  readonly biomes: readonly string[];
  /** Lang key for a short "where to find it" hint (biomes). */
  readonly whereKey: string;
  /** Bushes only: how many fruit a pick gives. */
  readonly pick?: { readonly min: number; readonly max: number };
  /** Bushes only: the stage a picked bush drops back to. */
  readonly pickResetStage?: number;
  /** Chop-bits colour on the board, 0..1 per channel. */
  readonly color: { readonly red: number; readonly green: number; readonly blue: number };
}

/** Blocks a player can break to find seeds (not with shears, not in creative). */
export const SEED_DROP_BLOCKS: readonly string[] = [
  "minecraft:short_grass",
  "minecraft:tall_grass",
  "minecraft:fern",
  "minecraft:large_fern",
];

// Vanilla wheat seeds drop from short grass 1 time in 8. Ours add to that, so per break the
// total chance in a matching biome is roughly 5 % per matching crop plus 1 % per other crop.
export const SEED_CHANCE_IN_BIOME = 0.05;
/** A small chance anywhere, so a player in a one-biome world isn't stuck (plan §1.5). */
export const SEED_CHANCE_ANY_BIOME = 0.01;

/**
 * Where bushes can be planted. Vanilla sweet berries list grass, dirt and podzol
 * (1.26.52 vanilla items/sweet_berries.json, "plant_at"); coarse dirt is a dirt variant there,
 * and farmland is added so a player who tilled the whole field isn't refused.
 */
export const SOIL_BLOCKS: readonly string[] = [
  "minecraft:grass_block",
  "minecraft:dirt",
  "minecraft:coarse_dirt",
  "minecraft:podzol",
  "minecraft:farmland",
];

export const CROPS: readonly Crop[] = [
  {
    key: "tomato",
    block: BLOCK_TOMATO_CROP,
    type: "crop",
    produce: ITEM_TOMATO,
    seed: ITEM_TOMATO_SEEDS,
    plantOn: "farmland",
    biomes: [
      "minecraft:plains",
      "minecraft:sunflower_plains",
      "minecraft:forest",
      "minecraft:forest_hills",
      "minecraft:birch_forest",
      "minecraft:birch_forest_hills",
      "minecraft:flower_forest",
      "minecraft:river",
    ],
    whereKey: "hk.crop.where.tomato",
    color: { red: 0.84, green: 0.23, blue: 0.18 },
  },
  {
    key: "onion",
    block: BLOCK_ONION_CROP,
    type: "crop",
    produce: ITEM_ONION,
    seed: ITEM_ONION,
    plantOn: "farmland",
    biomes: [
      "minecraft:plains",
      "minecraft:sunflower_plains",
      "minecraft:taiga",
      "minecraft:taiga_hills",
      "minecraft:mega_taiga",
      "minecraft:savanna",
      "minecraft:savanna_plateau",
    ],
    whereKey: "hk.crop.where.onion",
    color: { red: 0.79, green: 0.57, blue: 0.25 },
  },
  {
    key: "cucumber",
    block: BLOCK_CUCUMBER_CROP,
    type: "crop",
    produce: ITEM_CUCUMBER,
    seed: ITEM_CUCUMBER_SEEDS,
    plantOn: "farmland",
    biomes: [
      "minecraft:plains",
      "minecraft:sunflower_plains",
      "minecraft:forest",
      "minecraft:forest_hills",
      "minecraft:birch_forest",
      "minecraft:river",
      "minecraft:swampland",
    ],
    whereKey: "hk.crop.where.cucumber",
    color: { red: 0.4, green: 0.72, blue: 0.3 },
  },
  {
    key: "chili",
    block: BLOCK_CHILI_BUSH,
    type: "bush",
    produce: ITEM_CHILI,
    seed: ITEM_CHILI_SEEDS,
    plantOn: "soil",
    biomes: [
      "minecraft:jungle",
      "minecraft:jungle_hills",
      "minecraft:jungle_edge",
      "minecraft:bamboo_jungle",
      "minecraft:savanna",
      "minecraft:savanna_plateau",
      "minecraft:mesa",
      "minecraft:mesa_plateau",
      "minecraft:mesa_plateau_stone",
    ],
    whereKey: "hk.crop.where.chili",
    pick: { min: 1, max: 3 },
    pickResetStage: 2,
    color: { red: 0.88, green: 0.28, blue: 0.16 },
  },
  {
    key: "strawberry",
    block: BLOCK_STRAWBERRY_BUSH,
    type: "bush",
    produce: ITEM_STRAWBERRY,
    seed: ITEM_STRAWBERRY_SEEDS,
    plantOn: "soil",
    biomes: ["minecraft:meadow", "minecraft:flower_forest", "minecraft:cherry_grove"],
    whereKey: "hk.crop.where.strawberry",
    pick: { min: 2, max: 3 },
    pickResetStage: 2,
    color: { red: 0.91, green: 0.25, blue: 0.42 },
  },
  {
    key: "eggplant",
    block: BLOCK_EGGPLANT_CROP,
    type: "crop",
    produce: ITEM_EGGPLANT,
    seed: ITEM_EGGPLANT_SEEDS,
    plantOn: "farmland",
    biomes: [
      "minecraft:savanna",
      "minecraft:savanna_plateau",
      "minecraft:plains",
      "minecraft:sunflower_plains",
    ],
    whereKey: "hk.crop.where.eggplant",
    color: { red: 0.42, green: 0.22, blue: 0.55 },
  },
];

export function cropByBlock(blockId: string): Crop | undefined {
  return CROPS.find((crop) => crop.block === blockId);
}

export function cropByKey(key: string): Crop | undefined {
  return CROPS.find((crop) => crop.key === key);
}

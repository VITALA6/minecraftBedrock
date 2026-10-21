import { ITEM_TOMATO_SEEDS, SEED_DROP_CHANCE } from "../config";

// Where each crop's seeds come from. Growth itself is configured per crop block in its JSON
// (the "hk:crop_growth" parameters), so a new crop only adds a block file and an entry here.

export interface SeedSource {
  readonly seed: string;
  /** Blocks that may drop the seed when a player breaks them by hand or with a non-shears tool. */
  readonly blocks: readonly string[];
  readonly chance: number;
}

export const SEED_SOURCES: readonly SeedSource[] = [
  {
    seed: ITEM_TOMATO_SEEDS,
    blocks: [
      "minecraft:short_grass",
      "minecraft:tall_grass",
      "minecraft:fern",
      "minecraft:large_fern",
    ],
    chance: SEED_DROP_CHANCE,
  },
];

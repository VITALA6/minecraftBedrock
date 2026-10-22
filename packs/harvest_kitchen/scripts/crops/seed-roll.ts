import { CROPS, SEED_CHANCE_ANY_BIOME, SEED_CHANCE_IN_BIOME, type Crop } from "../data/crops";

// Which seed (if any) a grass break drops, weighted by biome (plan §1.5). Pure, so tests run it
// in Node; seed-drops.ts supplies the biome and Math.random().
//
// One roll per break, so a break drops at most one of our seeds. Each crop's chance is
// SEED_CHANCE_IN_BIOME where it belongs and SEED_CHANCE_ANY_BIOME elsewhere (or when the biome
// is unknown).

export function seedChances(
  biome: string | undefined,
  crops: readonly Crop[] = CROPS,
): { crop: Crop; chance: number }[] {
  return crops.map((crop) => ({
    crop,
    chance: biome && crop.biomes.includes(biome) ? SEED_CHANCE_IN_BIOME : SEED_CHANCE_ANY_BIOME,
  }));
}

/** The crop whose seed drops for `roll` (0 <= roll < 1), or undefined for no seed. */
export function rollSeed(
  biome: string | undefined,
  roll: number,
  crops: readonly Crop[] = CROPS,
): Crop | undefined {
  let left = roll;
  for (const { crop, chance } of seedChances(biome, crops)) {
    if (left < chance) return crop;
    left -= chance;
  }
  return undefined;
}

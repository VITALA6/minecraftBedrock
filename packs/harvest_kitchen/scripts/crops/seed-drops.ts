import { ItemStack, world, type Block } from "@minecraft/server";
import {
  CROPS,
  SEED_CHANCE_ANY_BIOME,
  SEED_CHANCE_IN_BIOME,
  SEED_DROP_BLOCKS,
  type Crop,
} from "../data/crops";
import { isCreative } from "../lib/inventory";

// Extra seed drops from grass, weighted by biome (plan §1.5). Added by script rather than by
// overriding vanilla's loot_tables/blocks/short_grass.json: an override would replace the vanilla
// table outright and collide with any other add-on that edits it. The cost: only player breaks
// count, not grass destroyed by water, pistons or explosions.
//
// One roll per break, so a break drops at most one of our seeds. Each crop's chance is
// SEED_CHANCE_IN_BIOME where it belongs and SEED_CHANCE_ANY_BIOME elsewhere.

function biomeAt(block: Block): string | undefined {
  try {
    return block.dimension.getBiome(block.location).id;
  } catch {
    return undefined; // unloaded or out of bounds: fall back to the any-biome chance
  }
}

export function seedChances(biome: string | undefined): { crop: Crop; chance: number }[] {
  return CROPS.map((crop) => ({
    crop,
    chance: biome && crop.biomes.includes(biome) ? SEED_CHANCE_IN_BIOME : SEED_CHANCE_ANY_BIOME,
  }));
}

export function registerSeedDrops(): void {
  world.afterEvents.playerBreakBlock.subscribe(
    ({ block, player, itemStackBeforeBreak }) => {
      if (isCreative(player)) return;
      if (itemStackBeforeBreak?.typeId === "minecraft:shears") return; // shears drop the grass

      let roll = Math.random();
      for (const { crop, chance } of seedChances(biomeAt(block))) {
        if (roll < chance) {
          block.dimension.spawnItem(new ItemStack(crop.seed), block.center());
          return;
        }
        roll -= chance;
      }
    },
    { blockTypes: [...SEED_DROP_BLOCKS] },
  );
}

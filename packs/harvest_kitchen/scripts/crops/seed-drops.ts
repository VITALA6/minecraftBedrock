import { ItemStack, world, type Block } from "@minecraft/server";
import { SEED_DROP_BLOCKS } from "../data/crops";
import { isCreative } from "../lib/inventory";
import { rollSeed } from "./seed-roll";

// Extra seed drops from grass, weighted by biome (plan §1.5). Added by script rather than by
// overriding vanilla's loot_tables/blocks/short_grass.json: an override would replace the vanilla
// table outright and collide with any other add-on that edits it. The cost: only player breaks
// count, not grass destroyed by water, pistons or explosions. The weighting is in seed-roll.ts.

function biomeAt(block: Block): string | undefined {
  try {
    return block.dimension.getBiome(block.location).id;
  } catch {
    return undefined; // unloaded or out of bounds: fall back to the any-biome chance
  }
}

export function registerSeedDrops(): void {
  world.afterEvents.playerBreakBlock.subscribe(
    ({ block, player, itemStackBeforeBreak }) => {
      if (isCreative(player)) return;
      if (itemStackBeforeBreak?.typeId === "minecraft:shears") return; // shears drop the grass

      const crop = rollSeed(biomeAt(block), Math.random());
      if (crop) block.dimension.spawnItem(new ItemStack(crop.seed), block.center());
    },
    { blockTypes: [...SEED_DROP_BLOCKS] },
  );
}

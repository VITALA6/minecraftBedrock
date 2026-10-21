import { ItemStack, world } from "@minecraft/server";
import { SEED_SOURCES } from "../data/crops";
import { isCreative } from "../lib/inventory";

// Extra seed drops from grass, added by script rather than by overriding vanilla's
// loot_tables/blocks/short_grass.json. An override would replace the vanilla table outright
// and collide with any other add-on that edits the same file. The cost: only player breaks count,
// not grass destroyed by water, pistons or explosions.

export function registerSeedDrops(): void {
  for (const source of SEED_SOURCES) {
    world.afterEvents.playerBreakBlock.subscribe(
      ({ block, player, itemStackBeforeBreak }) => {
        if (isCreative(player)) return;
        if (itemStackBeforeBreak?.typeId === "minecraft:shears") return; // shears drop the grass itself
        if (Math.random() >= source.chance) return;
        block.dimension.spawnItem(new ItemStack(source.seed), block.center());
      },
      { blockTypes: [...source.blocks] },
    );
  }
}

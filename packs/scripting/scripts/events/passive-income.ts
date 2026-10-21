import { BlockVolume, system, world, type Player } from "@minecraft/server";
import { BLOCK_RUBY, PASSIVE_INCOME, PASSIVE_INTERVAL_TICKS, PASSIVE_RADIUS } from "../config";
import { addCoins } from "../wallet";

function isNearRubyBlock(player: Player): boolean {
  const { dimension, location } = player;
  const { min, max } = dimension.heightRange;
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  const r = PASSIVE_RADIUS;

  const volume = new BlockVolume(
    { x: x - r, y: Math.max(min, y - r), z: z - r },
    { x: x + r, y: Math.min(max - 1, y + r), z: z + r },
  );
  try {
    return dimension.containsBlock(volume, { includeTypes: [BLOCK_RUBY] });
  } catch {
    return false; // e.g. part of the volume is in an unloaded chunk
  }
}

export function startPassiveIncome(): void {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      if (!isNearRubyBlock(player)) continue;
      const added = addCoins(player, PASSIVE_INCOME);
      if (added > 0) player.onScreenDisplay.setActionBar(`§a+${added} coin§r (ruby block nearby)`);
    }
  }, PASSIVE_INTERVAL_TICKS);
}

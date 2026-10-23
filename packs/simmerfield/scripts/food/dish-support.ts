import { system, world, type Dimension, type Vector3 } from "@minecraft/server";
import { PISTON_SETTLE_TICKS } from "../config";
import { DISHES } from "../data/dishes";

// Placed dishes (the Strawberry Cake) must stand on a block and pop like vanilla cake when it goes
// (blockers.md B15). The block JSON does the main work: minecraft:placement_filter allows only the
// up face, so a cake can't hang on a wall, and per Microsoft Learn the game pops a placed block
// whose filter stops being met when the supporting block is removed. Whether a filter with
// allowed_faces alone (no block_filter: a cake may sit on any block) re-checks the block below on
// a neighbour change isn't proven in game yet, so this module is a bounded safety net:
//
// - it only reacts to the events that remove a block from under a cake: a player break, an
//   explosion and a piston move, and only looks at the one block above each affected position;
// - it never ticks and never scans: no onTick on the cake (plan §5.4);
// - a cake whose block below is air or liquid is destroyed with /setblock … destroy, which plays
//   the break particles and sound and uses the cake's loot table, which drops nothing (as vanilla).
//
// Not covered: support lost without any of these events (water or lava flowing in, fire, an
// enderman, /setblock). If the JSON pop works, this code finds the cake already gone and does
// nothing.

const DISH_BLOCKS: ReadonlySet<string> = new Set(
  DISHES.flatMap((dish) => (dish.slices ? [dish.slices.block] : [])),
);

/** Positions to look at, keyed by dimension + position, each with the tick it's due. */
const pending = new Map<string, { dimension: Dimension; location: Vector3; due: number }>();
/** Ticks that already have a flush scheduled (an explosion reports hundreds of blocks at once). */
const flushTicks = new Set<number>();

const above = ({ x, y, z }: Vector3): Vector3 => ({ x, y: y + 1, z });

function popIfUnsupported(dimension: Dimension, location: Vector3): void {
  const block = dimension.getBlock(location);
  if (!block || !DISH_BLOCKS.has(block.typeId)) return;
  const below = block.below();
  if (!below || !(below.isAir || below.isLiquid)) return;
  const { x, y, z } = block.location;
  dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
}

function flush(): void {
  const now = system.currentTick;
  for (const [key, check] of pending) {
    if (check.due > now) continue;
    pending.delete(key);
    try {
      popIfUnsupported(check.dimension, check.location);
    } catch {
      // unloaded chunk or out of the world: nothing to pop
    }
  }
}

/** Looks at the block above `location` in `delay` ticks (once per position). */
function checkAbove(dimension: Dimension, location: Vector3, delay = 1): void {
  const at = above(location);
  const key = `${dimension.id}:${at.x},${at.y},${at.z}`;
  const due = Math.max(system.currentTick + delay, pending.get(key)?.due ?? 0);
  pending.set(key, { dimension, location: at, due });
  if (flushTicks.has(due)) return;
  flushTicks.add(due);
  system.runTimeout(() => {
    flushTicks.delete(due);
    flush();
  }, due - system.currentTick);
}

export function registerDishSupport(): void {
  world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => {
    checkAbove(dimension, block.location);
  });
  world.afterEvents.blockExplode.subscribe(({ block, dimension }) => {
    checkAbove(dimension, block.location);
  });
  world.afterEvents.pistonActivate.subscribe(({ piston, dimension }) => {
    let moved: Vector3[];
    try {
      moved = piston.getAttachedBlocksLocations();
    } catch {
      return;
    }
    // The pushed blocks land a few ticks later; check once they have.
    for (const location of moved) checkAbove(dimension, location, PISTON_SETTLE_TICKS);
  });
}

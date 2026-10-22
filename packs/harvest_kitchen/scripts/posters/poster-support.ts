import { system, world, type Dimension, type Vector3 } from "@minecraft/server";
import { BLOCK_RECIPE_POSTER, PISTON_SETTLE_TICKS, STATE_FACING } from "../config";
import { FACINGS, step } from "./poster-logic";

// A recipe poster hangs on the block behind it and pops when that block goes. The block JSON's
// minecraft:placement_filter (side faces only) is meant to do it, but whether a side-face filter
// re-checks the right neighbour (the poster has no block_face state: the multi-block trait allows
// no placement_position trait) isn't proven in game. So, as for the cake (food/dish-support.ts),
// a bounded safety net:
//
// - it only reacts to the events that remove a block: a player break, an explosion, a piston move;
// - for each removed position it looks at the 4 horizontal neighbours for a poster whose wall is
//   exactly that position, and breaks it with /setblock … destroy if the wall is air or liquid
//   (the multi-block takes the other part with it; posters/poster.ts drops the item from onBreak);
// - it never ticks and never scans.
//
// Not covered: a wall removed without these events (/setblock, /fill, an enderman, fire).

const pending = new Map<string, { dimension: Dimension; location: Vector3; due: number }>();
const flushTicks = new Set<number>();

function popIfUnsupported(dimension: Dimension, wall: Vector3): void {
  const support = dimension.getBlock(wall);
  if (!support || !(support.isAir || support.isLiquid)) return;
  for (const facing of FACINGS) {
    const d = step(facing);
    const block = support.offset({ x: d.x, y: 0, z: d.z });
    if (block?.typeId !== BLOCK_RECIPE_POSTER) continue;
    if (block.permutation.getAllStates()[STATE_FACING] !== facing) continue; // hangs elsewhere
    const { x, y, z } = block.location;
    dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
  }
}

function flush(): void {
  const now = system.currentTick;
  for (const [key, check] of pending) {
    if (check.due > now) continue;
    pending.delete(key);
    try {
      popIfUnsupported(check.dimension, check.location);
    } catch {
      // unloaded chunk or out of the world
    }
  }
}

/** Checks the posters around `location` in `delay` ticks (once per position). */
function checkAround(dimension: Dimension, location: Vector3, delay = 1): void {
  const key = `${dimension.id}:${location.x},${location.y},${location.z}`;
  const due = Math.max(system.currentTick + delay, pending.get(key)?.due ?? 0);
  pending.set(key, { dimension, location, due });
  if (flushTicks.has(due)) return;
  flushTicks.add(due);
  system.runTimeout(() => {
    flushTicks.delete(due);
    flush();
  }, due - system.currentTick);
}

export function registerPosterSupport(): void {
  world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => {
    checkAround(dimension, block.location);
  });
  world.afterEvents.blockExplode.subscribe(({ block, dimension }) => {
    checkAround(dimension, block.location);
  });
  world.afterEvents.pistonActivate.subscribe(({ piston, dimension }) => {
    let moved: Vector3[];
    try {
      moved = piston.getAttachedBlocksLocations();
    } catch {
      return;
    }
    for (const location of moved) checkAround(dimension, location, PISTON_SETTLE_TICKS);
  });
}

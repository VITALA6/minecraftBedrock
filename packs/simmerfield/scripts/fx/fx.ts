import {
  system,
  world,
  type Block,
  type Dimension,
  type Entity,
  type Vector3,
} from "@minecraft/server";
import { BLOCK_CUTTING_BOARD } from "../config";
import { setStates } from "../lib/block-states";
import {
  FX_BOARD_CHOPPING_STATE,
  FX_BOARD_FACING_STATE,
  FX_BOARD_YAW,
  FX_ENTITY_TYPES,
  FX_KNIFE,
  FX_TIMING,
  FX_TYPE_OF,
  FX_VIEW_DISTANCE,
  type FxKind,
} from "./fx-config";
import { FxRegistry, ownerKey, type FxEntry, type FxSpot } from "./fx-registry";

// Station effects: the knife that chops on the cutting board and the spoon that stirs a cooking
// pot. Each is an entity (wm_kitchen:fx_knife, wm_kitchen:fx_spoon) whose motion is a client animation in the
// resource pack; the script only spawns and removes them.
//
// Lifecycle
// - Knife: fxChop() on every chop. A live knife on that board gets FX_TIMING.knifeLifeTicks more;
//   otherwise one is spawned, turned to the board's facing. The fx loop removes it when it
//   expires. Its own minecraft:timer (entity JSON) despawns it after 10 s regardless (the spoon's
//   after 60 s; cooking takes at most 10 s, and a pot still boiling just gets a fresh spoon).
// - Spoon: fxStir(on) from the station's refreshVisuals (every state push and every sweep of a
//   station with contents): on = cooking with heat. Spawned only while a player is within
//   FX_VIEW_DISTANCE; removed when cooking ends or pauses, when the pot is broken (fxStopStir from
//   spill), when no player is near (checked by the fx loop) and when its chunk unloads.
//
// Never kept in the world (stable has no "don't save" flag, so the script cleans up instead):
// - an fx entity whose chunk unloads is forgotten (entityRemove); the saved copy is removed when
//   it loads again (entityLoad), and the pot spawns a fresh spoon if it's still cooking;
// - at world load (and once after a /reload) every fx entity in loaded chunks is removed;
// - one spawned by anything but this module (entitySpawn) is removed on the next tick;
// - before spawning, strays of the same type on that block are removed (a /reload leftover).
// The board hides its resting knife (state wm_kitchen:chopping) while its fx knife lives: every path
// that removes or forgets a knife shows it again, and fxBoardCheck (the board's random tick and
// every use) fixes a board left knifeless by a knife lost while its chunk was unloading.
// The entity JSON adds: no spawn egg or spawn rules (it must stay summonable: is_summonable false
// also blocks Dimension.spawnEntity, seen in game 2026-10-23), no loot, no collision, no
// hitbox, no damage, no physics, not pushable, and a despawn when no player is near.
//
// Work: no per-tick or per-block timers. One fx loop (FX_TIMING.loopTicks) runs only while fx
// exist, over the registry (at most FX_CAPS.total entries). fxStir is a map lookup unless the pot
// needs a spoon, and then it retries at most every FX_TIMING.spoonRetryTicks.

const registry = new FxRegistry<Entity>();
const retryAt = new Map<string, number>(); // pot owner -> tick of the next spawn attempt
let loop: number | undefined;
let loopCount = 0;

const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

function spotOf(dimension: Dimension, { x, y, z }: Vector3): FxSpot {
  return { dimension: dimension.id, x, y, z };
}

const bottomCenter = ({ x, y, z }: Vector3): Vector3 => ({ x: x + 0.5, y, z: z + 0.5 });

function isValid(entity: Entity): boolean {
  try {
    return entity.isValid;
  } catch {
    return false;
  }
}

const blockAt = ({ x, y, z }: Vector3): Vector3 => ({
  x: Math.floor(x),
  y: Math.floor(y),
  z: Math.floor(z),
});

/** Hides (on) or shows the resting knife of the board at `location`, if a board is there. */
function setChopping(dimension: Dimension, location: Vector3, on: boolean): void {
  try {
    const block = dimension.getBlock(location);
    if (block?.typeId === BLOCK_CUTTING_BOARD) setStates(block, { [FX_BOARD_CHOPPING_STATE]: on });
  } catch {
    // unloaded: the board's random tick or its next use shows the knife again (fxBoardCheck)
  }
}

function showBoardKnife(spot: FxSpot): void {
  try {
    setChopping(world.getDimension(spot.dimension), spot, false);
  } catch {
    // unknown dimension
  }
}

/** Removes the entity; a knife gives its board back its resting knife. */
function removeEntity(entity: Entity): void {
  try {
    if (!entity.isValid) return;
    const knifeAt = entity.typeId === FX_KNIFE ? blockAt(entity.location) : undefined;
    const dimension = entity.dimension;
    entity.remove();
    if (knifeAt) setChopping(dimension, knifeAt, false);
  } catch (error) {
    console.warn(`[simmerfield] fx: couldn't remove ${entity.typeId}: ${String(error)}`);
  }
}

/** Drops the registry entry (the entity is gone or going); a knife's board shows its knife. */
function forget(entry: FxEntry<Entity>): void {
  registry.remove(entry.owner);
  if (entry.kind === "knife") showBoardKnife(entry.spot);
}

function despawn(entry: FxEntry<Entity>): void {
  forget(entry);
  removeEntity(entry.handle);
}

function playerNear(dimension: Dimension, location: Vector3): boolean {
  try {
    return dimension.getPlayers({ location, maxDistance: FX_VIEW_DISTANCE }).length > 0;
  } catch {
    return false;
  }
}

/** Removes fx entities of `kind` on this block that the registry doesn't own (strays). */
function removeStrays(dimension: Dimension, location: Vector3, kind: FxKind): void {
  for (const entity of dimension.getEntities({
    type: FX_TYPE_OF[kind],
    location,
    maxDistance: 0.75,
  })) {
    if (!registry.hasId(entity.id)) removeEntity(entity);
  }
}

function spawn(
  kind: FxKind,
  dimension: Dimension,
  block: Vector3,
  yaw: number,
  expires?: number,
): boolean {
  const spot = spotOf(dimension, block);
  if (!registry.canAdd(kind, spot)) return false;
  const at = bottomCenter(block);
  removeStrays(dimension, at, kind);
  const entity = dimension.spawnEntity(FX_TYPE_OF[kind], at, { initialRotation: yaw });
  const added = registry.add({
    owner: ownerKey(kind, spot),
    kind,
    spot,
    id: entity.id,
    handle: entity,
    expires,
  });
  if (!added) {
    removeEntity(entity);
    return false;
  }
  ensureLoop();
  return true;
}

// --- the fx loop ----------------------------------------------------------------------------------

function tickFx(): void {
  loopCount++;
  const now = system.currentTick;
  for (const entry of registry.expired(now)) despawn(entry);
  if (loopCount % FX_TIMING.spoonCheckEvery === 0) {
    for (const entry of registry.entries()) {
      if (!isValid(entry.handle)) forget(entry);
      else if (
        entry.kind === "spoon" &&
        !playerNear(entry.handle.dimension, entry.handle.location)
      ) {
        despawn(entry);
      }
    }
  }
  if (registry.size === 0 && loop !== undefined) {
    system.clearRun(loop);
    loop = undefined;
  }
}

function ensureLoop(): void {
  if (loop === undefined) loop = system.runInterval(tickFx, FX_TIMING.loopTicks);
}

// --- hooks for the stations -----------------------------------------------------------------------

/** One chop on `board` (a cutting board block): the knife chops there for a moment. */
export function fxChop(board: Block): void {
  try {
    const { dimension, location } = board;
    const owner = ownerKey("knife", spotOf(dimension, location));
    const expires = system.currentTick + FX_TIMING.knifeLifeTicks;
    const live = registry.get(owner);
    if (live && isValid(live.handle)) {
      registry.extend(owner, expires);
      setChopping(dimension, location, true); // a no-op unless something showed the knife again
      return;
    }
    if (live) registry.remove(owner);
    const facing = board.permutation.getAllStates()[FX_BOARD_FACING_STATE];
    const yaw = FX_BOARD_YAW[String(facing)] ?? 0;
    // the fx knife takes the resting knife's place: hide that one while it chops
    if (spawn("knife", dimension, location, yaw, expires)) setChopping(dimension, location, true);
  } catch (error) {
    console.warn(`[simmerfield] fx: knife failed: ${String(error)}`);
  }
}

/**
 * A board whose resting knife is hidden but has no live fx knife (lost while its chunk unloaded,
 * or after a reload) shows it again. Call from the board's random tick and on every use.
 */
export function fxBoardCheck(board: Block): void {
  try {
    if (board.permutation.getAllStates()[FX_BOARD_CHOPPING_STATE] !== true) return;
    const live = registry.get(ownerKey("knife", spotOf(board.dimension, board.location)));
    if (live && isValid(live.handle)) return;
    setStates(board, { [FX_BOARD_CHOPPING_STATE]: false });
  } catch (error) {
    console.warn(`[simmerfield] fx: board check failed: ${String(error)}`);
  }
}

/**
 * The pot at `location` is (`on`) or isn't cooking with heat: keep a stirring spoon in it or take
 * it out. Cheap when nothing changes; call it whenever the pot's look is refreshed.
 */
export function fxStir(dimension: Dimension, location: Vector3, on: boolean): void {
  try {
    const owner = ownerKey("spoon", spotOf(dimension, location));
    const live = registry.get(owner);
    if (!on) {
      retryAt.delete(owner);
      if (live) despawn(live);
      return;
    }
    if (live && isValid(live.handle)) return;
    if (live) registry.remove(owner);
    const now = system.currentTick;
    if (now < (retryAt.get(owner) ?? 0)) return;
    retryAt.set(owner, now + FX_TIMING.spoonRetryTicks);
    if (!dimension.isChunkLoaded(location)) return;
    if (!playerNear(dimension, bottomCenter(location))) return;
    if (spawn("spoon", dimension, location, Math.floor(Math.random() * 4) * 90)) {
      retryAt.delete(owner);
    }
  } catch (error) {
    console.warn(`[simmerfield] fx: spoon failed: ${String(error)}`);
  }
}

/** The pot at `location` is gone (broken, replaced): its spoon goes too. */
export function fxStopStir(dimension: Dimension, location: Vector3): void {
  fxStir(dimension, location, false);
}

/** For /wm_kitchen:debug: live fx per kind. */
export function fxCounts(): Record<FxKind, number> {
  return { knife: registry.count("knife"), spoon: registry.count("spoon") };
}

// --- non-persistence ------------------------------------------------------------------------------

const isFx = (typeId: string) => FX_ENTITY_TYPES.includes(typeId);

/** Removes every fx entity in loaded chunks that the registry doesn't own. Returns how many. */
function cleanupAll(): number {
  let removed = 0;
  for (const id of DIMENSIONS) {
    let dimension: Dimension;
    try {
      dimension = world.getDimension(id);
    } catch {
      continue;
    }
    for (const type of FX_ENTITY_TYPES) {
      for (const entity of dimension.getEntities({ type })) {
        if (registry.hasId(entity.id)) continue;
        removeEntity(entity);
        removed++;
      }
    }
  }
  if (removed > 0) console.log(`[simmerfield] fx: removed ${removed} leftover fx entities`);
  return removed;
}

/** Call once from main.ts (top level). Subscribes the cleanup events; spawns nothing. */
export function registerFx(): void {
  world.afterEvents.worldLoad.subscribe(() => {
    cleanupAll();
  });
  // A /reload re-runs the scripts with the world already loaded: clean up on the first tick too.
  system.run(() => {
    try {
      cleanupAll();
    } catch {
      // the world isn't ready yet: worldLoad does it
    }
  });

  // A saved fx entity coming back with its chunk (or after a dimension change): not ours.
  // Checked next tick, like entitySpawn, in case a fresh spawn also reports a load.
  world.afterEvents.entityLoad.subscribe(({ entity }) => {
    if (!isFx(entity.typeId)) return;
    system.run(() => {
      if (isValid(entity) && !registry.hasId(entity.id)) removeEntity(entity);
    });
  });

  // Spawned by anything else (a command, a structure): gone next tick. Our own spawns are in
  // the registry by then.
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (!isFx(entity.typeId)) return;
    system.run(() => {
      if (isValid(entity) && !registry.hasId(entity.id)) removeEntity(entity);
    });
  });

  // Unloaded with its chunk, despawned by its own timer, or removed: forget it.
  world.afterEvents.entityRemove.subscribe(
    ({ removedEntityId }) => {
      const entry = registry.removeId(removedEntityId);
      if (entry?.kind === "knife") showBoardKnife(entry.spot);
    },
    { entityTypes: [...FX_ENTITY_TYPES] },
  );
}

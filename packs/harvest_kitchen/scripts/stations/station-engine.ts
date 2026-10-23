import {
  ItemTypes,
  system,
  TicksPerSecond,
  world,
  type Block,
  type Player,
  type Vector3,
} from "@minecraft/server";
import {
  DONE_NOTIFY_RADIUS,
  PARTICLE,
  SOUND,
  STATION_SPARKLE_EVERY,
  STATION_SWEEP_TICKS,
  WORLD_DEBUG_FAST,
} from "../config";
import type { StationRecipe } from "../data/recipes";
import { stationByBlock } from "../data/stations";
import { fxStir, fxStopStir } from "../fx/fx";
import { setStates, type StateValue } from "../lib/block-states";
import { actionBar, particle, sound } from "../lib/feedback";
import { consumeHeldItem, dropItems, getHeldItem, giveOrDrop } from "../lib/inventory";
import { ingredientName, itemName, t } from "../lib/text";
import { clearMixHints, popGhosts, showMixHint, startGhosts } from "./ghosts";
import { hasHeatBelow } from "./heat";
import {
  addItems,
  collectOutput,
  fillLevel,
  finishJob,
  isEmpty,
  liquidOf,
  phaseOf,
  progressCells,
  spillContents,
  startJob,
  sweepStep,
  takeAllItems,
  type NextIngredient,
  type StationState,
} from "./station-logic";
import {
  clearStation,
  findSavedStations,
  readStation,
  stationKey,
  writeStation,
  type StationRef,
} from "./station-store";

// The generic container station (plan §5.2). Everything here works from a ContainerStation config
// (data/stations.ts) and that station's recipes (data/recipes.ts); nothing names the pot. The
// rules themselves are pure functions in station-logic.ts; this module reads and saves the state,
// checks heat, and does the sounds, particles and hand-outs.
//
// Rules that keep items safe:
// - Every change is a synchronous read-modify-write of the saved state, so two players acting in
//   the same tick can't both take the same items. Form choices are re-validated here after the
//   form's await.
// - Ingredients stay in the station, locked, while a dish cooks; they're consumed in the same
//   step that creates the dish. Breaking the station mid-cook spills them.
// - Hand-outs clear the saved state first, then give; giveOrDrop drops whatever doesn't fit.
//
// One runInterval drives every station with contents (no per-block onTick). The active list is
// rebuilt from saved data at world load, so /reload or reopening the world resumes cooking.

const tracked = new Map<string, StationRef>();
let sweepCount = 0;
let fast = false;

// --- reading --------------------------------------------------------------------------------------

export function refAt(block: Block): StationRef | undefined {
  const station = stationByBlock(block.typeId);
  return station && { station, dimension: block.dimension, location: block.location };
}

export function stationBlock(ref: StationRef): Block | undefined {
  try {
    const block = ref.dimension.getBlock(ref.location);
    return block?.typeId === ref.station.block ? block : undefined;
  } catch {
    return undefined; // unloaded chunk
  }
}

export function isFast(): boolean {
  return fast;
}

export function setFast(on: boolean): void {
  fast = on;
  world.setDynamicProperty(WORLD_DEBUG_FAST, on);
}

// --- visuals --------------------------------------------------------------------------------------

export function stationTop({ location }: StationRef): Vector3 {
  return { x: location.x + 0.5, y: location.y + 0.75, z: location.z + 0.5 };
}

function isHot(ref: StationRef, block: Block): boolean {
  return !ref.station.needsHeat || hasHeatBelow(block);
}

/** Heat below right now (stations that don't need heat always count as hot). */
export function stationHot(ref: StationRef): boolean {
  const block = stationBlock(ref);
  return block !== undefined && isHot(ref, block);
}

/** Pushes the saved state (and the heat below) into the block states that drive the model. */
export function refreshVisuals(ref: StationRef, state = readStation(ref)): void {
  const block = stationBlock(ref);
  if (!block) return;
  const { fill, phase, hot, liquid } = ref.station.states;
  const patch: Record<string, StateValue> = {};
  if (liquid) patch[liquid] = liquidOf(ref.station, state);
  if (fill) patch[fill.name] = fillLevel(ref.station, state, fill.levels);
  if (phase) patch[phase] = phaseOf(ref.station, state);
  if (hot) patch[hot] = isHot(ref, block);
  try {
    setStates(block, patch);
  } catch (error) {
    console.warn(`[harvest_kitchen] ${stationKey(ref)}: visual update failed: ${String(error)}`);
  }
  // fx: the stirring spoon while cooking with heat (scripts/fx)
  if (phase && hot) fxStir(ref.dimension, ref.location, patch[phase] === "cooking" && patch[hot] === true); // prettier-ignore
}

function save(ref: StationRef, state: StationState): void {
  writeStation(ref, state);
  clearMixHints(ref);
  if (isEmpty(state)) tracked.delete(stationKey(ref));
  else tracked.set(stationKey(ref), ref);
  refreshVisuals(ref, state);
}

// --- feedback -------------------------------------------------------------------------------------

function stationName(ref: StationRef) {
  return t(ref.station.nameKey);
}

function refuse(player: Player, ref: StationRef, message = t("hk.station.full", stationName(ref))) {
  const top = stationTop(ref);
  sound(ref.dimension, SOUND.potRefuse, top);
  particle(ref.dimension, PARTICLE.puff, top, 2, 0.2);
  actionBar(player, message);
}

/** Fizz, smoke and "♨ Needs fire below". */
export function noHeat(player: Player, ref: StationRef): void {
  const top = stationTop(ref);
  sound(ref.dimension, SOUND.fizz, top);
  particle(ref.dimension, PARTICLE.puff, top, 3, 0.25);
  actionBar(player, t("hk.station.no_heat"));
}

function announceReady(player: Player, ref: StationRef, recipes: StationRecipe[]): void {
  const [first] = recipes;
  if (!first) return;
  const top = stationTop(ref);
  sound(ref.dimension, SOUND.ready, top, { pitch: 1.2 });
  particle(ref.dimension, PARTICLE.sparkle, top, 3, 0.3);
  actionBar(
    player,
    recipes.length === 1
      ? t("hk.station.ready_one", itemName(first.result))
      : t("hk.station.ready_more", itemName(first.result), recipes.length - 1),
  );
}

/** "♨ ■■■□□" — five cells; without heat it's paused and says so (fizz, "Needs fire below"). */
export function showProgress(player: Player, ref: StationRef, state = readStation(ref)): void {
  const job = state.job;
  const block = stationBlock(ref);
  if (!job || !block) return;
  if (!isHot(ref, block)) return noHeat(player, ref); // paused: fizz + smoke (plan §2.2)
  sound(ref.dimension, SOUND.bubbleShort, stationTop(ref), { volume: 0.6 });
  const done = progressCells(job);
  actionBar(player, t("hk.station.progress", "■".repeat(done) + "□".repeat(5 - done)));
}

// --- actions --------------------------------------------------------------------------------------

/**
 * One hand-out or drop of `count` × `typeId`. The saved state is already cleared (so nothing can
 * be taken twice); if this one throws (an item id that no longer exists after an update or a
 * vanilla rename), it's logged and the remaining entries still come out.
 */
function returnItems(ref: StationRef, typeId: string, count: number, give: () => void): void {
  try {
    give();
  } catch (error) {
    console.warn(
      `[harvest_kitchen] ${stationKey(ref)}: couldn't return ${count}× ${typeId}: ${String(error)}`,
    );
  }
}

/**
 * Puts up to `count` of the held `typeId` in. Refuses non-ingredients, a full station and a busy
 * one. A raw ingredient of a pot dish is refused with "Make a mix first" and its mixes float above
 * the pot for this player (D16). Chimes when a new dish becomes possible.
 */
export function addFromHand(player: Player, ref: StationRef, typeId: string, count: number): void {
  if (!stationBlock(ref)) return;
  const state = readStation(ref);
  const result = addItems(
    ref.station,
    state,
    typeId,
    Math.min(count, getHeldItem(player)?.amount ?? 0),
  );
  switch (result.kind) {
    case "cooking":
      return showProgress(player, ref, state);
    case "done":
      return collect(player, ref);
    case "refused":
      if (result.madeInto.length === 0) {
        return refuse(player, ref, t("hk.station.refuse", itemName(typeId)));
      }
      showMixHint(player, ref, result.madeInto);
      return refuse(player, ref, t("hk.station.needs_mix"));
    case "full":
      return refuse(player, ref);
    case "none":
      return;
  }
  if (!consumeHeldItem(player, typeId, result.amount)) return;
  save(ref, result.state);
  popGhosts(ref, typeId, result.amount);

  const top = stationTop(ref);
  sound(ref.dimension, SOUND.potAccept, top);
  particle(ref.dimension, PARTICLE.splash, top, 2, 0.2);
  announceReady(player, ref, result.ready);
}

/** Starts `recipeId` if it's still possible; checks heat. Re-validates everything. */
export function startCooking(player: Player, ref: StationRef, recipeId: string): boolean {
  const block = stationBlock(ref);
  if (!block) {
    actionBar(player, t("hk.station.gone"));
    return false;
  }
  const result = startJob(ref.station, readStation(ref), recipeId, {
    hot: isHot(ref, block),
    fast,
    ticksPerSecond: TicksPerSecond,
  });
  switch (result.kind) {
    case "changed":
      actionBar(player, t("hk.station.changed"));
      return false;
    case "unknown":
      return false;
    case "missing":
      refuse(
        player,
        ref,
        t("hk.station.needs", result.first.missing, ingredientName(result.first.ingredient)),
      );
      return false;
    case "no_heat":
      noHeat(player, ref);
      return false;
  }
  save(ref, result.state);
  const top = stationTop(ref);
  sound(ref.dimension, SOUND.lid, top);
  sound(ref.dimension, SOUND.bubble, top);
  particle(ref.dimension, PARTICLE.steam, top, 2, 0.2);
  return true;
}

/** Hands the finished dish to `player` (hand first, then inventory). Anyone can collect. */
export function collect(player: Player, ref: StationRef): void {
  const result = collectOutput(readStation(ref));
  if (!result) return;
  const { out } = result;
  save(ref, result.state);
  returnItems(ref, out.item, out.count, () =>
    giveOrDrop(player, out.item, out.count, ref.dimension, stationTop(ref), true),
  );
  sound(ref.dimension, SOUND.pop, stationTop(ref));
}

/** Empty hand on an empty station: "Add ingredients". */
export function addHint(player: Player, ref: StationRef): void {
  sound(ref.dimension, SOUND.tap, stationTop(ref));
  actionBar(player, t("hk.station.add_hint"));
}

/**
 * Empty hand on a station with items but no dish yet: no form (D15). The ghosts above it show
 * everything that's missing; the action bar names the first one ("Add Onion", "Add 2 × Tomato").
 */
export function nextHint(player: Player, ref: StationRef, next: NextIngredient): void {
  sound(ref.dimension, SOUND.tap, stationTop(ref));
  const name = ingredientName(next.ingredient);
  actionBar(player, t("hk.station.next", next.missing > 1 ? t("hk.ui.item_count", next.missing, name) : name)); // prettier-ignore
}

/** Sneak + empty hand: everything comes out (idle or ready). */
export function takeAll(player: Player, ref: StationRef): void {
  const state = readStation(ref);
  if (state.job) return showProgress(player, ref, state);
  if (state.out) return collect(player, ref);
  const result = takeAllItems(state);
  if (!result) return addHint(player, ref);
  save(ref, result.state);
  for (const [id, n] of result.items) {
    returnItems(ref, id, n, () => giveOrDrop(player, id, n, ref.dimension, stationTop(ref)));
  }
  sound(ref.dimension, SOUND.pop, stationTop(ref));
}

/** Drops everything (ingredients of a running job and a finished dish included) and forgets it. */
export function spill(ref: StationRef): void {
  const state = readStation(ref);
  clearStation(ref);
  clearMixHints(ref);
  tracked.delete(stationKey(ref));
  fxStopStir(ref.dimension, ref.location); // fx: the spoon goes with the pot (scripts/fx)
  const center = {
    x: ref.location.x + 0.5,
    y: ref.location.y + 0.5,
    z: ref.location.z + 0.5,
  };
  for (const [id, n] of spillContents(state)) {
    returnItems(ref, id, n, () => dropItems(ref.dimension, center, id, n));
  }
}

/** A station placed where stale data survived (e.g. /setblock fires no break) starts empty. */
export function resetPlaced(ref: StationRef): void {
  clearStation(ref);
  tracked.delete(stationKey(ref));
  // Not inside the block's own onPlace: set its look (hot/cold) on the next tick.
  system.run(() => refreshVisuals(ref, { items: {} }));
}

// --- the sweep ------------------------------------------------------------------------------------

function finish(ref: StationRef, state: StationState): StationState {
  const result = finishJob(state, (id) => ItemTypes.get(id) !== undefined);
  if (!result) return state;
  if (result.kind === "cancelled") {
    console.warn(`[harvest_kitchen] ${stationKey(ref)}: ${result.problem}; cooking cancelled`);
    return result.state;
  }
  const top = stationTop(ref);
  sound(ref.dimension, SOUND.done, top);
  sound(ref.dimension, SOUND.pop, top);
  particle(ref.dimension, PARTICLE.sparkle, top, 6, 0.4);
  for (const player of ref.dimension.getPlayers({
    location: top,
    maxDistance: DONE_NOTIFY_RADIUS,
  })) {
    actionBar(player, t("hk.station.done", itemName(result.recipe.result)));
  }
  return result.state;
}

function sweepOne(ref: StationRef): void {
  if (!ref.dimension.isChunkLoaded(ref.location)) return;
  const block = stationBlock(ref);
  if (!block) {
    // Replaced without a break event (e.g. /setblock): give the contents back to the world.
    spill(ref);
    return;
  }
  const state = readStation(ref);
  if (isEmpty(state)) {
    tracked.delete(stationKey(ref));
    refreshVisuals(ref, state);
    return;
  }

  const job = state.job;
  const step = job && sweepStep(job, isHot(ref, block), fast);
  if (step && step.kind !== "paused") {
    if (step.kind === "cooking") particle(ref.dimension, PARTICLE.steam, stationTop(ref));
    save(ref, step.kind === "due" ? finish(ref, state) : { ...state, job: step.job });
    return;
  }
  if (!job && sweepCount % STATION_SPARKLE_EVERY === 0 && phaseOf(ref.station, state) === "ready") {
    particle(ref.dimension, PARTICLE.sparkle, stationTop(ref));
  }
  refreshVisuals(ref, state); // heat may have changed
}

function sweep(): void {
  sweepCount++;
  for (const [key, ref] of tracked) {
    try {
      sweepOne(ref);
    } catch (error) {
      console.warn(`[harvest_kitchen] station ${key}: ${String(error)}`);
    }
  }
}

/** Call from worldLoad: picks up stations that had contents when the world closed or /reload ran. */
export function startStationSweep(): void {
  fast = world.getDynamicProperty(WORLD_DEBUG_FAST) === true;
  for (const ref of findSavedStations()) tracked.set(stationKey(ref), ref);
  system.runInterval(sweep, STATION_SWEEP_TICKS);
  startGhosts(() => tracked.values());
}

export function trackedCount(): number {
  return tracked.size;
}

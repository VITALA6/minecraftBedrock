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
  FAST_COOK_TICKS,
  PARTICLE,
  SOUND,
  STATION_SPARKLE_EVERY,
  STATION_SWEEP_TICKS,
  WORLD_DEBUG_FAST,
} from "../config";
import {
  canMake,
  consume,
  findStationRecipe,
  ingredientsOf,
  missingFor,
  recipesFor,
  type StationRecipe,
} from "../data/recipes";
import { stationByBlock, type ContainerStation } from "../data/stations";
import { setStates, type StateValue } from "../lib/block-states";
import { actionBar, particle, sound } from "../lib/feedback";
import { consumeHeldItem, dropItems, getHeldItem, giveOrDrop } from "../lib/inventory";
import { ingredientName, itemName, t } from "../lib/text";
import { hasHeatBelow } from "./heat";
import {
  clearStation,
  findSavedStations,
  isEmpty,
  readStation,
  stationKey,
  writeStation,
  type StationRef,
  type StationState,
} from "./station-store";

// The generic container station (plan §5.2). Everything here works from a ContainerStation config
// (data/stations.ts) and that station's recipes (data/recipes.ts); nothing names the pot.
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

export type Phase = "idle" | "ready" | "cooking" | "done";

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

export function totalItems(state: StationState): number {
  return Object.values(state.items).reduce((sum, n) => sum + n, 0);
}

export function possibleRecipes(station: ContainerStation, state: StationState): StationRecipe[] {
  return recipesFor(station.id).filter((recipe) => canMake(state.items, recipe.ingredients));
}

export function phaseOf(station: ContainerStation, state: StationState): Phase {
  if (state.job) return "cooking";
  if (state.out) return "done";
  return possibleRecipes(station, state).length > 0 ? "ready" : "idle";
}

/**
 * The recipe closest to what's in the station, for the "Almost!" button: fewest missing items
 * among recipes that use at least one item already inside.
 */
export function closestRecipe(
  station: ContainerStation,
  state: StationState,
): { recipe: StationRecipe; missing: ReturnType<typeof missingFor> } | undefined {
  let best:
    { recipe: StationRecipe; missing: ReturnType<typeof missingFor>; n: number } | undefined;
  for (const recipe of recipesFor(station.id)) {
    const uses = recipe.ingredients.some((i) => i.items.some((id) => (state.items[id] ?? 0) > 0));
    if (!uses) continue;
    const missing = missingFor(state.items, recipe.ingredients);
    const n = missing.reduce((sum, m) => sum + m.missing, 0);
    if (n > 0 && (!best || n < best.n)) best = { recipe, missing, n };
  }
  return best && { recipe: best.recipe, missing: best.missing };
}

export function isIngredient(station: ContainerStation, typeId: string): boolean {
  return ingredientsOf(station.id).has(typeId);
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

/** Pushes the saved state (and the heat below) into the block states that drive the model. */
export function refreshVisuals(ref: StationRef, state = readStation(ref)): void {
  const block = stationBlock(ref);
  if (!block) return;
  const { fill, phase, hot } = ref.station.states;
  const patch: Record<string, StateValue> = {};
  if (fill) {
    const amount = totalItems(state) + (state.out?.count ?? 0);
    const level = amount === 0 ? 0 : Math.ceil((amount / ref.station.capacity) * fill.levels);
    patch[fill.name] = Math.max(0, Math.min(fill.levels, level));
  }
  if (phase) patch[phase] = phaseOf(ref.station, state);
  if (hot) patch[hot] = isHot(ref, block);
  try {
    setStates(block, patch);
  } catch (error) {
    console.warn(`[harvest_kitchen] ${stationKey(ref)}: visual update failed: ${String(error)}`);
  }
}

function save(ref: StationRef, state: StationState): void {
  writeStation(ref, state);
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

function noHeat(player: Player, ref: StationRef): void {
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

/** "♨ ■■■□□" — five cells; pauses (and says so) without heat. */
export function showProgress(player: Player, ref: StationRef, state = readStation(ref)): void {
  const job = state.job;
  const block = stationBlock(ref);
  if (!job || !block) return;
  sound(ref.dimension, SOUND.bubbleShort, stationTop(ref), { volume: 0.6 });
  if (!isHot(ref, block)) {
    actionBar(player, t("hk.station.no_heat"));
    return;
  }
  const done = Math.max(0, Math.min(5, Math.floor(((job.total - job.ticks) / job.total) * 5)));
  actionBar(player, t("hk.station.progress", "■".repeat(done) + "□".repeat(5 - done)));
}

// --- actions --------------------------------------------------------------------------------------

/**
 * Puts up to `count` of the held `typeId` in. Refuses non-ingredients, a full station and a busy
 * one. Chimes when a new dish becomes possible.
 */
export function addFromHand(player: Player, ref: StationRef, typeId: string, count: number): void {
  if (!stationBlock(ref)) return;
  const state = readStation(ref);
  if (state.job) return showProgress(player, ref, state);
  if (state.out) return collect(player, ref);
  if (!isIngredient(ref.station, typeId)) {
    return refuse(player, ref, t("hk.station.refuse", itemName(typeId)));
  }
  const room = ref.station.capacity - totalItems(state);
  if (room <= 0) return refuse(player, ref);

  const amount = Math.min(room, count, getHeldItem(player)?.amount ?? 0);
  if (amount <= 0 || !consumeHeldItem(player, typeId, amount)) return;

  const before = new Set(possibleRecipes(ref.station, state).map((r) => r.id));
  const next: StationState = {
    items: { ...state.items, [typeId]: (state.items[typeId] ?? 0) + amount },
  };
  save(ref, next);

  const top = stationTop(ref);
  sound(ref.dimension, SOUND.potAccept, top);
  particle(ref.dimension, PARTICLE.splash, top, 2, 0.2);
  const added = possibleRecipes(ref.station, next).filter((r) => !before.has(r.id));
  if (added.length > 0) announceReady(player, ref, possibleRecipes(ref.station, next));
}

/** Starts `recipeId` if it's still possible; checks heat. Re-validates everything. */
export function startCooking(player: Player, ref: StationRef, recipeId: string): boolean {
  if (!stationBlock(ref)) {
    actionBar(player, t("hk.station.gone"));
    return false;
  }
  const state = readStation(ref);
  if (state.job || state.out) {
    actionBar(player, t("hk.station.changed"));
    return false;
  }
  const recipe = findStationRecipe(recipeId);
  if (!recipe || recipe.station !== ref.station.id) return false;
  const missing = missingFor(state.items, recipe.ingredients);
  const [first] = missing;
  if (first) {
    refuse(player, ref, t("hk.station.needs", first.missing, ingredientName(first.ingredient)));
    return false;
  }
  const block = stationBlock(ref);
  if (!block || !isHot(ref, block)) {
    noHeat(player, ref);
    return false;
  }

  const total = fast ? FAST_COOK_TICKS : Math.max(1, Math.round(recipe.seconds * TicksPerSecond));
  save(ref, { items: state.items, job: { recipe: recipe.id, ticks: total, total } });
  const top = stationTop(ref);
  sound(ref.dimension, SOUND.lid, top);
  sound(ref.dimension, SOUND.bubble, top);
  particle(ref.dimension, PARTICLE.steam, top, 2, 0.2);
  return true;
}

/** Hands the finished dish to `player` (hand first, then inventory). Anyone can collect. */
export function collect(player: Player, ref: StationRef): void {
  const state = readStation(ref);
  const out = state.out;
  if (!out) return;
  save(ref, { items: state.items });
  giveOrDrop(player, out.item, out.count, ref.dimension, stationTop(ref), true);
  sound(ref.dimension, SOUND.pop, stationTop(ref));
}

/** Takes out every ingredient of one type (pot screen "In the pot" button). */
export function takeOut(player: Player, ref: StationRef, typeId: string): boolean {
  if (!stationBlock(ref)) {
    actionBar(player, t("hk.station.gone"));
    return false;
  }
  const state = readStation(ref);
  const count = state.items[typeId] ?? 0;
  if (state.job || count === 0) {
    actionBar(player, t("hk.station.changed"));
    return false;
  }
  const items = { ...state.items };
  delete items[typeId];
  save(ref, { ...state, items });
  giveOrDrop(player, typeId, count, ref.dimension, stationTop(ref));
  sound(ref.dimension, SOUND.pop, stationTop(ref));
  return true;
}

/** Sneak + empty hand: everything comes out (idle or ready). */
export function takeAll(player: Player, ref: StationRef): void {
  const state = readStation(ref);
  if (state.job) return showProgress(player, ref, state);
  if (state.out) return collect(player, ref);
  if (totalItems(state) === 0) {
    sound(ref.dimension, SOUND.tap, stationTop(ref));
    actionBar(player, t("hk.station.add_hint"));
    return;
  }
  save(ref, { items: {} });
  for (const [id, n] of Object.entries(state.items)) {
    giveOrDrop(player, id, n, ref.dimension, stationTop(ref));
  }
  sound(ref.dimension, SOUND.pop, stationTop(ref));
}

/** Drops everything (ingredients of a running job and a finished dish included) and forgets it. */
export function spill(ref: StationRef): void {
  const state = readStation(ref);
  clearStation(ref);
  tracked.delete(stationKey(ref));
  const center = {
    x: ref.location.x + 0.5,
    y: ref.location.y + 0.5,
    z: ref.location.z + 0.5,
  };
  for (const [id, n] of Object.entries(state.items)) dropItems(ref.dimension, center, id, n);
  if (state.out) dropItems(ref.dimension, center, state.out.item, state.out.count);
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
  const job = state.job;
  if (!job) return state;
  // Cancel (keeping the ingredients) rather than consume them for a dish that can't be made:
  // a recipe removed in an update, contents that somehow changed, or a result item that failed
  // to load.
  const recipe = findStationRecipe(job.recipe);
  const problem = !recipe
    ? `unknown recipe "${job.recipe}"`
    : !canMake(state.items, recipe.ingredients)
      ? `ingredients missing for ${recipe.id}`
      : !ItemTypes.get(recipe.result)
        ? `result item ${recipe.result} isn't loaded (check the Content Log for item errors)`
        : undefined;
  if (!recipe || problem) {
    console.warn(`[harvest_kitchen] ${stationKey(ref)}: ${problem}; cooking cancelled`);
    return { items: state.items };
  }

  const next: StationState = {
    items: consume(state.items, recipe.ingredients),
    out: { item: recipe.result, count: recipe.count },
  };
  const top = stationTop(ref);
  sound(ref.dimension, SOUND.done, top);
  sound(ref.dimension, SOUND.pop, top);
  particle(ref.dimension, PARTICLE.sparkle, top, 6, 0.4);
  for (const player of ref.dimension.getPlayers({
    location: top,
    maxDistance: DONE_NOTIFY_RADIUS,
  })) {
    actionBar(player, t("hk.station.done", itemName(recipe.result)));
  }
  return next;
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
  if (job && isHot(ref, block)) {
    const ticks = (fast ? Math.min(job.ticks, FAST_COOK_TICKS) : job.ticks) - STATION_SWEEP_TICKS;
    const next = ticks <= 0 ? finish(ref, state) : { ...state, job: { ...job, ticks } };
    if (ticks > 0) particle(ref.dimension, PARTICLE.steam, stationTop(ref));
    save(ref, next);
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
}

export function trackedCount(): number {
  return tracked.size;
}

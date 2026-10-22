import { FAST_COOK_TICKS, STATION_SWEEP_TICKS } from "../config";
import {
  canMake,
  consumeServings,
  findStationRecipe,
  ingredientsOf,
  missingFor,
  recipesFor,
  servingsOf,
  stationInputsMadeFrom,
  type Ingredient,
  type StationRecipe,
} from "../data/recipes";
import { findDish } from "../data/dishes";
import { dominantLiquid, type Liquid } from "../data/liquids";
import type { ContainerStation } from "../data/stations";

// The container station's rules as pure functions of its saved state: what's possible, what a
// use does, how cooking counts down, what comes out. No @minecraft/server import (not even
// transitively), so tests run them in Node (packs/harvest_kitchen/tests/). station-engine.ts reads
// and saves the state, checks heat and does the feedback; station-store.ts persists it.

// --- state ---------------------------------------------------------------------------------------

export type Phase = "idle" | "ready" | "cooking" | "done";

export interface StationJob {
  readonly recipe: string;
  /** Cook time left. Counts down only while the station has heat, so it pauses without it. */
  readonly ticks: number;
  /** Cook time at the start, for the progress bar. */
  readonly total: number;
  /** Servings cooking at once (every serving the station held when it started; D16). */
  readonly servings: number;
}

/** A finished dish waiting in the station until someone collects it. */
export interface StationOutput {
  readonly item: string;
  readonly count: number;
}

export interface StationState {
  readonly items: Readonly<Record<string, number>>;
  readonly job?: StationJob;
  readonly out?: StationOutput;
}

export const EMPTY: StationState = { items: {} };

export function isEmpty(state: StationState): boolean {
  return !state.job && !state.out && Object.keys(state.items).length === 0;
}

// --- saved form ----------------------------------------------------------------------------------
// One JSON value per station (see station-store.ts for the key):
//   {"st":"pot","dim":"minecraft:overworld","pos":[10,64,-3],"items":{"hk:tomato":2},
//    "job":{"recipe":"hk:tomato_soup","ticks":60,"total":100,"servings":2},
//    "out":{"item":"…","count":2}}
// st/dim/pos are repeated in the value so active stations can be found again after a reload
// without parsing keys. Values are validated on read; anything malformed is dropped.

export interface SavedStation {
  readonly state: StationState;
  readonly station?: string;
  readonly dim?: string;
  readonly pos?: { readonly x: number; readonly y: number; readonly z: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseItems(raw: unknown): Record<string, number> {
  const items: Record<string, number> = {};
  if (!isRecord(raw)) return items;
  for (const [id, count] of Object.entries(raw)) if (positiveInt(count)) items[id] = count;
  return items;
}

function parseJob(raw: unknown): StationJob | undefined {
  if (!isRecord(raw)) return undefined;
  const { recipe, ticks, total, servings } = raw;
  if (typeof recipe !== "string" || typeof ticks !== "number" || !positiveInt(total)) return;
  // Jobs saved before batch cooking have no servings: they cooked one.
  const n = positiveInt(servings) ? servings : 1;
  return { recipe, ticks: Math.max(0, Math.floor(ticks)), total, servings: n };
}

function parseOut(raw: unknown): StationOutput | undefined {
  if (!isRecord(raw)) return undefined;
  const { item, count } = raw;
  return typeof item === "string" && positiveInt(count) ? { item, count } : undefined;
}

/** Reads a saved value; undefined if it isn't a JSON object at all. */
export function parseSaved(raw: string): SavedStation | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  const job = parseJob(value.job);
  const out = parseOut(value.out);
  const state: StationState = {
    items: parseItems(value.items),
    ...(job ? { job } : {}),
    ...(out ? { out } : {}),
  };
  const { st, dim, pos } = value;
  const validPos =
    Array.isArray(pos) && pos.length === 3 && pos.every((n) => typeof n === "number")
      ? { x: pos[0] as number, y: pos[1] as number, z: pos[2] as number }
      : undefined;
  return {
    state,
    station: typeof st === "string" ? st : undefined,
    dim: typeof dim === "string" ? dim : undefined,
    pos: validPos,
  };
}

export function serializeSaved(
  station: string,
  dim: string,
  { x, y, z }: { readonly x: number; readonly y: number; readonly z: number },
  state: StationState,
): string {
  return JSON.stringify({
    st: station,
    dim,
    pos: [x, y, z],
    items: state.items,
    job: state.job,
    out: state.out,
  });
}

// --- reading -------------------------------------------------------------------------------------

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

/** The fill state 0..levels: any contents (a finished dish included) show at least level 1. */
export function fillLevel(station: ContainerStation, state: StationState, levels: number): number {
  const amount = totalItems(state) + (state.out?.count ?? 0);
  const level = amount === 0 ? 0 : Math.ceil((amount / station.capacity) * levels);
  return Math.max(0, Math.min(levels, level));
}

/** The colour an item gives the station's liquid: that of the dish the first recipe using it makes. */
export function itemLiquid(station: ContainerStation, itemId: string): Liquid | undefined {
  const recipe = recipesFor(station.id).find((r) =>
    r.ingredients.some((i) => i.items.includes(itemId)),
  );
  return recipe && findDish(recipe.result)?.liquid;
}

/**
 * The liquid colour the station shows, so the pot reflects what's in it:
 *   - done: the finished dish's colour; cooking: the job's dish;
 *   - otherwise the colour there's most of among its contents, each mix counting as its dish's
 *     colour (dominantLiquid, data/liquids.ts; ties go to the stronger colour);
 *   - nothing that colours it -> clear water.
 */
export function liquidOf(station: ContainerStation, state: StationState): Liquid {
  const result = state.out
    ? state.out.item
    : state.job
      ? findStationRecipe(state.job.recipe)?.result
      : undefined;
  const dishLiquid = result === undefined ? undefined : findDish(result)?.liquid;
  return dishLiquid ?? dominantLiquid(state.items, (id) => itemLiquid(station, id));
}

/**
 * The recipe closest to what's in the station, for the ghosts and the "Add <item>" hint: fewest
 * missing items among recipes that use at least one item already inside (ties: the first in
 * recipe order).
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

/** "■■■□□": how many of the five progress cells are filled. */
export function progressCells(job: StationJob): number {
  return Math.max(0, Math.min(5, Math.floor(((job.total - job.ticks) / job.total) * 5)));
}

// --- using the station ---------------------------------------------------------------------------

/** The first missing slot of the closest recipe: what the "Add Onion" hint names. */
export interface NextIngredient {
  readonly ingredient: Ingredient;
  readonly missing: number;
}

/** What one use of the station does (plan §2.3, D15). */
export type UseAction =
  | { readonly kind: "progress" }
  | { readonly kind: "collect" }
  | { readonly kind: "add"; readonly typeId: string; readonly count: number }
  | { readonly kind: "hint" }
  | ({ readonly kind: "next" } & NextIngredient)
  | { readonly kind: "cook"; readonly recipe: string }
  | { readonly kind: "choose"; readonly recipes: readonly string[] }
  | { readonly kind: "take_all" };

/** Sneak + use goes through the before-event when the hand is empty or holds an ingredient. */
export function sneakHandles(station: ContainerStation, heldTypeId: string | undefined): boolean {
  return heldTypeId === undefined || isIngredient(station, heldTypeId);
}

/**
 * Routes one use:
 *   cooking -> progress, done -> collect (any hand, sneaking or not)
 *   holding an item -> add one (sneak: the whole stack)
 *   empty hand: empty -> "Add ingredients"; items but no dish -> "Add <first missing>" (no form:
 *   the ghosts above the pot show the rest); one dish possible -> cook it; several -> the choice
 *   form (the only form the pot has, D15);
 *   sneak + empty hand -> everything comes out.
 */
export function routeUse(
  station: ContainerStation,
  state: StationState,
  held: { readonly typeId: string; readonly amount: number } | undefined,
  sneaking: boolean,
): UseAction {
  const phase = phaseOf(station, state);
  if (phase === "cooking") return { kind: "progress" };
  if (phase === "done") return { kind: "collect" };
  const viaSneak = sneaking && sneakHandles(station, held?.typeId);
  if (held) return { kind: "add", typeId: held.typeId, count: viaSneak ? held.amount : 1 };
  if (totalItems(state) === 0) return { kind: "hint" };
  if (viaSneak) return { kind: "take_all" };
  const possible = possibleRecipes(station, state);
  const [only] = possible;
  if (only && possible.length === 1) return { kind: "cook", recipe: only.id };
  if (possible.length > 1) return { kind: "choose", recipes: possible.map((r) => r.id) };
  const first = closestRecipe(station, state)?.missing[0];
  return first ? { kind: "next", ...first } : { kind: "hint" };
}

/**
 * The dishes the choice form offers: only while two or more are possible right now (a single one
 * cooks without a form). Re-checked before the form opens and after every tap.
 */
export function choiceOf(station: ContainerStation, state: StationState): StationRecipe[] {
  if (state.job || state.out) return [];
  const possible = possibleRecipes(station, state);
  return possible.length > 1 ? possible : [];
}

export type AddResult =
  | { readonly kind: "cooking" | "done" | "full" | "none" }
  | {
      readonly kind: "refused";
      /** What the station takes that's made from this item (a raw ingredient's mixes), if any. */
      readonly madeInto: readonly string[];
    }
  | {
      readonly kind: "added";
      readonly amount: number;
      readonly state: StationState;
      /** Every possible recipe if the add made a new one possible (for the chime), else []. */
      readonly ready: StationRecipe[];
    };

/**
 * Puts up to `count` of `typeId` in, capped by the room left. Refuses non-ingredients, a full
 * station and a busy one; "none" when there's nothing to put in (`count` 0).
 */
export function addItems(
  station: ContainerStation,
  state: StationState,
  typeId: string,
  count: number,
): AddResult {
  if (state.job) return { kind: "cooking" };
  if (state.out) return { kind: "done" };
  if (!isIngredient(station, typeId)) {
    return { kind: "refused", madeInto: stationInputsMadeFrom(station.id, typeId) };
  }
  const room = station.capacity - totalItems(state);
  if (room <= 0) return { kind: "full" };
  const amount = Math.min(room, count);
  if (amount <= 0) return { kind: "none" };

  const before = new Set(possibleRecipes(station, state).map((r) => r.id));
  const next: StationState = {
    items: { ...state.items, [typeId]: (state.items[typeId] ?? 0) + amount },
  };
  const possible = possibleRecipes(station, next);
  const ready = possible.some((r) => !before.has(r.id)) ? possible : [];
  return { kind: "added", amount, state: next, ready };
}

/** Cook time in ticks for a new job (debug fast mode: FAST_COOK_TICKS). */
export function cookTicks(recipe: StationRecipe, fast: boolean, ticksPerSecond: number): number {
  return fast ? FAST_COOK_TICKS : Math.max(1, Math.round(recipe.seconds * ticksPerSecond));
}

export type StartResult =
  | { readonly kind: "changed" | "unknown" | "no_heat" }
  | { readonly kind: "missing"; readonly first: ReturnType<typeof missingFor>[number] }
  | { readonly kind: "started"; readonly state: StationState };

/**
 * Starts `recipeId` if it's still possible and there's heat. Re-validates everything. Every
 * serving the station holds cooks at once (3 tomato soup mixes -> 3 soups, one cook time).
 */
export function startJob(
  station: ContainerStation,
  state: StationState,
  recipeId: string,
  options: { readonly hot: boolean; readonly fast: boolean; readonly ticksPerSecond: number },
): StartResult {
  if (state.job || state.out) return { kind: "changed" };
  const recipe = findStationRecipe(recipeId);
  if (!recipe || recipe.station !== station.id) return { kind: "unknown" };
  const [first] = missingFor(state.items, recipe.ingredients);
  if (first) return { kind: "missing", first };
  if (!options.hot) return { kind: "no_heat" };
  const total = cookTicks(recipe, options.fast, options.ticksPerSecond);
  const servings = servingsOf(state.items, recipe.ingredients);
  return {
    kind: "started",
    state: { items: state.items, job: { recipe: recipe.id, ticks: total, total, servings } },
  };
}

export type SweepStep =
  | { readonly kind: "paused" }
  | { readonly kind: "cooking"; readonly job: StationJob }
  | { readonly kind: "due" };

/**
 * One sweep (every STATION_SWEEP_TICKS) of a running job. Without heat it pauses: the ticks left
 * stay as they are. Fast mode caps what's left at FAST_COOK_TICKS, so running jobs finish within
 * a second. "due" means call finishJob.
 */
export function sweepStep(job: StationJob, hot: boolean, fast: boolean): SweepStep {
  if (!hot) return { kind: "paused" };
  const ticks = (fast ? Math.min(job.ticks, FAST_COOK_TICKS) : job.ticks) - STATION_SWEEP_TICKS;
  return ticks > 0 ? { kind: "cooking", job: { ...job, ticks } } : { kind: "due" };
}

export type FinishResult =
  | { readonly kind: "finished"; readonly state: StationState; readonly recipe: StationRecipe }
  | { readonly kind: "cancelled"; readonly state: StationState; readonly problem: string };

/**
 * Turns a due job into its dishes: the ingredients of every serving are consumed in the same step
 * that creates the output (never more servings than are still inside). Cancels (keeping the
 * ingredients) rather than consume them for a dish that can't be made: a recipe removed in an
 * update, contents that somehow changed, or a result item that failed to load (`isItemLoaded`).
 */
export function finishJob(
  state: StationState,
  isItemLoaded: (typeId: string) => boolean,
): FinishResult | undefined {
  const job = state.job;
  if (!job) return undefined;
  const recipe = findStationRecipe(job.recipe);
  const problem = !recipe
    ? `unknown recipe "${job.recipe}"`
    : !canMake(state.items, recipe.ingredients)
      ? `ingredients missing for ${recipe.id}`
      : !isItemLoaded(recipe.result)
        ? `result item ${recipe.result} isn't loaded (check the Content Log for item errors)`
        : undefined;
  if (!recipe || problem) {
    return { kind: "cancelled", state: { items: state.items }, problem: problem ?? "" };
  }
  const servings = Math.min(job.servings, servingsOf(state.items, recipe.ingredients));
  return {
    kind: "finished",
    recipe,
    state: {
      items: consumeServings(state.items, recipe.ingredients, servings),
      out: { item: recipe.result, count: recipe.count * servings },
    },
  };
}

/** The finished dish and what's left once it's handed out. */
export function collectOutput(
  state: StationState,
): { readonly out: StationOutput; readonly state: StationState } | undefined {
  return state.out && { out: state.out, state: { items: state.items } };
}

/** Sneak + empty hand: every ingredient comes out; undefined while busy or when empty. */
export function takeAllItems(
  state: StationState,
): { readonly items: [string, number][]; readonly state: StationState } | undefined {
  const items = Object.entries(state.items);
  if (state.job || state.out || items.length === 0) return undefined;
  return { items, state: EMPTY };
}

/** What a break drops: every ingredient (a running job's included) and a finished dish. */
export function spillContents(state: StationState): [string, number][] {
  const drops = Object.entries(state.items);
  if (state.out) drops.push([state.out.item, state.out.count]);
  return drops;
}

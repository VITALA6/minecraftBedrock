import {
  GHOST_ALPHA,
  GHOST_ALT_TICKS,
  GHOST_BOB_SECONDS,
  GHOST_DONE_ALPHA,
  GHOST_HEIGHT,
  GHOST_MAX_ICONS,
  GHOST_SPACING,
  GHOST_WAVE_SECONDS,
} from "../config";
import { ghostIconIndex } from "../data/ghost-atlas";
import type { ContainerStation } from "../data/stations";
import { closestRecipe, possibleRecipes, type StationState } from "./station-logic";

// Ghost ingredients above a pot (D15), as pure functions: what a pot shows, where each icon goes
// for one viewer, which pots a player sees, and which ghost pops when an item goes in. No
// @minecraft/server import; stations/ghosts.ts spawns the particles.
//
//   empty                    nothing
//   idle with items          one ghost per missing item of the closest recipe (1 of 2 onions
//                            in -> one onion ghost), in the recipe's slot order
//   ready (1+ dishes match)  the dish icon(s), with a sparkle
//   cooking                  nothing: the lid, steam and the progress bar already say it
//   done                     the finished dish, nearly solid, no sparkle: it's real now, and it
//                            says *what* is waiting (the block only says "done")
//   hint (D16)               for one player, for a few seconds after they used a raw ingredient
//                            on the pot: the mix(es) it goes into, whatever the pot holds
//
// With mixes (D16) every pot recipe is one mix, so "missing" only shows for a station whose
// recipes have several slots (none yet; an oven could).

export type GhostMode = "none" | "missing" | "ready" | "done" | "hint";

export interface GhostIcon {
  /** The item the icon shows (for a "cod or salmon" slot, one of them in turn). */
  readonly item: string;
  /** Items that fill this ghost's slot: adding one of them pops it. Empty for dish icons. */
  readonly accepts: readonly string[];
}

export interface GhostView {
  readonly mode: GhostMode;
  readonly icons: readonly GhostIcon[];
  /** The recipe the missing ghosts belong to. */
  readonly recipe?: string;
}

export const NO_GHOSTS: GhostView = { mode: "none", icons: [] };

/** Which alternative a multi-item slot shows at `tick`: each one for GHOST_ALT_TICKS. */
export function altCycle(tick: number): number {
  return Math.floor(tick / GHOST_ALT_TICKS);
}

const dishIcon = (item: string): GhostIcon => ({ item, accepts: [] });

/** What the pot shows above it. `cycle` picks the alternative of "cod or salmon" slots. */
export function ghostsFor(station: ContainerStation, state: StationState, cycle = 0): GhostView {
  if (state.job) return NO_GHOSTS;
  if (state.out) return { mode: "done", icons: [dishIcon(state.out.item)] };
  if (Object.keys(state.items).length === 0) return NO_GHOSTS;

  const possible = possibleRecipes(station, state);
  if (possible.length > 0) {
    return {
      mode: "ready",
      icons: possible.slice(0, GHOST_MAX_ICONS).map((r) => dishIcon(r.result)),
    };
  }
  const closest = closestRecipe(station, state);
  if (!closest) return NO_GHOSTS;
  const icons: GhostIcon[] = [];
  for (const { ingredient, missing } of closest.missing) {
    const item = ingredient.items[cycle % ingredient.items.length] ?? ingredient.items[0];
    if (item === undefined) continue;
    for (let i = 0; i < missing && icons.length < GHOST_MAX_ICONS; i++) {
      icons.push({ item, accepts: ingredient.items });
    }
  }
  return icons.length > 0 ? { mode: "missing", icons, recipe: closest.recipe.id } : NO_GHOSTS;
}

/** The "make a mix first" hint: the mixes a refused raw ingredient goes into. */
export function hintView(items: readonly string[]): GhostView {
  if (items.length === 0) return NO_GHOSTS;
  return { mode: "hint", icons: items.slice(0, GHOST_MAX_ICONS).map(dishIcon) };
}

// --- how it looks ---------------------------------------------------------------------------------

export interface GhostStyle {
  /** Particle alpha (the hk:ghost_icon tint), set per spawn. */
  readonly alpha: number;
  /** A sparkle emitter at the row's centre. */
  readonly sparkle: boolean;
}

export function ghostStyle(mode: GhostMode): GhostStyle {
  return {
    alpha: mode === "done" ? GHOST_DONE_ALPHA : GHOST_ALPHA,
    sparkle: mode === "ready",
  };
}

/** Emitters one pot costs per update: one per icon, plus the sparkle. */
export function spawnCost(view: GhostView): number {
  return view.icons.length + (ghostStyle(view.mode).sparkle ? 1 : 0);
}

/**
 * The Molang inputs of one icon spawn. `hk_phase` makes the bob continuous across re-spawns (it's
 * the world time within one bob period) and shifts neighbours so the row bobs like a wave.
 */
export function iconVariables(
  item: string,
  index: number,
  mode: GhostMode,
  tick: number,
): { readonly icon: number; readonly alpha: number; readonly phase: number } | undefined {
  const icon = ghostIconIndex(item);
  if (icon < 0) return undefined;
  const period = GHOST_BOB_SECONDS * 20;
  return {
    icon,
    alpha: ghostStyle(mode).alpha,
    phase: (tick % period) / 20 + index * GHOST_WAVE_SECONDS,
  };
}

/** The particle variable each iconVariables field goes into (the JSON reads exactly these). */
export const GHOST_ICON_VARIABLES = {
  icon: "variable.hk_icon",
  alpha: "variable.hk_alpha",
  phase: "variable.hk_phase",
} as const;

// --- where it goes --------------------------------------------------------------------------------

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Centre of the pot block at `location` (its block origin). */
export function potCenter(location: Vec3): Vec3 {
  return { x: location.x + 0.5, y: location.y, z: location.z + 0.5 };
}

/**
 * Icon centres for one viewer: a row GHOST_HEIGHT above the pot, across the viewer's line of sight
 * (so it never shows edge-on), first icon on the viewer's left. A viewer straight above the pot
 * gets an east-west row.
 */
export function ghostPositions(pot: Vec3, viewer: Vec3, count: number): Vec3[] {
  const center = potCenter(pot);
  const dx = center.x - viewer.x;
  const dz = center.z - viewer.z;
  const length = Math.hypot(dx, dz);
  // Looking along (dx, dz), the right-hand side is (-dz, dx) in Minecraft's x-east, z-south axes.
  const axis = length < 1e-6 ? { x: 1, z: 0 } : { x: -dz / length, z: dx / length };
  const positions: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * GHOST_SPACING;
    positions.push({
      x: center.x + axis.x * offset,
      y: pot.y + GHOST_HEIGHT,
      z: center.z + axis.z * offset,
    });
  }
  return positions;
}

/** Where the sparkle goes: the middle of the row. */
export function rowCenter(pot: Vec3): Vec3 {
  const center = potCenter(pot);
  return { ...center, y: pot.y + GHOST_HEIGHT };
}

export interface PotPlace {
  readonly key: string;
  readonly dimension: string;
  readonly location: Vec3;
}

/** The pots a player sees ghosts for: same dimension, within `radius` of the centre, nearest first. */
export function nearestPots<T extends PotPlace>(
  viewer: Vec3,
  dimension: string,
  pots: Iterable<T>,
  radius: number,
  max: number,
): T[] {
  const near: { pot: T; d: number }[] = [];
  for (const pot of pots) {
    if (pot.dimension !== dimension) continue;
    const c = potCenter(pot.location);
    const d = (c.x - viewer.x) ** 2 + (c.y + 0.5 - viewer.y) ** 2 + (c.z - viewer.z) ** 2;
    if (d <= radius * radius) near.push({ pot, d });
  }
  near.sort((a, b) => a.d - b.d || a.pot.key.localeCompare(b.pot.key));
  return near.slice(0, max).map((n) => n.pot);
}

// --- popping --------------------------------------------------------------------------------------

/**
 * The ghosts `amount` × `typeId` going in fills: the first ones whose slot accepts it. Only missing
 * ghosts pop; a dish icon never does.
 */
export function popIndices(view: GhostView, typeId: string, amount: number): number[] {
  if (view.mode !== "missing") return [];
  const out: number[] = [];
  view.icons.forEach((icon, i) => {
    if (out.length < amount && icon.accepts.includes(typeId)) out.push(i);
  });
  return out;
}

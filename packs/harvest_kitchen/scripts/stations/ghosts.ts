import { MolangVariableMap, system, world, type Player } from "@minecraft/server";
import {
  GHOST_MAX_POTS_PER_PLAYER,
  GHOST_MAX_SPAWNS_PER_UPDATE,
  GHOST_PARTICLE,
  GHOST_RADIUS,
  GHOST_UPDATE_TICKS,
} from "../config";
import {
  altCycle,
  GHOST_ICON_VARIABLES,
  ghostPositions,
  ghostsFor,
  ghostStyle,
  iconVariables,
  nearestPots,
  popIndices,
  rowCenter,
  spawnCost,
  type GhostView,
  type Vec3,
} from "./ghost-logic";
import { readStation, stationKey, type StationRef } from "./station-store";

// Ghost ingredients above the pot (D15): what's still missing floats above it as semi-transparent
// bobbing icons; a pot that can cook shows the dish with a sparkle. The decisions are pure
// (ghost-logic.ts); this module only spawns particles.
//
// Cost rules (plan §5.4):
// - One runInterval (GHOST_UPDATE_TICKS) for everything. The pots come from the station engine's
//   active list (stations with contents), the viewers from world.getAllPlayers(): no per-block
//   tick, no world scan. Each pot's state is read once per update, however many players see it.
// - Each player sees at most GHOST_MAX_POTS_PER_PLAYER pots (nearest first, within GHOST_RADIUS),
//   and one update spawns at most GHOST_MAX_SPAWNS_PER_UPDATE emitters in total.
// - Particles are per player (Player.spawnParticle), so each row faces its own viewer, and the
//   particle lifetime is the update period plus one fade, so ghosts cross-fade without stacking.
//   Nothing is saved; a ghost that's no longer wanted just isn't re-spawned.

interface Shown {
  readonly ref: StationRef;
  view: GhostView;
  positions: Vec3[];
}

/** What each player saw in the last update, for the pop when an item goes in. */
const shown = new Map<string, { readonly player: Player; readonly pots: Map<string, Shown> }>();

function spawn(player: Player, id: string, at: Vec3, vars?: MolangVariableMap): boolean {
  try {
    player.spawnParticle(id, at, vars);
    return true;
  } catch {
    return false; // the player left, or the spot just unloaded: the next update tries again
  }
}

function spawnRow(player: Player, ref: StationRef, view: GhostView, tick: number): Vec3[] {
  const positions = ghostPositions(ref.location, player.location, view.icons.length);
  view.icons.forEach((icon, i) => {
    const at = positions[i];
    const input = iconVariables(icon.item, i, view.mode, tick);
    if (!at || !input) return; // an item without an atlas cell: tests keep this from happening
    const vars = new MolangVariableMap();
    vars.setFloat(GHOST_ICON_VARIABLES.icon, input.icon);
    vars.setFloat(GHOST_ICON_VARIABLES.alpha, input.alpha);
    vars.setFloat(GHOST_ICON_VARIABLES.phase, input.phase);
    spawn(player, GHOST_PARTICLE.icon, at, vars);
  });
  if (ghostStyle(view.mode).sparkle) spawn(player, GHOST_PARTICLE.sparkle, rowCenter(ref.location));
  return positions;
}

function update(stations: () => Iterable<StationRef>): void {
  shown.clear();
  const players = world.getAllPlayers();
  if (players.length === 0) return;
  const pots = [...stations()].map((ref) => ({
    ref,
    key: stationKey(ref),
    dimension: ref.dimension.id,
    location: ref.location,
  }));
  if (pots.length === 0) return;

  const tick = system.currentTick;
  const views = new Map<string, GhostView>();
  let budget = GHOST_MAX_SPAWNS_PER_UPDATE;
  for (const player of players) {
    if (!player.isValid) continue;
    const mine = new Map<string, Shown>();
    const near = nearestPots(
      player.location,
      player.dimension.id,
      pots,
      GHOST_RADIUS,
      GHOST_MAX_POTS_PER_PLAYER,
    );
    for (const pot of near) {
      let view = views.get(pot.key);
      if (!view) {
        view = ghostsFor(pot.ref.station, readStation(pot.ref), altCycle(tick));
        views.set(pot.key, view);
      }
      const cost = spawnCost(view);
      if (cost === 0 || cost > budget) continue;
      budget -= cost;
      mine.set(pot.key, { ref: pot.ref, view, positions: spawnRow(player, pot.ref, view, tick) });
    }
    if (mine.size > 0) shown.set(player.id, { player, pots: mine });
  }
}

/** Call once from worldLoad with the engine's active stations. */
export function startGhosts(stations: () => Iterable<StationRef>): void {
  system.runInterval(() => {
    try {
      update(stations);
    } catch (error) {
      console.warn(`[harvest_kitchen] ghosts: ${String(error)}`);
    }
  }, GHOST_UPDATE_TICKS);
}

/**
 * `amount` × `typeId` just went into the station at `ref`: every player who sees its missing
 * ghosts gets a small pop where the filled ones float. Those ghosts are dropped from what the
 * player "sees", so a second add before the next update pops the next one. The particle itself
 * fades out on its own within GHOST_LIFETIME_SECONDS (particles can't be removed).
 */
export function popGhosts(ref: StationRef, typeId: string, amount: number): void {
  const key = stationKey(ref);
  for (const { player, pots } of shown.values()) {
    const seen = pots.get(key);
    if (!seen || !player.isValid) continue;
    const popped = popIndices(seen.view, typeId, amount);
    for (const i of popped) {
      const at = seen.positions[i];
      if (at) spawn(player, GHOST_PARTICLE.pop, at);
    }
    if (popped.length === 0) continue;
    const keep = (_: unknown, i: number) => !popped.includes(i);
    seen.view = { ...seen.view, icons: seen.view.icons.filter(keep) };
    seen.positions = seen.positions.filter(keep);
  }
}

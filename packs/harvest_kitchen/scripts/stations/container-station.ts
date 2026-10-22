import {
  system,
  world,
  type Block,
  type BlockComponentRegistry,
  type BlockCustomComponent,
  type Player,
} from "@minecraft/server";
import { COMPONENT_CONTAINER_STATION } from "../config";
import { stationByBlock } from "../data/stations";
import { getHeldItem } from "../lib/inventory";
import { openPotScreen } from "../ui/pot-screen";
import { HEAT_BLOCK_IDS } from "./heat";
import {
  addFromHand,
  addHint,
  collect,
  refAt,
  refreshVisuals,
  resetPlaced,
  showProgress,
  spill,
  startCooking,
  takeAll,
} from "./station-engine";
import { routeUse, sneakHandles } from "./station-logic";
import { readStation, type StationRef } from "./station-store";

// Interaction routing for container stations (plan §2.3); the routing decision is routeUse in
// station-logic.ts, the actions are in station-engine.ts.
//
//   phase cooking         any hand    -> progress "♨ ■■■□□" (or "Needs fire below")
//   phase done            any hand    -> the dish goes to your hand / inventory
//   holding an item                   -> add one (sneak: the whole stack)
//   empty hand, ready, one dish       -> start cooking, no form
//   empty hand, ready, several dishes -> pot screen
//   empty hand, idle with items       -> pot screen ("Almost!")
//   empty hand, idle and empty        -> "Add ingredients"
//   sneak + empty hand                -> everything comes out
//
// Sneak + use is routed through world.beforeEvents.playerInteractWithBlock: whether a block's
// onPlayerInteract fires at all while sneaking with an item isn't proven in game, so the
// before-event cancels the vanilla action and handles it in the next tick. The component skips
// the same cases, so nothing runs twice.

function handleUse(player: Player, ref: StationRef, sneaking: boolean): void {
  const state = readStation(ref);
  const action = routeUse(ref.station, state, getHeldItem(player), sneaking);
  switch (action.kind) {
    case "progress":
      return showProgress(player, ref, state);
    case "collect":
      return collect(player, ref);
    case "add":
      return addFromHand(player, ref, action.typeId, action.count);
    case "hint":
      return addHint(player, ref);
    case "cook":
      startCooking(player, ref, action.recipe);
      return;
    case "screen":
      return openPotScreen(player, ref);
    case "take_all":
      return takeAll(player, ref);
  }
}

const containerStation: BlockCustomComponent = {
  onPlayerInteract({ block, player }) {
    const ref = refAt(block);
    if (!player || !ref) return;
    if (player.isSneaking && sneakHandles(ref.station, getHeldItem(player)?.typeId)) return;
    handleUse(player, ref, false);
  },

  // A station placed where old data survived (the previous one was removed by /setblock or /fill,
  // which fire no break event) starts empty instead of inheriting it. Permutation changes keep
  // the same block type and are skipped.
  onPlace({ block, previousBlock }) {
    const ref = refAt(block);
    if (!ref || previousBlock.type.id === block.typeId) return;
    resetPlaced(ref);
  },

  // Idle, empty stations aren't in the sweep; random ticks keep their hot/cold look honest.
  onRandomTick({ block }) {
    const ref = refAt(block);
    if (ref) refreshVisuals(ref);
  },

  // Both hooks spill; spill clears the data first, so whichever runs second finds nothing. The
  // block is air by now, so the station comes from the broken permutation.
  onPlayerBreak({ block, brokenBlockPermutation }) {
    const station = stationByBlock(brokenBlockPermutation.type.id);
    if (station) spill({ station, dimension: block.dimension, location: block.location });
  },
  onBreak({ block, brokenBlockPermutation }) {
    const station = stationByBlock(brokenBlockPermutation.type.id);
    if (station) spill({ station, dimension: block.dimension, location: block.location });
  },
};

/** Refreshes the hot/cold look of a station directly above `block` (or two above, for fire). */
function refreshAbove(block: Block): void {
  for (const steps of [1, 2]) {
    try {
      const above = block.above(steps);
      const ref = above && refAt(above);
      if (ref) refreshVisuals(ref);
    } catch {
      // top of the world or unloaded
    }
  }
}

export function registerContainerStation(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_CONTAINER_STATION, containerStation);
}

export function registerStationEvents(): void {
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { block, player, itemStack, isFirstEvent } = event;
    const ref = refAt(block);
    if (!ref || !player.isSneaking || !sneakHandles(ref.station, itemStack?.typeId)) return;
    event.cancel = true;
    if (!isFirstEvent) return;
    // Before-events run in restricted mode: change the world on the next tick.
    system.run(() => {
      const now = player.isValid ? refAt(block) : undefined;
      if (now) handleUse(player, now, true);
    });
  });

  // Heat placed, broken, lit or put out below an idle station.
  world.afterEvents.playerPlaceBlock.subscribe(({ block }) => refreshAbove(block), {
    blockTypes: [...HEAT_BLOCK_IDS],
  });
  world.afterEvents.playerBreakBlock.subscribe(({ block }) => refreshAbove(block), {
    blockTypes: [...HEAT_BLOCK_IDS],
  });
  // Only the first event of a press: holding the button repeats this for every block in the world.
  world.afterEvents.playerInteractWithBlock.subscribe(({ block, isFirstEvent }) => {
    if (isFirstEvent) system.runTimeout(() => refreshAbove(block), 1);
  });
}

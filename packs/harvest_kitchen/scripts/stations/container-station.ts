import {
  system,
  world,
  type Block,
  type BlockComponentRegistry,
  type BlockCustomComponent,
  type Player,
} from "@minecraft/server";
import { COMPONENT_CONTAINER_STATION, SOUND } from "../config";
import { stationByBlock } from "../data/stations";
import { actionBar, sound } from "../lib/feedback";
import { getHeldItem } from "../lib/inventory";
import { t } from "../lib/text";
import { openPotScreen } from "../ui/pot-screen";
import { HEAT_BLOCK_IDS } from "./heat";
import {
  addFromHand,
  collect,
  isIngredient,
  phaseOf,
  possibleRecipes,
  refAt,
  refreshVisuals,
  resetPlaced,
  showProgress,
  spill,
  startCooking,
  stationTop,
  takeAll,
  totalItems,
} from "./station-engine";
import { readStation, type StationRef } from "./station-store";

// Interaction routing for container stations (plan §2.3); the rules are in station-engine.ts.
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

function sneakHandles(ref: StationRef, heldTypeId: string | undefined): boolean {
  return heldTypeId === undefined || isIngredient(ref.station, heldTypeId);
}

function handleUse(player: Player, ref: StationRef): void {
  const state = readStation(ref);
  const phase = phaseOf(ref.station, state);
  if (phase === "cooking") return showProgress(player, ref, state);
  if (phase === "done") return collect(player, ref);

  const held = getHeldItem(player);
  if (held) return addFromHand(player, ref, held.typeId, 1);

  if (totalItems(state) === 0) {
    sound(ref.dimension, SOUND.tap, stationTop(ref));
    actionBar(player, t("hk.station.add_hint"));
    return;
  }
  const possible = possibleRecipes(ref.station, state);
  const [only] = possible;
  if (only && possible.length === 1) {
    startCooking(player, ref, only.id);
    return;
  }
  openPotScreen(player, ref);
}

function handleSneakUse(player: Player, ref: StationRef): void {
  const state = readStation(ref);
  const phase = phaseOf(ref.station, state);
  if (phase === "cooking") return showProgress(player, ref, state);
  if (phase === "done") return collect(player, ref);
  const held = getHeldItem(player);
  if (held) return addFromHand(player, ref, held.typeId, held.amount);
  takeAll(player, ref);
}

const containerStation: BlockCustomComponent = {
  onPlayerInteract({ block, player }) {
    const ref = refAt(block);
    if (!player || !ref) return;
    if (player.isSneaking && sneakHandles(ref, getHeldItem(player)?.typeId)) return;
    handleUse(player, ref);
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
    if (!ref || !player.isSneaking || !sneakHandles(ref, itemStack?.typeId)) return;
    event.cancel = true;
    if (!isFirstEvent) return;
    // Before-events run in restricted mode: change the world on the next tick.
    system.run(() => {
      const now = player.isValid ? refAt(block) : undefined;
      if (now) handleSneakUse(player, now);
    });
  });

  // Heat placed, broken, lit or put out below an idle station.
  world.afterEvents.playerPlaceBlock.subscribe(({ block }) => refreshAbove(block), {
    blockTypes: [...HEAT_BLOCK_IDS],
  });
  world.afterEvents.playerBreakBlock.subscribe(({ block }) => refreshAbove(block), {
    blockTypes: [...HEAT_BLOCK_IDS],
  });
  world.afterEvents.playerInteractWithBlock.subscribe(({ block }) => {
    system.runTimeout(() => refreshAbove(block), 1);
  });
}

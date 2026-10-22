import {
  BlockPermutation,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  ItemStack,
  Player,
  system,
  type CustomCommandRegistry,
  type RawMessage,
} from "@minecraft/server";
import { DEBUG_GROW_RADIUS, STATE_GROWTH } from "../config";
import { resetDiscovery } from "../discovery/discovery";
import { HK_ITEM_IDS } from "../discovery/unlock";
import { CROPS } from "../data/crops";
import { CRAFTING_RECIPES, STATION_RECIPES } from "../data/recipes";
import { lastValidation, validateData } from "../data/validate";
import { getState, setState } from "../lib/block-states";
import { giveOrDrop } from "../lib/inventory";
import { raw, t } from "../lib/text";
import { isFast, refAt, setFast, trackedCount } from "../stations/station-engine";
import { ghostsFor, type GhostView } from "../stations/ghost-logic";
import { phaseOf } from "../stations/station-logic";
import { readStation, storedSize } from "../stations/station-store";

// /hk:debug <kit|grow|fast|pot|validate|reset> — operator-only test helpers (plan §6):
//   kit       every Harvest Kitchen item, the vanilla ingredients the recipes use, a campfire
//   grow      matures Harvest Kitchen crops within DEBUG_GROW_RADIUS blocks
//   fast      toggles near-instant cooking (saved in the world)
//   pot       prints the state of the station you're looking at
//   validate  re-runs the data check and prints it to chat (the Content Log loses its tail)
//   reset     forgets your discovered crops and that you got the starter poster
//
// Custom commands register only in system.beforeEvents.startup, and their callbacks run in
// restricted mode (@privilege no-restricted-execution on world changes), so every action is
// deferred with system.run. Output goes to the caller's chat as lang keys plus raw data.

const COMMAND = "hk:debug";
const ACTION_ENUM = "hk:debug_action";
const ACTIONS = ["kit", "grow", "fast", "pot", "validate", "reset"] as const;
type Action = (typeof ACTIONS)[number];

function isAction(value: unknown): value is Action {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

const KIT_EXTRAS: readonly [string, number][] = [
  ["minecraft:campfire", 1],
  ["minecraft:bone_meal", 32],
  ["minecraft:wooden_hoe", 1],
  ["minecraft:water_bucket", 1],
  ["minecraft:paper", 2], // + any crop: a Recipe Poster
];

function kit(player: Player): void {
  const vanilla = new Set<string>();
  for (const recipe of [...STATION_RECIPES, ...CRAFTING_RECIPES]) {
    for (const id of recipe.ingredients.flatMap((i) => i.items)) {
      if (!id.startsWith("hk:")) vanilla.add(id);
    }
  }
  const at = player.location;
  // 8 of anything that stacks, 1 of dishes in bowls; what doesn't fit drops at your feet.
  const give = (id: string) => {
    try {
      giveOrDrop(player, id, Math.min(8, new ItemStack(id).maxAmount), player.dimension, at);
    } catch {
      player.sendMessage(raw(`§c${id} isn't loaded`));
    }
  };
  for (const id of HK_ITEM_IDS) give(id);
  for (const id of vanilla) give(id);
  for (const [id, n] of KIT_EXTRAS) giveOrDrop(player, id, n, player.dimension, at);
  player.sendMessage(t("hk.debug.kit", HK_ITEM_IDS.length + vanilla.size + KIT_EXTRAS.length));
}

const maxStages = new Map<string, number>();

function maxGrowth(blockId: string): number {
  let max = maxStages.get(blockId);
  if (max !== undefined) return max;
  max = 0;
  for (let stage = 15; stage > 0; stage--) {
    try {
      BlockPermutation.resolve(blockId, { [STATE_GROWTH]: stage });
      max = stage;
      break;
    } catch {
      // not a valid stage for this block
    }
  }
  maxStages.set(blockId, max);
  return max;
}

function grow(player: Player): void {
  const cropBlocks = new Set(CROPS.map((crop) => crop.block));
  const { x, y, z } = player.location;
  const r = DEBUG_GROW_RADIUS;
  let grown = 0;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        try {
          const block = player.dimension.getBlock({
            x: Math.floor(x) + dx,
            y: Math.floor(y) + dy,
            z: Math.floor(z) + dz,
          });
          if (!block || !cropBlocks.has(block.typeId)) continue;
          const max = maxGrowth(block.typeId);
          if (getState(block, STATE_GROWTH) === max) continue;
          setState(block, STATE_GROWTH, max);
          grown++;
        } catch {
          // outside the world or unloaded
        }
      }
    }
  }
  player.sendMessage(t("hk.debug.grow", grown));
}

/** "missing hk:onion minecraft:bowl (hk:onion_soup)" — what the D15 ghosts above it show. */
function ghostLine(view: GhostView): string {
  const recipe = view.recipe ? ` (${view.recipe})` : "";
  return `${view.mode} ${view.icons.map((i) => i.item).join(" ")}${recipe}`;
}

function pot(player: Player): void {
  const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
  const ref = hit && refAt(hit.block);
  if (!ref) {
    player.sendMessage(t("hk.debug.pot_none"));
    return;
  }
  const state = readStation(ref);
  const { x, y, z } = ref.location;
  const states = hit.block.permutation.getAllStates();
  const lines = [
    `${ref.station.id} @ ${x},${y},${z} phase=${phaseOf(ref.station, state)}`,
    `states ${JSON.stringify(states)}`,
    `items ${JSON.stringify(state.items)}`,
    `job ${state.job ? `${state.job.recipe} ${state.job.ticks}/${state.job.total} ticks` : "-"}`,
    `out ${state.out ? `${state.out.count}x ${state.out.item}` : "-"}`,
    `ghosts ${ghostLine(ghostsFor(ref.station, state))}`,
    `saved ${storedSize(ref)} chars, active stations ${trackedCount()}, fast ${isFast()}`,
  ];
  for (const line of lines) player.sendMessage(raw(line));
}

function validate(player: Player): void {
  const problems = validateData();
  player.sendMessage(t("hk.debug.validate", problems.length));
  for (const problem of problems.slice(0, 40)) player.sendMessage(raw(`§7- ${problem}`));
}

function run(player: Player, action: Action): void {
  switch (action) {
    case "kit":
      return kit(player);
    case "grow":
      return grow(player);
    case "fast":
      setFast(!isFast());
      return player.sendMessage(t(isFast() ? "hk.debug.fast_on" : "hk.debug.fast_off"));
    case "pot":
      return pot(player);
    case "validate":
      player.sendMessage(t("hk.debug.build", __BUILD_ID__));
      return validate(player);
    case "reset":
      resetDiscovery(player);
      return player.sendMessage(t("hk.debug.reset"));
  }
}

export function registerDebugCommand(registry: CustomCommandRegistry): void {
  registry.registerEnum(ACTION_ENUM, [...ACTIONS]);
  registry.registerCommand(
    {
      name: COMMAND,
      description: "Harvest Kitchen test helpers (kit, grow, fast, pot, validate, reset).",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      // Operator-only already; works in worlds without cheats so test sessions need no setup.
      cheatsRequired: false,
      mandatoryParameters: [{ name: ACTION_ENUM, type: CustomCommandParamType.Enum }],
    },
    (origin, action: unknown) => {
      const player = origin.sourceEntity;
      if (!(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Run this as a player." };
      }
      if (!isAction(action)) {
        return { status: CustomCommandStatus.Failure, message: `Use: ${ACTIONS.join(" | ")}` };
      }
      system.run(() => {
        if (player.isValid) run(player, action);
      });
      return { status: CustomCommandStatus.Success };
    },
  );
}

/** Chat on join is for test sessions only: release builds (npm run build:release) send none. */
function isTester(player: Player): boolean {
  return !__RELEASE__ && player.commandPermissionLevel >= CommandPermissionLevel.GameDirectors;
}

/** Operators see the running build on join (deploy only takes effect after re-entering). */
export function announceBuild(player: Player): void {
  if (isTester(player)) player.sendMessage(t("hk.debug.build", __BUILD_ID__));
}

/** Tells an operator on join if the data check found problems (the log file may have lost it). */
export function announceProblems(player: Player): void {
  const count = lastValidation().length;
  if (count === 0 || !isTester(player)) return;
  const message: RawMessage = t("hk.debug.problems", count);
  player.sendMessage(message);
}

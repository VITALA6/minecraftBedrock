import {
  BlockPermutation,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandSource,
  CustomCommandStatus,
  ItemStack,
  Player,
  system,
  type CustomCommandRegistry,
  type RawMessage,
} from "@minecraft/server";
import { DEBUG_GROW_RADIUS, STATE_GROWTH } from "../config";
import { resetDiscovery } from "../discovery/discovery";
import { MOD_ITEM_IDS } from "../discovery/unlock";
import { CROPS } from "../data/crops";
import { CRAFTING_RECIPES, STATION_RECIPES } from "../data/recipes";
import { lastValidation, validateData } from "../data/validate";
import { fxCounts } from "../fx/fx";
import { getState, setState } from "../lib/block-states";
import { giveOrDrop } from "../lib/inventory";
import { raw, t } from "../lib/text";
import { isFast, refAt, setFast, trackedCount } from "../stations/station-engine";
import { ghostsFor, type GhostView } from "../stations/ghost-logic";
import { phaseOf } from "../stations/station-logic";
import { readStation, storedSize } from "../stations/station-store";

// /wm_kitchen:debug <kit|grow|fast|pot|validate|reset|fx> — operator-only test helpers (plan §6):
//   kit       every Simmerfield item, the vanilla ingredients the recipes use, a campfire
//   grow      matures Simmerfield crops within DEBUG_GROW_RADIUS blocks
//   fast      toggles near-instant cooking (saved in the world)
//   pot       prints the state of the station you're looking at
//   validate  re-runs the data check and prints it to chat (the Content Log loses its tail)
//   reset     forgets your discovered crops and that you got the starter poster and guide book
//   fx        counts the live pot/board effect entities (knife, spoon)
//
// Custom commands register only in system.beforeEvents.startup, and their callbacks run in
// restricted mode (@privilege no-restricted-execution on world changes), so every action is
// deferred with system.run. Output goes to the caller's chat as lang keys plus raw data.

const COMMAND = "wm_kitchen:debug";
const ACTION_ENUM = "wm_kitchen:debug_action";
const ACTIONS = ["kit", "grow", "fast", "pot", "validate", "reset", "fx"] as const;
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
  ["minecraft:book", 1], // + a carrot: a Kitchen Guide
  // Kitchen decor: not in MOD_ITEM_IDS, which counts as "has a Simmerfield item" for discovery.
  ["wm_kitchen:kitchen_counter", 1],
  ["wm_kitchen:kitchen_cabinet", 1],
  ["wm_kitchen:spice_shelf", 1],
  ["wm_kitchen:kitchen_sink", 1],
  ["wm_kitchen:kitchen_stove", 1],
  ["wm_kitchen:hanging_pan", 1],
  ["wm_kitchen:pickle_jar", 1],
  ["wm_kitchen:vegetable_basket", 1],
];

function kit(player: Player): void {
  const vanilla = new Set<string>();
  for (const recipe of [...STATION_RECIPES, ...CRAFTING_RECIPES]) {
    for (const id of recipe.ingredients.flatMap((i) => i.items)) {
      if (!id.startsWith("wm_kitchen:")) vanilla.add(id);
    }
  }
  const at = player.location;
  // 8 of anything that stacks, 1 of dishes in bowls; what doesn't fit drops at your feet. An id
  // that doesn't load is named in chat and the rest of the kit still comes.
  const give = (id: string, count?: number) => {
    try {
      const n = count ?? Math.min(8, new ItemStack(id).maxAmount);
      giveOrDrop(player, id, n, player.dimension, at);
    } catch {
      player.sendMessage(raw(`§c${id} isn't loaded`));
    }
  };
  for (const id of MOD_ITEM_IDS) give(id);
  for (const id of vanilla) give(id);
  for (const [id, n] of KIT_EXTRAS) give(id, n);
  player.sendMessage(
    t("wm_kitchen.debug.kit", MOD_ITEM_IDS.length + vanilla.size + KIT_EXTRAS.length),
  );
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
  player.sendMessage(t("wm_kitchen.debug.grow", grown));
}

/** "missing wm_kitchen:onion minecraft:bowl (wm_kitchen:onion_soup)" — what the D15 ghosts above it show. */
function ghostLine(view: GhostView): string {
  const recipe = view.recipe ? ` (${view.recipe})` : "";
  return `${view.mode} ${view.icons.map((i) => i.item).join(" ")}${recipe}`;
}

function pot(player: Player): void {
  const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
  const ref = hit && refAt(hit.block);
  if (!ref) {
    player.sendMessage(t("wm_kitchen.debug.pot_none"));
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
  player.sendMessage(t("wm_kitchen.debug.validate", problems.length));
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
      return player.sendMessage(
        t(isFast() ? "wm_kitchen.debug.fast_on" : "wm_kitchen.debug.fast_off"),
      );
    case "pot":
      return pot(player);
    case "validate":
      player.sendMessage(t("wm_kitchen.debug.build", __BUILD_ID__));
      return validate(player);
    case "fx": {
      const { knife, spoon } = fxCounts();
      return player.sendMessage(t("wm_kitchen.debug.fx", knife, spoon));
    }
    case "reset":
      resetDiscovery(player);
      return player.sendMessage(t("wm_kitchen.debug.reset"));
  }
}

/** An operator: anyone above the default member level ("Any"). Readable in restricted mode. */
function isOperator(player: Player): boolean {
  return player.commandPermissionLevel >= CommandPermissionLevel.GameDirectors;
}

// Registered in every build, release included: it's how an operator checks a world (build id,
// data check, station state). Two gates keep it operator-only:
//   1. permissionLevel Admin: "any operator, but NOT command blocks" (the pinned .d.ts), so the
//      game itself refuses members and command blocks before the callback runs.
//   2. The callback re-checks the source: only a player running it directly (sourceType Entity,
//      not Block, NPCDialogue or Server), and that player must be an operator, again inside the
//      deferred run in case their level changed. A source that runs it as someone else
//      (`/execute as`) is held to that entity's level too.
export function registerDebugCommand(registry: CustomCommandRegistry): void {
  registry.registerEnum(ACTION_ENUM, [...ACTIONS]);
  registry.registerCommand(
    {
      name: COMMAND,
      description: "Simmerfield test helpers (kit, grow, fast, pot, validate, reset, fx).",
      permissionLevel: CommandPermissionLevel.Admin,
      // Operator-only already; works in worlds without cheats so test sessions need no setup.
      cheatsRequired: false,
      mandatoryParameters: [{ name: ACTION_ENUM, type: CustomCommandParamType.Enum }],
    },
    (origin, action: unknown) => {
      const player = origin.sourceEntity;
      if (origin.sourceType !== CustomCommandSource.Entity || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Run this as a player." };
      }
      if (!isOperator(player)) {
        return { status: CustomCommandStatus.Failure, message: "Operators only." };
      }
      if (!isAction(action)) {
        return { status: CustomCommandStatus.Failure, message: `Use: ${ACTIONS.join(" | ")}` };
      }
      system.run(() => {
        if (player.isValid && isOperator(player)) run(player, action);
      });
      return { status: CustomCommandStatus.Success };
    },
  );
}

// Chat on join is for test sessions only: release builds (npm run build:release) send none.
// Each function tests __RELEASE__ itself (not through a helper) so the release bundle compiles
// its body away; esbuild doesn't inline function calls.

/** Operators see the running build on join (deploy only takes effect after re-entering). */
export function announceBuild(player: Player): void {
  if (__RELEASE__) return;
  if (isOperator(player)) player.sendMessage(t("wm_kitchen.debug.build", __BUILD_ID__));
}

/** Tells an operator on join if the data check found problems (the log file may have lost it). */
export function announceProblems(player: Player): void {
  if (__RELEASE__) return;
  const count = lastValidation().length;
  if (count === 0 || !isOperator(player)) return;
  const message: RawMessage = t("wm_kitchen.debug.problems", count);
  player.sendMessage(message);
}

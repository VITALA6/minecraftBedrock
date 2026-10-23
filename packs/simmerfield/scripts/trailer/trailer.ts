import {
  BlockPermutation,
  EasingType,
  HudVisibility,
  InputPermissionCategory,
  ItemStack,
  Player,
  system,
  world,
  WeatherType,
  type Dimension,
  type ScriptEventCommandMessageAfterEvent,
} from "@minecraft/server";
import { STATE_CARDINAL } from "../config";
import { inventoryOf } from "../lib/inventory";
import { refAt, resetPlaced } from "../stations/station-engine";
import {
  GROUND,
  MARKER_SECONDS,
  SCENES,
  SET_BOUNDS,
  SET_LAYOUT,
  STILLS,
  sceneByName,
  stillByNumber,
  takeSeconds,
  type Actor,
  type BlockSpec,
  type Keyframe,
  type Placement,
  type Scene,
  type Still,
} from "./scenes";
import {
  blockToWorld,
  cardinalOf,
  facingFromYaw,
  parseAnchor,
  serializeAnchor,
  toWorld,
  type Anchor,
} from "./set-space";
import { parseTrailerCommand, USAGE, type TrailerCommand } from "./trailer-command";
import { sceneTimeline, toTicks, type Step } from "./timeline";

type CameraEase = Extract<Step, { kind: "camera" }>["ease"] & {};

// Trailer capture tool (dev builds only): `/scriptevent wm_kitchen:trailer <command>` runs the scenes of
// docs/simmerfield/marketing/trailer.md with a scripted camera, so every take of a shot
// frames the same. Recording workflow: docs/simmerfield/marketing/recording-guide.md.
// Commands: scripts/trailer/trailer-command.ts. Scene data: scripts/trailer/scenes.ts.
//
// system.afterEvents.scriptEventReceive is an after-event: its callback isn't in restricted
// execution, so the camera, HUD, time and block calls (@privilege no-restricted-execution) run
// directly. Every scheduled step re-checks that the player is still valid, and leaving cancels
// the player's session; a player who left mid-scene gets camera and HUD reset on their next join
// (the player property below).

const EVENT_ID = "wm_kitchen:trailer";
const WORLD_ANCHOR = "wm_kitchen:trailer.anchor";
/** Player property: a scene or still is (or was, when they left) controlling their view. */
const PLAYER_ACTIVE = "wm_kitchen:trailer.active";
const FREE_CAMERA = "minecraft:free"; // vanilla preset (in the 1.26.52.3 binary)
const WEATHER_TICKS = 1_000_000; // setWeather's upper bound
const FIRE_SAFE_TICKS = 20 * 120;
const PREFIX = "§6[trailer]§r ";

interface Session {
  readonly player: Player;
  readonly runs: number[];
  readonly label: string;
}

const sessions = new Map<string, Session>();
/** doDayLightCycle before the first session froze it; restored when the last one ends. */
let daylightBefore: boolean | undefined;

function say(player: Player, text: string): void {
  if (player.isValid) player.sendMessage(`${PREFIX}${text}`);
}

function readAnchor(): Anchor | undefined {
  return parseAnchor(world.getDynamicProperty(WORLD_ANCHOR));
}

// --- view control --------------------------------------------------------------------------------

function setCameraKey(player: Player, anchor: Anchor, key: Keyframe, ease?: CameraEase): void {
  const options = {
    location: toWorld(anchor, key.pos),
    facingLocation: toWorld(anchor, key.look),
  };
  if (ease) {
    player.camera.setCamera(FREE_CAMERA, {
      ...options,
      easeOptions: { easeTime: ease.seconds, easeType: EasingType[ease.type] },
    });
  } else {
    player.camera.setCamera(FREE_CAMERA, options);
  }
}

function marker(player: Player): void {
  player.camera.fade({
    fadeColor: { red: 0, green: 0, blue: 0 },
    fadeTime: { fadeInTime: 0, holdTime: MARKER_SECONDS, fadeOutTime: 0 },
  });
}

/** Each restore step on its own: one failing (or the player gone) must not skip the others. */
function restoreView(player: Player): void {
  const tryRun = (what: string, fn: () => void) => {
    try {
      fn();
    } catch (error) {
      console.warn(`[simmerfield] trailer restore ${what}: ${String(error)}`);
    }
  };
  if (!player.isValid) return;
  tryRun("camera", () => player.camera.clear());
  tryRun("fov", () => player.runCommand("camera @s fov_clear"));
  tryRun("hud", () => player.onScreenDisplay.setHudVisibility(HudVisibility.Reset));
  tryRun("look", () =>
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true),
  );
  tryRun("flag", () => player.setDynamicProperty(PLAYER_ACTIVE, undefined));
}

function endSession(playerId: string): Session | undefined {
  const session = sessions.get(playerId);
  if (!session) return undefined;
  for (const run of session.runs) system.clearRun(run);
  sessions.delete(playerId);
  if (sessions.size === 0 && daylightBefore !== undefined) {
    try {
      world.gameRules.doDayLightCycle = daylightBefore;
    } catch (error) {
      console.warn(`[simmerfield] trailer daylight restore: ${String(error)}`);
    }
    daylightBefore = undefined;
  }
  return session;
}

function stop(player: Player, quiet = false): void {
  const session = endSession(player.id);
  restoreView(player);
  if (!quiet)
    say(player, session ? `Stopped ${session.label}.` : "Nothing was running; view reset.");
}

function beginSession(player: Player, label: string): Session {
  stop(player, true);
  const session: Session = { player, runs: [], label };
  sessions.set(player.id, session);
  player.setDynamicProperty(PLAYER_ACTIVE, true);
  if (daylightBefore === undefined) daylightBefore = world.gameRules.doDayLightCycle;
  world.gameRules.doDayLightCycle = false;
  return session;
}

/** Schedules `fn` for the session; a gone player or a thrown error ends the session cleanly. */
function schedule(session: Session, ticks: number, fn: () => void): void {
  const run = system.runTimeout(() => {
    const { player } = session;
    if (sessions.get(player.id) !== session) return; // stopped or replaced
    if (!player.isValid) {
      endSession(player.id);
      return;
    }
    try {
      fn();
    } catch (error) {
      console.warn(`[simmerfield] trailer ${session.label}: ${String(error)}`);
      say(player, `§c${session.label} failed: ${String(error)}`);
      stop(player, true);
    }
  }, ticks);
  session.runs.push(run);
}

// --- the set -------------------------------------------------------------------------------------

function permutationOf(anchor: Anchor, spec: BlockSpec): BlockPermutation {
  const states: Record<string, boolean | number | string> = { ...spec.states };
  if (spec.cardinal) states[STATE_CARDINAL] = cardinalOf(anchor.facing, spec.cardinal);
  return BlockPermutation.resolve(spec.id, states);
}

/** Sets one staged block; returns a problem line instead of throwing. */
function place(dimension: Dimension, anchor: Anchor, placement: Placement): string | undefined {
  const location = blockToWorld(anchor, placement.at);
  try {
    dimension.setBlockPermutation(location, permutationOf(anchor, placement.block));
    // A staged pot starts empty, even where an earlier take left saved contents.
    const block = dimension.getBlock(location);
    const ref = block && refAt(block);
    if (ref) resetPlaced(ref);
    return undefined;
  } catch (error) {
    return `${placement.block.id} at ${location.x},${location.y},${location.z}: ${String(error)}`;
  }
}

function placeAll(
  dimension: Dimension,
  anchor: Anchor,
  placements: readonly Placement[],
): string[] {
  const problems: string[] = [];
  for (const placement of placements) {
    const problem = place(dimension, anchor, placement);
    if (problem) problems.push(problem);
  }
  return problems;
}

function* stageJob(
  player: Player,
  dimension: Dimension,
  anchor: Anchor,
): Generator<void, void, void> {
  const problems: string[] = [];
  const { min, max } = SET_BOUNDS;
  for (let x = min.x; x <= max.x; x++) {
    for (let z = min.z; z <= max.z; z++) {
      for (let y = min.y - 2; y <= max.y; y++) {
        const id = y === min.y - 2 ? GROUND.under : y === min.y - 1 ? GROUND.top : "minecraft:air";
        const location = blockToWorld(anchor, { x, y, z });
        try {
          dimension.setBlockType(location, id);
        } catch (error) {
          problems.push(`${id} at ${location.x},${location.y},${location.z}: ${String(error)}`);
        }
      }
      yield;
    }
  }
  for (const placement of SET_LAYOUT) {
    const problem = place(dimension, anchor, placement);
    if (problem) problems.push(problem);
    yield;
  }
  if (!player.isValid) return;
  say(player, `Set staged: ${SET_LAYOUT.length} blocks, ${problems.length} problems.`);
  for (const problem of problems.slice(0, 10)) say(player, `§7- ${problem}`);
}

// --- actor ---------------------------------------------------------------------------------------

function placeActor(player: Player, anchor: Anchor, actor: Actor | undefined): void {
  if (!actor) return;
  player.teleport(toWorld(anchor, actor.pos), { facingLocation: toWorld(anchor, actor.look) });
  if (actor.hotbar) {
    const inventory = inventoryOf(player);
    const slots = actor.hotbar.length === 0 ? [undefined] : actor.hotbar;
    slots.forEach((entry, slot) => {
      inventory?.setItem(slot, entry && new ItemStack(entry.item, entry.count));
    });
    player.selectedSlotIndex = 0;
  }
  if (actor.fireSafe) {
    player.addEffect("fire_resistance", FIRE_SAFE_TICKS, { showParticles: false });
  }
  if (actor.lockLook) {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false);
  }
}

function setWorld(player: Player, time: number): void {
  world.setTimeOfDay(time);
  player.dimension.setWeather(WeatherType.Clear, WEATHER_TICKS);
}

/** Checks the anchor exists and the player is in its dimension. */
function anchorFor(player: Player): Anchor | undefined {
  const anchor = readAnchor();
  if (!anchor) {
    say(
      player,
      "No anchor yet: stand at the set's origin, face east, run wm_kitchen:trailer anchor.",
    );
    return undefined;
  }
  if (anchor.dimension !== player.dimension.id) {
    say(player, `The anchor is in ${anchor.dimension}; go there first.`);
    return undefined;
  }
  return anchor;
}

// --- commands ------------------------------------------------------------------------------------

function runScene(player: Player, scene: Scene, preroll: number): void {
  const anchor = anchorFor(player);
  if (!anchor) return;
  const label = `shot ${scene.shot} "${scene.name}"`;
  const take = takeSeconds(scene, preroll);
  say(
    player,
    `${label}: ${scene.duration} s on screen, take ${take.toFixed(1)} s. ${scene.action}`,
  );
  if (scene.adapted) say(player, `§7Adapted: ${scene.adapted}`);

  const session = beginSession(player, label);
  setWorld(player, scene.time);
  const problems = placeAll(player.dimension, anchor, scene.stage ?? []);
  for (const problem of problems) say(player, `§c${problem}`);
  placeActor(player, anchor, scene.actor);
  if (scene.camera !== "ui") player.onScreenDisplay.setHudVisibility(HudVisibility.Hide);
  if (scene.camera === "scripted" && scene.fov !== undefined) {
    player.camera.setFov({ fov: scene.fov });
  }

  for (const step of sceneTimeline(scene, preroll)) {
    const run = () => {
      switch (step.kind) {
        case "marker":
          return marker(player);
        case "camera":
          return setCameraKey(player, anchor, step.key, step.ease);
        case "cue": {
          const problem = place(player.dimension, anchor, {
            at: step.cue.at,
            block: step.cue.block,
          });
          if (problem) console.warn(`[simmerfield] trailer cue: ${problem}`);
          const at = toWorld(anchor, { ...step.cue.at, y: step.cue.at.y + 0.5 });
          if (step.cue.sound) player.dimension.playSound(step.cue.sound, at);
          if (step.cue.particle) player.dimension.spawnParticle(step.cue.particle, at);
          return;
        }
        case "end":
          endSession(player.id);
          restoreView(player);
          return say(player, `${label} done (${scene.duration} s).`);
      }
    };
    if (step.kind === "camera" && scene.camera !== "scripted") continue;
    if (step.tick === 0) run();
    else schedule(session, step.tick, run);
  }
}

function runStill(player: Player, still: Still): void {
  const anchor = anchorFor(player);
  if (!anchor) return;
  const label = `still ${still.n} "${still.title}"`;
  beginSession(player, label);
  setWorld(player, still.time);
  for (const problem of placeAll(player.dimension, anchor, still.stage ?? [])) {
    say(player, `§c${problem}`);
  }
  placeActor(player, anchor, still.actor);
  say(player, `${label}: ${still.action} Stays until wm_kitchen:trailer stop.`);
  if (still.camera === "ui") return;
  player.onScreenDisplay.setHudVisibility(HudVisibility.Hide);
  if (still.fov !== undefined) player.camera.setFov({ fov: still.fov });
  setCameraKey(player, anchor, { at: 0, pos: still.pos, look: still.look });
}

function saveAnchor(player: Player): void {
  const { x, y, z } = player.location;
  const anchor: Anchor = {
    x: Math.floor(x),
    y: Math.floor(y),
    z: Math.floor(z),
    dimension: player.dimension.id,
    facing: facingFromYaw(player.getRotation().y),
  };
  world.setDynamicProperty(WORLD_ANCHOR, serializeAnchor(anchor));
  const hint = anchor.facing === "east" ? "" : " Face east for the planned sun direction.";
  say(
    player,
    `Anchor saved at ${anchor.x},${anchor.y},${anchor.z} facing ${anchor.facing}.${hint}`,
  );
}

function stage(player: Player): void {
  const anchor = anchorFor(player);
  if (!anchor) return;
  const { min, max } = SET_BOUNDS;
  say(
    player,
    `Staging: clears x ${min.x}..${max.x}, z ${min.z}..${max.z} around the anchor (set space), then builds the set.`,
  );
  system.runJob(stageJob(player, player.dimension, anchor));
}

function list(player: Player): void {
  say(player, USAGE);
  for (const scene of SCENES) {
    say(player, `§e${scene.name}§r (shot ${scene.shot}, ${scene.duration} s, ${scene.camera})`);
  }
  for (const still of STILLS) say(player, `§bstill ${still.n}§r ${still.title}`);
}

function execute(player: Player, command: TrailerCommand): void {
  switch (command.kind) {
    case "list":
      return list(player);
    case "anchor":
      return saveAnchor(player);
    case "stage":
      return stage(player);
    case "stop":
      return stop(player);
    case "still": {
      const still = stillByNumber(command.n);
      return still && runStill(player, still);
    }
    case "scene": {
      const scene = sceneByName(command.name);
      return scene && runScene(player, scene, command.preroll);
    }
    case "error":
      return say(player, `§c${command.message}`);
  }
}

function onScriptEvent(event: ScriptEventCommandMessageAfterEvent): void {
  if (event.id !== EVENT_ID) return;
  const player = event.sourceEntity ?? event.initiator;
  if (!(player instanceof Player)) {
    console.warn("[simmerfield] wm_kitchen:trailer needs a player: run it from chat.");
    return;
  }
  try {
    execute(player, parseTrailerCommand(event.message));
  } catch (error) {
    say(player, `§c${String(error)}`);
    stop(player, true);
  }
}

/** Dev builds only (main.ts: `if (!__RELEASE__) registerTrailer();`). Call at top level. */
export function registerTrailer(): void {
  system.afterEvents.scriptEventReceive.subscribe(onScriptEvent, { namespaces: ["wm_kitchen"] });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    endSession(playerId);
  });
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn || player.getDynamicProperty(PLAYER_ACTIVE) !== true) return;
    // Left mid-scene last time: hand the view back (the client may keep a hidden HUD).
    system.runTimeout(() => restoreView(player), toTicks(1));
  });
}

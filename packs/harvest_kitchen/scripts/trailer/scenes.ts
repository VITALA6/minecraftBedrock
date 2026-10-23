import {
  BLOCK_CHILI_BUSH,
  BLOCK_COOKING_POT,
  BLOCK_CUCUMBER_CROP,
  BLOCK_CUTTING_BOARD,
  BLOCK_ONION_CROP,
  BLOCK_STRAWBERRY_BUSH,
  BLOCK_STRAWBERRY_CAKE,
  BLOCK_TOMATO_CROP,
  ITEM_CHILI_STEW,
  ITEM_CUCUMBER,
  ITEM_GUIDE_BOOK,
  ITEM_ONION,
  ITEM_STRAWBERRY_JAM,
  ITEM_TOMATO,
  ITEM_TOMATO_SOUP_MIX,
  PARTICLE,
  SOUND,
  STATE_GROWTH,
  STATE_SLICES,
} from "../config";
import type { SetDirection, Vec3 } from "./set-space";

// The trailer's in-game scenes as data (docs/harvest-kitchen/marketing/trailer.md): one scene per
// shot of the shot list and one still camera per store screenshot. Pure (ids come from config.ts),
// so tests check it in Node; scripts/trailer/trailer.ts runs it with the camera API.
//
// Coordinates are set space (scripts/trailer/set-space.ts): relative to the saved anchor, +z the
// way the operator faced when they ran `/scriptevent hk:trailer anchor`. Face **east** when you
// anchor: the farm is then east of you, so the sunrise (shot 1) is behind it and the sunset (12,
// 13) behind the cake table.
//
// The set (SET_LAYOUT, built by `hk:trailer stage`), seen from above, +z up the page:
//
//   z 14   ######### wall for screenshot 6 (wool row under four columns of item frames)
//   z 10   fffffffff back fence
//   z  4-8 TTTTTTT f  B   farm rows: tomato 4, onion 5, water 6, cucumber 7, tomato 8; bushes x 5-6
//   z  3-5 C=pot, K=board on a counter at x -6                                  lava pool x 12, z 1-5
//   z -3   grass patch x 6-8 (shot 2)
//   z -6   cake on a log at x 0, fence posts with lanterns at x ±2

export type Ease =
  "Linear" | "InSine" | "OutSine" | "InOutSine" | "InQuad" | "OutQuad" | "InOutQuad" | "InOutCubic";

export interface Keyframe {
  /** Seconds from the start of the scene; the camera arrives here at this time. */
  readonly at: number;
  readonly pos: Vec3;
  /** The point the camera faces. */
  readonly look: Vec3;
  /** How the move from the previous keyframe eases. Default InOutSine. */
  readonly ease?: Ease;
  /** Jump here at `at` instead of moving (a cut inside the shot). */
  readonly cut?: boolean;
}

export type StateValue = boolean | number | string;

export interface BlockSpec {
  readonly id: string;
  readonly states?: Readonly<Record<string, StateValue>>;
  /** Sets STATE_CARDINAL (minecraft:cardinal_direction) to this set-space direction. */
  readonly cardinal?: SetDirection;
}

export interface Placement {
  /** Integer set-space block offset. */
  readonly at: Vec3;
  readonly block: BlockSpec;
}

/** A timed change during a scene: a block changes, with an optional sound and particle. */
export interface Cue {
  readonly time: number;
  readonly at: Vec3;
  readonly block: BlockSpec;
  readonly sound?: string;
  readonly particle?: string;
}

export interface HotbarItem {
  readonly item: string;
  readonly count: number;
}

/** Where the operator's player stands (teleported there) and what they hold. */
export interface Actor {
  readonly pos: Vec3;
  readonly look: Vec3;
  /** Locks mouse look, so a use hits what the mark faces (the camera shows another view). */
  readonly lockLook?: boolean;
  /** Hotbar slots 0.. are replaced with these; slot 0 is selected. [] = empty hand. */
  readonly hotbar?: readonly HotbarItem[];
  /** Safety Fire Resistance (no particles) for the lava shots. */
  readonly fireSafe?: boolean;
}

/**
 * - scripted: free camera on the keyframes, HUD hidden
 * - first_person: the player's own view (hand visible), HUD hidden, no camera override
 * - ui: the player's own view with the HUD on (the Kitchen Guide shot)
 */
export type CameraMode = "scripted" | "first_person" | "ui";

export interface Scene {
  /** Command argument and clip file name: trailer/raw/<name>.mkv. */
  readonly name: string;
  /** Shot number in trailer.md. */
  readonly shot: number;
  /** Seconds on screen in the plan's ~48 s cut (the "Dur" column). */
  readonly duration: number;
  /** Ticks, 0..23999 (world.setTimeOfDay). */
  readonly time: number;
  readonly camera: CameraMode;
  /** Field of view for the scripted camera (Camera.setFov). */
  readonly fov?: number;
  /** Scripted only: at least one; the first one is at 0, the last one at `duration`. */
  readonly keys: readonly Keyframe[];
  readonly actor?: Actor;
  /** Blocks set when the scene starts (on top of the staged set). */
  readonly stage?: readonly Placement[];
  readonly cues?: readonly Cue[];
  /** What the operator does while it runs; printed to chat before the take. */
  readonly action: string;
  /** Where the scene departs from trailer.md's shot text because the pack changed since. */
  readonly adapted?: string;
}

export interface Still {
  /** Screenshot number in trailer.md (1..8). */
  readonly n: number;
  readonly title: string;
  readonly time: number;
  /** "ui" keeps the HUD and the player's own view (screenshot 5); otherwise a still free camera. */
  readonly camera: "still" | "ui";
  readonly fov?: number;
  readonly pos: Vec3;
  readonly look: Vec3;
  readonly actor?: Actor;
  readonly stage?: readonly Placement[];
  readonly action: string;
}

/** Seconds of still camera before and after each scene: room for crossfades in the edit. */
export const HANDLE_SECONDS = 0.5;
/** Black frames before and after each take. tools/edit-trailer.mjs finds the scene by them. */
export const MARKER_SECONDS = 0.4;
/** Default wait between the command and the take (chat fades, the operator gets ready). */
export const DEFAULT_PREROLL_SECONDS = 5;
/** Every crop and bush in the pack grows 0..3 (hk:growth in the block JSONs; a test checks). */
export const MAX_GROWTH = 3;

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const grown = (id: string, stage = MAX_GROWTH): BlockSpec => ({
  id,
  states: { [STATE_GROWTH]: stage },
});
const plain = (id: string): BlockSpec => ({ id });

// --- the set -------------------------------------------------------------------------------------

/** Cleared to air (y 0..5) and re-grounded (grass on dirt) before the set is built. */
export const SET_BOUNDS = { min: v(-9, 0, -9), max: v(14, 5, 15) } as const;
export const GROUND = { top: "minecraft:grass_block", under: "minecraft:dirt" } as const;

const FARM_X = [-3, -2, -1, 0, 1, 2, 3] as const;
/** Mixed stages per row, so growth reads (screenshot 1: "leave one row at mixed stages"). */
const FARM_ROWS: readonly { z: number; block: string; stages: readonly number[] }[] = [
  { z: 4, block: BLOCK_TOMATO_CROP, stages: [3, 2, 3, 3, 1, 3, 2] },
  { z: 5, block: BLOCK_ONION_CROP, stages: [3, 3, 2, 3, 3, 1, 3] },
  { z: 7, block: BLOCK_CUCUMBER_CROP, stages: [2, 3, 3, 1, 3, 3, 3] },
  { z: 8, block: BLOCK_TOMATO_CROP, stages: [3, 3, 3, 3, 3, 3, 3] },
];
const FARMLAND: BlockSpec = { id: "minecraft:farmland", states: { moisturized_amount: 7 } };

/** The hero crop of shot 3 (front row, centre). */
export const HERO_CROP = v(0, 0, 4);
export const POT = v(-6, 1, 5);
export const BOARD = v(-6, 1, 3);
export const CAKE = v(0, 1, -6);
export const BUSH = v(5, 0, 6);

function buildLayout(): Placement[] {
  const out: Placement[] = [];
  const put = (at: Vec3, block: BlockSpec) => out.push({ at, block });
  // Farm: farmland rows with crops, a water channel at z 6 (hydrates z 2..10).
  for (const row of FARM_ROWS) {
    FARM_X.forEach((x, i) => {
      put(v(x, -1, row.z), FARMLAND);
      put(v(x, 0, row.z), grown(row.block, row.stages[i] ?? MAX_GROWTH));
    });
  }
  for (const x of FARM_X) put(v(x, -1, 6), plain("minecraft:water"));
  for (let x = -4; x <= 4; x++) put(v(x, 0, 10), plain("minecraft:oak_fence"));
  for (let z = 3; z <= 9; z++) put(v(4, 0, z), plain("minecraft:oak_fence"));
  // Bushes on grass east of the fence, flowers around (shot 4, screenshot 2).
  put(v(5, 0, 4), grown(BLOCK_CHILI_BUSH));
  put(BUSH, grown(BLOCK_STRAWBERRY_BUSH));
  put(v(6, 0, 6), grown(BLOCK_STRAWBERRY_BUSH));
  put(v(5, 0, 7), grown(BLOCK_STRAWBERRY_BUSH, 2));
  put(v(6, 0, 4), plain("minecraft:dandelion"));
  put(v(7, 0, 6), plain("minecraft:poppy"));
  put(v(6, 0, 8), plain("minecraft:cornflower"));
  for (const at of [v(7, 0, 5), v(7, 0, 7), v(6, 0, 7)]) put(at, plain("minecraft:pink_petals"));
  // Kitchen corner: the pot on a lit campfire, the board on a counter, a basket.
  put(v(-6, 0, 5), { id: "minecraft:campfire", states: { extinguished: false } });
  put(POT, plain(BLOCK_COOKING_POT));
  put(v(-6, 0, 3), plain("hk:kitchen_counter"));
  // Facing is blocker B9 (unproven): "forward" is how a player facing +z would place it.
  put(BOARD, { id: BLOCK_CUTTING_BOARD, cardinal: "forward" });
  put(v(-7, 0, 3), plain("hk:vegetable_basket"));
  // Cake table behind the anchor, lanterns on fence posts, flowers.
  put(v(0, 0, -6), plain("minecraft:stripped_oak_log"));
  put(CAKE, { id: BLOCK_STRAWBERRY_CAKE, states: { [STATE_SLICES]: 0 } });
  for (const x of [-2, 2]) {
    put(v(x, 0, -6), plain("minecraft:oak_fence"));
    put(v(x, 1, -6), plain("minecraft:lantern"));
  }
  put(v(1, 0, -8), plain("minecraft:poppy"));
  put(v(-1, 0, -8), plain("minecraft:dandelion"));
  put(v(-2, 0, -4), plain("minecraft:pink_petals"));
  // Grass to break for seeds (shot 2).
  for (let x = 6; x <= 8; x++) {
    for (let z = -3; z <= -1; z++) put(v(x, 0, z), plain("minecraft:short_grass"));
  }
  // Lava strip in a stone basin, nothing flammable within 3 blocks (shot 10, screenshot 8).
  for (let x = 11; x <= 13; x++) {
    for (let z = 0; z <= 6; z++) {
      put(v(x, -2, z), plain("minecraft:stone"));
      const lava = x === 12 && z >= 1 && z <= 5;
      put(v(x, -1, z), plain(lava ? "minecraft:lava" : "minecraft:stone"));
    }
  }
  // Wall for screenshot 6: wool under four columns (red, blue, yellow, green family colours).
  const wool: Record<number, string> = {
    [-3]: "minecraft:red_wool",
    [-1]: "minecraft:blue_wool",
    1: "minecraft:yellow_wool",
    3: "minecraft:green_wool",
  };
  for (let x = -4; x <= 4; x++) {
    for (let y = 0; y <= 4; y++) {
      const colour = y === 0 ? wool[x] : undefined;
      put(v(x, y, 14), plain(colour ?? "minecraft:oak_planks"));
    }
  }
  return out;
}

export const SET_LAYOUT: readonly Placement[] = buildLayout();

// --- the shots -----------------------------------------------------------------------------------

const MORNING = 1000;
const DAY = 2000;
const NOON = 6000;
const SUNSET = 12000;
const SUNRISE = 23000;
const NIGHT = 18000;

/** Points on a circle around `center` at height `y`, every `step` degrees, one per `dt` s. */
export function orbit(
  center: Vec3,
  radius: number,
  y: number,
  fromDeg: number,
  toDeg: number,
  duration: number,
  segments: number,
): Keyframe[] {
  const keys: Keyframe[] = [];
  for (let i = 0; i <= segments; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / segments;
    const rad = (deg * Math.PI) / 180;
    keys.push({
      at: Math.round(((duration * i) / segments) * 1000) / 1000,
      pos: v(center.x + radius * Math.sin(rad), y, center.z + radius * Math.cos(rad)),
      look: center,
      // Linear between points: constant speed, no stop at each keyframe.
      ease: "Linear",
    });
  }
  return keys;
}

const potCam = v(-3.3, 1.6, 5);
const potLook = v(-6, 1.35, 5);
const potActor: Actor = { pos: v(-6.4, 0, 6.6), look: v(-6, 1.3, 5), lockLook: true };

export const SCENES: readonly Scene[] = [
  {
    name: "farm",
    shot: 1,
    duration: 4,
    time: SUNRISE,
    camera: "scripted",
    fov: 80,
    keys: [
      { at: 0, pos: v(0, 1.3, -1.5), look: v(0, 0.6, 8) },
      { at: 4, pos: v(0, 1.0, 1.8), look: v(0, 0.4, 9), ease: "InOutSine" },
    ],
    actor: { pos: v(-8, 0, -8), look: v(0, 1, 6), hotbar: [] },
    action: "Nothing: the camera pushes in over the farm. You are parked out of frame.",
  },
  {
    name: "seeds",
    shot: 2,
    duration: 3,
    time: MORNING,
    camera: "scripted",
    fov: 70,
    keys: [{ at: 0, pos: v(7.7, 2.0, -5.7), look: v(7, 0.3, -2) }],
    actor: { pos: v(7, 0, -4.6), look: v(7, 0.2, -2), hotbar: [] },
    action: "Break grass in front of you until seeds drop (5 % per break; keep the good take).",
  },
  {
    name: "grow",
    shot: 3,
    duration: 4,
    time: MORNING,
    camera: "scripted",
    fov: 60,
    keys: [{ at: 0, pos: v(-1.4, 0.35, 3.0), look: v(0, 0.35, 4.3) }],
    actor: { pos: v(-8, 0, -8), look: v(0, 1, 4), hotbar: [] },
    stage: [{ at: HERO_CROP, block: plain("minecraft:air") }],
    cues: [
      { time: 0.4, at: HERO_CROP, block: grown(BLOCK_TOMATO_CROP, 0) },
      ...[1, 2, 3].map((stage, i) => ({
        time: 1.2 + i * 0.9,
        at: HERO_CROP,
        block: grown(BLOCK_TOMATO_CROP, stage),
        sound: SOUND.boneMeal,
        particle: PARTICLE.growth,
      })),
    ],
    action: "Nothing: the script plants the tomato and bone-meals it three stages.",
    adapted:
      "Scripted re-enactment: the scene sets the stages itself (with the bone meal sound and the growth particle), so the player is out of frame.",
  },
  {
    name: "berries",
    shot: 4,
    duration: 3,
    time: MORNING,
    camera: "scripted",
    fov: 70,
    keys: [
      { at: 0, pos: v(8.6, 2.6, 2.9), look: v(5.3, 0.5, 6) },
      { at: 3, pos: v(7.7, 2.6, 2.1), look: v(5.3, 0.5, 6), ease: "Linear" },
    ],
    actor: { pos: v(6, 0, 5), look: v(5, 0.4, 6), lockLook: true, hotbar: [] },
    stage: [{ at: BUSH, block: grown(BLOCK_STRAWBERRY_BUSH) }],
    action: "Use the strawberry bush in front of you with an empty hand.",
  },
  {
    name: "chop",
    shot: 5,
    duration: 4,
    time: DAY,
    camera: "scripted",
    fov: 60,
    keys: [{ at: 0, pos: v(-4.8, 2.35, 3), look: v(-6, 1.05, 3) }],
    actor: {
      pos: v(-6, 0, 1.9),
      look: v(-6, 1.05, 3),
      lockLook: true,
      hotbar: [
        { item: ITEM_TOMATO, count: 8 },
        { item: ITEM_ONION, count: 8 },
      ],
    },
    action:
      "Use the board with the tomato (slot 1), then switch to the onion (slot 2) and use it again.",
  },
  {
    name: "cook",
    shot: 6,
    duration: 3,
    time: DAY,
    camera: "scripted",
    fov: 70,
    keys: [{ at: 0, pos: potCam, look: potLook }],
    actor: { ...potActor, hotbar: [{ item: ITEM_TOMATO_SOUP_MIX, count: 2 }] },
    stage: [{ at: POT, block: plain(BLOCK_COOKING_POT) }],
    action: "Use the pot twice with the Tomato Soup Mix: two plops, the liquid rises.",
    adapted:
      "D16: the pot cooks mixes, not raw tomatoes. The player drops two Tomato Soup Mixes (2 tomatoes + a bowl on the crafting table). Start with an empty pot (sneak + empty hand takes everything out).",
  },
  {
    name: "simmer",
    shot: 7,
    duration: 3,
    time: DAY,
    camera: "scripted",
    fov: 70,
    keys: [
      { at: 0, pos: potCam, look: potLook },
      { at: 3, pos: v(-4.3, 1.5, 5), look: v(-6, 1.3, 5), ease: "InOutSine" },
    ],
    actor: { ...potActor, hotbar: [] },
    action: "The pot is ready from the cook take. Use it with an empty hand: cooking starts.",
    adapted:
      'No lid while cooking: the lid only shows when cooking pauses for lack of heat. The shot is "ready" (glint, chime), then an empty-hand use starts cooking: the lid sound, steam and the glowing rim.',
  },
  {
    name: "serve",
    shot: 8,
    duration: 3,
    time: DAY,
    camera: "first_person",
    keys: [],
    actor: { pos: v(-6, 0, 6.4), look: v(-6, 1.2, 5), hotbar: [] },
    action:
      "Wait for the done ding (/hk:debug fast helps), then use the pot: the soup goes to your hand.",
    adapted: 'No lid to take off: "done" is the bell and the dish is collected with one use.',
  },
  {
    name: "guide",
    shot: 9,
    duration: 4,
    time: DAY,
    camera: "ui",
    keys: [],
    actor: {
      pos: v(-4.5, 0, 4),
      look: v(-6, 1.2, 4),
      hotbar: [{ item: ITEM_GUIDE_BOOK, count: 1 }],
    },
    action: 'Use the Kitchen Guide, open "What can I make?", tap a dish.',
    adapted:
      'The Recipe Book screen is now the Kitchen Guide (an item, D19). Its "What can I make?" spread lists the dishes your inventory can make; give yourself only a few ingredients first.',
  },
  {
    name: "lava",
    shot: 10,
    duration: 4,
    time: NOON,
    camera: "scripted",
    fov: 70,
    keys: [
      { at: 0, pos: v(12.7, 2.0, -2.2), look: v(12, 0.6, 2) },
      { at: 1.5, pos: v(8.4, 2.0, 2.6), look: v(12, 0.3, 3), cut: true },
      { at: 4, pos: v(8.4, 2.0, 3.6), look: v(12, 0.3, 3.8), ease: "Linear" },
    ],
    actor: {
      pos: v(12, 0, -0.9),
      look: v(12, 0.6, 6),
      lockLook: true,
      fireSafe: true,
      hotbar: [{ item: ITEM_CHILI_STEW, count: 1 }],
    },
    action:
      "Eat the Chili Stew, then walk forward across the lava (look is locked straight ahead).",
  },
  {
    name: "jam",
    shot: 11,
    duration: 3,
    time: NOON,
    camera: "scripted",
    fov: 70,
    keys: [
      { at: 0, pos: v(-1.5, 0.7, -5), look: v(-4, 0.9, -1.5) },
      { at: 1, pos: v(-1.5, 0.7, -5), look: v(-4, 0.9, -1.5) },
      { at: 3, pos: v(4.5, 0.7, -5), look: v(9, 0.9, -1.5), ease: "InQuad" },
    ],
    actor: {
      pos: v(-4, 0, -1.5),
      look: v(10, 1.6, -1.5),
      lockLook: true,
      hotbar: [{ item: ITEM_STRAWBERRY_JAM, count: 1 }],
    },
    action: "Eat the jam right away, then sprint forward when the camera starts to move (~1 s).",
  },
  {
    name: "cake",
    shot: 12,
    duration: 6,
    time: SUNSET,
    camera: "scripted",
    fov: 70,
    keys: orbit(v(CAKE.x, 1.3, CAKE.z), 4.6, 3.2, -40, 50, 6, 6),
    actor: { pos: v(0, 0, -7.4), look: v(0, 1.2, -6), lockLook: true, hotbar: [] },
    stage: [{ at: CAKE, block: { id: BLOCK_STRAWBERRY_CAKE, states: { [STATE_SLICES]: 0 } } }],
    action: "Eat a slice every ~2 s (three in all). Friends: stand at the other sides and eat too.",
  },
  {
    name: "finale",
    shot: 13,
    duration: 4,
    time: SUNSET,
    camera: "scripted",
    fov: 80,
    keys: [
      { at: 0, pos: v(0, 2.2, 1.5), look: v(0, 0.6, 8) },
      { at: 4, pos: v(0, 9, -7.5), look: v(0, 0, 6), ease: "InOutSine" },
    ],
    actor: { pos: v(-8, 0, -8), look: v(0, 1, 6), hotbar: [] },
    action: "Nothing: the camera pulls back and rises. The end card is added in the edit.",
  },
];

export const STILLS: readonly Still[] = [
  {
    n: 1,
    title: "The farm (hero shot)",
    time: SUNSET,
    camera: "still",
    fov: 70,
    pos: v(5.5, 2.6, 1),
    look: v(-4, 0.8, 6.5),
    actor: { pos: v(3.2, 0, 3), look: v(0, 0.5, 6), hotbar: [{ item: ITEM_TOMATO, count: 1 }] },
    action: "Stand still; you are in frame holding a tomato.",
  },
  {
    n: 2,
    title: "Strawberries in bloom",
    time: MORNING,
    camera: "still",
    fov: 60,
    pos: v(7.2, 0.35, 4),
    look: v(5.2, 0.45, 6.3),
    actor: { pos: v(6, 0, 7), look: v(5, 0.4, 6), hotbar: [] },
    stage: [
      { at: BUSH, block: grown(BLOCK_STRAWBERRY_BUSH) },
      { at: v(6, 0, 6), block: grown(BLOCK_STRAWBERRY_BUSH) },
    ],
    action: "Pick one bush so a few strawberries lie on the ground, then take the screenshot.",
  },
  {
    n: 3,
    title: "Chopping",
    time: NOON,
    camera: "still",
    fov: 60,
    pos: v(-4.9, 2.3, 3),
    look: v(-6, 1.05, 3),
    actor: {
      pos: v(-6, 0, 1.9),
      look: v(-6, 1.05, 3),
      lockLook: true,
      hotbar: [{ item: ITEM_CUCUMBER, count: 16 }],
    },
    action: "Use the board with the cucumber and grab a burst while the bits fly.",
  },
  {
    n: 4,
    title: "The pot at night",
    time: NIGHT,
    camera: "still",
    fov: 70,
    pos: v(-4, 1.55, 4.3),
    look: v(-6, 1.3, 5),
    actor: { ...potActor, hotbar: [] },
    action: "Start a real cook first (/hk:debug fast off); /hk:debug pot must say cooking.",
  },
  {
    n: 5,
    title: "What can I make?",
    time: NOON,
    camera: "ui",
    pos: v(-4.5, 1.62, 4),
    look: v(-6, 1.2, 4),
    actor: {
      pos: v(-4.5, 0, 4),
      look: v(-6, 1.2, 4),
      hotbar: [{ item: ITEM_GUIDE_BOOK, count: 1 }],
    },
    action: 'Open the Kitchen Guide on "What can I make?" with ingredients for 3-4 dishes only.',
  },
  {
    n: 6,
    title: "Dishes by colour",
    time: NOON,
    camera: "still",
    fov: 70,
    pos: v(0, 2.5, 10.4),
    look: v(0, 2.5, 14),
    actor: { pos: v(0, 0, 9), look: v(0, 2, 14), hotbar: [] },
    action: "Place item frames on the wall above each wool block and put the dishes in by hand.",
  },
  {
    n: 7,
    title: "Sharing the cake",
    time: SUNSET,
    camera: "still",
    fov: 70,
    pos: v(3.4, 2.8, -9.2),
    look: v(0, 1.2, -6),
    actor: { pos: v(-1.2, 0, -6.4), look: v(0, 1.2, -6), hotbar: [] },
    stage: [{ at: CAKE, block: { id: BLOCK_STRAWBERRY_CAKE, states: { [STATE_SLICES]: 1 } } }],
    action: "One slice is gone. Eat another for the hearts and screenshot mid-bite.",
  },
  {
    n: 8,
    title: "A dish with a power",
    time: NOON,
    camera: "still",
    fov: 70,
    pos: v(8.2, 1.8, 3),
    look: v(12, 0.4, 3),
    actor: {
      pos: v(12, 0, 3),
      look: v(12, 0.5, 6),
      fireSafe: true,
      hotbar: [{ item: "minecraft:bowl", count: 1 }],
    },
    action: "You stand in the lava with Fire Resistance and an empty bowl.",
  },
];

// --- lookups and derived numbers ----------------------------------------------------------------

export function sceneByName(name: string): Scene | undefined {
  return SCENES.find((scene) => scene.name === name);
}

export function stillByNumber(n: number): Still | undefined {
  return STILLS.find((still) => still.n === n);
}

/** The plan's ~48 s: every scene back to back. */
export function totalDuration(scenes: readonly Scene[] = SCENES): number {
  return scenes.reduce((sum, scene) => sum + scene.duration, 0);
}

/** Seconds a take runs after the command: preroll, marker, handles, the shot, marker. */
export function takeSeconds(scene: Scene, preroll = DEFAULT_PREROLL_SECONDS): number {
  return preroll + 2 * MARKER_SECONDS + 2 * HANDLE_SECONDS + scene.duration;
}

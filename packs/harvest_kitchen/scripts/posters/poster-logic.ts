import { findDish } from "../data/dishes";
import { CRAFTING_RECIPES, STATION_RECIPES } from "../data/recipes";
import { isUnlocked } from "../discovery/unlock";

// Recipe posters (D15) as pure functions: which dish each poster state shows, the texture of each
// half, the sneak + use cycle through the dishes a player has discovered, and the wall geometry
// (which half a part shows, where its wall is). No @minecraft import, so the unit tests and the
// tools (gen-posters.mjs, gen-poster-block.mjs) share it with the game; posters/poster.ts reads
// and writes the blocks.
//
// The poster is a 2×1 multi-block (minecraft:multi_block, 2 parts): each part shows one half of
// a 128×64 recipe image as a 64×64 texture. Its states:
//
//   hk:poster, hk:poster_page   together the poster index: page × 16 + hk:poster (an int state
//                          holds at most 16 values); index 0 = the blank "find crops" poster,
//                          1.. = POSTER_DISHES[i - 1]
//   hk:facing              the way the poster's front faces (out of the wall); set by script
//   (the half a part shows comes from minecraft:multi_block_part, see halfOfPart)
//   minecraft:cardinal_direction, minecraft:multi_block_part   from the traits (not read here)

/** Dishes in recipe order (pot recipes, then crafting), each once: the cycle order. */
export const POSTER_DISHES: readonly string[] = [
  ...new Set(
    [...STATION_RECIPES, ...CRAFTING_RECIPES]
      .map((recipe) => recipe.result)
      .filter((id) => findDish(id) !== undefined),
  ),
];

/** The blank poster's state value. */
export const POSTER_BLANK = 0;

/** Number of poster indices: the blank plus one per dish. */
export const POSTER_COUNT: number = POSTER_DISHES.length + 1;

/** Values one int block state can hold: hk:poster counts within a page of this many. */
export const POSTER_MAX_STATES = 16;

/** Values of hk:poster_page. */
export const POSTER_PAGES: number = Math.ceil(POSTER_COUNT / POSTER_MAX_STATES);

/** The two state values that store poster `index`. */
export function posterStates(index: number): { readonly slot: number; readonly page: number } {
  return { slot: index % POSTER_MAX_STATES, page: Math.floor(index / POSTER_MAX_STATES) };
}

/** The poster index stored in the two states (a missing page state counts as page 0). */
export function posterIndexOf(slot: number, page = 0): number {
  return page * POSTER_MAX_STATES + slot;
}

/** The dish a poster state shows, or undefined for the blank (or an out-of-range value). */
export function posterDish(index: number): string | undefined {
  return index > 0 ? POSTER_DISHES[index - 1] : undefined;
}

/** The state value for a dish; the blank for anything that isn't on a poster. */
export function posterIndex(dishId: string): number {
  return POSTER_DISHES.indexOf(dishId) + 1; // -1 + 1 = POSTER_BLANK
}

// --- textures --------------------------------------------------------------------------------------

export type Half = "left" | "right";
export const HALVES: readonly Half[] = ["left", "right"];

export const POSTER_TEXTURE_DIR = "textures/hk/poster";

const shortName = (id: string) => id.slice(id.indexOf(":") + 1);

/** "blank" or "tomato_soup": the image a poster state shows (both halves). */
export function posterStem(index: number): string {
  const dish = posterDish(index);
  return dish ? shortName(dish) : "blank";
}

/** File stem of one half: "tomato_soup_left". */
export function halfStem(index: number, half: Half): string {
  return `${posterStem(index)}_${half}`;
}

/** RP-relative texture path (no extension) and the terrain_texture.json shortname of a half. */
export function halfTexture(index: number, half: Half): { path: string; shortname: string } {
  const stem = halfStem(index, half);
  return { path: `${POSTER_TEXTURE_DIR}/${stem}`, shortname: `hk_poster_${stem}` };
}

/** Every poster state, blank first. */
export function posterIndices(): number[] {
  return Array.from({ length: POSTER_COUNT }, (_, i) => i);
}

// --- discovery and the cycle -----------------------------------------------------------------------

/** What a player has found (discovery/discovery.ts reads it from the player). */
export interface Discovery {
  readonly found: ReadonlySet<string>;
  readonly creative: boolean;
}

/** Poster states this player may show: discovered dishes in order (all of them in creative). */
export function discoveredPosters(discovery: Discovery): number[] {
  return POSTER_DISHES.map((id, i) => ({ id, index: i + 1 }))
    .filter(({ id }) => isUnlocked(id, discovery.found, discovery.creative))
    .map(({ index }) => index);
}

/**
 * The state sneak + use turns a poster to: the next discovered dish after `current`, wrapping
 * around; from the blank (or an undiscovered dish) the next discovered one after it in order.
 * Undefined when the player has discovered nothing (the caller shows a hint and changes nothing).
 */
export function nextPoster(current: number, discovery: Discovery): number | undefined {
  const shown = discoveredPosters(discovery);
  if (shown.length === 0) return undefined;
  return shown.find((index) => index > current) ?? shown[0];
}

/** What a freshly placed poster shows: the player's first discovered dish, else the blank. */
export function firstPoster(discovery: Discovery): number {
  return discoveredPosters(discovery)[0] ?? POSTER_BLANK;
}

// --- wall geometry ---------------------------------------------------------------------------------

export type Facing = "north" | "south" | "east" | "west";
export const FACINGS: readonly Facing[] = ["north", "south", "east", "west"];

export function isFacing(value: unknown): value is Facing {
  return typeof value === "string" && (FACINGS as readonly string[]).includes(value);
}

const STEP: Readonly<Record<Facing, { x: number; z: number }>> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  east: { x: 1, z: 0 },
  west: { x: -1, z: 0 },
};

/** One block in direction `facing`. */
export function step(facing: Facing): { x: number; z: number } {
  return STEP[facing];
}

export function opposite(facing: Facing): Facing {
  return ({ north: "south", south: "north", east: "west", west: "east" } as const)[facing];
}

/** 90° clockwise seen from above: north -> east -> south -> west. */
export function clockwise(facing: Facing): Facing {
  return ({ north: "east", east: "south", south: "west", west: "north" } as const)[facing];
}

/**
 * The viewer's right when facing a poster whose front faces `facing`: the viewer looks the other
 * way (opposite), and their right is clockwise of that. A south-facing poster is read looking
 * north, with east on the right.
 */
export function viewerRight(facing: Facing): Facing {
  return clockwise(opposite(facing));
}

interface XYZ {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The wall block a poster part at `at` hangs on: one block behind its front (`facing`). */
export function wallPosition(at: XYZ, facing: Facing): XYZ {
  const back = step(opposite(facing));
  return { x: at.x + back.x, y: at.y, z: at.z + back.z };
}

/** Where a poster part hanging on `wall` with front `facing` sits: one block in front of it. */
export function posterPosition(wall: XYZ, facing: Facing): XYZ {
  const front = step(facing);
  return { x: wall.x + front.x, y: wall.y, z: wall.z + front.z };
}

/** The trait's state names (minecraft:multi_block, minecraft:placement_direction). */
export const STATE_PART = "minecraft:multi_block_part";
export const STATE_CARDINAL_DIRECTION = "minecraft:cardinal_direction";

/**
 * Which half of the image a part shows, from block states only, so no script has to write a
 * per-part state (rewriting a part's permutation made the game drop the whole poster, 2026-10-22).
 * The trait puts part 1 one block in the `cardinal` direction from part 0 (seen in game: cardinal
 * south, part 1 at z+1). Undefined when `cardinal` runs into or out of the wall (refused on place).
 */
export function halfOfPart(facing: Facing, cardinal: Facing, part: number): Half | undefined {
  const right = viewerRight(facing);
  if (cardinal === right) return part === 0 ? "left" : "right";
  if (cardinal === opposite(right)) return part === 0 ? "right" : "left";
  return undefined;
}

/**
 * Which way a placed poster really faces, read from the world: its parts lie side by side, so
 * the wall is on one of the two sides across that line, and it's the side where every part has a
 * solid block behind it. `hint` (from the clicked face) decides only when both sides qualify (a
 * poster squeezed between two walls). Undefined when no side has a full wall, or the parts aren't
 * neighbours. With one part (the other not loaded yet) only `hint` is checked.
 */
export function settleFacing(
  parts: readonly XYZ[],
  hint: Facing | undefined,
  solidAt: (at: XYZ) => boolean,
): Facing | undefined {
  let candidates: Facing[];
  const [a, b] = parts;
  if (!a) return undefined;
  if (!b) candidates = hint ? [hint] : [];
  else {
    const dx = Math.abs(b.x - a.x);
    const dz = Math.abs(b.z - a.z);
    if (b.y !== a.y || dx + dz !== 1) return undefined;
    // parts along x: the wall runs along x, so the poster faces north or south (and vice versa)
    candidates = dx === 1 ? ["north", "south"] : ["east", "west"];
    if (hint && candidates.includes(hint))
      candidates = [hint, ...candidates.filter((f) => f !== hint)];
  }
  return candidates.find((facing) => parts.every((part) => solidAt(wallPosition(part, facing))));
}

/** "Down" etc. (the Script API Direction values) as a horizontal facing; undefined for up/down. */
export function facingOfDirection(direction: string): Facing | undefined {
  const lower = direction.toLowerCase();
  return isFacing(lower) ? lower : undefined;
}

interface XZ {
  readonly x: number;
  readonly z: number;
}

/**
 * Which half each of two side-by-side parts shows, from where they actually are. The one further
 * along the viewer's right shows the right half. Undefined if the parts aren't side by side along
 * the wall (one behind the other, or not neighbours).
 */
export function halvesOf(facing: Facing, a: XZ, b: XZ): [Half, Half] | undefined {
  const r = step(viewerRight(facing));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (dx === r.x && dz === r.z) return ["left", "right"];
  if (dx === -r.x && dz === -r.z) return ["right", "left"];
  return undefined;
}

/**
 * The half the clicked (starting) part shows at placement, before the parts exist. The trait puts
 * the parts along the stored cardinal direction; assuming the second part goes one block that
 * way, the starting part is the left half when that is the viewer's right. The script re-checks
 * with the real part positions (halvesOf) a tick later. Undefined if the cardinal direction runs
 * into or out of the wall (the player looked along the wall).
 */
export function startHalf(facing: Facing, cardinal: Facing): Half | undefined {
  if (cardinal === viewerRight(facing)) return "left";
  if (cardinal === opposite(viewerRight(facing))) return "right";
  return undefined;
}

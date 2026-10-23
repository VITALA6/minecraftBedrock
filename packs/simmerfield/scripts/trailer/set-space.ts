// "Set space" for the trailer scenes: every camera point, actor mark and staged block is written
// relative to one saved anchor, so the whole set can be rebuilt anywhere and filmed from the same
// angles. Pure: no @minecraft/server values, so tests run it in Node.
//
//   origin  the centre of the anchor block's floor (the block the operator stood in)
//   +x      the operator's right when they ran `/scriptevent wm_kitchen:trailer anchor`
//   +y      up (y = 0 is the top of the ground, i.e. the anchor block's floor)
//   +z      forward: the cardinal direction the operator faced
//
// Block offsets are integers, and block (bx, by, bz) is centred on set point (bx, by + 0.5, bz),
// so "the pot at (-6, 1, 5)" and "look at (-6, 1.4, 5)" mean the same spot.

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** World cardinal direction the set's +z points to. */
export type Facing = "north" | "south" | "east" | "west";

export const FACINGS: readonly Facing[] = ["south", "west", "north", "east"];

export interface Anchor {
  /** The anchor block (integer world coordinates). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly dimension: string;
  readonly facing: Facing;
}

/** Unit forward vector in world space (Minecraft: +x east, +z south). */
function forward(facing: Facing): { x: number; z: number } {
  switch (facing) {
    case "south":
      return { x: 0, z: 1 };
    case "north":
      return { x: 0, z: -1 };
    case "east":
      return { x: 1, z: 0 };
    case "west":
      return { x: -1, z: 0 };
  }
}

/** World vector for a set-space direction (rotation only, no translation). */
export function rotate(facing: Facing, v: Vec3): Vec3 {
  const f = forward(facing);
  // Right-hand side of someone facing f, seen from above: north -> east, south -> west.
  const r = { x: -f.z, z: f.x };
  return { x: v.x * r.x + v.z * f.x, y: v.y, z: v.x * r.z + v.z * f.z };
}

/** A continuous set-space point (camera, actor, look target) in world coordinates. */
export function toWorld(anchor: Anchor, p: Vec3): Vec3 {
  const v = rotate(anchor.facing, p);
  return { x: anchor.x + 0.5 + v.x, y: anchor.y + v.y, z: anchor.z + 0.5 + v.z };
}

/** An integer set-space block offset as the world block position. */
export function blockToWorld(anchor: Anchor, b: Vec3): Vec3 {
  const v = rotate(anchor.facing, b);
  return { x: anchor.x + v.x, y: anchor.y + v.y, z: anchor.z + v.z };
}

/** World cardinal direction of a set-space direction ("forward" = the anchor's facing). */
export type SetDirection = "forward" | "back" | "left" | "right";

export function cardinalOf(facing: Facing, direction: SetDirection): Facing {
  // FACINGS goes south -> west -> north -> east: each step is a right turn (facing south, your
  // right hand points west).
  const steps: Record<SetDirection, number> = { forward: 0, right: 1, back: 2, left: 3 };
  return FACINGS[(FACINGS.indexOf(facing) + steps[direction]) % 4] as Facing;
}

/**
 * Snaps a yaw (Entity.getRotation().y: 0 = south, 90 = west, 180/-180 = north, -90 = east) to
 * the nearest cardinal direction.
 */
export function facingFromYaw(yaw: number): Facing {
  const quarter = Math.round((((yaw % 360) + 360) % 360) / 90) % 4;
  return FACINGS[quarter] as Facing;
}

/** Dynamic property value for an anchor (a world property holds a string). */
export function serializeAnchor(anchor: Anchor): string {
  return JSON.stringify(anchor);
}

export function parseAnchor(raw: unknown): Anchor | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof Anchor, unknown>>;
    const { x, y, z, dimension, facing } = value;
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof z === "number" &&
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      Number.isInteger(z) &&
      typeof dimension === "string" &&
      typeof facing === "string" &&
      (FACINGS as readonly string[]).includes(facing)
    ) {
      return { x, y, z, dimension, facing: facing as Facing };
    }
  } catch {
    // not JSON
  }
  return undefined;
}

// Station effects (fx): the chopping knife over the cutting board and the stirring spoon in a
// cooking pot. Every number the fx use lives here. No @minecraft/server import: tests read it.
//
// Both effects are short-lived, script-owned entities with a client animation (the RP animates
// them; nothing moves them from script). See fx.ts for the lifecycle and the safety nets.

export const FX_KNIFE = "hk:fx_knife";
export const FX_SPOON = "hk:fx_spoon";
export const FX_ENTITY_TYPES: readonly string[] = [FX_KNIFE, FX_SPOON];

export type FxKind = "knife" | "spoon";

export const FX_TYPE_OF: Readonly<Record<FxKind, string>> = { knife: FX_KNIFE, spoon: FX_SPOON };

export interface FxCaps {
  /** Side of the square areas the caps count in, in blocks (per dimension, aligned to 0). */
  readonly areaSize: number;
  /** At most this many of one kind per area. */
  readonly perAreaKind: Readonly<Record<FxKind, number>>;
  /** At most this many fx of any kind per area. */
  readonly perArea: number;
  /** At most this many fx in the whole world. */
  readonly total: number;
}

export const FX_CAPS: FxCaps = {
  areaSize: 16,
  perAreaKind: { knife: 4, spoon: 4 },
  perArea: 6,
  total: 32,
};

export const FX_TIMING = {
  /** A knife stays this long after the last chop (the chop animation is 0.5 s, so ~2 strokes). */
  knifeLifeTicks: 20,
  /** The one fx loop: expires knives. It only runs while any fx exists. */
  loopTicks: 5,
  /** Every Nth loop also checks the spoons (entity still there, a player still near). */
  spoonCheckEvery: 8,
  /** A pot that wants a spoon but got none (no player near, cap reached) asks again after this. */
  spoonRetryTicks: 40,
} as const;

/** Spoons only stir while a player is within this many blocks of the pot. */
export const FX_VIEW_DISTANCE = 32;

/**
 * Entity yaw for a knife on a board with this minecraft:cardinal_direction, so the knife model
 * (authored in the board's model space, paddle handle to -z) lines up with the board. Entity yaw 0
 * looks south and an entity model's front is its -z, so the yaw is the direction the board's -z
 * points: north 180, south 0, west 90, east 270. If the knife shows across the board in game, the
 * board's rotation sense differs: swap west and east here (one line).
 */
export const FX_BOARD_YAW: Readonly<Record<string, number>> = {
  north: 180,
  south: 0,
  west: 90,
  east: 270,
};

/** The board block's facing state (vanilla placement_direction trait). */
export const FX_BOARD_FACING_STATE = "minecraft:cardinal_direction";

/**
 * The board's own bool state: true while an fx knife chops on it. The board JSON hides its
 * resting knife bone then (bone_visibility), so the fx knife reads as that knife picking itself
 * up. Set by fxChop, cleared whenever the knife goes; a stale true (knife lost while the chunk was
 * unloading) is cleared by the board's random tick or the next use.
 */
export const FX_BOARD_CHOPPING_STATE = "hk:chopping";

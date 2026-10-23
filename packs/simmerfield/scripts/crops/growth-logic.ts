import type { Crop } from "../data/crops";

// The crop and bush rules as pure functions: block params, growth per random tick, bone meal and
// bush picking. No @minecraft/server import, so tests run them in Node; crop-growth.ts reads the
// block (stage, light, farmland below) and applies the result. Random numbers come in as `roll`
// (0 <= roll < 1, e.g. Math.random()) so tests are deterministic.

export const BONE_MEAL = "minecraft:bone_meal";

export type GrowthType = "crop" | "bush";

export interface GrowthParams {
  readonly type: GrowthType;
  readonly maxStage: number;
  /** Chance to advance one stage per random tick, on hydrated farmland (or any soil for bushes). */
  readonly growthChance: number;
  /** Multiplier on growthChance when the farmland below is dry. Bushes use 1. */
  readonly dryMultiplier: number;
  readonly minLight: number;
}

function num(
  raw: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = raw[key];
  return typeof value === "number" && value >= min && value <= max ? value : fallback;
}

const warned = new Set<string>();

/** The "wm_kitchen:crop_growth" params from the block JSON, with defaults for anything missing or odd. */
export function readParams(params: unknown, blockId: string): GrowthParams {
  const raw =
    typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
  let type: GrowthType = "crop";
  if (raw.type === "bush") type = "bush";
  else if (raw.type !== undefined && raw.type !== "crop" && !warned.has(blockId)) {
    warned.add(blockId);
    console.warn(`[simmerfield] ${blockId}: crop type ${JSON.stringify(raw.type)} not supported`);
  }
  return {
    type,
    maxStage: Math.floor(num(raw, "max_stage", 3, 1, 15)),
    growthChance: num(raw, "growth_chance", 0.5, 0, 1),
    dryMultiplier: num(raw, "dry_multiplier", type === "bush" ? 1 : 0.5, 0, 1),
    minLight: num(raw, "min_light", 9, 0, 15),
  };
}

/** Farmland with moisturized_amount 0 (or missing) is dry. Anything that isn't farmland isn't. */
export function isDryFarmland(
  belowTypeId: string | undefined,
  moisture: boolean | number | string | undefined,
): boolean {
  if (belowTypeId !== "minecraft:farmland") return false;
  return !(typeof moisture === "number" && moisture > 0);
}

/** Like vanilla crops: block light or sky light (unaffected by time of day) must reach minLight. */
export function hasEnoughLight(blockLight: number, skyLight: number, minLight: number): boolean {
  return Math.max(blockLight, skyLight) >= minLight;
}

export interface GrowthSpot {
  readonly blockLight: number;
  readonly skyLight: number;
  readonly dryFarmland: boolean;
}

/** The stage after one random tick, or undefined if it doesn't grow this time. */
export function randomTickStage(
  growth: GrowthParams,
  stage: number,
  spot: GrowthSpot,
  roll: number,
): number | undefined {
  if (stage >= growth.maxStage) return undefined;
  if (!hasEnoughLight(spot.blockLight, spot.skyLight, growth.minLight)) return undefined;
  const chance = growth.growthChance * (spot.dryFarmland ? growth.dryMultiplier : 1);
  return roll < chance ? stage + 1 : undefined;
}

/** The stage after bone meal (or /wm_kitchen:debug grow steps), or undefined if already mature. */
export function grownStage(stage: number, maxStage: number, steps = 1): number | undefined {
  return stage >= maxStage ? undefined : Math.min(maxStage, stage + steps);
}

/**
 * What using a crop does: a mature bush is picked with whatever is in hand (bone meal included,
 * which is then not used up); bone meal grows anything not yet mature; anything else does nothing.
 */
export function useAction(
  growth: GrowthParams,
  stage: number,
  heldTypeId: string | undefined,
): "pick" | "bone_meal" | "none" {
  if (growth.type === "bush" && stage >= growth.maxStage) return "pick";
  if (heldTypeId === BONE_MEAL && stage < growth.maxStage) return "bone_meal";
  return "none";
}

/** A bush pick: how many fruit (min..max, inclusive) and the stage it falls back to. */
export function pickResult(crop: Crop, roll: number): { count: number; stage: number } | undefined {
  if (!crop.pick) return undefined;
  const { min, max } = crop.pick;
  return { count: min + Math.floor(roll * (max - min + 1)), stage: crop.pickResetStage ?? 0 };
}

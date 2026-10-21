import type { Block, BlockComponentRegistry, BlockCustomComponent } from "@minecraft/server";
import { COMPONENT_CROP_GROWTH, GROWTH_STATE } from "../config";
import { getNumberState, setState } from "../lib/block-states";
import { consumeHeldItem, getHeldItem, isCreative } from "../lib/inventory";

// Shared by every crop block. The block JSON declares the "hk:growth" state and lists
//   "hk:crop_growth": { "max_stage": 3, "growth_chance": 0.5, "dry_multiplier": 0.5, "min_light": 9 }
// Everything else (stage textures, drops, farmland-only placement) is plain block JSON.

const BONE_MEAL = "minecraft:bone_meal";

interface GrowthParams {
  readonly maxStage: number;
  /** Chance to advance one stage per random tick, on hydrated farmland. */
  readonly growthChance: number;
  /** Multiplier on growthChance when the farmland below is dry. */
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

function readParams(params: unknown): GrowthParams {
  const raw =
    typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
  return {
    maxStage: Math.floor(num(raw, "max_stage", 3, 1, 15)),
    growthChance: num(raw, "growth_chance", 0.5, 0, 1),
    dryMultiplier: num(raw, "dry_multiplier", 0.5, 0, 1),
    minLight: num(raw, "min_light", 9, 0, 15),
  };
}

function isHydrated(block: Block): boolean {
  const moisture = block.below()?.permutation.getAllStates().moisturized_amount;
  return typeof moisture === "number" && moisture > 0;
}

// Like vanilla crops: block light or sky light (unaffected by time of day) must reach minLight.
function hasEnoughLight(block: Block, minLight: number): boolean {
  return Math.max(block.getLightLevel(), block.getSkyLightLevel()) >= minLight;
}

const cropGrowth: BlockCustomComponent = {
  onRandomTick({ block }, { params }) {
    const growth = readParams(params);
    const stage = getNumberState(block, GROWTH_STATE);
    if (stage === undefined || stage >= growth.maxStage) return;
    if (!hasEnoughLight(block, growth.minLight)) return;

    const chance = growth.growthChance * (isHydrated(block) ? 1 : growth.dryMultiplier);
    if (Math.random() < chance) setState(block, GROWTH_STATE, stage + 1);
  },

  // Bone meal has no effect on custom blocks by itself, so the crop handles it.
  onPlayerInteract({ block, dimension, player }, { params }) {
    if (!player || getHeldItem(player)?.typeId !== BONE_MEAL) return;
    const stage = getNumberState(block, GROWTH_STATE);
    if (stage === undefined || stage >= readParams(params).maxStage) return;
    if (!isCreative(player) && !consumeHeldItem(player, BONE_MEAL)) return;

    setState(block, GROWTH_STATE, stage + 1);
    const center = block.center();
    dimension.spawnParticle("minecraft:crop_growth_emitter", center);
    dimension.playSound("item.bone_meal.use", center);
  },
};

export function registerCropGrowth(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_CROP_GROWTH, cropGrowth);
}

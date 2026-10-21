import {
  ItemStack,
  type Block,
  type BlockComponentRegistry,
  type BlockCustomComponent,
} from "@minecraft/server";
import { COMPONENT_CROP_GROWTH, PARTICLE, SOUND, STATE_GROWTH } from "../config";
import { cropByBlock } from "../data/crops";
import { getNumberState, setState } from "../lib/block-states";
import { particle, sound } from "../lib/feedback";
import { consumeHeldItem, getHeldItem, isCreative } from "../lib/inventory";

// Shared by every crop and bush block. The block JSON declares the "hk:growth" state and lists
//   "hk:crop_growth": { "type": "crop", "max_stage": 3, "growth_chance": 0.5,
//                       "dry_multiplier": 0.5, "min_light": 9 }
// Params stay flat (plan §5.1). Stage textures, loot and placement rules are plain block JSON;
// what a bush gives when picked is in data/crops.ts.
//
// Types:
//   crop  break to harvest (loot table per stage).
//   bush  use when mature to pick: drops fruit, falls back to the crop's pickResetStage, regrows.
//   tall  (SHOULD, not implemented) a two-block crop. Extension point: add "tall" to GrowthType,
//         grow the top half in onRandomTick, and break both halves together.

const BONE_MEAL = "minecraft:bone_meal";

type GrowthType = "crop" | "bush";

interface GrowthParams {
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

function readParams(params: unknown, blockId: string): GrowthParams {
  const raw =
    typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
  let type: GrowthType = "crop";
  if (raw.type === "bush") type = "bush";
  else if (raw.type !== undefined && raw.type !== "crop" && !warned.has(blockId)) {
    warned.add(blockId);
    console.warn(
      `[harvest_kitchen] ${blockId}: crop type ${JSON.stringify(raw.type)} not supported`,
    );
  }
  return {
    type,
    maxStage: Math.floor(num(raw, "max_stage", 3, 1, 15)),
    growthChance: num(raw, "growth_chance", 0.5, 0, 1),
    dryMultiplier: num(raw, "dry_multiplier", type === "bush" ? 1 : 0.5, 0, 1),
    minLight: num(raw, "min_light", 9, 0, 15),
  };
}

function isDryFarmland(block: Block): boolean {
  const below = block.below();
  if (below?.typeId !== "minecraft:farmland") return false;
  const moisture = below.permutation.getAllStates().moisturized_amount;
  return !(typeof moisture === "number" && moisture > 0);
}

// Like vanilla crops: block light or sky light (unaffected by time of day) must reach minLight.
function hasEnoughLight(block: Block, minLight: number): boolean {
  return Math.max(block.getLightLevel(), block.getSkyLightLevel()) >= minLight;
}

/** Advances one stage; returns false if already mature. Used by bone meal and /hk:debug grow. */
export function growStage(block: Block, maxStage: number, steps = 1): boolean {
  const stage = getNumberState(block, STATE_GROWTH);
  if (stage === undefined || stage >= maxStage) return false;
  setState(block, STATE_GROWTH, Math.min(maxStage, stage + steps));
  return true;
}

function pickBush(block: Block): boolean {
  const crop = cropByBlock(block.typeId);
  if (!crop?.pick) return false;
  const { min, max } = crop.pick;
  const count = min + Math.floor(Math.random() * (max - min + 1));
  setState(block, STATE_GROWTH, crop.pickResetStage ?? 0);
  const center = block.center();
  block.dimension.spawnItem(new ItemStack(crop.produce, count), center);
  sound(block.dimension, SOUND.berryPick, center);
  particle(block.dimension, PARTICLE.bits, center, 4, 0.3, crop.color);
  return true;
}

const cropGrowth: BlockCustomComponent = {
  onRandomTick({ block }, { params }) {
    const growth = readParams(params, block.typeId);
    const stage = getNumberState(block, STATE_GROWTH);
    if (stage === undefined || stage >= growth.maxStage) return;
    if (!hasEnoughLight(block, growth.minLight)) return;

    const chance = growth.growthChance * (isDryFarmland(block) ? growth.dryMultiplier : 1);
    if (Math.random() < chance) setState(block, STATE_GROWTH, stage + 1);
  },

  // Bone meal does nothing to custom blocks by itself, so the crop handles it. A mature bush is
  // picked with whatever is in hand (bone meal included, which is then not used up).
  onPlayerInteract({ block, dimension, player }, { params }) {
    if (!player) return;
    const growth = readParams(params, block.typeId);
    const stage = getNumberState(block, STATE_GROWTH);
    if (stage === undefined) return;

    if (growth.type === "bush" && stage >= growth.maxStage) {
      pickBush(block);
      return;
    }
    if (getHeldItem(player)?.typeId !== BONE_MEAL || stage >= growth.maxStage) return;
    if (!isCreative(player) && !consumeHeldItem(player, BONE_MEAL)) return;

    growStage(block, growth.maxStage);
    const center = block.center();
    particle(dimension, PARTICLE.growth, center);
    sound(dimension, SOUND.boneMeal, center);
  },
};

export function registerCropGrowth(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_CROP_GROWTH, cropGrowth);
}

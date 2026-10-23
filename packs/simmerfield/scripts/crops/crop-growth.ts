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
import {
  BONE_MEAL,
  grownStage,
  isDryFarmland,
  pickResult,
  randomTickStage,
  readParams,
  useAction,
} from "./growth-logic";

// Shared by every crop and bush block. The block JSON declares the "wm_kitchen:growth" state and lists
//   "wm_kitchen:crop_growth": { "type": "crop", "max_stage": 3, "growth_chance": 0.5,
//                       "dry_multiplier": 0.5, "min_light": 9 }
// Params stay flat (plan §5.1). Stage textures, loot and placement rules are plain block JSON;
// what a bush gives when picked is in data/crops.ts. The rules are pure functions in
// growth-logic.ts; this module reads the block and applies them.
//
// Types:
//   crop  break to harvest (loot table per stage).
//   bush  use when mature to pick: drops fruit, falls back to the crop's pickResetStage, regrows.
//   tall  (SHOULD, not implemented) a two-block crop. Extension point: add "tall" to GrowthType
//         (growth-logic.ts), grow the top half in onRandomTick, and break both halves together.

function isOnDryFarmland(block: Block): boolean {
  const below = block.below();
  return isDryFarmland(below?.typeId, below?.permutation.getAllStates().moisturized_amount);
}

/** Advances one stage; returns false if already mature. Used by bone meal. */
export function growStage(block: Block, maxStage: number, steps = 1): boolean {
  const stage = getNumberState(block, STATE_GROWTH);
  const next = stage === undefined ? undefined : grownStage(stage, maxStage, steps);
  if (next === undefined) return false;
  setState(block, STATE_GROWTH, next);
  return true;
}

function pickBush(block: Block): boolean {
  const crop = cropByBlock(block.typeId);
  const pick = crop && pickResult(crop, Math.random());
  if (!crop || !pick) return false;
  setState(block, STATE_GROWTH, pick.stage);
  const center = block.center();
  block.dimension.spawnItem(new ItemStack(crop.produce, pick.count), center);
  sound(block.dimension, SOUND.berryPick, center);
  particle(block.dimension, PARTICLE.bits, center, 4, 0.3, crop.color);
  return true;
}

const cropGrowth: BlockCustomComponent = {
  onRandomTick({ block }, { params }) {
    const growth = readParams(params, block.typeId);
    const stage = getNumberState(block, STATE_GROWTH);
    if (stage === undefined || stage >= growth.maxStage) return;
    const next = randomTickStage(
      growth,
      stage,
      {
        blockLight: block.getLightLevel(),
        skyLight: block.getSkyLightLevel(),
        dryFarmland: isOnDryFarmland(block),
      },
      Math.random(),
    );
    if (next !== undefined) setState(block, STATE_GROWTH, next);
  },

  // Bone meal does nothing to custom blocks by itself, so the crop handles it. A mature bush is
  // picked with whatever is in hand (bone meal included, which is then not used up).
  onPlayerInteract({ block, dimension, player }, { params }) {
    if (!player) return;
    const growth = readParams(params, block.typeId);
    const stage = getNumberState(block, STATE_GROWTH);
    if (stage === undefined) return;

    const action = useAction(growth, stage, getHeldItem(player)?.typeId);
    if (action === "pick") {
      pickBush(block);
      return;
    }
    if (action !== "bone_meal") return;
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

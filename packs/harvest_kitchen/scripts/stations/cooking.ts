import {
  ItemTypes,
  system,
  world,
  type Block,
  type Player,
  type RawMessage,
  type Vector3,
} from "@minecraft/server";
import {
  BLOCK_COOKING_POT,
  COOKING_STATE,
  DELIVERY_RADIUS,
  POT_CAPACITY,
  POT_SWEEP_TICKS,
} from "../config";
import { COOKING_INGREDIENTS, findCookingRecipe, type CookingRecipe } from "../data/recipes";
import { setState } from "../lib/block-states";
import { consumeHeldItem, dropItems, giveOrDrop } from "../lib/inventory";
import { itemCount, itemName, list, t } from "../lib/text";
import {
  clearPot,
  findCookingPots,
  potKey,
  readPot,
  writePot,
  type PotRef,
  type PotState,
} from "./pot-store";

// Cooking pot rules. Every change is validated here, synchronously, against the saved state,
// so the UI can't be used to cook twice, cook without ingredients or duplicate items.
//
// Ingredients stay in the pot (locked) while a dish cooks and are only removed when it's done.
// Breaking the pot mid-cook just spills them: nothing is lost and nothing is duplicated.

export type PotResult = { readonly ok: boolean; readonly message: RawMessage };

const ok = (message: RawMessage): PotResult => ({ ok: true, message });
const fail = (message: RawMessage): PotResult => ({ ok: false, message });

export function potAt(block: Block): PotRef {
  return { dimension: block.dimension, location: block.location };
}

function potTop({ location }: PotRef): Vector3 {
  return { x: location.x + 0.5, y: location.y + 0.7, z: location.z + 0.5 };
}

function potBlock(pot: PotRef): Block | undefined {
  try {
    const block = pot.dimension.getBlock(pot.location);
    return block?.typeId === BLOCK_COOKING_POT ? block : undefined;
  } catch {
    return undefined; // unloaded chunk
  }
}

function setCookingVisual(pot: PotRef, cooking: boolean): void {
  const block = potBlock(pot);
  if (block) setState(block, COOKING_STATE, cooking);
}

export function totalItems(state: PotState): number {
  return Object.values(state.items).reduce((sum, n) => sum + n, 0);
}

export function canCook(state: PotState, recipe: CookingRecipe): boolean {
  return Object.entries(recipe.ingredients).every(([id, n]) => (state.items[id] ?? 0) >= n);
}

/** What the pot still lacks for `recipe`, as [item id, count] pairs. */
export function missingFor(state: PotState, recipe: CookingRecipe): [string, number][] {
  return Object.entries(recipe.ingredients)
    .map(([id, n]): [string, number] => [id, n - (state.items[id] ?? 0)])
    .filter(([, n]) => n > 0);
}

export function secondsLeft(state: PotState): number {
  return state.job ? Math.max(0, Math.ceil((state.job.readyAt - Date.now()) / 1000)) : 0;
}

export function addIngredient(player: Player, pot: PotRef, typeId: string): PotResult {
  const state = readPot(pot);
  if (state.job) return fail(t("hk.ui.pot.busy"));
  if (!COOKING_INGREDIENTS.has(typeId))
    return fail(t("hk.ui.pot.not_ingredient", itemName(typeId)));
  const total = totalItems(state);
  if (total >= POT_CAPACITY) return fail(t("hk.ui.pot.full", POT_CAPACITY));
  if (!consumeHeldItem(player, typeId))
    return fail(t("hk.ui.pot.not_ingredient", itemName(typeId)));

  writePot(pot, { items: { ...state.items, [typeId]: (state.items[typeId] ?? 0) + 1 } });
  return ok(t("hk.ui.pot.added", itemName(typeId), total + 1, POT_CAPACITY));
}

export function startCooking(player: Player, pot: PotRef, recipeId: string): PotResult {
  if (!potBlock(pot)) return fail(t("hk.ui.pot.gone"));
  const state = readPot(pot);
  if (state.job) return fail(t("hk.ui.pot.busy"));
  const recipe = findCookingRecipe(recipeId);
  if (!recipe) return fail(t("hk.ui.pot.gone"));
  if (!canCook(state, recipe)) {
    const missing = missingFor(state, recipe).map(([id, n]) => itemCount(id, n));
    return fail(t("hk.ui.pot.missing", itemName(recipe.result), list(missing)));
  }

  const job = { recipe: recipe.id, readyAt: Date.now() + recipe.seconds * 1000, cook: player.id };
  writePot(pot, { items: state.items, job });
  setCookingVisual(pot, true);
  active.set(potKey(pot), pot);
  pot.dimension.playSound("bubble.up", potTop(pot));
  return ok(t("hk.ui.pot.started", itemName(recipe.result), recipe.seconds));
}

export function takeOutIngredients(player: Player, pot: PotRef): PotResult {
  if (!potBlock(pot)) return fail(t("hk.ui.pot.gone"));
  const state = readPot(pot);
  if (state.job) return fail(t("hk.ui.pot.busy"));
  if (totalItems(state) === 0) return fail(t("hk.ui.pot.empty"));

  // Clear first, then hand out: a failure halfway can lose items to the ground, never duplicate.
  clearPot(pot);
  for (const [id, n] of Object.entries(state.items)) {
    giveOrDrop(player, id, n, pot.dimension, potTop(pot));
  }
  return ok(t("hk.ui.pot.taken_out"));
}

/** Completes a pot's job if it's due. Returns false if the pot couldn't be reached (unloaded). */
export function finishIfReady(pot: PotRef): boolean {
  const block = potBlock(pot);
  const state = readPot(pot);
  const job = state.job;
  if (!job) return true;
  if (Date.now() < job.readyAt) return true;
  if (!block) {
    console.warn(`[harvest_kitchen] pot ${potKey(pot)}: dish due but pot not reachable; retrying`);
    return false;
  }

  // Cancel (keeping the ingredients) rather than consume them for a dish that can't be made:
  // a recipe removed in an update, contents that somehow changed, or a result item that the game
  // failed to load.
  const recipe = findCookingRecipe(job.recipe);
  const problem = !recipe
    ? `unknown recipe "${job.recipe}"`
    : !canCook(state, recipe)
      ? `ingredients missing for ${recipe.id}`
      : !ItemTypes.get(recipe.result)
        ? `result item ${recipe.result} isn't loaded (check the Content Log for item errors)`
        : undefined;
  if (!recipe || problem) {
    console.warn(`[harvest_kitchen] pot ${potKey(pot)}: ${problem}; cooking cancelled`);
    writePot(pot, { items: state.items });
    setCookingVisual(pot, false);
    return true;
  }

  const items = { ...state.items };
  for (const [id, n] of Object.entries(recipe.ingredients)) {
    const left = (items[id] ?? 0) - n;
    if (left > 0) items[id] = left;
    else delete items[id];
  }
  writePot(pot, { items });
  setCookingVisual(pot, false);
  deliver(pot, job.cook, recipe);
  return true;
}

function deliver(pot: PotRef, cookId: string, recipe: CookingRecipe): void {
  const top = potTop(pot);
  const cook = world.getAllPlayers().find((p) => p.id === cookId);
  const near =
    cook?.dimension.id === pot.dimension.id &&
    Math.hypot(cook.location.x - top.x, cook.location.y - top.y, cook.location.z - top.z) <=
      DELIVERY_RADIUS;

  try {
    if (cook && near) {
      giveOrDrop(cook, recipe.result, recipe.count, pot.dimension, top);
      cook.onScreenDisplay.setActionBar(
        t("hk.ui.pot.ready", itemCount(recipe.result, recipe.count)),
      );
    } else {
      dropItems(pot.dimension, top, recipe.result, recipe.count);
    }
  } catch (error) {
    console.warn(
      `[harvest_kitchen] pot ${potKey(pot)}: delivering ${recipe.count} ${recipe.result} failed: ${String(error)}`,
    );
  }
  pot.dimension.playSound("random.pop", top);
  pot.dimension.playSound("block.composter.fill_success", top);
  pot.dimension.spawnParticle("minecraft:villager_happy", top);
}

/** Drops everything in the pot (ingredients of a running job included) and forgets it. */
export function spillPot(pot: PotRef): void {
  const state = readPot(pot);
  clearPot(pot);
  active.delete(potKey(pot));
  const center = { x: pot.location.x + 0.5, y: pot.location.y + 0.5, z: pot.location.z + 0.5 };
  for (const [id, n] of Object.entries(state.items)) dropItems(pot.dimension, center, id, n);
}

// --- active pots -------------------------------------------------------------------------------
// One interval serves every cooking pot: steam while cooking, finish when due. Pots in unloaded
// chunks are skipped and finish when the chunk loads again.

const active = new Map<string, PotRef>();

function sweep(): void {
  for (const [key, pot] of active) {
    try {
      if (!pot.dimension.isChunkLoaded(pot.location)) continue;
      const state = readPot(pot);
      if (!state.job) {
        active.delete(key);
        continue;
      }
      if (!potBlock(pot)) {
        // Replaced without a break event (e.g. /setblock): give the ingredients back to the world.
        spillPot(pot);
        continue;
      }
      if (Date.now() >= state.job.readyAt) {
        if (finishIfReady(pot)) active.delete(key);
      } else {
        pot.dimension.spawnParticle("minecraft:white_smoke_particle", potTop(pot));
      }
    } catch (error) {
      console.warn(`[harvest_kitchen] pot ${key}: ${String(error)}`);
    }
  }
}

/** Call from worldLoad: picks up pots that were cooking when the world closed or /reload ran. */
export function startCookingSweep(): void {
  for (const pot of findCookingPots()) active.set(potKey(pot), pot);
  system.runInterval(sweep, POT_SWEEP_TICKS);
}

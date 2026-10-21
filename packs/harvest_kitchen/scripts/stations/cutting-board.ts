import {
  system,
  world,
  type Block,
  type BlockComponentRegistry,
  type BlockCustomComponent,
  type Player,
  type Vector3,
} from "@minecraft/server";
import {
  BLOCK_CUTTING_BOARD,
  CHOP_INTERVAL_TICKS,
  CHOP_MAX_DISTANCE,
  COMPONENT_CUTTING_STATION,
  PARTICLE,
  SOUND,
} from "../config";
import { CROPS } from "../data/crops";
import { findCuttingRecipe, type CuttingRecipe } from "../data/recipes";
import { actionBar, particle, sound } from "../lib/feedback";
import { consumeHeldItem, distance, getHeldItem, giveOrDrop } from "../lib/inventory";
import { t } from "../lib/text";

// Cutting board (plan §2.5). Station inputs are consumed in creative too, like a crafting table.
//   hold a crop + use       -> one chop: sound, bits in the crop's colour, output to inventory
//   sneak + use with a crop -> chops the held stack, one item every few ticks (S6); stops when
//                              the player walks away, switches item or the board goes
//   wrong item              -> thud, grey puff, "✘ Can't cut that"
//   empty hand              -> tap, "Hold a vegetable"
// Sneak + use comes through world.beforeEvents.playerInteractWithBlock (see container-station.ts
// for why), so the component skips it.

const WHITE = { red: 0.9, green: 0.9, blue: 0.9 };

function boardTop(block: Block): Vector3 {
  return { ...block.center(), y: block.location.y + 0.2 };
}

function colorFor(recipe: CuttingRecipe) {
  return CROPS.find((crop) => crop.produce === recipe.input)?.color ?? WHITE;
}

/** One chop. Returns false if the hand no longer holds the input. */
function chopOnce(player: Player, block: Block, recipe: CuttingRecipe): boolean {
  if (!consumeHeldItem(player, recipe.input)) return false;
  const top = boardTop(block);
  giveOrDrop(player, recipe.output, recipe.count, block.dimension, top);
  sound(block.dimension, SOUND.chop, top, { pitch: 1.1 + Math.random() * 0.2 });
  sound(block.dimension, SOUND.chopSquish, top, { volume: 0.4, pitch: 1.6 });
  particle(block.dimension, PARTICLE.bits, top, 4, 0.25, colorFor(recipe));
  return true;
}

function refuse(player: Player, block: Block): void {
  const top = boardTop(block);
  sound(block.dimension, SOUND.thud, top, { pitch: 0.5 });
  particle(block.dimension, PARTICLE.puff, top, 2, 0.2);
  actionBar(player, t("hk.board.refuse"));
}

function emptyHand(player: Player, block: Block): void {
  sound(block.dimension, SOUND.tap, boardTop(block));
  actionBar(player, t("hk.board.hint"));
}

function use(player: Player, block: Block): void {
  const held = getHeldItem(player);
  if (!held) return emptyHand(player, block);
  const recipe = findCuttingRecipe(held.typeId);
  if (!recipe) return refuse(player, block);
  chopOnce(player, block, recipe);
}

// --- sneak-chop (S6) -----------------------------------------------------------------------------

const chopping = new Map<string, number>(); // player id -> runInterval handle

function stopChopping(playerId: string): void {
  const handle = chopping.get(playerId);
  if (handle !== undefined) system.clearRun(handle);
  chopping.delete(playerId);
}

function startChopping(player: Player, block: Block): void {
  const held = getHeldItem(player);
  if (!held) return emptyHand(player, block);
  const recipe = findCuttingRecipe(held.typeId);
  if (!recipe) return refuse(player, block);

  stopChopping(player.id);
  const { dimension, location } = block;
  const center = block.center();
  if (!chopOnce(player, block, recipe)) return;

  const playerId = player.id;
  const handle = system.runInterval(() => {
    try {
      const board = dimension.getBlock(location);
      const keepGoing =
        player.isValid &&
        board?.typeId === BLOCK_CUTTING_BOARD &&
        player.dimension.id === dimension.id &&
        distance(player.location, center) <= CHOP_MAX_DISTANCE &&
        chopOnce(player, board, recipe);
      if (!keepGoing) stopChopping(playerId);
    } catch {
      stopChopping(playerId);
    }
  }, CHOP_INTERVAL_TICKS);
  chopping.set(playerId, handle);
}

const cuttingStation: BlockCustomComponent = {
  onPlayerInteract({ block, player }) {
    if (!player) return;
    const held = getHeldItem(player);
    if (player.isSneaking && held && findCuttingRecipe(held.typeId)) return; // before-event has it
    use(player, block);
  },
};

export function registerCuttingBoard(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_CUTTING_STATION, cuttingStation);
}

export function registerCuttingBoardEvents(): void {
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { block, player, itemStack, isFirstEvent } = event;
    if (block.typeId !== BLOCK_CUTTING_BOARD || !player.isSneaking) return;
    if (!itemStack || !findCuttingRecipe(itemStack.typeId)) return;
    event.cancel = true;
    if (!isFirstEvent) return;
    system.run(() => {
      const board = player.isValid ? block.dimension.getBlock(block.location) : undefined;
      if (board?.typeId === BLOCK_CUTTING_BOARD) startChopping(player, board);
    });
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => stopChopping(playerId));
}

import { ItemStack, world, type Player } from "@minecraft/server";
import { GOT_WALLET_PROPERTY, ITEM_WALLET } from "../config";
import { getContainer } from "../inventory";
import { mirrorScore } from "../scoreboard";
import { getCoins } from "../wallet";

export function syncScore(player: Player): void {
  mirrorScore(player, getCoins(player));
}

function giveStarterWallet(player: Player): void {
  if (player.getDynamicProperty(GOT_WALLET_PROPERTY) === true) return;
  const container = getContainer(player);
  if (!container) return;

  const leftover = container.addItem(new ItemStack(ITEM_WALLET));
  if (leftover) player.dimension.spawnItem(leftover, player.location); // full inventory: drop it
  player.setDynamicProperty(GOT_WALLET_PROPERTY, true);
  player.sendMessage("You got a §6Ruby Wallet§r. Use it to check your balance and open the shop.");
}

export function registerPlayerJoin(): void {
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;
    syncScore(player);
    giveStarterWallet(player);
  });
}

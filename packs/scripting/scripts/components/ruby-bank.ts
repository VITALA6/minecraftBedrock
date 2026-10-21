import type { BlockComponentRegistry, BlockCustomComponent } from "@minecraft/server";
import { ITEM_RUBY } from "../config";
import { getContainer } from "../inventory";
import { addCoins, getCoins, roomInWallet } from "../wallet";

// Custom components V2: the block JSON lists `"myteam:ruby_bank": { "coins_per_ruby": 1 }`
// among its components, and the script registers behavior for that name. The JSON object arrives
// as `params`. It is untyped data from a pack file, so validate it.

export const RUBY_BANK = "myteam:ruby_bank";

function coinsPerRuby(params: unknown): number {
  if (typeof params === "object" && params !== null) {
    const rate = (params as Record<string, unknown>).coins_per_ruby;
    if (typeof rate === "number" && Number.isInteger(rate) && rate > 0) return rate;
  }
  return 1;
}

const rubyBank: BlockCustomComponent = {
  onPlayerInteract({ player }, { params }) {
    if (!player) return;
    const rate = coinsPerRuby(params);
    const container = getContainer(player);
    const slot = player.selectedSlotIndex;
    const held = container?.getItem(slot);

    if (!container || held?.typeId !== ITEM_RUBY) {
      player.onScreenDisplay.setActionBar(
        `Balance: §e${getCoins(player)}§r coins. Hold rubies and use this block to deposit.`,
      );
      return;
    }

    const deposit = Math.min(held.amount, Math.floor(roomInWallet(player) / rate));
    if (deposit === 0) {
      player.onScreenDisplay.setActionBar("§eYour wallet is full");
      return;
    }
    if (deposit === held.amount) {
      container.setItem(slot, undefined);
    } else {
      held.amount -= deposit;
      container.setItem(slot, held);
    }
    const added = addCoins(player, deposit * rate);
    player.onScreenDisplay.setActionBar(
      `§a+${added} coins§r for ${deposit} rubies. Balance: §e${getCoins(player)}`,
    );
  },
};

export function registerRubyBank(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(RUBY_BANK, rubyBank);
}

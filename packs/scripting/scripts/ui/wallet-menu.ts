import type { Player } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import { CATALOG, purchase, purchaseLimit, type ShopItem } from "../shop";
import { getCoins } from "../wallet";

// form.show() resolves when the player closes the form. Anything can happen in between: the player
// may leave (then `player.isValid` is false, or show() rejects with FormRejectError), spend coins
// elsewhere, or fill their inventory. So check validity after every await, and let purchase()
// re-validate everything.

export async function openWalletMenu(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("Ruby Wallet")
    .body(`Balance: §e${getCoins(player)}§r coins\n\nShop:`);
  for (const item of CATALOG) form.button(`${item.label}\n§8${item.price} coins each`, item.icon);

  const response = await form.show(player);
  if (!player.isValid) return;
  if (response.canceled) {
    if (response.cancelationReason === FormCancelationReason.UserBusy) {
      player.sendMessage("§eClose chat or other menus, then use the wallet again.");
    }
    return;
  }

  const item = response.selection === undefined ? undefined : CATALOG[response.selection];
  if (item) await openPurchaseForm(player, item);
}

async function openPurchaseForm(player: Player, item: ShopItem): Promise<void> {
  const limit = purchaseLimit(player, item);
  if (limit.reason !== undefined) {
    player.sendMessage(`§c${limit.reason}`);
    return;
  }

  // The slider starts at 0 ("cancel") so it is still a real range when only 1 can be bought.
  const form = new ModalFormData()
    .title(`Buy ${item.label}`)
    .slider(`Quantity (${item.price} coins each, you have ${getCoins(player)})`, 0, limit.max, {
      valueStep: 1,
      defaultValue: 1,
    })
    .submitButton("Buy");

  const response = await form.show(player);
  if (!player.isValid || response.canceled) return;

  // formValues has one entry per control, in order. Ours is the slider at index 0.
  const quantity = response.formValues?.[0];
  if (typeof quantity !== "number" || quantity === 0) {
    player.sendMessage("Nothing bought.");
    return;
  }

  const result = purchase(player, item, quantity);
  player.sendMessage(
    result.ok
      ? `§aBought ${result.quantity} × ${item.label} for ${result.cost} coins.§r Balance: ${getCoins(player)}`
      : `§c${result.reason}`,
  );
}

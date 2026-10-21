import { world } from "@minecraft/server";
import { FormRejectError, FormRejectReason } from "@minecraft/server-ui";
import { ITEM_WALLET } from "../config";
import { openWalletMenu } from "../ui/wallet-menu";

export function registerWalletItem(): void {
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack.typeId !== ITEM_WALLET) return;

    // Event callbacks can't be async, so handle the promise explicitly.
    openWalletMenu(source).catch((error: unknown) => {
      if (error instanceof FormRejectError && error.reason === FormRejectReason.PlayerQuit) return;
      console.error(`[wallet] menu failed: ${String(error)}`);
    });
  });
}

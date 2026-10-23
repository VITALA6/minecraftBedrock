import type { Player } from "@minecraft/server";
import {
  ActionFormData,
  FormCancelationReason,
  FormRejectError,
  FormRejectReason,
} from "@minecraft/server-ui";
import { BOOK, SPREADS, TAPPABLE, slotLabel } from "../guide/book-layout";
import type { GuideAction, PageModel } from "../guide/guide-model";
import { t } from "../lib/text";

// Shows a Kitchen Guide page (guide/guide-model.ts) as an ActionFormData that our JSON UI draws
// as a book (resource/ui/wm_kitchen_guide/guide.json, D19/D20). The title carries the spread's marker;
// every one of the BOOK.size buttons is sent, unset ones as empty slots, so index N of the form is
// always slot N of the layout (guide/book-layout.ts). Only buttons are added: label(), header()
// and divider() rows would shift every index.
//
// Forms are snapshots. Actions must re-read and re-validate whatever they change, because the
// world moves on while the form is open (plan §2.4).

/** Shows `page`; resolves to the tapped slot's action, or undefined if closed. */
export async function showBookPage(
  player: Player,
  page: PageModel,
): Promise<GuideAction | undefined> {
  const form = new ActionFormData()
    .title({ rawtext: [{ text: SPREADS[page.spread] }, page.title] })
    .body(page.body);
  for (let index = 0; index < BOOK.size; index++) {
    const slot = page.slots[index];
    form.button(slotLabel(slot?.role ?? "e", slot?.count ?? "", slot?.text), slot?.icon);
  }
  const response = await form.show(player);
  if (!player.isValid) return undefined;
  if (response.canceled) {
    if (response.cancelationReason === FormCancelationReason.UserBusy) {
      player.sendMessage(t("wm_kitchen.ui.busy"));
    }
    return undefined;
  }
  const slot = response.selection === undefined ? undefined : page.slots[response.selection];
  return slot && TAPPABLE.has(slot.role) ? slot.action : undefined;
}

/** Runs a form flow without letting its promise float; a player leaving mid-form is normal. */
export function runForm(flow: Promise<unknown>, what: string): void {
  flow.catch((error: unknown) => {
    if (error instanceof FormRejectError && error.reason === FormRejectReason.PlayerQuit) return;
    console.error(`[simmerfield] ${what} failed: ${String(error)}`);
  });
}

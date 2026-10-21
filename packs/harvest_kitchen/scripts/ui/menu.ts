import type { Player, RawMessage } from "@minecraft/server";
import {
  ActionFormData,
  FormCancelationReason,
  FormRejectError,
  FormRejectReason,
} from "@minecraft/server-ui";
import { UI_ICONS } from "../data/icons";
import { t } from "../lib/text";

// ActionFormData with one action per button (D11). Every row of an ActionForm is a button, so
// every button does something; labels, headers and dividers are only for grouping.
//
// Forms are snapshots. Actions must re-read and re-validate whatever they change, because the
// world moves on while the form is open (plan §2.4).

export class Menu<T> {
  private readonly form = new ActionFormData();
  private readonly actions: (() => T)[] = [];

  constructor(title: RawMessage) {
    this.form.title(title);
  }

  body(text: RawMessage): this {
    this.form.body(text);
    return this;
  }

  header(text: RawMessage): this {
    this.form.header(text);
    return this;
  }

  divider(): this {
    this.form.divider();
    return this;
  }

  button(label: RawMessage, icon: string | undefined, action: () => T): this {
    this.form.button(label, icon);
    this.actions.push(action);
    return this;
  }

  /** The Back button, always last. */
  back(action: () => T): this {
    return this.divider().button(t("hk.ui.back"), UI_ICONS.back, action);
  }

  get size(): number {
    return this.actions.length;
  }

  /** Shows the menu; resolves to the chosen action's result, or undefined if closed. */
  async show(player: Player): Promise<T | undefined> {
    const response = await this.form.show(player);
    if (!player.isValid) return undefined;
    if (response.canceled) {
      if (response.cancelationReason === FormCancelationReason.UserBusy) {
        player.sendMessage(t("hk.ui.busy"));
      }
      return undefined;
    }
    const action = response.selection === undefined ? undefined : this.actions[response.selection];
    return action?.();
  }
}

/** Runs a form flow without letting its promise float; a player leaving mid-form is normal. */
export function runForm(flow: Promise<unknown>, what: string): void {
  flow.catch((error: unknown) => {
    if (error instanceof FormRejectError && error.reason === FormRejectReason.PlayerQuit) return;
    console.error(`[harvest_kitchen] ${what} failed: ${String(error)}`);
  });
}

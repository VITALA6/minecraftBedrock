import type { Player, RawMessage } from "@minecraft/server";
import {
  ActionFormData,
  FormCancelationReason,
  FormRejectError,
  FormRejectReason,
} from "@minecraft/server-ui";
import { BOOK, SPREADS, TAPPABLE, slotLabel, type Role, type Spread } from "../guide/book-layout";
import { t } from "../lib/text";

// An ActionFormData drawn as the Kitchen Guide's book (resource/ui/hk_guide/guide.json, D19). The
// title carries the spread's marker; every one of the BOOK.size buttons is sent, unset ones as
// empty slots, so index N of the form is always slot N of the layout (guide/book-layout.ts).
// Only buttons are added: label(), header() and divider() rows would shift every index.
//
// Forms are snapshots. Actions must re-read and re-validate whatever they change, because the
// world moves on while the form is open (plan §2.4).

export interface Slot {
  readonly role: Role;
  /** Drawn at the slot's bottom-right: a number (≤ 1 shows nothing) or ≤ 2 ASCII characters. */
  readonly count?: number | string;
  /** Tooltip, row name, chip or heading text. */
  readonly text?: RawMessage;
  readonly icon?: string;
}

export class BookForm<T> {
  private readonly slots: (Slot | undefined)[] = Array.from({ length: BOOK.size }, () => undefined);
  private readonly actions = new Map<number, () => T>();
  private bodyText: RawMessage = { text: "" };

  constructor(
    private readonly spread: Spread,
    private readonly title: RawMessage,
  ) {}

  body(text: RawMessage): this {
    this.bodyText = text;
    return this;
  }

  /** Puts `slot` at `index`; `action` runs when it's tapped (tappable roles only). */
  set(index: number, slot: Slot, action?: () => T): this {
    if (!Number.isInteger(index) || index < 0 || index >= BOOK.size) {
      throw new Error(`book slot ${index} is outside 0..${BOOK.size - 1}`);
    }
    this.slots[index] = slot;
    if (action && TAPPABLE.has(slot.role)) this.actions.set(index, action);
    else this.actions.delete(index);
    return this;
  }

  /** A heading or footer: text only, not tappable. */
  text(index: number, message: RawMessage): this {
    return this.set(index, { role: "t", text: message });
  }

  /** Shows the book page; resolves to the tapped slot's action result, or undefined if closed. */
  async show(player: Player): Promise<T | undefined> {
    const form = new ActionFormData()
      .title({ rawtext: [{ text: SPREADS[this.spread] }, this.title] })
      .body(this.bodyText);
    for (const slot of this.slots) {
      form.button(slotLabel(slot?.role ?? "e", slot?.count ?? "", slot?.text), slot?.icon);
    }
    const response = await form.show(player);
    if (!player.isValid) return undefined;
    if (response.canceled) {
      if (response.cancelationReason === FormCancelationReason.UserBusy) {
        player.sendMessage(t("hk.ui.busy"));
      }
      return undefined;
    }
    const action =
      response.selection === undefined ? undefined : this.actions.get(response.selection);
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

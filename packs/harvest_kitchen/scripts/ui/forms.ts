import { system, type Player, type RawMessage } from "@minecraft/server";
import {
  DataDrivenScreenClosedReason,
  FormRejectError,
  FormRejectReason,
  PlayerLeftError,
  type CustomForm,
  type UIRawMessage,
} from "@minecraft/server-ui";
import { t } from "../lib/text";

// Shared bits of the CustomForm screens (D14): the book (ui/book.ts) and the pot screen
// (ui/pot-screen.ts).
//
// - Button onClick callbacks only schedule work (`later`): the action runs next tick, so it never
//   depends on what the callback's execution context allows, and it re-checks the player first.
// - Forms are re-validated on every action: the world moves on while a form is open.

/** RawMessage (from our lang helpers) as the UI's message type; the shapes match. */
export function ui(message: RawMessage): UIRawMessage {
  return message;
}

export const EMPTY_TEXT: UIRawMessage = { text: "" };

/** Runs `action` next tick if the player is still there. */
export function later(player: Player, action: () => void): void {
  system.run(() => {
    if (player.isValid) action();
  });
}

/** Closes `form` if it's showing; a form that already closed is fine. */
export function closeForm(form: CustomForm): void {
  try {
    if (form.isShowing()) form.close();
  } catch {
    // closed in between (the player pressed X in the same tick)
  }
}

/** Shows `form`; says "close chat" when the player is busy. True if it closed normally. */
export async function showForm(player: Player, form: CustomForm): Promise<boolean> {
  const reason = await form.show();
  if (!player.isValid) return false;
  if (reason === DataDrivenScreenClosedReason.UserBusy) {
    player.sendMessage(t("hk.ui.busy"));
    return false;
  }
  return true;
}

/** Runs a form flow without letting its promise float; a player leaving mid-form is normal. */
export function runForm(flow: Promise<unknown>, what: string): void {
  flow.catch((error: unknown) => {
    if (error instanceof PlayerLeftError) return;
    if (error instanceof FormRejectError && error.reason === FormRejectReason.PlayerQuit) return;
    console.error(`[harvest_kitchen] ${what} failed: ${String(error)}`);
  });
}

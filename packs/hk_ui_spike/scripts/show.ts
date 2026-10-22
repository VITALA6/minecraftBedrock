import { type Player, system } from "@minecraft/server";
import {
  FormCancelationReason,
  FormRejectError,
  FormRejectReason,
  type FormResponse,
} from "@minecraft/server-ui";
import type { SlotForm } from "./slot-form";

// Showing forms and reporting what came back. Everything goes to chat, because the Content Log
// file loses its tail under mcpelauncher (CLAUDE.md).

/** `/scriptevent` is typed in chat, which is still closing when the event fires: retry on UserBusy. */
const BUSY_RETRIES = 20;
const BUSY_DELAY_TICKS = 5;

export function report(player: Player, name: string, text: string): void {
  if (!player.isValid) return;
  player.sendMessage(`§7[S9 ${name}]§r ${text}`);
}

/** Shows a form, retrying while the player is busy. Undefined if the player left. */
export async function showWhenFree<R extends FormResponse>(
  player: Player,
  show: () => Promise<R>,
): Promise<R | undefined> {
  for (let attempt = 0; ; attempt++) {
    const response = await show();
    if (!player.isValid) return undefined;
    const busy = response.canceled && response.cancelationReason === FormCancelationReason.UserBusy;
    if (!busy || attempt >= BUSY_RETRIES) return response;
    await system.waitTicks(BUSY_DELAY_TICKS);
    if (!player.isValid) return undefined;
  }
}

/** Safety cap so a stuck loop can't keep reopening forever. */
const MAX_TAPS = 60;

/**
 * Shows a slot form again after every tap, so a tester can tap through every slot in one go.
 * `onTap` reports the index and may change state for the next round; closing the form (X, Esc,
 * B) ends the loop.
 */
export async function tapLoop(
  player: Player,
  name: string,
  round: () => { form: SlotForm; onTap?: (index: number) => void },
): Promise<void> {
  for (let tap = 0; tap < MAX_TAPS; tap++) {
    const { form, onTap } = round();
    const response = await showWhenFree(player, () => form.build().show(player));
    if (!response) return;
    if (response.canceled || response.selection === undefined) {
      report(player, name, `closed (${response.cancelationReason ?? "no selection"})`);
      return;
    }
    report(
      player,
      name,
      `tapped §e#${response.selection}§r = ${form.describe(response.selection)}`,
    );
    onTap?.(response.selection);
  }
  report(player, name, `stopped after ${MAX_TAPS} taps`);
}

/** Runs a form flow without a floating promise; errors go to chat and the Content Log. */
export function runFlow(player: Player, name: string, flow: Promise<unknown>): void {
  flow.catch((error: unknown) => {
    if (error instanceof FormRejectError && error.reason === FormRejectReason.PlayerQuit) return;
    console.error(`[hk_ui_spike] ${name} failed: ${String(error)}`);
    report(player, name, `§cfailed: ${String(error)}`);
  });
}

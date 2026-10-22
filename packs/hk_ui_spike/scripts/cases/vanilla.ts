import type { Player } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { MARKER, TEX } from "../config";
import { report, showWhenFree } from "../show";

// Regression cases: forms WITHOUT our marker must look exactly like vanilla while the spike RP is
// active. Each one uses every element its form type has.

export async function openVanillaAction(player: Player): Promise<void> {
  // "§h" alone (quartz colour) on purpose: only "§h§k" may switch the layout.
  const form = new ActionFormData()
    .title("§hVanilla§r ActionForm")
    .body("Body text. Below: header, label, divider, then 4 buttons.")
    .header("A header()")
    .label("A label()")
    .divider()
    .button("Vanilla icon (carrot)", TEX.carrot)
    .button("Our icon (tomato)", TEX.tomato)
    .button("No icon")
    .button(
      "A long button label that has to wrap or be cut off, to compare with vanilla",
      TEX.bowl,
    );
  const response = await showWhenFree(player, () => form.show(player));
  if (!response) return;
  report(
    player,
    "vanilla",
    response.canceled
      ? `closed (${response.cancelationReason})`
      : `selection §e#${response.selection}§r`,
  );
}

export async function openModal(player: Player): Promise<void> {
  const form = new ModalFormData()
    .title("Vanilla ModalForm")
    .header("A header()")
    .label("A label()")
    .divider()
    .toggle("A toggle", { defaultValue: true })
    .slider("A slider", 0, 10, { defaultValue: 4 })
    .dropdown("A dropdown", ["One", "Two", "Three"], { defaultValueIndex: 1 })
    .textField("A text field", "placeholder")
    .submitButton("Submit");
  const response = await showWhenFree(player, () => form.show(player));
  if (!response) return;
  report(
    player,
    "modal",
    response.canceled
      ? `closed (${response.cancelationReason})`
      : `values ${JSON.stringify(response.formValues)}`,
  );
}

export async function openMessage(player: Player, prefixed: boolean): Promise<void> {
  const name = prefixed ? "msgprefix" : "message";
  const form = new MessageFormData()
    .title(prefixed ? `${MARKER.book}Prefixed MessageForm` : "Vanilla MessageForm")
    .body(
      prefixed
        ? "If this shows inside the book, MessageForm uses long_form too."
        : "Two buttons below.",
    )
    .button1(prefixed ? "s  Button 1" : "Button 1")
    .button2(prefixed ? "s  Button 2" : "Button 2");
  const response = await showWhenFree(player, () => form.show(player));
  if (!response) return;
  report(
    player,
    name,
    response.canceled
      ? `closed (${response.cancelationReason})`
      : `selection §e#${response.selection}§r`,
  );
}

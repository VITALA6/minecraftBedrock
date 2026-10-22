import type { RawMessage } from "@minecraft/server";

// The button-label code read by ui/hk_ui_spike/forms.json.
//
// Every label starts with a 3-byte ASCII header, then the display text:
//
//   byte 1     role: s slot, l locked (silhouette + "?"), h needs heat (flame badge),
//              a active (open chapter ribbon), e empty (drawn as an empty slot, not clickable)
//   bytes 2-3  count, drawn verbatim at the slot's bottom-right: "  " none, " 2", "64", "+1"
//   rest       display text (tooltip on PC, the label on text buttons); any RawMessage
//
// The JSON reads it with ('%.1s' * #form_button_text) for the role, ('%.3s' * t) - ('%.1s' * t)
// for the count, and t - ('%.3s' * t) for the text. '%.Ns' cuts bytes, so the header must stay
// ASCII; the display text after it can be anything (translated, colour codes, any language).

export type Role = "s" | "l" | "h" | "a" | "e";

const ASCII = /^[\x20-\x7e]*$/;

/** Formats the 2-byte count field. Numbers ≤ 1 show nothing, like vanilla stacks. */
export function countField(count: number | string = ""): string {
  const text =
    typeof count === "number" ? (count <= 1 ? "" : String(Math.min(Math.floor(count), 99))) : count;
  if (text.length > 2 || !ASCII.test(text)) {
    throw new Error(`count field must be at most 2 ASCII characters, got "${text}"`);
  }
  return text.padStart(2, " ");
}

/** The header alone, e.g. `s 2`. */
export function header(role: Role, count: number | string = ""): string {
  return role + countField(count);
}

/** A full button label: header + display text. */
export function slotLabel(
  role: Role,
  count: number | string,
  text: RawMessage | string,
): RawMessage {
  return { rawtext: [{ text: header(role, count) }, typeof text === "string" ? { text } : text] };
}

/** An empty slot. It is still an ActionForm button (every row is), but the layout hides it. */
export function emptyLabel(): RawMessage {
  return { rawtext: [{ text: header("e") }] };
}

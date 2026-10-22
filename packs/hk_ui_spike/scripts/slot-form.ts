import type { RawMessage } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { emptyLabel, header, type Role, slotLabel } from "./slot-label";

interface Slot {
  label: RawMessage;
  icon?: string;
  /** What the chat report says when this index comes back. */
  note: string;
}

/**
 * An ActionForm whose buttons sit at fixed indexes of a custom layout. Unset indexes are sent as
 * empty slots, so index N of the form is always slot N of the layout.
 *
 * Only buttons are added: label(), header() and divider() would take a place in the same
 * `form_buttons` collection and shift every slot after them (see the `shift` case).
 */
export class SlotForm {
  private readonly slots: (Slot | undefined)[];
  private bodyText: RawMessage | string = "";

  constructor(
    private readonly marker: string,
    private readonly titleText: RawMessage | string,
    size: number,
  ) {
    this.slots = Array.from({ length: size }, () => undefined);
  }

  body(text: RawMessage | string): this {
    this.bodyText = text;
    return this;
  }

  set(
    index: number,
    role: Role,
    count: number | string,
    text: RawMessage | string,
    icon?: string,
  ): this {
    if (index < 0 || index >= this.slots.length) {
      throw new Error(`slot ${index} is outside 0..${this.slots.length - 1}`);
    }
    const shown = typeof text === "string" ? text : (text.translate ?? "rawtext");
    this.slots[index] = {
      label: slotLabel(role, count, text),
      icon,
      note: `${header(role, count).trim() || role} ${shown}`,
    };
    return this;
  }

  /** What chat says for a returned index. */
  describe(index: number): string {
    return this.slots[index]?.note ?? "empty slot (should not be clickable)";
  }

  build(): ActionFormData {
    const title: RawMessage = {
      rawtext: [
        { text: this.marker },
        typeof this.titleText === "string" ? { text: this.titleText } : this.titleText,
      ],
    };
    const form = new ActionFormData().title(title).body(this.bodyText);
    for (const slot of this.slots) {
      if (slot) form.button(slot.label, slot.icon);
      else form.button(emptyLabel());
    }
    return form;
  }
}

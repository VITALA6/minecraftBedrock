import { ItemStack, type RawMessage } from "@minecraft/server";

// Every player-facing string is a lang key in resource/texts/en_US.lang, so the pack can be
// localized without touching code. Placeholders use the vanilla form: %1$s, %2$s, ...

export type TextArg = RawMessage | string | number;

// Always wrapped in { rawtext: [...] }, the canonical form. In 1.26.52 the only ActionForm button
// built from a bare { translate } with no arguments showed an empty label; buttons whose
// translate carried "with" arguments rendered fine.
export function t(key: string, ...args: TextArg[]): RawMessage {
  if (args.length === 0) return { rawtext: [{ translate: key }] };
  const params = args.map((arg) => (typeof arg === "object" ? arg : { text: String(arg) }));
  return { rawtext: [{ translate: key, with: { rawtext: params } }] };
}

const nameKeys = new Map<string, string>();

/** The item's localized name, e.g. "Tomato" or "Carrot". */
export function itemName(typeId: string): RawMessage {
  let key = nameKeys.get(typeId);
  if (key === undefined) {
    key = new ItemStack(typeId).localizationKey;
    nameKeys.set(typeId, key);
  }
  return { translate: key };
}

/** "2 × Tomato" */
export function itemCount(typeId: string, count: number): RawMessage {
  return t("hk.ui.item_count", count, itemName(typeId));
}

/** Joins messages with ", ". */
export function list(parts: readonly RawMessage[]): RawMessage {
  return { rawtext: parts.flatMap((part, i) => (i === 0 ? [part] : [{ text: ", " }, part])) };
}

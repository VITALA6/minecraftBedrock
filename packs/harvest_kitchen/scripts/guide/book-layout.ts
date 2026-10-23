import type { RawMessage } from "@minecraft/server";

// The contract between the Kitchen Guide's script pages (ui/guide-screen.ts) and its JSON UI book
// (resource/ui/hk_guide/guide.json, written by tools/gen-guide-ui.mjs from this file). Pure, so
// tests and the generator read it in Node; the type-only import above is erased.
//
// - The book is an ActionFormData. resource/ui/server_form.json hides the vanilla form when the
//   title contains BOOK_MARKER and shows our book instead; the marker's last digit picks the spread.
// - Every tappable thing is a form button at a fixed index (BOOK). Unused indexes are still sent,
//   as empty slots, so index N of the form is always slot N of the layout. Never add label(),
//   header() or divider() rows: they share the button collection and would shift every index.
// - Each button label starts with a 3-byte ASCII header (role + count), read by the layout with
//   '%.1s' and '%.3s' (byte cuts, so the header must stay ASCII); the display text follows.

/** Every book title starts with one of these: 4 format codes, 12 bytes, nothing visible. */
export const SPREADS = {
  /** Left: title, big icon, body, effect and station chips. Right: 3×3 grid, result, cook row. */
  recipe: "§h§k§1§r",
  /** Left: title, big icon, body. Right: heading, LIST_ROWS rows of icon + text, footer. */
  list: "§h§k§2§r",
  /** Left: title, big icon. Right: heading, then the body as a full page of text. */
  text: "§h§k§3§r",
} as const;

export type Spread = keyof typeof SPREADS;

/** What server_form.json looks for to swap the vanilla form for the book. */
export const BOOK_MARKER = "§h§k";
/** Byte length of every SPREADS marker, cut off the title with '%.12s'. */
export const MARKER_BYTES = 12;

export const LIST_ROWS = 7;

/** Fixed button indexes. Content indexes are shared: a spread uses the ones it draws. */
export const BOOK = {
  /** The big picture on the left page. Not tappable. */
  icon: 0,
  /** Recipe: the 3×3 grid, row by row. */
  grid: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  /** List: the rows, top to bottom (the first LIST_ROWS of 1..). */
  rows: [1, 2, 3, 4, 5, 6, 7],
  /** Recipe: what the grid makes (the mix of a hot dish, or the dish). */
  result: 10,
  /** Recipe, hot dishes: the pot chip of the cook row. */
  cook: 11,
  /** Recipe, hot dishes: the dish the cook row makes. */
  cooked: 12,
  /** Right page heading (text). */
  heading: 13,
  /** Right page footer (text): ingredient names, page number. */
  footer: 14,
  /** Recipe, left page: the effect chip and the station chip. */
  effect: 15,
  station: 16,
  prev: 17,
  next: 18,
  back: 19,
  home: 20,
  /** Ribbons on the right edge, top to bottom (TABS). */
  tabs: [21, 22, 23, 24, 25, 26],
  size: 27,
} as const;

/** The ribbons, in BOOK.tabs order. */
export const TABS = ["hot", "cold", "board", "crops", "topics", "what"] as const;
export type Tab = (typeof TABS)[number];

/**
 * A button's role, the header's first byte:
 * s a normal slot · l locked (dark silhouette and "?") · h needs heat (small flame) ·
 * a the open chapter's ribbon · t text only (headings, not tappable) · e empty (hidden or dead).
 */
export type Role = "s" | "l" | "h" | "a" | "t" | "e";

/** Roles the player can tap. */
export const TAPPABLE: ReadonlySet<Role> = new Set(["s", "l", "h", "a"]);

const ASCII = /^[\x20-\x7e]*$/;

/** The 2-byte count field. Numbers ≤ 1 show nothing, like vanilla stacks; capped at 99. */
export function countField(count: number | string = ""): string {
  const text =
    typeof count === "number" ? (count <= 1 ? "" : String(Math.min(Math.floor(count), 99))) : count;
  if (text.length > 2 || !ASCII.test(text)) {
    throw new Error(`count field must be at most 2 ASCII characters, got "${text}"`);
  }
  return text.padStart(2, " ");
}

/** The header alone, e.g. "s 2". */
export function header(role: Role, count: number | string = ""): string {
  return role + countField(count);
}

/** A full button label: header + display text. */
export function slotLabel(role: Role, count: number | string, text?: RawMessage): RawMessage {
  const parts: RawMessage[] = [{ text: header(role, count) }];
  if (text) parts.push(text);
  return { rawtext: parts };
}

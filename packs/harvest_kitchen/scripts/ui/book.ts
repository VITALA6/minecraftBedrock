import type { Player, RawMessage } from "@minecraft/server";
import {
  CustomForm,
  ObservableBoolean,
  ObservableString,
  ObservableUIRawMessage,
} from "@minecraft/server-ui";
import { BOOK_FLIP, RP_UUID, SOUND } from "../config";
import { foundCrops } from "../book/discovery";
import { cropByKey } from "../data/crops";
import { EFFECTS, familyOf, findDish } from "../data/dishes";
import { stationById } from "../data/stations";
import { countInventory, isCreative } from "../lib/inventory";
import { itemName, t } from "../lib/text";
import {
  MAX_CONTEXT_BUTTONS,
  bookImagePath,
  bookPage,
  contextButtons,
  contextTarget,
  cropKnown,
  missingCrops,
  nextPage,
  pageImage,
  prevPage,
  type BookPage,
  type Chapter,
  type ContextButton,
  type Discovery,
} from "./book-pages";
import { EMPTY_TEXT, closeForm, later, runForm, showForm, ui } from "./forms";

// The recipe book (plan §3, D14): one CustomForm showing one large pre-rendered page image
// (tools/gen-book-pages.mjs) with icon-free buttons under it:
//
//   [page image]                    the page for this player: locked or unlocked (book-pages.ts)
//   [label]                         one short localized line (effect, where to find, ...)
//   ◀ Prev   Next ▶   Contents      walk BOOK_ORDER; Contents = Home
//   context buttons                 the page's choices: dish names (or ???), crops, chapters
//   Close (X)
//
// The title is the page's name from lang. Pages flip in place (BOOK_FLIP "in_place"): the image
// src, title, label and a fixed pool of context buttons are observables. "reopen" builds a fresh
// form per page instead.

interface PageView {
  readonly title: RawMessage;
  readonly image: string;
  readonly label?: RawMessage;
  readonly buttons: readonly { readonly label: RawMessage; readonly target: BookPage }[];
  readonly prev?: BookPage;
  readonly next?: BookPage;
}

function discoveryOf(player: Player): Discovery {
  return { found: foundCrops(player), creative: isCreative(player) };
}

function chapterTitle(chapter: Chapter): RawMessage {
  if (chapter === "board") return t("hk.book.board");
  if (chapter === "crafting") return t("hk.book.crafting");
  if (chapter === "crops") return t("hk.book.crops");
  return t(stationById(chapter)?.nameKey ?? "hk.station.pot");
}

const named = (message: RawMessage) => t("hk.ui.text", message);

function dishLabel(id: string): RawMessage {
  const dish = findDish(id);
  const family = dish && familyOf(dish);
  return named(family ? { rawtext: [{ text: `${family.glyph} ` }, itemName(id)] } : itemName(id));
}

function buttonLabel(button: ContextButton): RawMessage {
  switch (button.kind) {
    case "what":
      return t("hk.book.what");
    case "chapter":
      return chapterTitle(button.chapter);
    case "dish":
      return button.locked ? t("hk.book.locked") : dishLabel(button.id);
    case "crop": {
      const crop = cropByKey(button.key);
      if (!crop) return t("hk.book.locked");
      return button.known
        ? t("hk.book.go", itemName(crop.produce))
        : t("hk.book.crop_locked", t(crop.whereKey));
    }
  }
}

function effectLine(id: string): RawMessage {
  const dish = findDish(id);
  const effect = dish?.effect;
  const info = effect && EFFECTS[effect.effect];
  const family = dish && familyOf(dish);
  const line =
    effect && info && family
      ? t("hk.book.effect_line", family.glyph, { translate: info.nameKey }, effect.seconds)
      : t("hk.book.no_effect");
  if (!dish?.slices) return line;
  return { rawtext: [line, { text: "\n" }, t("hk.book.sliced", dish.slices.count)] };
}

function titleAndLabel(page: BookPage, d: Discovery): { title: RawMessage; label?: RawMessage } {
  switch (page.kind) {
    case "home":
      return { title: t("hk.book.title") };
    case "what":
      return { title: t("hk.book.what") };
    case "chapter": {
      const title = chapterTitle(page.chapter);
      if (page.chapter === "board") return { title, label: t("hk.book.board_hint") };
      if (page.chapter === "crops") return { title, label: t("hk.book.crops_hint") };
      if (page.chapter === "crafting") return { title };
      const heat = stationById(page.chapter)?.needsHeat;
      return { title, label: heat ? t("hk.book.needs_heat") : undefined };
    }
    case "dish":
      return missingCrops(page.id, d).length > 0
        ? { title: t("hk.book.locked"), label: t("hk.book.locked_body") }
        : { title: named(itemName(page.id)), label: effectLine(page.id) };
    case "crop": {
      const crop = cropByKey(page.key);
      if (!crop) return { title: t("hk.book.crops") };
      const where = t("hk.book.where", t(crop.whereKey));
      if (!cropKnown(page.key, d)) return { title: t("hk.book.locked"), label: where };
      const plant = t(
        crop.plantOn === "farmland" ? "hk.book.plant_farmland" : "hk.book.plant_soil",
      );
      const lines: RawMessage[] = [where, { text: "\n" }, plant];
      if (crop.type === "bush") lines.push({ text: "\n" }, t("hk.book.bush"));
      return { title: named(itemName(crop.produce)), label: { rawtext: lines } };
    }
  }
}

function viewOf(player: Player, page: BookPage): PageView {
  const d = discoveryOf(player);
  const counts = page.kind === "what" ? countInventory(player) : {};
  const buttons = contextButtons(page, d, counts).map((button) => ({
    label: buttonLabel(button),
    target: contextTarget(button),
  }));
  const { title, label: pageLabel } = titleAndLabel(page, d);
  const label = page.kind === "what" && buttons.length === 0 ? t("hk.book.nothing") : pageLabel;
  return {
    title,
    image: bookImagePath(pageImage(page, d)),
    label,
    buttons,
    prev: prevPage(page),
    next: nextPage(page),
  };
}

interface Slot {
  readonly label: ObservableUIRawMessage;
  readonly shown: ObservableBoolean;
  target?: BookPage;
}

class BookForm {
  readonly form: CustomForm;
  /** Set when the next page needs a fresh form ("reopen" mode, or more buttons than the pool). */
  pending?: BookPage;
  private prev?: BookPage;
  private next?: BookPage;
  private readonly title = new ObservableUIRawMessage(EMPTY_TEXT);
  private readonly src = new ObservableString("");
  private readonly label = new ObservableUIRawMessage(EMPTY_TEXT);
  private readonly labelShown = new ObservableBoolean(false);
  private readonly prevOff = new ObservableBoolean(true);
  private readonly nextOff = new ObservableBoolean(true);
  private readonly homeOff = new ObservableBoolean(true);
  private readonly slots: Slot[] = [];

  constructor(
    private readonly player: Player,
    page: BookPage,
  ) {
    const view = viewOf(player, page);
    const pool = BOOK_FLIP === "in_place" ? MAX_CONTEXT_BUTTONS : view.buttons.length;
    this.form = new CustomForm(player, this.title)
      .image(this.src, RP_UUID, { width: 1 })
      .label(this.label, { visible: this.labelShown })
      .button(t("hk.book.prev"), () => this.go(this.prev), { disabled: this.prevOff })
      .button(t("hk.book.next"), () => this.go(this.next), { disabled: this.nextOff })
      .button(t("hk.book.contents"), () => this.go(bookPage.home()), { disabled: this.homeOff });
    for (let i = 0; i < pool; i++) {
      const slot: Slot = {
        label: new ObservableUIRawMessage(EMPTY_TEXT),
        shown: new ObservableBoolean(false),
      };
      this.slots.push(slot);
      this.form.button(slot.label, () => this.go(slot.target), { visible: slot.shown });
    }
    this.form.closeButton();
    this.apply(page, view);
  }

  private apply(page: BookPage, view: PageView): void {
    this.prev = view.prev;
    this.next = view.next;
    this.title.setData(ui(view.title));
    this.src.setData(view.image);
    this.label.setData(view.label ? ui(view.label) : EMPTY_TEXT);
    this.labelShown.setData(view.label !== undefined);
    this.prevOff.setData(view.prev === undefined);
    this.nextOff.setData(view.next === undefined);
    this.homeOff.setData(page.kind === "home");
    this.slots.forEach((slot, i) => {
      const button = view.buttons[i];
      slot.target = button?.target;
      slot.label.setData(button ? ui(button.label) : EMPTY_TEXT);
      slot.shown.setData(button !== undefined);
    });
  }

  /** Turns to `page`: in place when the form can show it, otherwise through a fresh form. */
  private go(page: BookPage | undefined): void {
    if (!page) return;
    later(this.player, () => {
      if (!this.form.isShowing()) return;
      const view = viewOf(this.player, page);
      this.player.playSound(SOUND.pageTurn);
      if (BOOK_FLIP === "in_place" && view.buttons.length <= this.slots.length) {
        this.apply(page, view);
        return;
      }
      this.pending = page;
      closeForm(this.form);
    });
  }
}

/** Shows the book at `start` (Home by default) until the player closes it. */
export async function showBook(player: Player, start: BookPage = bookPage.home()): Promise<void> {
  player.playSound(SOUND.pageTurn);
  let page: BookPage | undefined = start;
  for (let guard = 0; page && guard < 500; guard++) {
    const book: BookForm = new BookForm(player, page);
    if (!(await showForm(player, book.form))) return;
    page = book.pending;
  }
}

export function openBook(player: Player, start?: BookPage): void {
  runForm(showBook(player, start), "recipe book");
}

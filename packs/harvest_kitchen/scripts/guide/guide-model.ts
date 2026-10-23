import type { RawMessage } from "@minecraft/server";
import { CROPS, cropByKey, type Crop } from "../data/crops";
import { DISHES, EFFECTS, FAMILIES, findDish, type Dish } from "../data/dishes";
import { EFFECT_ICONS, UI_ICONS, itemIcon } from "../data/icons";
import {
  CUTTING_RECIPES,
  recipeMaking,
  servingsOf,
  type Counts,
  type Ingredient,
} from "../data/recipes";
import { stationById } from "../data/stations";
import { cropOfItem, cropsOfDish, isUnlocked } from "../discovery/unlock";
import {
  BOOK,
  LIST_ROWS,
  STAGE_SLOTS,
  TABS,
  USES,
  type Role,
  type Spread,
  type Tab,
} from "./book-layout";
import { GUIDE_LINE_BREAK, GUIDE_TOPICS } from "./guide-pages";

// The Kitchen Guide's pages as data (D19). Pure: no @minecraft/server values, so tests build every
// page in Node and the mockup script (art/harvest_kitchen/mockups/render-book.mjs) draws exactly
// what the game would get. ui/guide-screen.ts gathers the player's state into a GuideContext,
// shows the PageModel through ui/book-form.ts and acts on the tapped slot's GuideAction.
//
// Spreads (guide/book-layout.ts): list (Home, chapters, What can I make?), recipe (a dish), crop
// (a crop) and text (a How to Play topic). Every page has ◀ ▶ (the neighbouring page of the same
// chapter), Back, Home and the ribbons; the open chapter's ribbon is role "a" (tabOf).
//
// Locking follows discovery (D3): undiscovered dishes and crops are dark silhouettes with "?",
// as on the posters. Pot dishes are two steps (D16): grid → mix on the crafting table, then
// the pot cooks the mix.

export type Chapter = "hot" | "cold";

export type GuidePage =
  | { readonly kind: "home" }
  | { readonly kind: "topics"; readonly page: number }
  | { readonly kind: "topic"; readonly index: number }
  | { readonly kind: "dishes"; readonly chapter: Chapter; readonly page: number }
  | { readonly kind: "dish"; readonly id: string }
  | { readonly kind: "board" }
  | { readonly kind: "crops" }
  | { readonly kind: "crop"; readonly key: string }
  | { readonly kind: "what"; readonly page: number };

/** go: open on top · turn: replace this page (◀ ▶) · tab: a chapter right above Home · hint: action bar. */
export type GuideAction =
  | { readonly go: GuidePage }
  | { readonly turn: GuidePage }
  | { readonly tab: GuidePage }
  | { readonly hint: RawMessage }
  | "back"
  | "home";

export interface SlotModel {
  readonly role: Role;
  /** Drawn at the slot's bottom-right: a number (≤ 1 shows nothing) or ≤ 2 ASCII characters. */
  readonly count?: number | string;
  /** Tooltip, row name, chip or heading text. */
  readonly text?: RawMessage;
  readonly icon?: string;
  /** What tapping it does (tappable roles only). */
  readonly action?: GuideAction;
}

export interface PageModel {
  readonly spread: Spread;
  readonly title: RawMessage;
  readonly body: RawMessage;
  /** BOOK.size entries; undefined is an empty slot. */
  readonly slots: readonly (SlotModel | undefined)[];
}

/** What a page needs to know about the player. */
export interface GuideContext {
  /** Crop keys the player has found (discovery). */
  readonly found: ReadonlySet<string>;
  /** Creative unlocks everything. */
  readonly creative: boolean;
  /** item id → count in the player's inventory (What can I make?). */
  readonly counts: Counts;
  /** The item's localized name (in game: its ItemStack's localization key). */
  readonly itemName: (id: string) => RawMessage;
}

export const HOME: GuidePage = { kind: "home" };

// --- text (the pure half of lib/text.ts) ---------------------------------------------------------

type Arg = RawMessage | string | number;

/** A lang key with %1$s… arguments, always as { rawtext } (a bare translate rendered blank). */
export function tr(key: string, ...args: Arg[]): RawMessage {
  if (args.length === 0) return { rawtext: [{ translate: key }] };
  const params = args.map((arg) => (typeof arg === "object" ? arg : { text: String(arg) }));
  return { rawtext: [{ translate: key, with: { rawtext: params } }] };
}

export function joined(parts: readonly RawMessage[], separator = ", "): RawMessage {
  return {
    rawtext: parts.flatMap((part, i) => (i === 0 ? [part] : [{ text: separator }, part])),
  };
}

/** One part per line. */
const lines = (...parts: RawMessage[]): RawMessage => joined(parts, GUIDE_LINE_BREAK);

const EMPTY: RawMessage = { text: "" };

// --- chapters and navigation ----------------------------------------------------------------------

/** A pot dish is hot, a crafting-table dish cold. */
export function chapterOf(dishId: string): Chapter {
  return recipeMaking(dishId)?.kind === "station" ? "hot" : "cold";
}

export function dishesIn(chapter: Chapter): Dish[] {
  return DISHES.filter((dish) => chapterOf(dish.id) === chapter);
}

/** The chapter each ribbon opens. */
export const TAB_PAGE: Readonly<Record<Tab, GuidePage>> = {
  hot: { kind: "dishes", chapter: "hot", page: 0 },
  board: { kind: "board" },
  cold: { kind: "dishes", chapter: "cold", page: 0 },
  crops: { kind: "crops" },
  what: { kind: "what", page: 0 },
  topics: { kind: "topics", page: 0 },
};

/** Each chapter's icon (ribbon, Home row) and name. */
export const TAB_LOOK: Readonly<Record<Tab, { readonly icon: string; readonly nameKey: string }>> =
  {
    hot: { icon: UI_ICONS.pot, nameKey: "hk.guide.hot" },
    board: { icon: UI_ICONS.board, nameKey: "hk.guide.board" },
    cold: { icon: UI_ICONS.crafting, nameKey: "hk.guide.cold" },
    crops: { icon: UI_ICONS.crops, nameKey: "hk.guide.crops" },
    what: { icon: UI_ICONS.whatCanIMake, nameKey: "hk.guide.what" },
    topics: { icon: UI_ICONS.howToPlay, nameKey: "hk.guide.how_to_play" },
  };

/** The chapter a page belongs to: its ribbon is drawn open. Home belongs to none. */
export function tabOf(page: GuidePage): Tab | undefined {
  switch (page.kind) {
    case "home":
      return undefined;
    case "topics":
    case "topic":
      return "topics";
    case "dishes":
      return page.chapter;
    case "dish":
      return chapterOf(page.id);
    case "board":
      return "board";
    case "crops":
    case "crop":
      return "crops";
    case "what":
      return "what";
  }
}

/** Pages of a list: the slice on page `page` (clamped), ◀ ▶ targets and the page count. */
export function paged<I>(
  items: readonly I[],
  page: number,
  perPage: number,
  at: (page: number) => GuidePage,
): { shown: readonly I[]; current: number; pages: number; prev?: GuidePage; next?: GuidePage } {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(0, Math.floor(page)), pages - 1);
  const start = current * perPage;
  return {
    shown: items.slice(start, start + perPage),
    current,
    pages,
    prev: current > 0 ? at(current - 1) : undefined,
    next: current < pages - 1 ? at(current + 1) : undefined,
  };
}

/** The neighbour of `index` in `items` as a page, if there is one. */
function neighbour<I>(items: readonly I[], index: number, at: (item: I) => GuidePage) {
  const item = index >= 0 ? items[index] : undefined;
  return item === undefined ? undefined : at(item);
}

// --- discovery -----------------------------------------------------------------------------------

export function cropKnown(ctx: GuideContext, crop: Crop): boolean {
  return ctx.creative || ctx.found.has(crop.key);
}

export function dishKnown(ctx: GuideContext, dishId: string): boolean {
  return isUnlocked(dishId, ctx.found, ctx.creative);
}

/** True when the item belongs to a crop the player hasn't found. */
function itemLocked(ctx: GuideContext, itemId: string): boolean {
  const key = cropOfItem(itemId);
  const crop = key ? cropByKey(key) : undefined;
  return crop !== undefined && !cropKnown(ctx, crop);
}

// --- recipes -------------------------------------------------------------------------------------

/** What the right page of a dish shows: the grid, what it makes and, for a pot dish, the cook. */
export function dishSteps(dishId: string):
  | {
      readonly grid: readonly Ingredient[];
      /** The grid's result: the mix of a pot dish, else the dish. */
      readonly result: string;
      readonly resultCount: number;
      readonly cook?: { readonly station: string; readonly seconds: number };
    }
  | undefined {
  const made = recipeMaking(dishId);
  if (!made) return undefined;
  if (made.kind === "crafting") {
    return { grid: made.recipe.ingredients, result: dishId, resultCount: made.recipe.count };
  }
  const mixId = made.recipe.ingredients[0]?.items[0] ?? "";
  const mix = recipeMaking(mixId);
  return {
    grid: mix?.kind === "crafting" ? mix.recipe.ingredients : made.recipe.ingredients,
    result: mixId,
    resultCount: mix?.recipe.count ?? 1,
    cook: { station: made.recipe.station, seconds: made.recipe.seconds },
  };
}

/**
 * Dishes the counts can make now, with how many servings: for a pot dish, the mixes carried plus
 * the mixes its raw ingredients make; for a crafted dish, its crafts. Each dish is counted on its
 * own (two dishes may share the same tomatoes).
 */
export function makeable(counts: Counts): { readonly dish: Dish; readonly servings: number }[] {
  const result: { dish: Dish; servings: number }[] = [];
  for (const dish of DISHES) {
    const made = recipeMaking(dish.id);
    if (!made) continue;
    let servings = servingsOf(counts, made.recipe.ingredients) * made.recipe.count;
    if (made.kind === "station") {
      const mixId = made.recipe.ingredients[0]?.items[0] ?? "";
      const mix = recipeMaking(mixId);
      if (mix?.kind === "crafting") {
        servings += servingsOf(counts, mix.recipe.ingredients) * mix.recipe.count;
      }
    }
    if (servings > 0) result.push({ dish, servings });
  }
  return result;
}

/** Every crop shows this many growth stages (textures/hk/blocks/<block>_stage_<n>). */
export const GROWTH_STAGES = STAGE_SLOTS - 1;

/** The growth stage textures of a crop, youngest first. */
export function stageIcons(crop: Crop): string[] {
  const block = crop.block.slice(crop.block.indexOf(":") + 1);
  return Array.from({ length: GROWTH_STAGES }, (_, i) => `textures/hk/blocks/${block}_stage_${i}`);
}

/** What a crop is used in: its cuts (board), then every dish that needs it. */
export function cropUses(
  cropKey: string,
): (
  { readonly kind: "cut"; readonly item: string } | { readonly kind: "dish"; readonly dish: Dish }
)[] {
  const crop = cropByKey(cropKey);
  if (!crop) return [];
  return [
    ...CUTTING_RECIPES.filter((r) => r.input === crop.produce).map((r) => ({
      kind: "cut" as const,
      item: r.output,
    })),
    ...DISHES.filter((d) => cropsOfDish(d.id).has(crop.key)).map((dish) => ({
      kind: "dish" as const,
      dish,
    })),
  ];
}

// --- building a page -------------------------------------------------------------------------------

class Page {
  readonly slots: (SlotModel | undefined)[] = Array.from({ length: BOOK.size }, () => undefined);
  private bodyText: RawMessage = EMPTY;

  constructor(
    private readonly spread: Spread,
    private readonly title: RawMessage,
  ) {}

  body(text: RawMessage): this {
    this.bodyText = text;
    return this;
  }

  set(index: number, slot: SlotModel): this {
    if (!Number.isInteger(index) || index < 0 || index >= BOOK.size) {
      throw new Error(`book slot ${index} is outside 0..${BOOK.size - 1}`);
    }
    this.slots[index] = slot;
    return this;
  }

  /** A heading or footer: text only, not tappable. */
  text(index: number, message: RawMessage): this {
    return this.set(index, { role: "t", text: message });
  }

  model(): PageModel {
    return { spread: this.spread, title: this.title, body: this.bodyText, slots: this.slots };
  }
}

interface Frame {
  readonly at: GuidePage;
  readonly prev?: GuidePage;
  readonly next?: GuidePage;
}

/** ◀ ▶, Back, Home and the ribbons: the same on every page. */
function frame(page: Page, { at, prev, next }: Frame): PageModel {
  const nav = (index: number, key: string, target: GuidePage | undefined) =>
    page.set(
      index,
      target
        ? { role: "s", text: tr(key), action: { turn: target } }
        : { role: "e", text: tr(key) },
    );
  nav(BOOK.prev, "hk.guide.prev_page", prev);
  nav(BOOK.next, "hk.guide.next_page", next);
  const root = at.kind === "home";
  page.set(
    BOOK.back,
    root
      ? { role: "e", text: tr("hk.ui.back") }
      : { role: "s", text: tr("hk.ui.back"), action: "back" },
  );
  page.set(
    BOOK.home,
    root
      ? { role: "e", text: tr("hk.guide.home") }
      : { role: "s", text: tr("hk.guide.home"), action: "home" },
  );
  const open = tabOf(at);
  TABS.forEach((tab, i) => {
    const index = BOOK.tabs[i];
    if (index === undefined) return;
    const look = TAB_LOOK[tab];
    page.set(index, {
      role: tab === open ? "a" : "s",
      text: tr(look.nameKey),
      icon: look.icon,
      action: { tab: TAB_PAGE[tab] },
    });
  });
  return page.model();
}

/** Fills list rows (BOOK.rows) with `row(item)`. */
function rows<I>(page: Page, shown: readonly I[], row: (item: I) => SlotModel) {
  shown.forEach((item, i) => {
    const index = BOOK.rows[i];
    if (index !== undefined) page.set(index, row(item));
  });
}

function pageFooter(page: Page, current: number, pages: number) {
  if (pages > 1) page.text(BOOK.footer, tr("hk.guide.page", current + 1, pages));
}

const LOCKED = (): RawMessage => tr("hk.guide.locked");

function dishSlot(ctx: GuideContext, dish: Dish, count?: number): SlotModel {
  const known = dishKnown(ctx, dish.id);
  return {
    role: known ? "s" : "l",
    count,
    text: known ? ctx.itemName(dish.id) : LOCKED(),
    icon: itemIcon(dish.id),
    action: { go: { kind: "dish", id: dish.id } },
  };
}

/** Where tapping an ingredient leads: its crop, the board, its own recipe, or a vanilla hint. */
function ingredientAction(ingredient: Ingredient): GuideAction {
  const id = ingredient.items[0] ?? "";
  const crop = CROPS.find((c) => c.produce === id || c.seed === id);
  if (crop) return { go: { kind: "crop", key: crop.key } };
  if (CUTTING_RECIPES.some((r) => r.output === id)) return { go: { kind: "board" } };
  if (findDish(id)) return { go: { kind: "dish", id } };
  return { hint: tr("hk.guide.vanilla_item") };
}

function ingredientName(ctx: GuideContext, ingredient: Ingredient): RawMessage {
  return joined(
    ingredient.items.map((id) => ctx.itemName(id)),
    " / ",
  );
}

// --- the pages -------------------------------------------------------------------------------------

function chapterCount(ctx: GuideContext, tab: Tab): RawMessage {
  const name = tr(TAB_LOOK[tab].nameKey);
  if (tab === "hot" || tab === "cold") {
    const dishes = dishesIn(tab);
    const known = dishes.filter((d) => dishKnown(ctx, d.id)).length;
    return tr("hk.guide.chapter_count", name, known, dishes.length);
  }
  if (tab === "crops") {
    const known = CROPS.filter((c) => cropKnown(ctx, c)).length;
    return tr("hk.guide.chapter_count", name, known, CROPS.length);
  }
  return name;
}

function home(ctx: GuideContext): PageModel {
  const page = new Page("list", tr("hk.guide.title"))
    .body(tr("hk.guide.home_body"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.guide })
    .text(BOOK.heading, tr("hk.guide.chapters"));
  const ready = makeable(ctx.counts).length;
  rows(page, TABS, (tab) => ({
    role: "s",
    count: tab === "what" ? ready : undefined,
    text: chapterCount(ctx, tab),
    icon: TAB_LOOK[tab].icon,
    action: { go: TAB_PAGE[tab] },
  }));
  return frame(page, { at: HOME });
}

function topics(at: GuidePage & { kind: "topics" }): PageModel {
  const page = new Page("list", tr("hk.guide.how_to_play"))
    .body(tr("hk.guide.topics_body"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.howToPlay })
    .text(BOOK.heading, tr("hk.guide.topics"));
  const list = paged(GUIDE_TOPICS, at.page, LIST_ROWS, (p) => ({ kind: "topics", page: p }));
  const start = list.current * LIST_ROWS;
  rows(page, list.shown, (topic) => ({
    role: "s",
    text: tr(topic.titleKey),
    icon: topic.icon,
    action: { go: { kind: "topic", index: start + list.shown.indexOf(topic) } },
  }));
  pageFooter(page, list.current, list.pages);
  return frame(page, { at, prev: list.prev, next: list.next });
}

function topic(at: GuidePage & { kind: "topic" }): PageModel {
  const entry = GUIDE_TOPICS[at.index];
  if (!entry) return topics({ kind: "topics", page: 0 });
  const page = new Page("text", tr(entry.titleKey))
    .body(tr(entry.textKey, GUIDE_LINE_BREAK))
    .set(BOOK.icon, { role: "s", icon: entry.icon })
    .text(BOOK.heading, tr("hk.guide.topic_n", at.index + 1, GUIDE_TOPICS.length));
  const step = (i: number): GuidePage | undefined =>
    GUIDE_TOPICS[i] ? { kind: "topic", index: i } : undefined;
  return frame(page, { at, prev: step(at.index - 1), next: step(at.index + 1) });
}

/** The How to Play topic with this title key (for chips that explain a step). */
function topicPage(titleKey: string): GuidePage {
  const index = GUIDE_TOPICS.findIndex((entry) => entry.titleKey === titleKey);
  return index < 0 ? { kind: "topics", page: 0 } : { kind: "topic", index };
}

function dishes(ctx: GuideContext, at: GuidePage & { kind: "dishes" }): PageModel {
  const all = dishesIn(at.chapter);
  const known = all.filter((d) => dishKnown(ctx, d.id)).length;
  const hot = at.chapter === "hot";
  const page = new Page("list", tr(hot ? "hk.guide.hot" : "hk.guide.cold"))
    .body(tr(hot ? "hk.guide.hot_body" : "hk.guide.cold_body"))
    .set(BOOK.icon, { role: hot ? "h" : "s", icon: TAB_LOOK[at.chapter].icon })
    .text(BOOK.heading, tr("hk.guide.found", known, all.length));
  const list = paged(all, at.page, LIST_ROWS, (p) => ({
    kind: "dishes",
    chapter: at.chapter,
    page: p,
  }));
  rows(page, list.shown, (dish) => dishSlot(ctx, dish));
  pageFooter(page, list.current, list.pages);
  return frame(page, { at, prev: list.prev, next: list.next });
}

function dish(ctx: GuideContext, at: GuidePage & { kind: "dish" }): PageModel {
  const entry = findDish(at.id);
  const steps = dishSteps(at.id);
  if (!entry || !steps) return dishes(ctx, { kind: "dishes", chapter: "hot", page: 0 });
  const known = dishKnown(ctx, at.id);
  const chapter = chapterOf(at.id);
  const name = known ? ctx.itemName(at.id) : LOCKED();
  const page = new Page("recipe", name).set(BOOK.icon, {
    role: known ? "s" : "l",
    icon: itemIcon(at.id),
  });

  // Left page: what it does. The effect: family glyph and name, effect, duration.
  const effect = entry.effect;
  const info = effect && EFFECTS[effect.effect];
  const family = info && FAMILIES[info.family];
  const body: RawMessage[] = [];
  if (!known) body.push(tr("hk.guide.locked_body"));
  else if (effect && info && family) {
    body.push(
      tr(
        "hk.guide.effect_line",
        family.glyph,
        tr(family.nameKey),
        { translate: info.nameKey },
        effect.seconds,
      ),
    );
  } else body.push(tr("hk.guide.no_effect"));
  if (known && entry.slices) body.push(tr("hk.guide.sliced", entry.slices.count));
  page.body(lines(...body));
  if (effect && info && family) {
    page.set(BOOK.effect, {
      role: known ? "s" : "l",
      text: known ? tr("hk.guide.effect_chip", family.glyph, effect.seconds) : LOCKED(),
      icon: EFFECT_ICONS[effect.effect] ?? family.icon,
      action: { hint: known ? tr(family.hintKey) : tr("hk.guide.locked_body") },
    });
  }

  // Right page: the grid → its result; a pot dish then cooks the mix (D16).
  if (steps.cook) {
    const station = stationById(steps.cook.station);
    const stationIcon = station ? itemIcon(station.icon) : UI_ICONS.pot;
    page.text(BOOK.heading, tr("hk.guide.step_mix"));
    page.set(BOOK.station, {
      role: "h",
      text: tr("hk.guide.pot_fire"),
      icon: stationIcon,
      action: { go: topicPage("hk.guide.topic.pot") },
    });
    page.set(BOOK.cook, {
      role: "h",
      text: tr("hk.guide.cook_seconds", steps.cook.seconds),
      icon: stationIcon,
      action: { go: topicPage("hk.guide.topic.cooking") },
    });
    page.set(BOOK.cooked, {
      role: known ? "s" : "l",
      text: name,
      icon: itemIcon(at.id),
      action: { hint: tr("hk.guide.cook_hint") },
    });
  } else {
    page.text(BOOK.heading, tr("hk.guide.step_craft"));
    page.set(BOOK.station, {
      role: "s",
      text: tr("hk.guide.craft"),
      icon: UI_ICONS.crafting,
      action: { go: topicPage("hk.guide.topic.cold") },
    });
  }
  steps.grid.forEach((ingredient, i) => {
    const index = BOOK.grid[i];
    if (index === undefined) return;
    const itemId = ingredient.items[0] ?? "";
    const locked = !known && itemLocked(ctx, itemId);
    page.set(index, {
      role: locked ? "l" : "s",
      count: ingredient.count,
      text: locked ? LOCKED() : ingredientName(ctx, ingredient),
      icon: itemIcon(itemId),
      action: ingredientAction(ingredient),
    });
  });
  page.set(BOOK.result, {
    role: known ? "s" : "l",
    count: steps.resultCount,
    text: known ? ctx.itemName(steps.result) : LOCKED(),
    icon: itemIcon(steps.result),
    action: { hint: tr("hk.guide.mix_hint") },
  });

  // Footer: the ingredients by name (touch has no tooltips), or where to find what's missing.
  // A count of 1 is left out, as on vanilla stacks: the 3-line footer is tight in de/pl/fr.
  if (known) {
    page.text(
      BOOK.footer,
      joined(
        steps.grid.map((ingredient) =>
          ingredient.count === 1
            ? ingredientName(ctx, ingredient)
            : tr("hk.ui.item_count", ingredient.count, ingredientName(ctx, ingredient)),
        ),
      ),
    );
  } else {
    const missing = [...cropsOfDish(at.id)]
      .map((key) => cropByKey(key))
      .filter((crop): crop is Crop => crop !== undefined && !cropKnown(ctx, crop))
      .map((crop) => tr(crop.whereKey));
    page.text(BOOK.footer, tr("hk.guide.find", joined(missing, "; ")));
  }

  const siblings = dishesIn(chapter);
  const here = siblings.findIndex((d) => d.id === at.id);
  const to = (d: Dish): GuidePage => ({ kind: "dish", id: d.id });
  return frame(page, {
    at,
    prev: neighbour(siblings, here - 1, to),
    next: neighbour(siblings, here + 1, to),
  });
}

function board(ctx: GuideContext): PageModel {
  const at: GuidePage = { kind: "board" };
  const page = new Page("list", tr("hk.guide.board"))
    .body(tr("hk.guide.board_body"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.board })
    .text(BOOK.heading, tr("hk.guide.cuts"));
  rows(page, CUTTING_RECIPES.slice(0, LIST_ROWS), (recipe) => {
    const key = cropOfItem(recipe.input);
    if (key && itemLocked(ctx, recipe.input)) {
      return {
        role: "l",
        text: LOCKED(),
        icon: itemIcon(recipe.output),
        action: { go: { kind: "crop", key } },
      };
    }
    return {
      role: "s",
      count: recipe.count,
      text: ctx.itemName(recipe.output),
      icon: itemIcon(recipe.output),
      action: { hint: tr("hk.guide.board_hint", ctx.itemName(recipe.input)) },
    };
  });
  return frame(page, { at });
}

function crops(ctx: GuideContext): PageModel {
  const at: GuidePage = { kind: "crops" };
  const known = CROPS.filter((c) => cropKnown(ctx, c)).length;
  const page = new Page("list", tr("hk.guide.crops"))
    .body(tr("hk.guide.crops_body"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.crops })
    .text(BOOK.heading, tr("hk.guide.found", known, CROPS.length));
  rows(page, CROPS.slice(0, LIST_ROWS), (crop) => {
    const knownCrop = cropKnown(ctx, crop);
    return {
      role: knownCrop ? "s" : "l",
      text: knownCrop ? ctx.itemName(crop.produce) : LOCKED(),
      icon: itemIcon(crop.produce),
      action: { go: { kind: "crop", key: crop.key } },
    };
  });
  return frame(page, { at });
}

function crop(ctx: GuideContext, at: GuidePage & { kind: "crop" }): PageModel {
  const entry = cropByKey(at.key);
  if (!entry) return crops(ctx);
  const known = cropKnown(ctx, entry);
  const role: Role = known ? "s" : "l";
  const where = tr("hk.guide.where", tr(entry.whereKey));
  const plant = tr(
    entry.plantOn === "farmland" ? "hk.guide.plant_farmland" : "hk.guide.plant_soil",
  );
  const page = new Page("crop", known ? ctx.itemName(entry.produce) : LOCKED()).set(BOOK.icon, {
    role,
    icon: itemIcon(entry.produce),
  });
  const body = [where];
  if (!known) body.push(tr("hk.guide.crop_unknown"));
  else {
    body.push(plant);
    if (entry.type === "bush") body.push(tr("hk.guide.bush"));
  }
  page.body(lines(...body));

  // Right page: seed → stages → produce, then what it's used in.
  const hidden = { hint: where };
  page.text(BOOK.heading, tr("hk.guide.growth"));
  const stages: SlotModel[] = [
    {
      role,
      text: known ? ctx.itemName(entry.seed) : LOCKED(),
      icon: itemIcon(entry.seed),
      action: known ? { hint: plant } : hidden,
    },
    ...stageIcons(entry).map((icon, i) => ({
      role,
      text: known ? tr("hk.guide.stage", i + 1, GROWTH_STAGES) : LOCKED(),
      icon,
      action: known ? { hint: plant } : hidden,
    })),
  ];
  stages.forEach((slot, i) => {
    const index = BOOK.stages[i];
    if (index !== undefined) page.set(index, slot);
  });
  page.set(BOOK.result, {
    role,
    text: known ? ctx.itemName(entry.produce) : LOCKED(),
    icon: itemIcon(entry.produce),
    action: known
      ? { hint: tr(entry.type === "bush" ? "hk.guide.bush" : "hk.guide.plant_farmland") }
      : hidden,
  });
  page.text(BOOK.subheading, tr("hk.guide.used_in"));
  cropUses(entry.key)
    .slice(0, USES)
    .forEach((use, i) => {
      const index = BOOK.uses[i];
      if (index === undefined) return;
      if (use.kind === "dish") page.set(index, dishSlot(ctx, use.dish));
      else {
        page.set(index, {
          role,
          text: known ? ctx.itemName(use.item) : LOCKED(),
          icon: itemIcon(use.item),
          action: { go: { kind: "board" } },
        });
      }
    });
  if (!known) page.text(BOOK.footer, tr("hk.guide.crop_unknown"));

  const here = CROPS.findIndex((c) => c.key === entry.key);
  const to = (c: Crop): GuidePage => ({ kind: "crop", key: c.key });
  return frame(page, {
    at,
    prev: neighbour(CROPS, here - 1, to),
    next: neighbour(CROPS, here + 1, to),
  });
}

function what(ctx: GuideContext, at: GuidePage & { kind: "what" }): PageModel {
  const ready = makeable(ctx.counts);
  const page = new Page("list", tr("hk.guide.what"))
    .body(tr(ready.length > 0 ? "hk.guide.what_body" : "hk.guide.nothing"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.whatCanIMake })
    .text(BOOK.heading, tr("hk.guide.can_make", ready.length));
  const list = paged(ready, at.page, LIST_ROWS, (p) => ({ kind: "what", page: p }));
  rows(page, list.shown, ({ dish: entry, servings }) => dishSlot(ctx, entry, servings));
  pageFooter(page, list.current, list.pages);
  return frame(page, { at, prev: list.prev, next: list.next });
}

/** The page model for `page`, as the player in `ctx` sees it. */
export function buildPage(page: GuidePage, ctx: GuideContext): PageModel {
  switch (page.kind) {
    case "home":
      return home(ctx);
    case "topics":
      return topics(page);
    case "topic":
      return topic(page);
    case "dishes":
      return dishes(ctx, page);
    case "dish":
      return dish(ctx, page);
    case "board":
      return board(ctx);
    case "crops":
      return crops(ctx);
    case "crop":
      return crop(ctx, page);
    case "what":
      return what(ctx, page);
  }
}

// --- the page stack (Back, Home, ribbons) ----------------------------------------------------------

const MAX_DEPTH = 24;

/** The page stack after `action`; Home stays at the bottom. Hints don't move. */
export function navigate(stack: readonly GuidePage[], action: GuideAction): GuidePage[] {
  if (action === "back") return stack.length > 1 ? stack.slice(0, -1) : [...stack];
  if (action === "home") return [HOME];
  if ("hint" in action) return [...stack];
  if ("tab" in action) return [HOME, action.tab];
  if ("turn" in action) return [...stack.slice(0, -1), action.turn];
  const next = [...stack, action.go];
  if (next.length > MAX_DEPTH) next.splice(1, 1);
  return next;
}

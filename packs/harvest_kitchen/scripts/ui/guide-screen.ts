import type { Player, RawMessage } from "@minecraft/server";
import { SOUND } from "../config";
import { CROPS, cropByKey, type Crop } from "../data/crops";
import { DISHES, EFFECTS, familyOf, findDish, type Dish } from "../data/dishes";
import { EFFECT_ICONS, UI_ICONS, itemIcon } from "../data/icons";
import {
  CRAFTING_RECIPES,
  CUTTING_RECIPES,
  STATION_RECIPES,
  canMake,
  recipeMaking,
  type Ingredient,
} from "../data/recipes";
import { stationById } from "../data/stations";
import { foundCrops, isDishUnlocked } from "../discovery/discovery";
import { cropOfItem, cropsOfDish } from "../discovery/unlock";
import { BOOK, LIST_ROWS, TABS, type Role, type Tab } from "../guide/book-layout";
import { GUIDE_LINE_BREAK, GUIDE_TOPICS } from "../guide/guide-pages";
import { actionBar } from "../lib/feedback";
import { countInventory, isCreative } from "../lib/inventory";
import { ingredientName, itemName, join, t } from "../lib/text";
import { BookForm, runForm } from "./book-form";

// The Kitchen Guide (D19): a book of pages drawn by our JSON UI (resource/ui/hk_guide/guide.json),
// opened by the hk:guide_book item (guide/guide-book.ts). Recipe pages come from data/; nothing is
// written per dish. Three spreads (guide/book-layout.ts):
//
//   list    Home, How to Play, Hot/Cold Dishes, Cutting Board, Crops, a crop, What can I make?
//   recipe  a dish: picture, effect and station on the left; the 3×3 grid → result, and for a
//           hot dish the cook row (pot → dish), on the right (D16: mix first, then the pot)
//   text    a How to Play topic
//
// Every page has ◀ ▶ (pages of a list, or the neighbouring dish/topic), Back, Home and the
// ribbons. Locking follows discovery (D3): undiscovered dishes and crops are dark silhouettes
// with "?", as on the posters.

type Chapter = "hot" | "cold";

export type GuidePage =
  | { readonly kind: "home" }
  | { readonly kind: "topics"; readonly page: number }
  | { readonly kind: "topic"; readonly index: number }
  | { readonly kind: "dishes"; readonly chapter: Chapter; readonly page: number }
  | { readonly kind: "dish"; readonly id: string }
  | { readonly kind: "board" }
  | { readonly kind: "crops" }
  | { readonly kind: "crop"; readonly key: string; readonly page: number }
  | { readonly kind: "what"; readonly page: number };

/** go: open on top · turn: replace this page (◀ ▶) · tab: a chapter right above Home. */
type Outcome =
  | { readonly go: GuidePage }
  | { readonly turn: GuidePage }
  | { readonly tab: GuidePage }
  | "back"
  | "home"
  | "stay";

type Book = BookForm<Outcome>;

const MAX_DEPTH = 24;

/** One part per line. */
const lines = (...parts: RawMessage[]): RawMessage => ({
  rawtext: parts.flatMap((part, i) => (i === 0 ? [part] : [{ text: GUIDE_LINE_BREAK }, part])),
});

function hint(player: Player, message: RawMessage): Outcome {
  actionBar(player, message);
  return "stay";
}

// --- the frame: nav buttons and ribbons ----------------------------------------------------------

const TAB_PAGE: Readonly<Record<Tab, GuidePage>> = {
  hot: { kind: "dishes", chapter: "hot", page: 0 },
  cold: { kind: "dishes", chapter: "cold", page: 0 },
  board: { kind: "board" },
  crops: { kind: "crops" },
  topics: { kind: "topics", page: 0 },
  what: { kind: "what", page: 0 },
};

const TAB_LOOK: Readonly<Record<Tab, { readonly icon: string; readonly nameKey: string }>> = {
  hot: { icon: UI_ICONS.pot, nameKey: "hk.guide.hot" },
  cold: { icon: UI_ICONS.crafting, nameKey: "hk.guide.cold" },
  board: { icon: UI_ICONS.board, nameKey: "hk.guide.board" },
  crops: { icon: UI_ICONS.crops, nameKey: "hk.guide.crops" },
  topics: { icon: UI_ICONS.guide, nameKey: "hk.guide.how_to_play" },
  what: { icon: UI_ICONS.whatCanIMake, nameKey: "hk.guide.what" },
};

interface FrameOptions {
  readonly tab?: Tab;
  readonly prev?: GuidePage;
  readonly next?: GuidePage;
  /** Home itself: Back and Home are dead. */
  readonly root?: boolean;
}

function frame(book: Book, options: FrameOptions): Book {
  const nav = (index: number, key: string, target: GuidePage | undefined) => {
    if (target) book.set(index, { role: "s", text: t(key) }, () => ({ turn: target }));
    else book.set(index, { role: "e", text: t(key) });
  };
  nav(BOOK.prev, "hk.guide.prev_page", options.prev);
  nav(BOOK.next, "hk.guide.next_page", options.next);
  const up: Role = options.root ? "e" : "s";
  book.set(BOOK.back, { role: up, text: t("hk.ui.back") }, () => "back");
  book.set(BOOK.home, { role: up, text: t("hk.guide.home") }, () => "home");
  TABS.forEach((tab, i) => {
    const look = TAB_LOOK[tab];
    const index = BOOK.tabs[i];
    if (index === undefined) return;
    book.set(
      index,
      { role: tab === options.tab ? "a" : "s", text: t(look.nameKey), icon: look.icon },
      () => ({ tab: TAB_PAGE[tab] }),
    );
  });
  return book;
}

/** The slice of `items` on list page `page`, and the ◀ ▶ targets and footer for it. */
function paged<I>(
  items: readonly I[],
  page: number,
  at: (page: number) => GuidePage,
): { shown: readonly I[]; start: number; prev?: GuidePage; next?: GuidePage; footer?: RawMessage } {
  const pages = Math.max(1, Math.ceil(items.length / LIST_ROWS));
  const current = Math.min(Math.max(0, page), pages - 1);
  const start = current * LIST_ROWS;
  return {
    shown: items.slice(start, start + LIST_ROWS),
    start,
    prev: current > 0 ? at(current - 1) : undefined,
    next: current < pages - 1 ? at(current + 1) : undefined,
    footer: pages > 1 ? t("hk.guide.page", current + 1, pages) : undefined,
  };
}

/** Fills the list rows: `row` gets each item, its button index and its position in `shown`. */
function listRows<I>(shown: readonly I[], row: (item: I, index: number, position: number) => void) {
  shown.forEach((item, i) => {
    const index = BOOK.rows[i];
    if (index !== undefined) row(item, index, i);
  });
}

// --- discovery ------------------------------------------------------------------------------------

function cropKnown(player: Player, crop: Crop, found: ReadonlySet<string>): boolean {
  return isCreative(player) || found.has(crop.key);
}

/** Locked when the item belongs to a crop the player hasn't found. */
function itemLocked(player: Player, itemId: string, found: ReadonlySet<string>): boolean {
  const key = cropOfItem(itemId);
  const crop = key ? cropByKey(key) : undefined;
  return crop !== undefined && !cropKnown(player, crop, found);
}

function chapterOf(dishId: string): Chapter {
  return recipeMaking(dishId)?.kind === "station" ? "hot" : "cold";
}

function dishesIn(chapter: Chapter): Dish[] {
  return DISHES.filter((dish) => chapterOf(dish.id) === chapter);
}

function dishRow(book: Book, player: Player, index: number, dish: Dish, found: Set<string>) {
  const unlocked = isDishUnlocked(player, dish.id, found);
  book.set(
    index,
    {
      role: unlocked ? "s" : "l",
      text: unlocked ? itemName(dish.id) : t("hk.guide.locked"),
      icon: itemIcon(dish.id),
    },
    () => ({ go: { kind: "dish", id: dish.id } }),
  );
}

/** Where tapping an ingredient leads: its crop, the board, its own recipe, or a vanilla hint. */
function ingredientTarget(player: Player, ingredient: Ingredient): Outcome {
  const id = ingredient.items[0] ?? "";
  const crop = CROPS.find((c) => c.produce === id || c.seed === id);
  if (crop) return { go: { kind: "crop", key: crop.key, page: 0 } };
  if (CUTTING_RECIPES.some((r) => r.output === id)) return { go: { kind: "board" } };
  if (findDish(id)) return { go: { kind: "dish", id } };
  return hint(player, t("hk.guide.vanilla_item"));
}

// --- pages ---------------------------------------------------------------------------------------

function home(player: Player): Book {
  const found = foundCrops(player);
  const unlocked = (chapter: Chapter) =>
    dishesIn(chapter).filter((d) => isDishUnlocked(player, d.id, found)).length;
  const book = new BookForm<Outcome>("list", t("hk.guide.title"))
    .body(t("hk.guide.home_body"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.guide })
    .text(BOOK.heading, t("hk.guide.chapters"));
  const rows: { tab: Tab; text: RawMessage; count?: number }[] = [
    { tab: "topics", text: t("hk.guide.how_to_play") },
    { tab: "what", text: t("hk.guide.what"), count: makeableDishes(player).length },
    {
      tab: "hot",
      text: t("hk.guide.chapter_count", t("hk.guide.hot"), unlocked("hot"), dishesIn("hot").length),
    },
    {
      tab: "cold",
      text: t(
        "hk.guide.chapter_count",
        t("hk.guide.cold"),
        unlocked("cold"),
        dishesIn("cold").length,
      ),
    },
    { tab: "board", text: t("hk.guide.board") },
    {
      tab: "crops",
      text: t(
        "hk.guide.chapter_count",
        t("hk.guide.crops"),
        CROPS.filter((c) => cropKnown(player, c, found)).length,
        CROPS.length,
      ),
    },
  ];
  listRows(rows, (row, index) =>
    book.set(
      index,
      { role: "s", count: row.count, text: row.text, icon: TAB_LOOK[row.tab].icon },
      () => ({ go: TAB_PAGE[row.tab] }),
    ),
  );
  return frame(book, { root: true });
}

function topicsPage(page: number): Book {
  const book = new BookForm<Outcome>("list", t("hk.guide.how_to_play"))
    .body(t("hk.guide.topics_body"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.guide })
    .text(BOOK.heading, t("hk.guide.topics"));
  const { shown, start, prev, next, footer } = paged(GUIDE_TOPICS, page, (p) => ({
    kind: "topics",
    page: p,
  }));
  listRows(shown, (topic, index, position) =>
    book.set(index, { role: "s", text: t(topic.titleKey), icon: topic.icon }, () => ({
      go: { kind: "topic", index: start + position },
    })),
  );
  if (footer) book.text(BOOK.footer, footer);
  return frame(book, { tab: "topics", prev, next });
}

function topicPage(index: number): Book {
  const topic = GUIDE_TOPICS[index];
  if (!topic) return topicsPage(0);
  const book = new BookForm<Outcome>("text", t(topic.titleKey))
    .body(t(topic.textKey, GUIDE_LINE_BREAK))
    .set(BOOK.icon, { role: "s", icon: topic.icon })
    .text(BOOK.heading, t("hk.guide.topic_n", index + 1, GUIDE_TOPICS.length));
  const at = (i: number): GuidePage | undefined =>
    GUIDE_TOPICS[i] ? { kind: "topic", index: i } : undefined;
  return frame(book, { tab: "topics", prev: at(index - 1), next: at(index + 1) });
}

function topicByKey(titleKey: string): GuidePage {
  const index = GUIDE_TOPICS.findIndex((topic) => topic.titleKey === titleKey);
  return index < 0 ? { kind: "topics", page: 0 } : { kind: "topic", index };
}

function dishesPage(player: Player, chapter: Chapter, page: number): Book {
  const found = foundCrops(player);
  const dishes = dishesIn(chapter);
  const unlocked = dishes.filter((d) => isDishUnlocked(player, d.id, found)).length;
  const hot = chapter === "hot";
  const book = new BookForm<Outcome>("list", t(hot ? "hk.guide.hot" : "hk.guide.cold"))
    .body(t(hot ? "hk.guide.hot_body" : "hk.guide.cold_body"))
    .set(BOOK.icon, { role: hot ? "h" : "s", icon: hot ? UI_ICONS.pot : UI_ICONS.crafting })
    .text(BOOK.heading, t("hk.guide.found", unlocked, dishes.length));
  const { shown, prev, next, footer } = paged(dishes, page, (p) => ({
    kind: "dishes",
    chapter,
    page: p,
  }));
  listRows(shown, (dish, index) => dishRow(book, player, index, dish, found));
  if (footer) book.text(BOOK.footer, footer);
  return frame(book, { tab: chapter, prev, next });
}

function dishPage(player: Player, id: string): Book {
  const found = foundCrops(player);
  const dish = findDish(id);
  const made = recipeMaking(id);
  if (!dish || !made) return dishesPage(player, "hot", 0);
  const unlocked = isDishUnlocked(player, id, found);
  const chapter = chapterOf(id);
  const locked = (itemId: string): Role =>
    !unlocked && itemLocked(player, itemId, found) ? "l" : "s";

  const book = new BookForm<Outcome>("recipe", unlocked ? itemName(id) : t("hk.guide.locked"));
  book.set(BOOK.icon, { role: unlocked ? "s" : "l", icon: itemIcon(id) });

  // Left page: what it does.
  const effect = dish.effect;
  const info = effect && EFFECTS[effect.effect];
  const family = familyOf(dish);
  const body: RawMessage[] = [];
  if (!unlocked) body.push(t("hk.guide.locked_body"));
  else if (effect && info)
    body.push(t("hk.guide.effect_line", { translate: info.nameKey }, effect.seconds));
  else body.push(t("hk.guide.no_effect"));
  if (unlocked && dish.slices) body.push(t("hk.guide.sliced", dish.slices.count));
  body.push(t(chapter === "hot" ? "hk.guide.hot_summary" : "hk.guide.cold_summary"));
  book.body(lines(...body));
  if (effect && info && family) {
    book.set(
      BOOK.effect,
      {
        role: unlocked ? "s" : "l",
        text: unlocked ? t("hk.guide.seconds", effect.seconds) : t("hk.guide.locked"),
        icon: EFFECT_ICONS[effect.effect] ?? family.icon,
      },
      () => hint(player, unlocked ? t(family.hintKey) : t("hk.guide.locked_body")),
    );
  }

  // Right page: how to make it. A hot dish's grid makes its mix (D16), then the cook row.
  let grid: readonly Ingredient[] = made.recipe.ingredients;
  let result = id;
  if (made.kind === "station") {
    const station = stationById(made.recipe.station);
    const mixId = made.recipe.ingredients[0]?.items[0] ?? "";
    const mix = recipeMaking(mixId);
    if (mix?.kind === "crafting") grid = mix.recipe.ingredients;
    result = mixId;
    book.text(BOOK.heading, t("hk.guide.step_mix"));
    book.set(
      BOOK.station,
      {
        role: "h",
        text: t("hk.guide.seconds", made.recipe.seconds),
        icon: station ? itemIcon(station.icon) : UI_ICONS.pot,
      },
      () => ({ go: topicByKey("hk.guide.topic.pot") }),
    );
    book.set(
      BOOK.cook,
      {
        role: "h",
        text: t("hk.guide.cook_seconds", made.recipe.seconds),
        icon: station ? itemIcon(station.icon) : UI_ICONS.pot,
      },
      () => ({ go: topicByKey("hk.guide.topic.cooking") }),
    );
    book.set(
      BOOK.cooked,
      {
        role: unlocked ? "s" : "l",
        text: unlocked ? itemName(id) : t("hk.guide.locked"),
        icon: itemIcon(id),
      },
      () => hint(player, t("hk.guide.cook_hint")),
    );
  } else {
    book.text(BOOK.heading, t("hk.guide.step_craft"));
    book.set(
      BOOK.station,
      { role: "s", text: t("hk.guide.craft"), icon: UI_ICONS.crafting },
      () => ({ go: topicByKey("hk.guide.topic.cold") }),
    );
  }

  grid.forEach((ingredient, i) => {
    const index = BOOK.grid[i];
    const itemId = ingredient.items[0] ?? "";
    if (index === undefined) return;
    const role = locked(itemId);
    book.set(
      index,
      {
        role,
        count: ingredient.count,
        text: role === "l" ? t("hk.guide.locked") : ingredientName(ingredient),
        icon: itemIcon(itemId),
      },
      () => ingredientTarget(player, ingredient),
    );
  });
  const resultCount = recipeMaking(result)?.recipe.count ?? 1;
  book.set(
    BOOK.result,
    {
      role: unlocked ? "s" : "l",
      count: resultCount,
      text: unlocked ? itemName(result) : t("hk.guide.locked"),
      icon: itemIcon(result),
    },
    () => hint(player, t("hk.guide.mix_hint")),
  );

  // Footer: the ingredients by name (touch has no tooltips), or where to find what's missing.
  if (unlocked) {
    book.text(
      BOOK.footer,
      join(
        grid.map((ingredient) =>
          t("hk.ui.item_count", ingredient.count, ingredientName(ingredient)),
        ),
      ),
    );
  } else {
    const missing = [...cropsOfDish(id)]
      .map((key) => cropByKey(key))
      .filter((crop): crop is Crop => crop !== undefined && !cropKnown(player, crop, found))
      .map((crop) => t(crop.whereKey));
    book.text(BOOK.footer, t("hk.guide.find", join(missing, "; ")));
  }

  const siblings = dishesIn(chapter);
  const at = siblings.findIndex((d) => d.id === id);
  const sibling = (i: number): GuidePage | undefined => {
    const other = siblings[i];
    return other ? { kind: "dish", id: other.id } : undefined;
  };
  return frame(book, { tab: chapter, prev: sibling(at - 1), next: sibling(at + 1) });
}

function boardPage(player: Player): Book {
  const found = foundCrops(player);
  const book = new BookForm<Outcome>("list", t("hk.guide.board"))
    .body(t("hk.guide.board_body"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.board })
    .text(BOOK.heading, t("hk.guide.cuts"));
  listRows(CUTTING_RECIPES.slice(0, LIST_ROWS), (recipe, index) => {
    const key = cropOfItem(recipe.input);
    if (itemLocked(player, recipe.input, found) && key) {
      book.set(
        index,
        { role: "l", text: t("hk.guide.locked"), icon: itemIcon(recipe.output) },
        () => ({
          go: { kind: "crop", key, page: 0 },
        }),
      );
      return;
    }
    book.set(
      index,
      {
        role: "s",
        count: recipe.count,
        text: itemName(recipe.output),
        icon: itemIcon(recipe.output),
      },
      () => hint(player, t("hk.guide.board_hint", itemName(recipe.input))),
    );
  });
  return frame(book, { tab: "board" });
}

function cropsPage(player: Player): Book {
  const found = foundCrops(player);
  const known = CROPS.filter((c) => cropKnown(player, c, found)).length;
  const book = new BookForm<Outcome>("list", t("hk.guide.crops"))
    .body(t("hk.guide.crops_body"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.crops })
    .text(BOOK.heading, t("hk.guide.found", known, CROPS.length));
  listRows(CROPS.slice(0, LIST_ROWS), (crop, index) => {
    const knownCrop = cropKnown(player, crop, found);
    book.set(
      index,
      {
        role: knownCrop ? "s" : "l",
        text: knownCrop ? itemName(crop.produce) : t("hk.guide.locked"),
        icon: itemIcon(crop.produce),
      },
      () => ({ go: { kind: "crop", key: crop.key, page: 0 } }),
    );
  });
  return frame(book, { tab: "crops" });
}

function cropPage(player: Player, key: string, page: number): Book {
  const crop = cropByKey(key);
  if (!crop) return cropsPage(player);
  const found = foundCrops(player);
  const known = cropKnown(player, crop, found);
  const where = t("hk.guide.where", t(crop.whereKey));
  const book = new BookForm<Outcome>("list", known ? itemName(crop.produce) : t("hk.guide.locked"));
  book.set(BOOK.icon, { role: known ? "s" : "l", icon: itemIcon(crop.produce) });
  if (!known) {
    book.body(lines(where, t("hk.guide.crop_unknown")));
    return frame(book, { tab: "crops" });
  }

  const plant = t(crop.plantOn === "farmland" ? "hk.guide.plant_farmland" : "hk.guide.plant_soil");
  const body = [where, plant];
  if (crop.type === "bush") body.push(t("hk.guide.bush"));
  book.body(lines(...body)).text(BOOK.heading, t("hk.guide.used_in"));

  type Row =
    | { readonly kind: "seed" | "cut"; readonly item: string }
    | { readonly kind: "dish"; readonly dish: Dish };
  const rows: Row[] = [];
  if (crop.seed !== crop.produce) rows.push({ kind: "seed", item: crop.seed });
  for (const recipe of CUTTING_RECIPES.filter((r) => r.input === crop.produce)) {
    rows.push({ kind: "cut", item: recipe.output });
  }
  for (const dish of DISHES.filter((d) => cropsOfDish(d.id).has(crop.key)))
    rows.push({ kind: "dish", dish });

  const { shown, prev, next, footer } = paged(rows, page, (p) => ({ kind: "crop", key, page: p }));
  listRows(shown, (row, index) => {
    if (row.kind === "dish") return dishRow(book, player, index, row.dish, found);
    book.set(index, { role: "s", text: itemName(row.item), icon: itemIcon(row.item) }, () =>
      row.kind === "seed" ? hint(player, plant) : { go: { kind: "board" } },
    );
  });
  if (footer) book.text(BOOK.footer, footer);
  return frame(book, { tab: "crops", prev, next });
}

/** The pot dish a mix cooks into. */
function dishOfMix(mixId: string): string | undefined {
  return STATION_RECIPES.find((r) => r.ingredients.some((i) => i.items.includes(mixId)))?.result;
}

/** Dishes whose mix or ingredients are all in the player's inventory now. */
function makeableDishes(player: Player): Dish[] {
  const counts = countInventory(player);
  const ids = new Set<string>();
  for (const recipe of [...STATION_RECIPES, ...CRAFTING_RECIPES]) {
    if (!canMake(counts, recipe.ingredients)) continue;
    const id = findDish(recipe.result) ? recipe.result : dishOfMix(recipe.result);
    if (id) ids.add(id);
  }
  return DISHES.filter((d) => ids.has(d.id));
}

function whatPage(player: Player, page: number): Book {
  const found = foundCrops(player);
  const dishes = makeableDishes(player);
  const book = new BookForm<Outcome>("list", t("hk.guide.what"))
    .body(t(dishes.length > 0 ? "hk.guide.what_body" : "hk.guide.nothing"))
    .set(BOOK.icon, { role: "s", icon: UI_ICONS.whatCanIMake })
    .text(BOOK.heading, t("hk.guide.can_make", dishes.length));
  const { shown, prev, next, footer } = paged(dishes, page, (p) => ({ kind: "what", page: p }));
  listRows(shown, (dish, index) => dishRow(book, player, index, dish, found));
  if (footer) book.text(BOOK.footer, footer);
  return frame(book, { tab: "what", prev, next });
}

function build(player: Player, page: GuidePage): Book {
  switch (page.kind) {
    case "home":
      return home(player);
    case "topics":
      return topicsPage(page.page);
    case "topic":
      return topicPage(page.index);
    case "dishes":
      return dishesPage(player, page.chapter, page.page);
    case "dish":
      return dishPage(player, page.id);
    case "board":
      return boardPage(player);
    case "crops":
      return cropsPage(player);
    case "crop":
      return cropPage(player, page.key, page.page);
    case "what":
      return whatPage(player, page.page);
  }
}

// --- navigation ----------------------------------------------------------------------------------

const HOME: GuidePage = { kind: "home" };

/** Shows the guide from Home. Each page is a new form; X or Esc closes the guide. */
async function showGuide(player: Player): Promise<void> {
  let stack: GuidePage[] = [HOME];
  player.playSound(SOUND.pageTurn);
  for (let guard = 0; guard < 200; guard++) {
    const page = stack[stack.length - 1] ?? HOME;
    const outcome = await build(player, page).show(player);
    if (!player.isValid || outcome === undefined) return;
    if (outcome === "stay") continue;
    if (outcome === "back") {
      if (stack.length > 1) stack.pop();
    } else if (outcome === "home") stack = [HOME];
    else if ("tab" in outcome) stack = [HOME, outcome.tab];
    else if ("turn" in outcome) stack[stack.length - 1] = outcome.turn;
    else {
      stack.push(outcome.go);
      if (stack.length > MAX_DEPTH) stack.splice(1, 1); // keep Home at the bottom
    }
    player.playSound(SOUND.pageTurn);
  }
}

export function openGuide(player: Player): void {
  runForm(showGuide(player), "kitchen guide");
}

import { cropOfItem, cropsOfDish } from "../book/unlock";
import { CROPS, cropByKey } from "../data/crops";
import { DISHES, findDish, type Dish } from "../data/dishes";
import {
  CRAFTING_RECIPES,
  CUTTING_RECIPES,
  STATION_RECIPES,
  canMake,
  recipeMaking,
  type Counts,
} from "../data/recipes";
import { STATIONS, type StationId } from "../data/stations";

// The recipe book's pages as pure data (D14): page order, Prev/Next, which pre-rendered image a
// page shows for a player, and which context buttons it gets. No @minecraft import, so the unit
// tests and tools/gen-book-pages.mjs (which renders exactly the images listed here) share it with
// the game. ui/book.ts turns it into a CustomForm.
//
// Images never encode per-player state except through the image choice itself: a dish page has
// one unlocked image and one locked image per set of crops still missing; chapter indexes are
// neutral (dish silhouettes), and the per-player part lives in the button labels.

/** Chapters: one per container station, then the board, the crafting table and the crops. */
export type Chapter = StationId | "board" | "crafting" | "crops";

export const CHAPTERS: readonly Chapter[] = [
  ...STATIONS.map((station) => station.id),
  "board",
  "crafting",
  "crops",
];

export type BookPage =
  | { readonly kind: "home" }
  | { readonly kind: "what" }
  | { readonly kind: "chapter"; readonly chapter: Chapter }
  | { readonly kind: "dish"; readonly id: string }
  | { readonly kind: "crop"; readonly key: string };

export const bookPage = {
  home: (): BookPage => ({ kind: "home" }),
  what: (): BookPage => ({ kind: "what" }),
  chapter: (chapter: Chapter): BookPage => ({ kind: "chapter", chapter }),
  dish: (id: string): BookPage => ({ kind: "dish", id }),
  crop: (key: string): BookPage => ({ kind: "crop", key }),
};

/** "home", "chapter:pot", "dish:hk:tomato_soup", "crop:tomato". */
export function pageKey(page: BookPage): string {
  switch (page.kind) {
    case "home":
    case "what":
      return page.kind;
    case "chapter":
      return `chapter:${page.chapter}`;
    case "dish":
      return `dish:${page.id}`;
    case "crop":
      return `crop:${page.key}`;
  }
}

// --- chapters and order ---------------------------------------------------------------------------

/** The chapter a dish is listed in: its station, or the crafting table. */
export function dishChapter(dishId: string): Chapter {
  const made = recipeMaking(dishId);
  return made?.kind === "station" ? made.recipe.station : "crafting";
}

export function dishesInChapter(chapter: Chapter): Dish[] {
  return DISHES.filter((dish) => dishChapter(dish.id) === chapter);
}

/** The whole book front to back; Prev/Next walk this list. */
export const BOOK_ORDER: readonly BookPage[] = [
  bookPage.home(),
  bookPage.what(),
  ...STATIONS.flatMap((station) => [
    bookPage.chapter(station.id),
    ...dishesInChapter(station.id).map((dish) => bookPage.dish(dish.id)),
  ]),
  bookPage.chapter("board"),
  bookPage.chapter("crafting"),
  ...dishesInChapter("crafting").map((dish) => bookPage.dish(dish.id)),
  bookPage.chapter("crops"),
  ...CROPS.map((crop) => bookPage.crop(crop.key)),
];

const ORDER_INDEX = new Map(BOOK_ORDER.map((page, i) => [pageKey(page), i]));

/** 1-based page number, as printed on the page image; 0 for a page not in the book. */
export function pageNumber(page: BookPage): number {
  return (ORDER_INDEX.get(pageKey(page)) ?? -1) + 1;
}

export function nextPage(page: BookPage): BookPage | undefined {
  const i = ORDER_INDEX.get(pageKey(page));
  return i === undefined ? undefined : BOOK_ORDER[i + 1];
}

export function prevPage(page: BookPage): BookPage | undefined {
  const i = ORDER_INDEX.get(pageKey(page));
  return i === undefined || i === 0 ? undefined : BOOK_ORDER[i - 1];
}

// --- discovery ------------------------------------------------------------------------------------

/** What a player has found (book/discovery.ts reads it from the player). */
export interface Discovery {
  readonly found: ReadonlySet<string>;
  readonly creative: boolean;
}

export function cropKnown(key: string, discovery: Discovery): boolean {
  return discovery.creative || discovery.found.has(key);
}

/** The crops a dish uses, in CROPS order (the order images list them in). */
export function dishCrops(dishId: string): string[] {
  const keys = cropsOfDish(dishId);
  return CROPS.filter((crop) => keys.has(crop.key)).map((crop) => crop.key);
}

/** Crops the player still has to find for this dish; empty means it's unlocked. */
export function missingCrops(dishId: string, discovery: Discovery): string[] {
  return dishCrops(dishId).filter((key) => !cropKnown(key, discovery));
}

// --- images ---------------------------------------------------------------------------------------

export const BOOK_TEXTURE_DIR = "textures/hk/book";

/** The path CustomForm.image() needs: relative to the RP, with ".png" (S1a). */
export function bookImagePath(stem: string): string {
  return `${BOOK_TEXTURE_DIR}/${stem}.png`;
}

const shortName = (id: string) => id.slice(id.indexOf(":") + 1);

export function dishStem(dishId: string, missing: readonly string[] = []): string {
  const base = `dish_${shortName(dishId)}`;
  return missing.length === 0 ? base : `${base}_locked_${missing.join("_")}`;
}

export function cropStem(key: string, known: boolean): string {
  return known ? `crop_${key}` : `crop_${key}_locked`;
}

/** The image stem (file name without .png) a page shows for this player. */
export function pageImage(page: BookPage, discovery: Discovery): string {
  switch (page.kind) {
    case "home":
    case "what":
      return page.kind;
    case "chapter":
      return `chapter_${page.chapter}`;
    case "dish":
      return dishStem(page.id, missingCrops(page.id, discovery));
    case "crop":
      return cropStem(page.key, cropKnown(page.key, discovery));
  }
}

/** One image the renderer draws. `missing`: a locked dish's missing crops; `locked`: a crop. */
export interface BookImageSpec {
  readonly stem: string;
  readonly page: BookPage;
  readonly missing?: readonly string[];
  readonly locked?: boolean;
}

/** Non-empty subsets of `keys`, each in the order of `keys`. */
function subsets(keys: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let mask = 1; mask < 1 << keys.length; mask++) {
    out.push(keys.filter((_, i) => (mask & (1 << i)) !== 0));
  }
  return out;
}

/** Every book image pageImage() can return, once each. */
export function bookImageSpecs(): BookImageSpec[] {
  const specs: BookImageSpec[] = [];
  for (const page of BOOK_ORDER) {
    if (page.kind === "dish") {
      specs.push({ stem: dishStem(page.id), page });
      for (const missing of subsets(dishCrops(page.id))) {
        specs.push({ stem: dishStem(page.id, missing), page, missing });
      }
    } else if (page.kind === "crop") {
      specs.push({ stem: cropStem(page.key, true), page });
      specs.push({ stem: cropStem(page.key, false), page, locked: true });
    } else {
      specs.push({ stem: pageImage(page, { found: new Set(), creative: false }), page });
    }
  }
  return specs;
}

// --- context buttons ------------------------------------------------------------------------------

export type ContextButton =
  | { readonly kind: "what" }
  | { readonly kind: "chapter"; readonly chapter: Chapter }
  | { readonly kind: "dish"; readonly id: string; readonly locked: boolean }
  | { readonly kind: "crop"; readonly key: string; readonly known: boolean };

export function contextTarget(button: ContextButton): BookPage {
  switch (button.kind) {
    case "what":
      return bookPage.what();
    case "chapter":
      return bookPage.chapter(button.chapter);
    case "dish":
      return bookPage.dish(button.id);
    case "crop":
      return bookPage.crop(button.key);
  }
}

const dishButton = (id: string, discovery: Discovery): ContextButton => ({
  kind: "dish",
  id,
  locked: missingCrops(id, discovery).length > 0,
});

const cropButton = (key: string, discovery: Discovery): ContextButton => ({
  kind: "crop",
  key,
  known: cropKnown(key, discovery),
});

/** Dishes whose ingredients are all in `counts` right now, in recipe order. */
export function whatCanIMake(counts: Counts): string[] {
  return [...STATION_RECIPES, ...CRAFTING_RECIPES]
    .filter((recipe) => canMake(counts, recipe.ingredients))
    .map((recipe) => recipe.result)
    .filter((id, i, all) => findDish(id) !== undefined && all.indexOf(id) === i);
}

const PREPARED = new Set(CUTTING_RECIPES.map((recipe) => recipe.output));

/**
 * The buttons a page gets between the nav buttons, top to bottom. They carry the per-player part
 * of the page: names, or "???" while locked. `counts` is the inventory, for "What can I make?".
 */
export function contextButtons(
  page: BookPage,
  discovery: Discovery,
  counts: Counts = {},
): ContextButton[] {
  switch (page.kind) {
    case "home":
      return [
        { kind: "what" },
        ...CHAPTERS.map((chapter): ContextButton => ({ kind: "chapter", chapter })),
      ];
    case "what":
      return whatCanIMake(counts).map((id) => dishButton(id, discovery));
    case "chapter":
      if (page.chapter === "crops") return CROPS.map((crop) => cropButton(crop.key, discovery));
      if (page.chapter === "board") {
        return CUTTING_RECIPES.map((recipe) => cropOfItem(recipe.input))
          .filter((key): key is string => key !== undefined)
          .map((key) => cropButton(key, discovery));
      }
      return dishesInChapter(page.chapter).map((dish) => dishButton(dish.id, discovery));
    case "dish": {
      const buttons = dishCrops(page.id).map((key) => cropButton(key, discovery));
      const made = recipeMaking(page.id);
      const usesBoard = made?.recipe.ingredients.some((i) =>
        i.items.some((id) => PREPARED.has(id)),
      );
      if (usesBoard) buttons.push({ kind: "chapter", chapter: "board" });
      return buttons;
    }
    case "crop": {
      if (!cropByKey(page.key) || !cropKnown(page.key, discovery)) return [];
      return DISHES.filter((dish) => cropsOfDish(dish.id).has(page.key)).map((dish) =>
        dishButton(dish.id, discovery),
      );
    }
  }
}

/** The most context buttons any page can have (the form's button pool when flipping in place). */
export const MAX_CONTEXT_BUTTONS: number = Math.max(
  DISHES.length, // "What can I make?" with everything in the bag
  ...BOOK_ORDER.map((page) => contextButtons(page, { found: new Set(), creative: true }).length),
);

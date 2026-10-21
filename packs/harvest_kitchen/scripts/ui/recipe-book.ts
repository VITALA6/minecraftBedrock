import type { Player, RawMessage } from "@minecraft/server";
import { EFFECT_BUTTON_ICON, SOUND } from "../config";
import { cropOfItem, cropsOfDish, foundCrops, isDishUnlocked } from "../book/discovery";
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
import { stationById, type StationId } from "../data/stations";
import { actionBar } from "../lib/feedback";
import { countInventory, isCreative } from "../lib/inventory";
import { ingredientName, itemName, t } from "../lib/text";
import { Menu, runForm } from "./menu";

// The recipe book (plan §3). Every page is generated from data/ (no hand-written pages), every
// row is an icon button, and Back is always the last button (Home is the root and has none).
//
//   Home           What can I make? · Pot · Board · Crafting · Crops
//   Station        one button per dish; locked dishes show "???" with the locked icon
//   Dish           body "❤ Regeneration · 8 s"; effect button; one button per ingredient, chaining
//                  to where it comes from (crop page, Board, its own dish page, or "Vanilla item");
//                  the station button
//   Crops          one button per crop, "Tomato · Plains, forests" or "??? · Jungle, savanna"
//   Crop           where it grows, how to plant, and the dishes that use it
//   What can I make?  dishes whose ingredients are all in your inventory right now

export type Page =
  | { readonly kind: "home" }
  | { readonly kind: "station"; readonly id: StationId | "board" | "crafting" }
  | { readonly kind: "dish"; readonly id: string }
  | { readonly kind: "crops" }
  | { readonly kind: "crop"; readonly key: string }
  | { readonly kind: "what" };

export const bookPage = {
  home: (): Page => ({ kind: "home" }),
  station: (id: StationId | "board" | "crafting"): Page => ({ kind: "station", id }),
  dish: (id: string): Page => ({ kind: "dish", id }),
  crops: (): Page => ({ kind: "crops" }),
  crop: (key: string): Page => ({ kind: "crop", key }),
};

type Outcome = { readonly go: Page } | "back" | "stay";

const go = (page: Page): Outcome => ({ go: page });
const MAX_DEPTH = 24;

// --- shared bits ---------------------------------------------------------------------------------

const label = (message: RawMessage) => t("hk.ui.text", message);

function hint(player: Player, message: RawMessage): Outcome {
  actionBar(player, message);
  return "stay";
}

/** Station a dish is made at, for its station button and its chapter. */
function chapterOf(dishId: string): StationId | "crafting" {
  const made = recipeMaking(dishId);
  return made?.kind === "station" ? made.recipe.station : "crafting";
}

function dishesIn(chapter: StationId | "crafting"): Dish[] {
  return DISHES.filter((dish) => chapterOf(dish.id) === chapter);
}

function dishButton(menu: Menu<Outcome>, player: Player, dish: Dish, found: Set<string>): void {
  if (isDishUnlocked(player, dish.id, found)) {
    const family = familyOf(dish);
    const name = family
      ? { rawtext: [{ text: `${family.glyph} ` }, itemName(dish.id)] }
      : itemName(dish.id);
    menu.button(label(name), itemIcon(dish.id), () => go(bookPage.dish(dish.id)));
  } else {
    menu.button(t("hk.book.locked"), UI_ICONS.locked, () => go(bookPage.dish(dish.id)));
  }
}

function cropFound(player: Player, crop: Crop, found: Set<string>): boolean {
  return isCreative(player) || found.has(crop.key);
}

// --- pages ---------------------------------------------------------------------------------------

function home(): Menu<Outcome> {
  return new Menu<Outcome>(t("hk.book.title"))
    .button(t("hk.book.what"), UI_ICONS.whatCanIMake, () => ({ go: { kind: "what" } }))
    .button(t("hk.station.pot"), UI_ICONS.pot, () => go(bookPage.station("pot")))
    .button(t("hk.book.board"), UI_ICONS.board, () => go(bookPage.station("board")))
    .button(t("hk.book.crafting"), UI_ICONS.crafting, () => go(bookPage.station("crafting")))
    .button(t("hk.book.crops"), UI_ICONS.crops, () => go(bookPage.crops()));
}

function stationPage(player: Player, id: StationId | "board" | "crafting"): Menu<Outcome> {
  const found = foundCrops(player);
  if (id === "board") {
    const menu = new Menu<Outcome>(t("hk.book.board"));
    for (const recipe of CUTTING_RECIPES) {
      const key = cropOfItem(recipe.input);
      if (key && !isCreative(player) && !found.has(key)) {
        menu.button(t("hk.book.locked"), UI_ICONS.locked, () => go(bookPage.crop(key)));
        continue;
      }
      menu.button(
        t("hk.book.cut_row", itemName(recipe.input), recipe.count, itemName(recipe.output)),
        itemIcon(recipe.output),
        () => hint(player, t("hk.book.board_hint", itemName(recipe.input))),
      );
    }
    return menu.back(() => "back");
  }
  if (id === "crafting") {
    const menu = new Menu<Outcome>(t("hk.book.crafting"));
    for (const dish of dishesIn("crafting")) dishButton(menu, player, dish, found);
    return menu.back(() => "back");
  }
  const station = stationById(id);
  const menu = new Menu<Outcome>(t(station?.nameKey ?? "hk.station.pot"));
  if (station?.needsHeat) {
    menu.button(t("hk.book.needs_heat"), UI_ICONS.needsHeat, () =>
      hint(player, t("hk.book.heat_sources")),
    );
  }
  for (const dish of dishesIn(id)) dishButton(menu, player, dish, found);
  return menu.back(() => "back");
}

function ingredientTarget(player: Player, ingredient: Ingredient): Outcome {
  const id = ingredient.items[0] ?? "";
  const crop = CROPS.find((c) => c.produce === id || c.seed === id);
  if (crop) return go(bookPage.crop(crop.key));
  if (CUTTING_RECIPES.some((r) => r.output === id)) return go(bookPage.station("board"));
  if (findDish(id) || recipeMaking(id)) return go(bookPage.dish(id));
  return hint(player, t("hk.book.vanilla_item"));
}

function effectLine(dish: Dish): RawMessage {
  const effect = dish.effect;
  const info = effect && EFFECTS[effect.effect];
  const family = familyOf(dish);
  if (!effect || !info || !family) return t("hk.book.no_effect");
  return t("hk.book.effect_line", family.glyph, { translate: info.nameKey }, effect.seconds);
}

function dishPage(player: Player, id: string): Menu<Outcome> {
  const dish = findDish(id);
  const made = recipeMaking(id);
  const found = foundCrops(player);

  if (!dish || !isDishUnlocked(player, id, found)) {
    // Locked: a silhouette that says what to look for next.
    const menu = new Menu<Outcome>(t("hk.book.locked")).body(t("hk.book.locked_body"));
    for (const key of cropsOfDish(id)) {
      const crop = cropByKey(key);
      if (!crop) continue;
      if (cropFound(player, crop, found)) {
        menu.button(label(itemName(crop.produce)), itemIcon(crop.produce), () =>
          go(bookPage.crop(key)),
        );
      } else {
        menu.button(t("hk.book.crop_locked", t(crop.whereKey)), UI_ICONS.locked, () =>
          go(bookPage.crop(key)),
        );
      }
    }
    return menu.back(() => "back");
  }

  const body: RawMessage[] = [effectLine(dish)];
  if (dish.slices) body.push({ text: "\n" }, t("hk.book.sliced", dish.slices.count));
  const menu = new Menu<Outcome>(itemName(id)).body({ rawtext: body });

  const effect = dish.effect;
  const family = familyOf(dish);
  if (effect && family) {
    const icon = EFFECT_BUTTON_ICON === "effect" ? EFFECT_ICONS[effect.effect] : family.icon;
    menu.button(effectLine(dish), icon, () => hint(player, t(family.hintKey)));
  }

  for (const ingredient of made?.recipe.ingredients ?? []) {
    menu.button(
      t("hk.book.ingredient", ingredient.count, ingredientName(ingredient)),
      itemIcon(ingredient.items[0] ?? ""),
      () => ingredientTarget(player, ingredient),
    );
  }

  if (made?.kind === "station") {
    const station = stationById(made.recipe.station);
    menu.button(
      station?.needsHeat
        ? t("hk.book.station_heat", t(station.nameKey))
        : t(station?.nameKey ?? ""),
      station ? itemIcon(station.icon) : undefined,
      () => go(bookPage.station(made.recipe.station)),
    );
  } else {
    menu.button(t("hk.book.crafting"), UI_ICONS.crafting, () => go(bookPage.station("crafting")));
  }
  return menu.back(() => "back");
}

function cropsPage(player: Player): Menu<Outcome> {
  const found = foundCrops(player);
  const menu = new Menu<Outcome>(t("hk.book.crops"));
  for (const crop of CROPS) {
    if (cropFound(player, crop, found)) {
      menu.button(
        t("hk.book.crop_row", itemName(crop.produce), t(crop.whereKey)),
        itemIcon(crop.produce),
        () => go(bookPage.crop(crop.key)),
      );
    } else {
      menu.button(t("hk.book.crop_locked", t(crop.whereKey)), UI_ICONS.locked, () =>
        go(bookPage.crop(crop.key)),
      );
    }
  }
  return menu.back(() => "back");
}

function cropPage(player: Player, key: string): Menu<Outcome> {
  const crop = cropByKey(key);
  const found = foundCrops(player);
  if (!crop) return new Menu<Outcome>(t("hk.book.crops")).back(() => "back");
  const known = cropFound(player, crop, found);

  const plant = t(crop.plantOn === "farmland" ? "hk.book.plant_farmland" : "hk.book.plant_soil");
  const body: RawMessage[] = [t("hk.book.where", t(crop.whereKey)), { text: "\n" }, plant];
  if (crop.type === "bush") body.push({ text: "\n" }, t("hk.book.bush"));
  const menu = new Menu<Outcome>(known ? itemName(crop.produce) : t("hk.book.locked")).body({
    rawtext: body,
  });
  if (!known) return menu.back(() => "back");

  if (crop.seed !== crop.produce) {
    menu.button(label(itemName(crop.seed)), itemIcon(crop.seed), () => hint(player, plant));
  }
  for (const recipe of CUTTING_RECIPES.filter((r) => r.input === crop.produce)) {
    menu.button(label(itemName(recipe.output)), itemIcon(recipe.output), () =>
      go(bookPage.station("board")),
    );
  }
  for (const dish of DISHES.filter((d) => cropsOfDish(d.id).has(crop.key))) {
    dishButton(menu, player, dish, found);
  }
  return menu.back(() => "back");
}

function whatPage(player: Player): Menu<Outcome> {
  const counts = countInventory(player);
  const found = foundCrops(player);
  const menu = new Menu<Outcome>(t("hk.book.what"));
  const makeable = [...STATION_RECIPES, ...CRAFTING_RECIPES].filter((r) =>
    canMake(counts, r.ingredients),
  );
  if (makeable.length === 0) menu.body(t("hk.book.nothing"));
  for (const recipe of makeable) {
    const dish = findDish(recipe.result);
    if (dish) dishButton(menu, player, dish, found);
  }
  return menu.back(() => "back");
}

function build(player: Player, page: Page): Menu<Outcome> {
  switch (page.kind) {
    case "home":
      return home();
    case "station":
      return stationPage(player, page.id);
    case "dish":
      return dishPage(player, page.id);
    case "crops":
      return cropsPage(player);
    case "crop":
      return cropPage(player, page.key);
    case "what":
      return whatPage(player);
  }
}

// --- navigation ----------------------------------------------------------------------------------

/** Shows the book starting at `start` (Home underneath, so Back always leads somewhere). */
export async function showBook(player: Player, start: Page = bookPage.home()): Promise<void> {
  const stack: Page[] = start.kind === "home" ? [start] : [bookPage.home(), start];
  player.playSound(SOUND.pageTurn);
  for (let guard = 0; guard < 200; guard++) {
    const page = stack[stack.length - 1];
    if (!page) return;
    const outcome = await build(player, page).show(player);
    if (!player.isValid || outcome === undefined) return;
    if (outcome === "back") stack.pop();
    else if (outcome !== "stay") {
      stack.push(outcome.go);
      if (stack.length > MAX_DEPTH) stack.splice(1, 1); // keep Home at the bottom
    }
  }
}

export function openBook(player: Player, start?: Page): void {
  runForm(showBook(player, start), "recipe book");
}

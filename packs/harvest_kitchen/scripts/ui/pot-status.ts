import { recipesFor, type Ingredient, type StationRecipe } from "../data/recipes";
import type { ContainerStation } from "../data/stations";
import {
  closestRecipe,
  possibleRecipes,
  showsScreen,
  type StationState,
} from "../stations/station-logic";

// What the pot screen shows (D14), as pure functions: the pre-rendered status image for a state,
// every image that can be chosen (tools/gen-book-pages.mjs renders exactly these), and the
// buttons. No @minecraft import; ui/pot-screen.ts builds the CustomForm.
//
// The trade-off (slice.md "Pot screen"): the contents are arbitrary (8 slots, 15 ingredient
// types), so the image can't show the real contents. It shows the *target recipe* instead: its
// ingredient slots inside the pot, each either present (full colour) or still missing (ghost +
// "+N"), the arrow, the heat (lit or cold flame) and the result (ghost while something is
// missing). That is one image per recipe × missing-count vector × heat. Ingredients that belong
// to no slot of the target recipe ("extras") only show as Take-out buttons.
// When several dishes are possible, one generic "choose" image per heat; the Cook buttons name them.

export const POT_TEXTURE_DIR = "textures/hk/pot";

export type Heat = "lit" | "cold";

export function potImagePath(stem: string): string {
  return `${POT_TEXTURE_DIR}/${stem}.png`;
}

const shortName = (id: string) => id.slice(id.indexOf(":") + 1);

function supplied(items: Readonly<Record<string, number>>, ingredient: Ingredient): number {
  return ingredient.items.reduce((sum, id) => sum + (items[id] ?? 0), 0);
}

/** How many are still missing per ingredient slot of `recipe` (0 = that slot is complete). */
export function slotMissing(
  recipe: StationRecipe,
  items: Readonly<Record<string, number>>,
): number[] {
  return recipe.ingredients.map((i) => Math.max(0, i.count - supplied(items, i)));
}

export function recipeStem(
  station: ContainerStation,
  recipe: StationRecipe,
  missing: readonly number[],
  heat: Heat,
): string {
  return `${station.id}_${shortName(recipe.id)}_${missing.join("")}_${heat}`;
}

export function chooseStem(station: ContainerStation, heat: Heat): string {
  return `${station.id}_choose_${heat}`;
}

export interface PotScreenView {
  /** Image stem (see potImagePath). */
  readonly image: string;
  /** Heat below; "cold" adds the "Needs fire below" line. */
  readonly heat: Heat;
  /** One Cook button per dish possible right now. */
  readonly cook: readonly StationRecipe[];
  /** The closest recipe when nothing is possible ("Almost!"): its book page. */
  readonly almost?: StationRecipe;
  /** Take-out buttons: one per ingredient type, with its count. */
  readonly contents: readonly (readonly [string, number])[];
  /**
   * Changes when the set of buttons changes (or the heat, which the screen states in a label);
   * the open screen then rebuilds. Anything else (counts, the image) updates in place.
   */
  readonly layout: string;
}

/** The pot screen for this state, or undefined when no screen should show (plan §2.3). */
export function potScreenView(
  station: ContainerStation,
  state: StationState,
  hot: boolean,
): PotScreenView | undefined {
  if (!showsScreen(station, state)) return undefined;
  const heat: Heat = hot ? "lit" : "cold";
  const cook = possibleRecipes(station, state);
  const almost = cook.length === 0 ? closestRecipe(station, state)?.recipe : undefined;
  const target = cook.length === 1 ? cook[0] : almost;
  const image = target
    ? recipeStem(station, target, slotMissing(target, state.items), heat)
    : chooseStem(station, heat);
  const contents = Object.entries(state.items).sort(([a], [b]) => a.localeCompare(b));
  const layout = [
    heat,
    cook.map((r) => r.id).join(","),
    almost?.id ?? "",
    contents.map(([id]) => id).join(","),
  ].join("|");
  return { image, heat, cook, almost, contents, layout };
}

/** One image the renderer draws: a recipe with its missing vector, or the generic "choose". */
export interface PotImageSpec {
  readonly stem: string;
  readonly heat: Heat;
  readonly recipe?: StationRecipe;
  readonly missing?: readonly number[];
}

/** Every missing vector closestRecipe or a single match can produce: all but "all missing". */
function missingVectors(recipe: StationRecipe): number[][] {
  let vectors: number[][] = [[]];
  for (const ingredient of recipe.ingredients) {
    const next: number[][] = [];
    for (const v of vectors) for (let m = 0; m <= ingredient.count; m++) next.push([...v, m]);
    vectors = next;
  }
  // closestRecipe only picks recipes that use at least one item already inside.
  return vectors.filter((v) => v.some((m, i) => m < (recipe.ingredients[i]?.count ?? 0)));
}

/** Every pot image potScreenView() can return, once each. */
export function potImageSpecs(station: ContainerStation): PotImageSpec[] {
  const specs: PotImageSpec[] = [];
  for (const heat of ["lit", "cold"] as const) {
    specs.push({ stem: chooseStem(station, heat), heat });
    for (const recipe of recipesFor(station.id)) {
      for (const missing of missingVectors(recipe)) {
        specs.push({ stem: recipeStem(station, recipe, missing, heat), heat, recipe, missing });
      }
    }
  }
  return specs;
}

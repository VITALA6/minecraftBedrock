// S9 spike (D13): IDs, title markers, fixed button indexes and textures. Throwaway pack.

/** `/scriptevent hk:uispike <case>` opens a test form. */
export const SCRIPT_EVENT = "hk:uispike";

/**
 * Title markers. `ui/server_form.json` hides the vanilla form when the title contains `§h§k`, and
 * each layout in `ui/hk_ui_spike/forms.json` shows when the title contains its own marker
 * (`§h§k§1` book, `§h§k§2` pot, `§h§k§3` data). The trailing `§r` keeps the title readable if our
 * layout ever loses to another pack: every code comes before the first visible character.
 */
export const MARKER = {
  book: "§h§k§1§r",
  pot: "§h§k§2§r",
  data: "§h§k§3§r",
} as const;

/** Book spread: every ActionForm button has a fixed slot in the layout (forms.json book_layout). */
export const BOOK = {
  /** 3×3 recipe grid, row by row. */
  grid: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  result: 9,
  prev: 10,
  next: 11,
  home: 12,
  station: 13,
  family: 14,
  effect: 15,
  /** Bookmark ribbons, top to bottom: Pot, Board, Crafting, Crops, What can I make. */
  tabs: [16, 17, 18, 19, 20],
  size: 21,
} as const;

/** Pot screen (forms.json pot_layout). */
export const POT = {
  /** "In the pot", 2 rows × 4. */
  contents: [0, 1, 2, 3, 4, 5, 6, 7],
  heat: 8,
  result: 9,
  cook: 10,
  almost: 11,
  book: 12,
  size: 13,
} as const;

const ICONS = "textures/hk_ui_spike/icons";

/** Our copies of the Harvest Kitchen placeholder icons, plus vanilla textures (verified in 1.26.52). */
export const TEX = {
  tomato: `${ICONS}/tomato`,
  onion: `${ICONS}/onion`,
  cucumber: `${ICONS}/cucumber`,
  strawberry: `${ICONS}/strawberry`,
  choppedOnion: `${ICONS}/chopped_onion`,
  slicedTomato: `${ICONS}/sliced_tomato`,
  tomatoSoup: `${ICONS}/tomato_soup`,
  vegetableStew: `${ICONS}/vegetable_stew`,
  gardenSalad: `${ICONS}/garden_salad`,
  strawberryCake: `${ICONS}/strawberry_cake`,
  cookingPot: `${ICONS}/cooking_pot`,
  cuttingBoard: `${ICONS}/cutting_board`,
  recipeBook: `${ICONS}/recipe_book`,
  chapterCrops: `${ICONS}/chapter_crops`,
  chapterMake: `${ICONS}/chapter_what_can_i_make`,
  familyHeal: `${ICONS}/family_heal`,
  locked: `${ICONS}/locked`,
  needsHeat: `${ICONS}/needs_heat`,
  carrot: "textures/items/carrot",
  potato: "textures/items/potato",
  bowl: "textures/items/bowl",
  milk: "textures/items/bucket_milk",
  sugar: "textures/items/sugar",
  egg: "textures/items/egg",
  wheat: "textures/items/wheat",
  craftingTable: "textures/blocks/crafting_table_front",
  regeneration: "textures/ui/regeneration_effect",
  flameLit: "textures/ui/flame_full_image",
  flameUnlit: "textures/ui/flame_empty_image",
} as const;

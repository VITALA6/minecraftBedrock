import { STATION_RECIPES } from "./recipes";

// The ghost particle atlas (D15): one texture holding every icon the ghosts above a pot can show,
// so one particle (wm_kitchen:ghost_icon) draws any of them, picked by a Molang float (variable.wm_kitchen_icon).
// tools/gen-ghost-atlas.mjs bundles this module and draws exactly these cells, so the script, the
// texture and the particle JSON can't drift (npm test runs the generator with --check).
//
// Each cell is 20 px: 1 px of transparent padding all round (so a filtered sample at the edge never
// picks up the neighbour), then the 18 px frame the particle shows (uv_size): the 16 px icon with a
// 1 px pale outline round its silhouette, so a dark icon (a bowl) still reads on a dark floor.

export const GHOST_ATLAS = {
  /** RP-relative path without extension, as the particle JSON names it. */
  texture: "textures/wm_kitchen/particle/ghost_atlas",
  columns: 8,
  cell: 20,
  /** Transparent border of each cell, outside the frame. */
  pad: 1,
  /** What one particle shows: the icon plus its outline ring. */
  frame: 18,
  icon: 16,
} as const;

/** Drawn by the generator, not taken from an item texture: the sparkle star and the pop puff. */
export const GHOST_STAR = "star";
export const GHOST_PUFF = "puff";

let cells: readonly string[] | undefined;

/**
 * Every cell in order: the two drawn shapes first (their fixed cells 0 and 1 are baked into the
 * sparkle and pop particles), then every ingredient and result of every station recipe, in recipe
 * order, each once. A new recipe's new items append at the end.
 */
export function ghostAtlasCells(): readonly string[] {
  if (!cells) {
    const list = [GHOST_STAR, GHOST_PUFF];
    for (const recipe of STATION_RECIPES) {
      for (const ingredient of recipe.ingredients) list.push(...ingredient.items);
      list.push(recipe.result);
    }
    cells = [...new Set(list)];
  }
  return cells;
}

/** The atlas cell of an item (the value for variable.wm_kitchen_icon), or -1 if it has none. */
export function ghostIconIndex(id: string): number {
  return ghostAtlasCells().indexOf(id);
}

export function ghostAtlasSize(): { readonly w: number; readonly h: number } {
  const rows = Math.ceil(ghostAtlasCells().length / GHOST_ATLAS.columns);
  return { w: GHOST_ATLAS.columns * GHOST_ATLAS.cell, h: rows * GHOST_ATLAS.cell };
}

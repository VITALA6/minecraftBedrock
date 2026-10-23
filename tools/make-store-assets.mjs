// Writes the store images for CurseForge and MCPEDL: docs/simmerfield/release/assets/
//
//   node tools/make-store-assets.mjs            compose the images from the committed sources
//   node tools/make-store-assets.mjs --check    exit 1 if any image differs from what it would write
//   node tools/make-store-assets.mjs --render   first re-render the 3D sources with Blockbench
//
// Six 1920×1080 gallery images (one idea each, with a caption) and the 720×340 MCPEDL thumbnail.
// They match the 400×400 logo (tools/make-logo.mjs): warm rays on an 8 px grid, a band of tilled
// soil with a grass edge, our own 16×16 textures scaled by whole numbers with nearest-neighbour,
// fixed hex colours, a hard drop shadow. Captions use the pixel font below (5×7, upper case), so
// no system font is involved and the output is byte-identical on every machine.
//
// Sources, our own art only (never art/references/, which is third-party):
//   - item and block textures in packs/simmerfield/resource/textures/wm_kitchen/
//   - our drawings of vanilla things in art/simmerfield/generated/ingredients/ (campfire, cake, bowl)
//   - 3D renders of our Blockbench models in docs/simmerfield/release/assets/src/. `--render` makes
//     them: it drives a running Blockbench through its MCP server (BB_MCP, default
//     http://localhost:3000/bb-mcp; start it with `blockbench`) and writes each scene, trimmed to
//     its pixels. Run it under the shared lock: `flock <lockfile> node tools/make-store-assets.mjs
//     --render`. The plain run never needs Blockbench.

/* global Canvas, Codecs, Formats, Group, newProject, Outliner, Project, Texture, THREE --
   Blockbench globals (inBlockbench) */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { decodePng, encodePng } from "./gen-textures.mjs";
import { ROOT } from "./paths.mjs";

const OUT_DIR = path.join(ROOT, "docs/simmerfield/release/assets");
const SRC_DIR = path.join(OUT_DIR, "src");
const ITEMS = path.join(ROOT, "packs/simmerfield/resource/textures/wm_kitchen/items");
const BLOCKS = path.join(ROOT, "packs/simmerfield/resource/textures/wm_kitchen/blocks");
const INGREDIENTS = path.join(ROOT, "art/simmerfield/generated/ingredients");
const MODELS = path.join(ROOT, "art/simmerfield/models");

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** The logo's colours, plus the caption band and the text. */
const COLOURS = {
  rayLight: hex("#fbe9b7"),
  rayDark: hex("#f4d48a"),
  grassTop: hex("#8cc152"),
  grass: hex("#5e9a3a"),
  soilLight: hex("#7a4f2e"),
  soilDark: hex("#5b3820"),
  shadow: hex("#3b2414"),
  band: hex("#3b2414"),
  bandEdge: hex("#7a4f2e"),
  text: hex("#fff3d6"),
  textGold: hex("#f4d48a"),
  textShadow: hex("#1c100a"),
  arrow: hex("#b4532a"),
};

// ---------------------------------------------------------------- pixel font
// 5×7 capitals (a few are narrower), drawn for these captions. "#" is ink.
const GLYPHS = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  J: ["....#", "....#", "....#", "....#", "#...#", "#...#", ".###."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  ",": ["..", "..", "..", "..", "..", ".#", "#."],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  ":": [".", "#", ".", ".", ".", "#", "."],
  "!": ["#", "#", "#", "#", "#", ".", "#"],
  "'": ["#", "#", ".", ".", ".", ".", "."],
  "-": ["....", "....", "....", "####", "....", "....", "...."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
};

/** Width of `str` in font pixels (1 px between glyphs). */
function textWidth(str) {
  let w = 0;
  for (const ch of str) {
    const g = GLYPHS[ch];
    if (!g) throw new Error(`no glyph for ${JSON.stringify(ch)}`);
    w += g[0].length + 1;
  }
  return w - 1;
}

/** Draws `str` with its top-left at (x, y), each font pixel `s`×`s`, with a drop shadow one font
 *  pixel down-right. */
function drawText(im, str, x, y, s, colour) {
  const ink = [];
  let cx = 0;
  for (const ch of str) {
    const g = GLYPHS[ch];
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < g[gy].length; gx++) if (g[gy][gx] === "#") ink.push([cx + gx, gy]);
    cx += g[0].length + 1;
  }
  for (const [gx, gy] of ink)
    fillRect(im, x + (gx + 1) * s, y + (gy + 1) * s, s, s, COLOURS.textShadow);
  for (const [gx, gy] of ink) fillRect(im, x + gx * s, y + gy * s, s, s, colour);
}

function drawTextCentred(im, str, cx, y, s, colour) {
  drawText(im, str, Math.round(cx - (textWidth(str) * s) / 2), y, s, colour);
}

/** A short label on a small plate in the caption band's colours, centred on `cx`. */
function drawLabel(im, str, cx, y, s) {
  const w = textWidth(str) * s;
  const pad = 2 * s;
  const x = Math.round(cx - w / 2);
  fillRect(im, x - pad, y - pad, w + 2 * pad + s, 8 * s + 2 * pad, COLOURS.bandEdge);
  fillRect(im, x - pad + s, y - pad + s, w + 2 * pad - s, 8 * s + 2 * pad - 2 * s, COLOURS.band);
  drawText(im, str, x, y, s, COLOURS.text);
}

// ---------------------------------------------------------------- drawing
function image(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) };
}

function fillRect(im, x0, y0, w, h, colour, alpha = 1) {
  for (let y = Math.max(0, y0); y < Math.min(im.h, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(im.w, x0 + w); x++) {
      const d = (y * im.w + x) * 4;
      for (let k = 0; k < 3; k++)
        im.px[d + k] = Math.round(colour[k] * alpha + im.px[d + k] * (1 - alpha));
      im.px[d + 3] = 255;
    }
}

/** Draws `src` ×`scale` at (ox, oy): nearest-neighbour, alpha-blended. `tint` replaces the
 *  colour (for the shadow). Renders use scale 1. */
function blit(im, src, scale, ox, oy, tint, alphaMul = 1) {
  for (let y = 0; y < src.h * scale; y++)
    for (let x = 0; x < src.w * scale; x++) {
      const tx = ox + x;
      const ty = oy + y;
      if (tx < 0 || ty < 0 || tx >= im.w || ty >= im.h) continue;
      const s = (Math.floor(y / scale) * src.w + Math.floor(x / scale)) * 4;
      const a = (src.px[s + 3] / 255) * alphaMul;
      if (a === 0) continue;
      const d = (ty * im.w + tx) * 4;
      for (let k = 0; k < 3; k++) {
        const c = tint ? tint[k] : src.px[s + k];
        im.px[d + k] = Math.round(c * a + im.px[d + k] * (1 - a));
      }
      im.px[d + 3] = 255;
    }
}

/** A sprite or render with the logo's hard drop shadow under it. */
function place(im, src, scale, x, y, shadow = Math.max(8, scale)) {
  blit(im, src, scale, x, y + shadow, COLOURS.shadow, 0.4);
  blit(im, src, scale, x, y);
}

const cache = new Map();
function load(dir, name) {
  const file = path.join(dir, `${name}.png`);
  if (!cache.has(file)) {
    const img = decodePng(readFileSync(file));
    if (!img) throw new Error(`${file}: unsupported PNG`);
    cache.set(file, img);
  }
  return cache.get(file);
}
const item = (name) => load(ITEMS, name);
const block = (name) => load(BLOCKS, name);
const ingredient = (name) => load(INGREDIENTS, name);
const render = (name) => load(SRC_DIR, name);

/** The arrow between steps, as a 9×7 sprite (drawn ×`s`). */
const ARROW = [
  "....#....",
  "....##...",
  "#######.",
  "########.",
  "#######..",
  "....##...",
  "....#....",
];
function arrowSprite() {
  const im = image(9, 7);
  ARROW.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== "#") return;
      im.px.set([...COLOURS.arrow, 255], (y * 9 + x) * 4);
    }),
  );
  return im;
}

// ---------------------------------------------------------------- the frame
/** The logo's background, any size: rays from `ray` (pixels) on a `cell` grid, the grass edge
 *  at `ground` (pixels, a multiple of `cell`) and soil below. */
function background(w, h, { cell, ray, ground, rays = 28 }) {
  const im = image(w, h);
  const grassRows = 2;
  const groundRow = ground / cell;
  for (let gy = 0; gy < Math.ceil(h / cell); gy++)
    for (let gx = 0; gx < Math.ceil(w / cell); gx++) {
      let colour;
      if (gy >= groundRow + grassRows) colour = gy % 2 ? COLOURS.soilDark : COLOURS.soilLight;
      else if (gy === groundRow) colour = COLOURS.grassTop;
      else if (gy > groundRow) colour = COLOURS.grass;
      else {
        const a = Math.atan2((gy + 0.5) * cell - ray.y, (gx + 0.5) * cell - ray.x);
        const sector = Math.floor(((a + Math.PI) / (2 * Math.PI)) * rays);
        colour = sector % 2 ? COLOURS.rayDark : COLOURS.rayLight;
      }
      fillRect(im, gx * cell, gy * cell, cell, cell, colour);
    }
  return im;
}

// Gallery frame: 1920×1080 on an 8 px grid. The caption band takes the top 27 rows (216 px),
// the grass edge is row 121 (968 px).
const W = 1920;
const H = 1080;
const CELL = 8;
const BAND = 216;
const GROUND = 968;
const TITLE_SCALE = 10;
const SUB_SCALE = 5;

function galleryFrame(title, sub, rayY = (BAND + GROUND) / 2) {
  const im = background(W, H, { cell: CELL, ray: { x: W / 2, y: rayY }, ground: GROUND });
  fillRect(im, 0, 0, W, BAND - CELL, COLOURS.band);
  fillRect(im, 0, BAND - CELL, W, CELL, COLOURS.bandEdge);
  drawTextCentred(im, title, W / 2, 40, TITLE_SCALE, COLOURS.text);
  drawTextCentred(im, sub, W / 2, 40 + 7 * TITLE_SCALE + 24, SUB_SCALE, COLOURS.textGold);
  // the name on the soil, so a shared image still says what it is
  const mark = "SIMMERFIELD";
  drawText(im, mark, W - 40 - textWidth(mark) * 4, H - 40 - 7 * 4, 4, COLOURS.textGold);
  return im;
}

/** Puts a render with its bottom `sink` px into the grass, centred on `cx`. */
function standOnGround(im, src, cx, sink = 16) {
  const x = Math.round(cx - src.w / 2);
  place(im, src, 1, x, GROUND + sink - src.h, 12);
  return { x, y: GROUND + sink - src.h };
}

// ---------------------------------------------------------------- the images
const SCENES = [
  {
    file: "curseforge-1-cook.png",
    what: "Cook: the Cooking Pot full of Tomato Soup on a lit Kitchen Stove, mix in, soup out",
    draw() {
      const im = galleryFrame("COOK IN THE POT", "OVER A CAMPFIRE, LAVA OR A LIT KITCHEN STOVE");
      standOnGround(im, render("pot_stove"), W / 2);
      const arrow = arrowSprite();
      const s = 12;
      const y = 448;
      place(im, item("tomato_soup_mix"), s, 232, y);
      place(im, arrow, 10, 488, y + 62);
      place(im, arrow, 10, W - 488 - 90, y + 62);
      place(im, item("tomato_soup"), s, W - 232 - 16 * s, y);
      drawLabel(im, "MIX", 232 + 8 * s, y + 16 * s + 56, 6);
      drawLabel(im, "SOUP", W - 232 - 8 * s, y + 16 * s + 56, 6);
      return im;
    },
  },
  {
    file: "curseforge-2-chop.png",
    what: "Chop: the Cutting Board with its knife, the four crops and the four cut ingredients",
    draw() {
      const im = galleryFrame(
        "CHOP ON THE CUTTING BOARD",
        "SLICES FOR SALADS, SANDWICHES AND SALSA",
      );
      standOnGround(im, render("board"), W / 2, 24);
      const whole = ["tomato", "onion", "cucumber", "eggplant"];
      const cut = ["sliced_tomato", "chopped_onion", "sliced_cucumber", "sliced_eggplant"];
      const s = 8;
      const top = 264;
      const step = 168;
      whole.forEach((n, i) => place(im, item(n), s, 136, top + i * step));
      cut.forEach((n, i) => place(im, item(n), s, W - 136 - 16 * s, top + i * step));
      const arrow = arrowSprite();
      const ay = top + 1.5 * step + 64 - 35;
      place(im, arrow, 10, 136 + 16 * s + 56, ay);
      place(im, arrow, 10, W - 136 - 16 * s - 56 - 90, ay);
      return im;
    },
  },
  {
    file: "curseforge-3-cake.png",
    what: "Strawberry Cake: the placed cake with a slice eaten, and its recipe (cake + strawberries)",
    draw() {
      const im = galleryFrame("STRAWBERRY CAKE", "PLACE IT, THEN EAT IT ONE SLICE AT A TIME", 600);
      standOnGround(im, render("cake"), 1300);
      // the recipe on the left: a cake and two strawberries
      const s = 8;
      const y = 520;
      place(im, ingredient("cake"), s, 112, y);
      drawText(im, "+", 112 + 128 + 24, y + 36, 8, COLOURS.arrow);
      place(im, item("strawberry"), s, 112 + 128 + 96, y);
      place(im, item("strawberry"), s, 112 + 2 * 128 + 112, y);
      place(im, arrowSprite(), 10, 112 + 3 * 128 + 144, y + 29);
      drawLabel(im, "RECIPE", 112 + (3 * 128 + 112) / 2, y + 128 + 56, 6);
      return im;
    },
  },
  {
    file: "curseforge-4-kitchen.png",
    what: "Decor: counters, cabinets, sink, spice shelf, lit stove with the pot, pan, jar, basket",
    draw() {
      const im = galleryFrame(
        "BUILD A KITCHEN",
        "EIGHT DECOR BLOCKS, AND THE LIT STOVE HEATS THE POT",
      );
      standOnGround(im, render("kitchen"), W / 2, 16);
      return im;
    },
  },
  {
    file: "curseforge-5-crops-dishes.png",
    what: "Overview: the 18 dish icons above the six crops growing in the soil",
    draw() {
      const im = galleryFrame("6 NEW CROPS, 18 DISHES", "GROW THEM, CHOP THEM, COOK THEM", 560);
      const dishes = [
        "tomato_soup",
        "vegetable_stew",
        "chili_stew",
        "fish_chowder",
        "chicken_soup",
        "onion_soup",
        "strawberry_jam",
        "stuffed_eggplant",
        "ratatouille",
        "eggplant_curry",
        "garden_salad",
        "salsa",
        "veggie_sandwich",
        "hearty_sandwich",
        "strawberry_cup",
        "eggplant_salad",
        "veggie_skewer",
        "strawberry_cake",
      ];
      const s = 8;
      const size = 16 * s;
      const gap = 48;
      const x0 = (W - (9 * size + 8 * gap)) / 2;
      dishes.forEach((n, i) =>
        place(im, item(n), s, x0 + (i % 9) * (size + gap), 296 + Math.floor(i / 9) * (size + 40)),
      );
      const crops = [
        "tomato_crop_stage_3",
        "onion_crop_stage_3",
        "cucumber_crop_stage_3",
        "eggplant_crop_stage_3",
        "chili_bush_stage_3",
        "strawberry_bush_stage_3",
      ];
      const ps = 12;
      const pgap = 72;
      const px0 = (W - (6 * 16 * ps + 5 * pgap)) / 2;
      crops.forEach((plant, i) =>
        blit(im, block(plant), ps, px0 + i * (16 * ps + pgap), GROUND + 2 * CELL - 16 * ps),
      );
      return im;
    },
  },
  {
    file: "curseforge-6-recipe-flow.png",
    what: "How a hot dish is made: grow tomatoes, craft a Tomato Soup Mix, cook it, eat the soup",
    draw() {
      const im = galleryFrame("GROW, MIX, COOK, EAT", "TOMATO SOUP IN FOUR STEPS");
      const s = 10;
      const size = 16 * s;
      const arrow = arrowSprite();
      const aw = 9 * 8;
      const gap = 56;
      const x0 = (W - (4 * size + 3 * (aw + 2 * gap))) / 2;
      const y = 470;
      const col = (i) => x0 + i * (size + aw + 2 * gap);
      // 1 grow: the ripe plant
      place(im, block("tomato_crop_stage_3"), s, col(0), y);
      // 2 mix: two tomatoes and a bowl above the mix
      place(im, item("tomato_soup_mix"), s, col(1), y);
      place(im, item("tomato"), 4, col(1) - 24, y - 112);
      place(im, item("tomato"), 4, col(1) + 48, y - 112);
      place(im, ingredient("bowl"), 4, col(1) + 120, y - 112);
      // 3 cook: the pot on a campfire, as on the logo
      place(im, ingredient("campfire"), s, col(2), y + 96);
      place(im, item("cooking_pot"), s, col(2), y - 24);
      // 4 eat
      place(im, item("tomato_soup"), s, col(3), y);
      for (let i = 0; i < 3; i++) place(im, arrow, 8, col(i) + size + gap, y + size / 2 - 28);
      ["GROW", "MIX", "COOK", "EAT"].forEach((label, i) =>
        drawLabel(im, label, col(i) + size / 2, y + size + 136, 7),
      );
      return im;
    },
  },
  {
    file: "MCPEDL.png",
    what: "MCPEDL thumbnail: the title next to the pot of soup on the lit stove",
    draw() {
      const w = 720;
      const h = 340;
      const cell = 4;
      const ground = 288;
      const im = background(w, h, { cell, ray: { x: 590, y: 170 }, ground, rays: 24 });
      fillRect(im, 0, 0, 404, ground, COLOURS.band);
      fillRect(im, 404, 0, cell, ground, COLOURS.bandEdge);
      drawTextCentred(im, "SIMMERFIELD", 202, 84, 6, COLOURS.text);
      drawTextCentred(im, "FARMING & COOKING", 202, 156, 4, COLOURS.textGold);
      drawTextCentred(im, "BY WENDERMODS", 202, 224, 3, COLOURS.text);
      const pot = render("pot_stove_small");
      place(im, pot, 1, Math.round(566 - pot.w / 2), ground + 8 - pot.h, 6);
      return im;
    },
  },
];

// ---------------------------------------------------------------- Blockbench renders (--render)
// Camera directions from the model towards the camera (the models face north, -z), as in
// art/simmerfield/models/_tools/bb-export.mjs. `ppu` is pixels per model pixel (1/16 block).
const NW = [-1, 0.82, -1];
const POT_ON_STOVE = [
  { file: "kitchen_stove/kitchen_stove.bbmodel" },
  {
    file: "cooking_pot/cooking_pot.bbmodel",
    offset: [0, 16, 0],
    hide: ["liquid_1", "liquid_2", "lid"],
  },
  { file: "fx_spoon/fx_spoon.src.bbmodel", offset: [0, 16, 0] },
];
const SOUP_READY = {
  cooking_pot_liquid: "cooking_pot_liquid_tomato_ready",
  cooking_pot_top: "cooking_pot_top_hot",
};
const RENDERS = [
  { name: "pot_stove", ppu: 21, dir: NW, parts: POT_ON_STOVE, textures: SOUP_READY },
  { name: "pot_stove_small", ppu: 8, dir: NW, parts: POT_ON_STOVE, textures: SOUP_READY },
  { name: "board", ppu: 44, dir: NW, parts: [{ file: "cutting_board/cutting_board.bbmodel" }] },
  {
    name: "cake",
    ppu: 32,
    dir: NW,
    parts: [{ file: "strawberry_cake/strawberry_cake.bbmodel", hide: ["slice_4"] }],
  },
  {
    // a little more from the front than NW, so the row reads wider than tall; the pot shows its
    // soup, as on a lit stove (the lid only shows while it cooks without heat)
    name: "kitchen",
    ppu: 10,
    dir: [-0.6, 0.6, -1],
    parts: [
      {
        file: "kitchen_deco/kitchen_group.bbmodel",
        hideElements: ["lid_plate", "lid_plate_side", "lid_knob", "liquid_1", "liquid_2"],
      },
    ],
    textures: SOUP_READY,
  },
];

/** Runs inside Blockbench (stringified: no comments inside, risky_eval refuses "//"). Merges the
 *  parts into a new Generic Model project, moves and hides them, swaps textures, renders with an
 *  orthographic camera on a transparent background, closes the project. */
async function inBlockbench(job) {
  const fs = require("fs");
  newProject(Formats.free);
  const proj = Project;
  try {
    for (const part of job.parts) {
      const before = new Set(Outliner.elements);
      const beforeGroups = new Set(Group.all);
      Codecs.project.merge(JSON.parse(fs.readFileSync(part.file, "utf8")));
      const off = part.offset ?? [0, 0, 0];
      for (const el of Outliner.elements) {
        if (before.has(el)) continue;
        if ((part.hideElements ?? []).includes(el.name)) el.visibility = false;
        for (let i = 0; i < 3; i++) {
          el.from[i] += off[i];
          el.to[i] += off[i];
          el.origin[i] += off[i];
        }
      }
      for (const g of Group.all) {
        if (beforeGroups.has(g)) continue;
        for (let i = 0; i < 3; i++) g.origin[i] += off[i];
        if ((part.hide ?? []).includes(g.name)) {
          g.visibility = false;
          for (const c of g.children) c.visibility = false;
        }
      }
    }
    for (const [name, file] of Object.entries(job.textures)) {
      const t = Texture.all.find((x) => x.name === name || x.name === name + ".png");
      if (!t) throw new Error("no texture " + name);
      t.fromPath(file);
    }
    Canvas.updateAll();
    Canvas.updateVisibility();
    for (let i = 0; i < 50 && Texture.all.some((t) => t.img && !t.img.complete); i++)
      await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 500));
    Canvas.updateAll();
    await new Promise((r) => setTimeout(r, 200));
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(job.size, job.size);
    renderer.setClearColor(0x000000, 0);
    const model = proj.model_3d;
    const parent = model.parent;
    const sc = new THREE.Scene();
    sc.add(model);
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    const half = job.size / 2 / job.ppu;
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 2000);
    cam.position.copy(center).addScaledVector(new THREE.Vector3(...job.dir).normalize(), 400);
    cam.up.set(0, 1, 0);
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    renderer.render(sc, cam);
    const data = renderer.domElement.toDataURL("image/png").split(",")[1];
    fs.writeFileSync(job.out, Buffer.from(data, "base64"));
    if (parent) parent.add(model);
    renderer.dispose();
    renderer.forceContextLoss();
  } finally {
    proj.close(true);
  }
  return { out: job.out };
}

async function blockbenchSession() {
  const url = process.env.BB_MCP ?? "http://localhost:3000/bb-mcp";
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  let sid;
  const rpc = async (body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: sid ? { ...headers, "mcp-session-id": sid } : headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    sid ??= res.headers.get("mcp-session-id");
    const line = text.split("\n").find((l) => l.startsWith("data: ")) ?? text;
    return text.trim() ? JSON.parse(line.replace(/^data: /, "")) : null;
  };
  await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "make-store-assets", version: "1" },
    },
  });
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
  let id = 10;
  return async (code) => {
    const r = await rpc({
      jsonrpc: "2.0",
      id: id++,
      method: "tools/call",
      params: { name: "risky_eval", arguments: { code } },
    });
    const text = (r.result?.content ?? []).map((c) => c.text ?? "").join("");
    if (r.result?.isError || text.startsWith("Error")) throw new Error(text || JSON.stringify(r));
    return JSON.parse(text);
  };
}

/** Crops an image to its non-transparent pixels. */
function trim(im) {
  let x0 = im.w;
  let y0 = im.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++)
      if (im.px[(y * im.w + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) throw new Error("empty render");
  const out = image(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < out.h; y++)
    out.px.set(
      im.px.subarray(((y0 + y) * im.w + x0) * 4, ((y0 + y) * im.w + x1 + 1) * 4),
      y * out.w * 4,
    );
  return out;
}

async function renderSources() {
  const evalInBlockbench = await blockbenchSession();
  mkdirSync(SRC_DIR, { recursive: true });
  for (const r of RENDERS) {
    const out = path.join(SRC_DIR, `${r.name}.png`);
    const job = {
      out,
      size: 1600,
      ppu: r.ppu,
      dir: r.dir,
      parts: r.parts.map((p) => ({ ...p, file: path.join(MODELS, p.file) })),
      textures: Object.fromEntries(
        Object.entries(r.textures ?? {}).map(([k, v]) => [k, path.join(BLOCKS, `${v}.png`)]),
      ),
    };
    await evalInBlockbench(`(${inBlockbench.toString()})(${JSON.stringify(job)})`);
    const img = decodePng(readFileSync(out));
    if (!img) throw new Error(`${out}: unsupported PNG`);
    if ([0, img.h - 1].some((y) => [0, img.w - 1].some((x) => img.px[(y * img.w + x) * 4 + 3])))
      throw new Error(`${r.name}: the render touches the corner, lower its ppu`);
    writeFileSync(out, encodePng(trim(img)));
    console.log(`[make-store-assets] rendered ${path.relative(ROOT, out)}`);
  }
}

// ---------------------------------------------------------------- main
if (process.argv.includes("--render")) await renderSources();
const check = process.argv.includes("--check");
let differs = 0;
mkdirSync(OUT_DIR, { recursive: true });
for (const scene of SCENES) {
  const png = encodePng(scene.draw());
  const file = path.join(OUT_DIR, scene.file);
  const rel = path.relative(ROOT, file);
  if (check) {
    let same;
    try {
      same = readFileSync(file).equals(png);
    } catch {
      same = false;
    }
    if (!same) differs++;
    console.log(`[make-store-assets] ${rel} ${same ? "up to date" : "differs"}`);
  } else {
    writeFileSync(file, png);
    console.log(`[make-store-assets] wrote ${rel} (${Math.round(png.length / 1024)} KB)`);
  }
}
if (check) process.exit(differs ? 1 : 0);

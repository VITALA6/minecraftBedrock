// Writes the 400×400 project logo for CurseForge and MCPEDL:
//   docs/harvest-kitchen/release/logo-400.png
//
//   node tools/make-logo.mjs           write the PNG
//   node tools/make-logo.mjs --check   exit 1 if the PNG differs from what it would write
//
// Built only from our own 16×16 art: the pack's item textures (packs/harvest_kitchen/resource/
// textures/hk/items/) and the campfire the recipe posters use (art/harvest_kitchen/generated/
// ingredients/campfire.png, drawn from our grid in art/harvest_kitchen/pixels/campfire.txt).
// Never anything from art/references/ (third-party, never shipped). Every icon is scaled by a
// whole number with nearest-neighbour, so the pixels stay square and sharp: the Cooking Pot at
// ×14 on a campfire at ×8, with a Tomato Soup and a Tomato at ×8 on either side (grow, cook,
// eat). The background is drawn on an 8 px grid (50×50 cells) so it matches the ×8 icons: warm
// rays behind the pot and a band of tilled soil with a grass edge at the bottom. Colours are
// fixed hex values below. Checked for legibility scaled down to 64 px.
//
// Deterministic: the same textures give a byte-identical PNG.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { decodePng, encodePng } from "./gen-textures.mjs";
import { ROOT } from "./paths.mjs";

const ITEMS = path.join(ROOT, "packs/harvest_kitchen/resource/textures/hk/items");
const INGREDIENTS = path.join(ROOT, "art/harvest_kitchen/generated/ingredients");
const OUT = path.join(ROOT, "docs/harvest-kitchen/release/logo-400.png");

const SIZE = 400;
const CELL = 8; // background grid and the small icons' texel size
const GRID = SIZE / CELL; // 50

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const COLOURS = {
  rayLight: hex("#fbe9b7"),
  rayDark: hex("#f4d48a"),
  grassTop: hex("#8cc152"),
  grass: hex("#5e9a3a"),
  soilLight: hex("#7a4f2e"),
  soilDark: hex("#5b3820"),
  shadow: hex("#3b2414"),
};

/** Where things go, in pixels. Icons are placed by their 16×16 origin and drawn in list order
 *  (the pot after the campfire, so it sits on the flames). */
const LAYOUT = {
  /** Rays fan out from here (cell coordinates). */
  rayCentre: { x: 24.5, y: 22 },
  rays: 16,
  /** First cell row of the soil band (the grass edge), and how many grass rows. */
  groundRow: 37,
  grassRows: 2,
  icons: [
    { dir: INGREDIENTS, name: "campfire", scale: 8, x: 136, y: 236 },
    { dir: ITEMS, name: "cooking_pot", scale: 14, x: 88, y: 64 },
    { dir: ITEMS, name: "tomato_soup", scale: 8, x: 8, y: 260 },
    { dir: ITEMS, name: "tomato", scale: 8, x: 264, y: 252 },
  ],
  /** Hard drop shadow under each icon, in pixels (a whole number of the icon's texels). */
  shadow: { dx: 0, dy: 8, alpha: 0.45 },
};

function background() {
  const px = new Uint8Array(SIZE * SIZE * 4);
  const { rayCentre, rays, groundRow, grassRows } = LAYOUT;
  for (let gy = 0; gy < GRID; gy++)
    for (let gx = 0; gx < GRID; gx++) {
      let colour;
      if (gy >= groundRow + grassRows) colour = gy % 2 ? COLOURS.soilDark : COLOURS.soilLight;
      else if (gy === groundRow) colour = COLOURS.grassTop;
      else if (gy > groundRow) colour = COLOURS.grass;
      else {
        const a = Math.atan2(gy + 0.5 - rayCentre.y, gx + 0.5 - rayCentre.x);
        const sector = Math.floor(((a + Math.PI) / (2 * Math.PI)) * rays);
        colour = sector % 2 ? COLOURS.rayDark : COLOURS.rayLight;
      }
      for (let y = gy * CELL; y < (gy + 1) * CELL; y++)
        for (let x = gx * CELL; x < (gx + 1) * CELL; x++) {
          px.set(colour, (y * SIZE + x) * 4);
          px[(y * SIZE + x) * 4 + 3] = 255;
        }
    }
  return { w: SIZE, h: SIZE, px };
}

/** Draws `icon` ×`scale` at (ox, oy): nearest-neighbour, alpha-blended over `im`. `tint`
 *  replaces the colour (for the shadow). */
function blit(im, icon, scale, ox, oy, tint, alphaMul = 1) {
  for (let y = 0; y < icon.h * scale; y++)
    for (let x = 0; x < icon.w * scale; x++) {
      const tx = ox + x;
      const ty = oy + y;
      if (tx < 0 || ty < 0 || tx >= im.w || ty >= im.h) continue;
      const s = (Math.floor(y / scale) * icon.w + Math.floor(x / scale)) * 4;
      const a = (icon.px[s + 3] / 255) * alphaMul;
      if (a === 0) continue;
      const d = (ty * im.w + tx) * 4;
      for (let k = 0; k < 3; k++) {
        const src = tint ? tint[k] : icon.px[s + k];
        im.px[d + k] = Math.round(src * a + im.px[d + k] * (1 - a));
      }
      im.px[d + 3] = 255;
    }
}

function render() {
  const im = background();
  const { dx, dy, alpha } = LAYOUT.shadow;
  for (const { dir, name, scale, x, y } of LAYOUT.icons) {
    const icon = decodePng(readFileSync(path.join(dir, `${name}.png`)));
    if (!icon || icon.w !== 16 || icon.h !== 16) throw new Error(`${name}.png: want a 16×16 PNG`);
    blit(im, icon, scale, x + dx, y + dy, COLOURS.shadow, alpha);
    blit(im, icon, scale, x, y);
  }
  return encodePng(im);
}

const png = render();
if (process.argv.includes("--check")) {
  let same;
  try {
    same = readFileSync(OUT).equals(png);
  } catch {
    same = false; // no logo yet
  }
  console.log(`[make-logo] ${path.relative(ROOT, OUT)} ${same ? "up to date" : "differs"}`);
  process.exit(same ? 0 : 1);
}
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`[make-logo] wrote ${path.relative(ROOT, OUT)}`);

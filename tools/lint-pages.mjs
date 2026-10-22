// Checks the recipe book pages and pot status images against docs/harvest-kitchen/art-style.md
// ("Book pages").
//
//   node tools/lint-pages.mjs          (npm run book runs it after tools/gen-book-pages.mjs)
//
// The list of images comes from the pack's own pure modules (bookImageSpecs, potImageSpecs),
// the same ones the script uses to pick an image, so "every image the script can show exists"
// and "no orphan PNGs" are checked against what the game can actually ask for. Each image is also
// re-rendered in memory: a file that differs from the current render is stale.
//
// Readability is measured at the assumed display size: a CustomForm image at width 1 is about
// FORM_UI_WIDTH UI px wide (unproven, see blockers.md B18). The renderer records every icon and
// text run it draws (position, scale, colours); this checks their display size and contrast in
// the decoded PNG. Exits with code 1 when anything fails.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { decodePng } from "./gen-textures.mjs";
import { BOOK_SIZE, POT_SIZE, SCALE, renderAll, upscale } from "./gen-book-pages.mjs";
import { ROOT } from "./paths.mjs";

const RP = path.join(ROOT, "packs/harvest_kitchen/resource");

export const PAGE_LIMITS = {
  /** Assumed on-screen width of an image at width 1 in a CustomForm, in UI px (PC, GUI scale). */
  formUiWidth: 280,
  /** An icon must show at least this big (vanilla inventory icons are 16 UI px). */
  minIconUi: 16,
  /** Text glyphs (cap height) at least this tall (the game font is 7 UI px). */
  minGlyphUi: 7,
  /** WCAG contrast ratio for text and numbers against what's behind them. */
  minTextContrast: 4.5,
  /** The most contrasting pixel of an icon or silhouette against its slot or page. */
  minIconContrast: 2,
};

const SIZES = { book: BOOK_SIZE, pot: POT_SIZE };

const luminance = ([r, g, b]) => {
  const ch = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Pixel at art coordinates (x, y) of a decoded ×SCALE image. */
function at(png, x, y) {
  const i = (y * SCALE * png.w + x * SCALE) * 4;
  return [png.px[i], png.px[i + 1], png.px[i + 2], png.px[i + 3]];
}

function pixelsIn(png, el, pad = 0) {
  const out = [];
  const W = png.w / SCALE;
  const H = png.h / SCALE;
  for (let y = Math.max(0, el.y - pad); y < Math.min(H, el.y + el.h + pad); y++)
    for (let x = Math.max(0, el.x - pad); x < Math.min(W, el.x + el.w + pad); x++)
      out.push(at(png, x, y));
  return out;
}

function checkImage(page, png, problems) {
  const say = (msg) => problems.push(`${page.stem}: ${msg}`);
  const size = SIZES[page.kind];
  if (png.w !== size.w * SCALE || png.h !== size.h * SCALE) {
    say(`size ${png.w}×${png.h}, expected ${size.w * SCALE}×${size.h * SCALE}`);
    return;
  }
  // alpha 0 or 255; every SCALE×SCALE block one colour (integer scale, no smoothing); and
  // identical to the current render (else the file is stale)
  const got = new Uint32Array(png.px.buffer, png.px.byteOffset, png.w * png.h);
  const want = new Uint32Array(upscale(page.image, SCALE).px.buffer);
  let translucent = 0;
  let blurred = 0;
  let stale = 0;
  for (let i = 0; i < got.length; i++) {
    const a = png.px[i * 4 + 3];
    if (a !== 0 && a !== 255) translucent++;
    const x = i % png.w;
    const y = (i - x) / png.w;
    if (got[i] !== got[(y - (y % SCALE)) * png.w + x - (x % SCALE)]) blurred++;
    if (got[i] !== want[i]) stale++;
  }
  if (translucent) say(`${translucent} semi-transparent pixels`);
  if (blurred) say(`${blurred} pixels break the ${SCALE}×${SCALE} grid (not integer-scaled)`);
  if (stale) say(`${stale} pixels differ from the current render: run tools/gen-book-pages.mjs`);

  // readability at display size
  const uiPerArt = PAGE_LIMITS.formUiWidth / size.w;
  for (const el of page.elements) {
    const where = `${el.kind}${el.text ? ` "${el.text}"` : ""} at ${el.x},${el.y}`;
    if (el.kind === "text") {
      const ui = el.h * uiPerArt;
      if (ui < PAGE_LIMITS.minGlyphUi) say(`${where}: glyphs ${ui.toFixed(1)} UI px tall`);
      const px = pixelsIn(png, el);
      if (!px.some((p) => same(p, el.fg))) say(`${where}: text colour not found in the image`);
      if (!pixelsIn(png, el, 2).some((p) => same(p, el.bg))) {
        say(`${where}: background colour not found around the text`);
      }
      const c = contrast(el.fg, el.bg);
      if (c < PAGE_LIMITS.minTextContrast) say(`${where}: contrast ${c.toFixed(2)}`);
      continue;
    }
    const ui = Math.min(el.w, el.h) * uiPerArt;
    if (ui < PAGE_LIMITS.minIconUi) say(`${where}: shows ${ui.toFixed(1)} UI px`);
    if (el.kind === "ghost") continue; // faded on purpose; its "+N" is checked as text
    const best = Math.max(...pixelsIn(png, el).map((p) => contrast(p, el.bg)));
    if (best < PAGE_LIMITS.minIconContrast) say(`${where}: best contrast ${best.toFixed(2)}`);
  }
}

async function main() {
  const { pages } = await renderAll();
  const problems = [];
  let bytes = 0;
  const expected = new Map();
  for (const page of pages) {
    const file = path.join(RP, page.dir, `${page.stem}.png`);
    if (!expected.has(page.dir)) expected.set(page.dir, new Set());
    expected.get(page.dir).add(`${page.stem}.png`);
    if (!existsSync(file)) {
      problems.push(`${page.stem}: missing ${path.relative(ROOT, file)} (the script can show it)`);
      continue;
    }
    bytes += statSync(file).size;
    const png = decodePng(readFileSync(file));
    if (!png) problems.push(`${page.stem}: can't decode`);
    else checkImage(page, png, problems);
  }
  for (const [dir, files] of expected) {
    for (const file of readdirSync(path.join(RP, dir))) {
      if (!files.has(file)) problems.push(`${dir}/${file}: orphan (no page or pot state uses it)`);
    }
  }
  const book = pages.filter((p) => p.kind === "book").length;
  const els = pages.reduce((n, p) => n + p.elements.length, 0);
  console.log(
    `[lint-pages] ${book} book pages, ${pages.length - book} pot images, ${els} icons/texts checked, ` +
      `${(bytes / 1024).toFixed(0)} KiB`,
  );
  for (const p of problems) console.log(`  ✘ ${p}`);
  if (problems.length > 0) {
    console.log(`[lint-pages] ${problems.length} problem(s)`);
    process.exitCode = 1;
  } else console.log("[lint-pages] all checks pass");
}

await main();

// Checks the recipe poster textures against docs/harvest-kitchen/art-style.md ("Recipe posters").
//
//   node tools/lint-posters.mjs        (npm run posters runs it after tools/gen-posters.mjs)
//
// The list of textures comes from the pack's own pure module (posters/poster-logic.ts), the same
// one the block JSON is generated from, so "every poster state has its two halves" and "no orphan
// PNGs" are checked against what the block can actually show. Each poster is also re-rendered in
// memory: a file that differs from the current render is stale.
//
// Readability is measured in texels at TEXELS_PER_BLOCK (64 per block): the renderer records every
// icon and text run it draws (position, scale, colours); this checks their size and contrast in
// the decoded PNGs (the two halves stitched back together). Exits with code 1 when anything fails.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { decodePng } from "./gen-textures.mjs";
import { HALF_SIZE, POSTER_SIZE, TEXELS_PER_BLOCK, renderAll } from "./gen-posters.mjs";
import { ROOT } from "./paths.mjs";

const RP = path.join(ROOT, "packs/harvest_kitchen/resource");

export const POSTER_LIMITS = {
  /**
   * Icons at least a quarter block (16 texels at 64 per block). From 4 blocks away on a 1080p
   * screen (FOV 70) a block is about 190 px tall, so an icon shows at about 48 px: the size of an
   * inventory icon at GUI scale 3.
   */
  minIconTexels: TEXELS_PER_BLOCK / 4,
  /** Text glyphs (cap height) at least the 7 px font at 1×: about 21 px tall from 4 blocks. */
  minGlyphTexels: 7,
  /** WCAG contrast ratio for text and numbers against what's behind them. */
  minTextContrast: 4.5,
  /** The most contrasting pixel of an icon against its slot or paper. */
  minIconContrast: 2,
};

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

function at(im, x, y) {
  const i = (y * im.w + x) * 4;
  return [im.px[i], im.px[i + 1], im.px[i + 2], im.px[i + 3]];
}

function pixelsIn(im, el, pad = 0) {
  const out = [];
  for (let y = Math.max(0, el.y - pad); y < Math.min(im.h, el.y + el.h + pad); y++)
    for (let x = Math.max(0, el.x - pad); x < Math.min(im.w, el.x + el.w + pad); x++)
      out.push(at(im, x, y));
  return out;
}

/** The two decoded halves side by side again. */
function stitch(halves) {
  const { w, h } = POSTER_SIZE;
  const px = new Uint8Array(w * h * 4);
  halves.forEach((half, i) => {
    for (let y = 0; y < h; y++) {
      px.set(half.px.subarray(y * HALF_SIZE * 4, (y + 1) * HALF_SIZE * 4), (y * w + i * HALF_SIZE) * 4); // prettier-ignore
    }
  });
  return { w, h, px };
}

function checkHalf(stem, png, want, say) {
  if (png.w !== HALF_SIZE || png.h !== HALF_SIZE) {
    say(`${stem}: size ${png.w}×${png.h}, expected ${HALF_SIZE}×${HALF_SIZE}`);
    return false;
  }
  let notOpaque = 0;
  let stale = 0;
  for (let i = 0; i < png.w * png.h; i++) {
    if (png.px[i * 4 + 3] !== 255) notOpaque++;
    for (let k = 0; k < 4; k++) {
      if (png.px[i * 4 + k] !== want.px[i * 4 + k]) {
        stale++;
        break;
      }
    }
  }
  // An opaque block face shows every pixel; a transparent or semi-transparent one would render
  // as whatever colour it carries, so the texture must be fully opaque.
  if (notOpaque) say(`${stem}: ${notOpaque} pixels aren't fully opaque`);
  if (stale) say(`${stem}: ${stale} pixels differ from the current render: run tools/gen-posters.mjs`); // prettier-ignore
  return true;
}

function checkReadability(poster, im, say) {
  for (const el of poster.elements) {
    const where = `${poster.stem}: ${el.kind}${el.text ? ` "${el.text}"` : ""} at ${el.x},${el.y}`;
    if (el.kind === "text") {
      if (el.h < POSTER_LIMITS.minGlyphTexels) say(`${where}: glyphs ${el.h} texels tall`);
      if (!pixelsIn(im, el).some((p) => same(p, el.fg))) say(`${where}: text colour not found`);
      if (!pixelsIn(im, el, 2).some((p) => same(p, el.bg))) say(`${where}: background not found`);
      const c = contrast(el.fg, el.bg);
      if (c < POSTER_LIMITS.minTextContrast) say(`${where}: contrast ${c.toFixed(2)}`);
      continue;
    }
    const size = Math.min(el.w, el.h);
    if (size < POSTER_LIMITS.minIconTexels) say(`${where}: ${size} texels`);
    const best = Math.max(...pixelsIn(im, el).map((p) => contrast(p, el.bg)));
    if (best < POSTER_LIMITS.minIconContrast) say(`${where}: best contrast ${best.toFixed(2)}`);
  }
}

function checkTerrain(posters, say) {
  const terrain = JSON.parse(readFileSync(path.join(RP, "textures/terrain_texture.json"), "utf8"));
  const entries = terrain.texture_data;
  const want = new Map(posters.flatMap((p) => p.halves.map((h) => [h.texture.shortname, h])));
  for (const [shortname, h] of want) {
    if (entries[shortname]?.textures !== h.texture.path) {
      say(`terrain_texture.json: ${shortname} should point to ${h.texture.path}`);
    }
  }
  for (const key of Object.keys(entries)) {
    if (key.startsWith("hk_poster_") && !want.has(key)) say(`terrain_texture.json: orphan ${key}`);
  }
  if (terrain.num_mip_levels !== 4 || terrain.padding !== 8) {
    say("terrain_texture.json: the posters assume num_mip_levels 4 and padding 8 (vanilla)");
  }
}

async function main() {
  const { data, posters } = await renderAll();
  const problems = [];
  const say = (msg) => problems.push(msg);
  const dir = path.join(RP, data.POSTER_TEXTURE_DIR);
  const expected = new Set();
  let bytes = 0;
  let measured = 0;
  for (const poster of posters) {
    const decoded = [];
    for (const half of poster.halves) {
      const file = path.join(dir, `${half.stem}.png`);
      expected.add(`${half.stem}.png`);
      if (!existsSync(file)) {
        say(`${half.stem}: missing ${path.relative(ROOT, file)} (the block can show it)`);
        continue;
      }
      bytes += statSync(file).size;
      const png = decodePng(readFileSync(file));
      if (!png) say(`${half.stem}: can't decode`);
      else if (checkHalf(half.stem, png, half.image, say)) decoded.push(png);
    }
    if (decoded.length === poster.halves.length) {
      checkReadability(poster, stitch(decoded), say);
      measured += poster.elements.length;
    }
  }
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (!expected.has(file)) say(`${data.POSTER_TEXTURE_DIR}/${file}: orphan (no poster state)`);
    }
  }
  checkTerrain(posters, say);
  console.log(
    `[lint-posters] ${posters.length} posters, ${expected.size} textures, ${measured} icons/texts ` +
      `checked, ${(bytes / 1024).toFixed(0)} KiB`,
  );
  for (const p of problems) console.log(`  ✘ ${p}`);
  if (problems.length > 0) {
    console.log(`[lint-posters] ${problems.length} problem(s)`);
    process.exitCode = 1;
  } else console.log("[lint-posters] all checks pass");
}

await main();

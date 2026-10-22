// Checks the generated Harvest Kitchen textures against docs/harvest-kitchen/art-style.md and
// writes a review sheet.
//
//   node tools/lint-textures.mjs
//
// Reads art/harvest_kitchen/generated/{items,ui,blocks}/*.png (in the generator's sprite order),
// prints every failed check, and writes generated/review_sheet.png + review_sheet.txt.
// Exits with code 1 when anything fails. Plain Node, no dependencies.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SPRITES, decodePng, encodePng, vanillaTextures } from "./gen-textures.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GEN_DIR = path.join(ROOT, "art/harvest_kitchen/generated");
const S = 16;

// Calibrated on vanilla 1.26.52 icons (see art-style.md).
const LIMITS = {
  minColours: 3,
  maxColours: 10, // icons; vanilla items mostly use 7-10
  maxColoursPlant: 8, // crop stages
  minSide: 10,
  maxSide: 15,
  minGreyRange: 80, // icons; vanilla items 63-164, most above 90
  minGreyRangeYoung: 35, // crop stages 0-2; vanilla young crops 37-60
  minGreyRangeMature: 70, // last crop stage; vanilla mature crops 68-97
  similarIou: 0.8,
  similarHue: 20,
};
const VANILLA_REFS = ["apple", "carrot", "seeds_wheat", "mushroom_stew", "bread"];

// ---------------------------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------------------------

const grey = (px, i) => 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
const colourKey = (px, i) => (px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2];

function profileOf(folder, name) {
  if (folder === "items" || folder === "ui") return "icon";
  if (/_stage_\d+$/.test(name)) return "plant";
  return "face";
}

function analyse(img) {
  const { w, h, px } = img;
  const opaque = new Array(w * h).fill(false);
  const colours = new Set();
  let semi = 0;
  let [minX, minY, maxX, maxY] = [w, h, -1, -1];
  let [gMin, gMax] = [255, 0];
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3];
    if (a > 0 && a < 255) semi++;
    if (a === 0) continue;
    opaque[i] = true;
    colours.add(colourKey(px, i));
    const x = i % w;
    const y = Math.floor(i / w);
    [minX, minY, maxX, maxY] = [
      Math.min(minX, x),
      Math.min(minY, y),
      Math.max(maxX, x),
      Math.max(maxY, y),
    ];
    const g = grey(px, i);
    [gMin, gMax] = [Math.min(gMin, g), Math.max(gMax, g)];
  }
  const orphans = [];
  for (let i = 0; i < w * h; i++) {
    if (!opaque[i]) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    let alone = true;
    for (let dy = -1; dy <= 1 && alone; dy++)
      for (let dx = -1; dx <= 1 && alone; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && opaque[ny * w + nx])
          alone = false;
      }
    if (alone) orphans.push([x, y]);
  }
  const side = maxX < 0 ? 0 : Math.max(maxX - minX + 1, maxY - minY + 1);
  const box = maxX < 0 ? "empty" : `${maxX - minX + 1}x${maxY - minY + 1}`;
  return {
    opaque,
    colours: colours.size,
    semi,
    side,
    box,
    greyRange: Math.round(gMax - gMin),
    orphans,
  };
}

function checks(t) {
  const a = t.stats;
  const fails = [];
  if (a.semi) fails.push(`${a.semi} semi-transparent pixel(s)`);
  if (t.profile === "face") return fails;
  const maxColours = t.profile === "icon" ? LIMITS.maxColours : LIMITS.maxColoursPlant;
  if (a.colours < LIMITS.minColours || a.colours > maxColours)
    fails.push(`${a.colours} colours (want ${LIMITS.minColours}-${maxColours})`);
  if (t.profile === "icon" && (a.side < LIMITS.minSide || a.side > LIMITS.maxSide))
    fails.push(`bounding box ${a.box} (longest side ${LIMITS.minSide}-${LIMITS.maxSide})`);
  if (a.orphans.length)
    fails.push(`orphan pixel(s) at ${a.orphans.map(([x, y]) => `${x},${y}`).join(" ")}`);
  const minGrey =
    t.profile === "icon"
      ? LIMITS.minGreyRange
      : t.mature
        ? LIMITS.minGreyRangeMature
        : LIMITS.minGreyRangeYoung;
  if (a.greyRange < minGrey) fails.push(`grayscale range ${a.greyRange} (want >= ${minGrey})`);
  return fails;
}

function hsl(r, g, b) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return [(hue * 60 + 360) % 360, s, l];
}

/** Dominant hue (degrees) of the chromatic pixels among `idx`, or null when there are too few. */
function dominantHue(img, idx) {
  const bins = new Array(36).fill(0);
  const hues = [];
  for (const i of idx) {
    if (!img.px[i * 4 + 3]) continue;
    const [hue, s, l] = hsl(img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]);
    if (s < 0.25 || l < 0.1 || l > 0.92) continue;
    hues.push(hue);
    bins[Math.floor(hue / 10) % 36]++;
  }
  if (hues.length < 4) return null;
  const smooth = bins.map((v, k) => bins[(k + 35) % 36] + 2 * v + bins[(k + 1) % 36]);
  const peak = (smooth.indexOf(Math.max(...smooth)) + 0.5) * 10;
  // Circular mean of the hues near the peak.
  let [sx, sy] = [0, 0];
  for (const hue of hues) {
    if (hueDist(hue, peak) > 20) continue;
    sx += Math.cos((hue * Math.PI) / 180);
    sy += Math.sin((hue * Math.PI) / 180);
  }
  return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
}

function hueDist(a, b) {
  if (a === null && b === null) return 0;
  if (a === null || b === null) return 180;
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** Pairs of icons with a similar silhouette and the same dominant hue where they differ. */
function similarPairs(icons) {
  const pairs = [];
  for (let i = 0; i < icons.length; i++)
    for (let j = i + 1; j < icons.length; j++) {
      const [a, b] = [icons[i], icons[j]];
      let [inter, uni] = [0, 0];
      const differ = [];
      for (let k = 0; k < S * S; k++) {
        const [oa, ob] = [a.stats.opaque[k], b.stats.opaque[k]];
        if (oa && ob) inter++;
        if (oa || ob) uni++;
        if ((oa || ob) && (oa !== ob || colourKey(a.img.px, k) !== colourKey(b.img.px, k)))
          differ.push(k);
      }
      const iou = uni ? inter / uni : 0;
      if (iou < LIMITS.similarIou) continue;
      const ha = dominantHue(a.img, differ);
      const hb = dominantHue(b.img, differ);
      const dist = hueDist(ha, hb);
      if (dist <= LIMITS.similarHue || differ.length < 8)
        pairs.push({ a, b, iou, ha, hb, dist, differ: differ.length });
    }
  return pairs;
}

// ---------------------------------------------------------------------------------------------
// Review sheet
// ---------------------------------------------------------------------------------------------

const PANEL = [0xc6, 0xc6, 0xc6];
const SLOT = [0x8b, 0x8b, 0x8b];
const SLOT_DARK = [0x37, 0x37, 0x37];
const SLOT_LIGHT = [0xff, 0xff, 0xff];
const INK = [0x3f, 0x3f, 0x3f];
const FLAG = [0xe0, 0x30, 0x30];

// 3×5 pixel font, rows top to bottom.
const FONT = {
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101010",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  Q: "010101101110011",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  Z: "111001010100111",
  0: "111101101101111",
  1: "010110010010111",
  2: "110001010100111",
  3: "110001010001110",
  4: "101101111001001",
  5: "111100110001110",
  6: "011100111101111",
  7: "111001010010010",
  8: "111101111101111",
  9: "111101111001110",
  "-": "000000111000000",
  ".": "000000000000010",
  "?": "110001010000010",
  " ": "000000000000000",
};
const FONT_SCALE = 2;
const CHAR_W = 4 * FONT_SCALE;
const LINE_H = 6 * FONT_SCALE;

const ZOOM = 4;
const SLOT_4X = 18 * ZOOM;
const CELL_W = SLOT_4X + 12;
const LABEL_CHARS = Math.floor(CELL_W / CHAR_W);

function canvas(w, h) {
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) px.set([...PANEL, 255], i * 4);
  const rect = (x, y, rw, rh, rgb) => {
    for (let yy = y; yy < y + rh; yy++)
      for (let xx = x; xx < x + rw; xx++)
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) px.set([...rgb, 255], (yy * w + xx) * 4);
  };
  return { w, h, px, rect };
}

/** Inventory slot (18 px at `scale`, dark top/left, light bottom/right) with `img` drawn inside. */
function drawSlot(cv, x, y, scale, img, mode) {
  const size = 18 * scale;
  cv.rect(x, y, size, size, SLOT);
  cv.rect(x, y, size, scale, SLOT_DARK);
  cv.rect(x, y, scale, size, SLOT_DARK);
  cv.rect(x, y + size - scale, size, scale, SLOT_LIGHT);
  cv.rect(x + size - scale, y, scale, size, SLOT_LIGHT);
  if (!img) return;
  for (let i = 0; i < S * S; i++) {
    const a = img.px[i * 4 + 3];
    if (!a) continue;
    let rgb = [img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]];
    if (mode === "grey") rgb = Array(3).fill(Math.round(grey(img.px, i)));
    if (mode === "silhouette") rgb = [0, 0, 0];
    const blend = rgb.map((v, k) => Math.round((v * a + SLOT[k] * (255 - a)) / 255));
    cv.rect(
      x + scale + (i % S) * scale,
      y + scale + Math.floor(i / S) * scale,
      scale,
      scale,
      blend,
    );
  }
}

function drawText(cv, x, y, text, rgb = INK) {
  [...text.toUpperCase()].forEach((ch, n) => {
    const glyph = FONT[ch] ?? FONT["?"];
    [...glyph].forEach((bit, k) => {
      if (bit === "1")
        cv.rect(
          x + n * CHAR_W + (k % 3) * FONT_SCALE,
          y + Math.floor(k / 3) * FONT_SCALE,
          FONT_SCALE,
          FONT_SCALE,
          rgb,
        );
    });
  });
}

/** Splits a snake_case name into label lines of at most LABEL_CHARS characters. */
function labelLines(name) {
  const lines = [];
  let line = "";
  for (let word of name.split("_")) {
    while (word.length > LABEL_CHARS) {
      if (line) lines.push(line);
      lines.push(word.slice(0, LABEL_CHARS));
      word = word.slice(LABEL_CHARS);
      line = "";
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= LABEL_CHARS) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadVanillaRefs() {
  try {
    const load = vanillaTextures();
    return VANILLA_REFS.map((name) => ({ name, img: load(`items/${name}`).img, vanilla: true }));
  } catch (error) {
    console.warn(`[lint-textures] no vanilla references: ${error.message}`);
    return [];
  }
}

function reviewSheet(groups, refs) {
  const PAD = 16;
  const SEP = 20;
  const rowsOf = (cols) => Math.max(...cols.map((t) => labelLines(t.name).length));
  const layout = groups.map((g) => {
    const cols = [...refs, ...g.items];
    const labelH = rowsOf(cols) * LINE_H;
    const h = LINE_H + 6 + (18 + 8) + (SLOT_4X + 4 + labelH + 8) + (SLOT_4X + 8) * 2;
    return { ...g, cols, labelH, h };
  });
  const w =
    PAD * 2 + Math.max(...layout.map((g) => g.cols.length)) * CELL_W + (refs.length ? SEP : 0);
  const h = PAD + layout.reduce((sum, g) => sum + g.h + PAD, 0);
  const cv = canvas(w, h);

  let y = PAD;
  for (const g of layout) {
    drawText(cv, PAD, y, g.title);
    const top = y + LINE_H + 6;
    g.cols.forEach((t, col) => {
      const x = PAD + col * CELL_W + (refs.length && !t.vanilla ? SEP : 0);
      let yy = top;
      drawSlot(cv, x, yy, 1, t.img);
      yy += 18 + 8;
      if (t.fails?.length || t.pairs?.length)
        cv.rect(x - 3, yy - 3, SLOT_4X + 6, SLOT_4X + 6, FLAG);
      drawSlot(cv, x, yy, ZOOM, t.img);
      labelLines(t.name).forEach((line, n) =>
        drawText(cv, x, yy + SLOT_4X + 4 + n * LINE_H, line, t.vanilla ? [0x70, 0x70, 0x70] : INK),
      );
      yy += SLOT_4X + 4 + g.labelH + 8;
      drawSlot(cv, x, yy, ZOOM, t.img, "grey");
      yy += SLOT_4X + 8;
      drawSlot(cv, x, yy, ZOOM, t.img, "silhouette");
    });
    if (refs.length)
      cv.rect(PAD + refs.length * CELL_W + SEP / 2 - 6, top, 2, g.h - LINE_H - 6, INK);
    y += g.h + PAD;
  }
  return encodePng({ w: cv.w, h: cv.h, px: cv.px });
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

function main() {
  const textures = [];
  for (const sprite of SPRITES) {
    const file = path.join(GEN_DIR, sprite.folder, `${sprite.name}.png`);
    if (!existsSync(file)) {
      textures.push({ ...sprite, profile: "missing", fails: ["file missing; run gen-textures"] });
      continue;
    }
    const img = decodePng(readFileSync(file));
    const t = { ...sprite, img, profile: profileOf(sprite.folder, sprite.name), pairs: [] };
    // The last stage of a crop is its mature look.
    const stage = /^(.*)_stage_(\d+)$/.exec(sprite.name);
    t.mature =
      !!stage &&
      !SPRITES.some(
        (o) => o.folder === sprite.folder && o.name === `${stage[1]}_stage_${+stage[2] + 1}`,
      );
    if (!img || img.w !== S || img.h !== S) t.fails = ["not a decodable 16x16 PNG"];
    else {
      t.stats = analyse(img);
      t.fails = checks(t);
    }
    textures.push(t);
  }

  const icons = textures.filter((t) => t.profile === "icon" && t.stats);
  const pairs = similarPairs(icons);
  for (const p of pairs) {
    p.a.pairs.push(p.b.name);
    p.b.pairs.push(p.a.name);
  }

  const lines = [];
  const failed = textures.filter((t) => t.fails.length);
  for (const t of failed) lines.push(`${t.folder}/${t.name}: ${t.fails.join("; ")}`);
  for (const p of pairs) {
    const hue = (v) => (v === null ? "grey" : `${Math.round(v)}°`);
    lines.push(
      `similar: ${p.a.name} ~ ${p.b.name} (silhouette IoU ${p.iou.toFixed(2)}, hue ${hue(p.ha)} vs ${hue(p.hb)}, ${p.differ} px differ)`,
    );
  }

  const groups = [];
  for (const t of icons) {
    let g = groups.find((x) => x.title === t.row);
    if (!g) groups.push((g = { title: t.row, items: [] }));
    g.items.push(t);
  }
  const refs = loadVanillaRefs();
  writeFileSync(path.join(GEN_DIR, "review_sheet.png"), reviewSheet(groups, refs));
  const index = [
    "Review sheet: per group, vanilla references (left), then each icon at 1x in a slot, 4x, 4x",
    "grayscale and 4x silhouette. Red frame = flagged by the linter.",
    "",
    ...groups.map((g) => `${g.title}: ${g.items.map((t) => t.name).join(", ")}`),
    "",
    "Per icon: colours, bounding box, grayscale range.",
    ...icons.map(
      (t) => `  ${t.name}: ${t.stats.colours} colours, ${t.stats.box}, grey ${t.stats.greyRange}`,
    ),
    "",
    lines.length ? "Problems:" : "Problems: none",
    ...lines.map((l) => `  ${l}`),
  ];
  writeFileSync(path.join(GEN_DIR, "review_sheet.txt"), index.join("\n") + "\n");

  const checked = textures.length;
  if (lines.length) {
    console.log(lines.join("\n"));
    console.log(
      `\n[lint-textures] ${failed.length} of ${checked} textures failed, ${pairs.length} similar pair(s)`,
    );
    process.exitCode = 1;
  } else console.log(`[lint-textures] ${checked} textures ok, no similar pairs`);
  console.log(
    `[lint-textures] wrote ${path.relative(ROOT, path.join(GEN_DIR, "review_sheet.png"))}`,
  );
}

main();

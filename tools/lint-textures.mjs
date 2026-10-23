// Checks the generated Simmerfield textures against docs/simmerfield/art-style.md and
// writes a review sheet.
//
//   node tools/lint-textures.mjs
//
// Reads art/simmerfield/generated/{items,ui,blocks}/*.png (in the generator's sprite order),
// prints every failed check, and writes generated/review_sheet.png + review_sheet.txt.
// Exits with code 1 when anything fails. Plain Node, no dependencies.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  SPRITES,
  decodePng,
  encodePng,
  loadPalette,
  renderSprite,
  vanillaTextures,
} from "./gen-textures.mjs";
import { gridFile } from "./pixels.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GEN_DIR = path.join(ROOT, "art/simmerfield/generated");
const S = 16;

// Calibrated on vanilla 1.26.52 icons (see art-style.md).
export const LIMITS = {
  minColours: 3,
  maxColours: 16, // icons; vanilla items mostly use 7-10, Farmer's Delight 13 (p90 22)
  maxColoursPlant: 8, // crop stages
  minSide: 10,
  maxSide: 15,
  minGreyRange: 80, // icons; vanilla items 63-164, most above 90
  minGreyRangeYoung: 35, // crop stages 0-2; vanilla young crops 37-60
  minGreyRangeMature: 70, // last crop stage; vanilla mature crops 68-97
  // Surface richness, calibrated on Farmer's Delight + Croptopia items (art-style.md
  // "Reference study"): their p90 flat patch is 12-14 px, median edge/inner 0.54-0.66,
  // p10 detail 0.62-0.72.
  maxFlatPx: 14,
  maxEdgeVsInner: 0.85,
  minDetail: 0.62,
  // UI symbols are clean metal, paper and glyphs: vanilla bucket, map, ingots, paper and compass
  // score 0.54-0.59. The flat-patch limit still stops flat clip-art.
  minDetailUi: 0.5,
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
  if (folder === "items" || folder === "ui" || folder === "ingredients") return "icon";
  if (/_stage_\d+$/.test(name)) return "plant";
  return "face";
}

export function analyse(img) {
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
    surface: maxX < 0 ? null : metrics(img),
  };
}

// ---------------------------------------------------------------------------------------------
// Surface metrics (art-style.md "Reference study"): what "reads richer" measures as, on opaque
// pixels, luma 0-255. tools/ref-sheet.mjs reports them for the reference mods too.
// ---------------------------------------------------------------------------------------------

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const hueDiff = (a, b) => ((b - a + 540) % 360) - 180;

export function metrics(img) {
  const at = (x, y) =>
    x >= 0 && y >= 0 && x < S && y < S && img.px[(y * S + x) * 4 + 3] ? (y * S + x) * 4 : -1;
  const key = (i) => (img.px[i] << 16) | (img.px[i + 1] << 8) | img.px[i + 2];
  const L = (i) => luma(img.px[i], img.px[i + 1], img.px[i + 2]);
  const pts = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (at(x, y) >= 0) pts.push([x, y]);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const colours = new Map();
  let pairs = 0;
  let changes = 0;
  const edge = [];
  const inner = [];
  const lit = []; // luma of edge pixels exposed on the top or left
  const shaded = []; // ... on the bottom or right
  for (const [x, y] of pts) {
    const i = at(x, y);
    colours.set(key(i), (colours.get(key(i)) ?? 0) + 1);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      const j = at(x + dx, y + dy);
      if (j < 0) continue;
      pairs++;
      if (key(i) !== key(j)) changes++;
    }
    const open = {
      t: at(x, y - 1) < 0,
      l: at(x - 1, y) < 0,
      b: at(x, y + 1) < 0,
      r: at(x + 1, y) < 0,
    };
    if (open.t || open.l || open.b || open.r) edge.push(L(i));
    else inner.push(L(i));
    if ((open.t || open.l) && !(open.b || open.r)) lit.push(L(i));
    if ((open.b || open.r) && !(open.t || open.l)) shaded.push(L(i));
  }
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  const lumas = pts.map(([x, y]) => L(at(x, y)));

  // Colour families: chromatic colours binned by hue (30°), greys in their own family.
  const fams = new Map();
  for (const [k, n] of colours) {
    const [h, s, l] = hsl(k >> 16, (k >> 8) & 255, k & 255);
    const fam = s < 0.15 || l < 0.08 ? "grey" : Math.round(h / 30) % 12;
    if (!fams.has(fam)) fams.set(fam, []);
    fams.get(fam).push({ h, s, l, n });
  }
  const famList = [...fams.entries()]
    .map(([fam, cs]) => ({ fam, cs, n: cs.reduce((s, c) => s + c.n, 0) }))
    .sort((a, b) => b.n - a.n);
  const main = famList.find((f) => f.fam !== "grey") ?? famList[0];
  const ramp = [...main.cs].sort((a, b) => a.l - b.l);
  // Hue shift of the main ramp: lightest vs darkest shade. Positive = the highlight sits nearer
  // yellow (60°) than the shadow does, i.e. warm highlights / cool shadows.
  const dark = ramp[0];
  const light = ramp.at(-1);
  const toYellow = (h) => Math.abs(hueDiff(h, 60));
  const shift = ramp.length > 1 ? Math.abs(hueDiff(dark.h, light.h)) : 0;
  const warmth = ramp.length > 1 ? toYellow(dark.h) - toYellow(light.h) : 0;

  // Highlight placement: centroid of the brightest 10% of pixels, in bbox units (-1..1).
  const sorted = pts.map((p, n) => ({ p, l: lumas[n] })).sort((a, b) => b.l - a.l);
  const top = sorted.slice(0, Math.max(1, Math.round(pts.length * 0.1)));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = mean(top.map((t) => (t.p[0] - cx) / Math.max(1, (x1 - x0) / 2)));
  const hy = mean(top.map((t) => (t.p[1] - cy) / Math.max(1, (y1 - y0) / 2)));

  // Largest 4-connected patch of one colour, as a share of the painted pixels.
  const seen = new Set();
  let flat = 0;
  for (const [x, y] of pts) {
    if (seen.has(y * S + x)) continue;
    const k = key(at(x, y));
    const todo = [[x, y]];
    let n = 0;
    seen.add(y * S + x);
    while (todo.length) {
      const [px, py] = todo.pop();
      n++;
      for (const [nx, ny] of [
        [px + 1, py],
        [px - 1, py],
        [px, py + 1],
        [px, py - 1],
      ]) {
        const j = at(nx, ny);
        if (j < 0 || seen.has(ny * S + nx) || key(j) !== k) continue;
        seen.add(ny * S + nx);
        todo.push([nx, ny]);
      }
    }
    flat = Math.max(flat, n);
  }

  return {
    longest: Math.max(x1 - x0, y1 - y0) + 1,
    flat: flat / pts.length,
    flatPx: flat,
    coverage: pts.length / (S * S), // share of the 16×16 canvas that is painted
    bboxFill: pts.length / ((x1 - x0 + 1) * (y1 - y0 + 1)),
    colours: colours.size,
    families: famList.length,
    mainShades: ramp.length, // shades in the dominant hue family
    detail: pairs ? changes / pairs : 0, // neighbour pairs that change colour
    edgeVsInner: mean(edge) / mean(inner), // < 1: the edge is darker than the inside
    darkEdge: edge.filter((l) => l < 45).length / Math.max(1, edge.length), // near-black edge
    edgeTLminusBR: mean(lit) - mean(shaded), // > 0: light from the top left on the outline
    lumaRange: Math.max(...lumas) - Math.min(...lumas),
    hueShift: shift,
    warmth,
    highlight: [hx, hy],
    sat: mean(pts.map(([x, y]) => hsl(...img.px.subarray(at(x, y), at(x, y) + 3))[1])),
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
  const m = a.surface;
  if (t.profile === "icon" && m) {
    if (m.flatPx > LIMITS.maxFlatPx)
      fails.push(`flat patch of ${m.flatPx} px in one colour (want <= ${LIMITS.maxFlatPx})`);
    if (m.edgeVsInner > LIMITS.maxEdgeVsInner)
      fails.push(
        `edge/inner brightness ${m.edgeVsInner.toFixed(2)} (want <= ${LIMITS.maxEdgeVsInner}: a darker edge)`,
      );
    const minDetail = t.folder === "ui" ? LIMITS.minDetailUi : LIMITS.minDetail;
    if (m.detail < minDetail) fails.push(`detail ${m.detail.toFixed(2)} (want >= ${minDetail})`);
  }
  return fails;
}

export function hsl(r, g, b) {
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

/** Checks one icon image as the full lint would (pixels.mjs --preview). */
/** The last stage of a crop is its mature look. */
const isMature = (sprite) => {
  const stage = /^(.*)_stage_(\d+)$/.exec(sprite.name);
  return (
    !!stage &&
    !SPRITES.some(
      (o) => o.folder === sprite.folder && o.name === `${stage[1]}_stage_${+stage[2] + 1}`,
    )
  );
};

export function lintOne(sprite, img) {
  const t = { ...sprite, img, profile: profileOf(sprite.folder, sprite.name) };
  t.mature = isMature(t);
  t.stats = analyse(img);
  return { stats: t.stats, fails: checks(t) };
}

/** Similar-pair findings of one icon against `others` ([{sprite, img}]), as text. */
export function similarTo(sprite, img, others) {
  const wrap = (s, im) => ({ ...s, img: im, stats: analyse(im) });
  const me = wrap(sprite, img);
  const hue = (v) => (v === null ? "grey" : `${Math.round(v)}°`);
  return others.flatMap((o) =>
    similarPairs([me, wrap(o.sprite, o.img)]).map(
      (p) =>
        `${sprite.name} ~ ${o.sprite.name} (IoU ${p.iou.toFixed(2)}, hue ${hue(p.ha)} vs ${hue(p.hb)}, ${p.differ} px differ)`,
    ),
  );
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
  _: "000000000000111",
  ":": "000010000010000",
  "|": "010010010010010",
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

export function canvas(w, h) {
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
export function drawSlot(cv, x, y, scale, img, mode) {
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

export function drawText(cv, x, y, text, rgb = INK) {
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

/** Splits a snake_case name into label lines of at most `max` characters. */
export function labelLines(name, max = LABEL_CHARS) {
  const lines = [];
  let line = "";
  for (let word of name.split("_")) {
    while (word.length > max) {
      if (line) lines.push(line);
      lines.push(word.slice(0, max));
      word = word.slice(max);
      line = "";
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= max) line += " " + word;
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

/** Hand-authored icons (t.before set) get two columns: the procedural "before" on the left, a
 *  thin rule, and the grid "after" on the right, in every row. */
function reviewSheet(groups, refs) {
  const PAD = 16;
  const SEP = 20;
  const PAIR_GAP = 10;
  const widthOf = (t) => (t.before ? CELL_W + SLOT_4X + PAIR_GAP : CELL_W);
  const labelsOf = (t) => labelLines(t.name, Math.floor((widthOf(t) - 12) / CHAR_W));
  const layout = groups.map((g) => {
    const cols = [...refs, ...g.items];
    const labelH = Math.max(...cols.map((t) => labelsOf(t).length)) * LINE_H;
    const h = LINE_H + 6 + (18 + 8) + (SLOT_4X + 4 + labelH + 8) + (SLOT_4X + 8) * 2;
    const width = cols.reduce((sum, t) => sum + widthOf(t), 0);
    return { ...g, cols, labelH, h, width };
  });
  const w = PAD * 2 + Math.max(...layout.map((g) => g.width)) + (refs.length ? SEP : 0);
  const h = PAD + layout.reduce((sum, g) => sum + g.h + PAD, 0);
  const cv = canvas(w, h);
  const DIM = [0x70, 0x70, 0x70];

  let y = PAD;
  for (const g of layout) {
    const paired = g.items.some((t) => t.before);
    drawText(cv, PAD, y, paired ? `${g.title}   - each icon: before | after` : g.title);
    const top = y + LINE_H + 6;
    let x = PAD;
    g.cols.forEach((t, col) => {
      if (col === refs.length && refs.length) x += SEP;
      const views = t.before ? [t.before, t.img] : [t.img];
      const xs = views.map((_, k) => x + k * (SLOT_4X + PAIR_GAP));
      let yy = top;
      views.forEach((img, k) => drawSlot(cv, xs[k], yy, 1, img));
      yy += 18 + 8;
      if (t.fails?.length || t.pairs?.length)
        cv.rect(xs.at(-1) - 3, yy - 3, SLOT_4X + 6, SLOT_4X + 6, FLAG);
      views.forEach((img, k) => drawSlot(cv, xs[k], yy, ZOOM, img));
      labelsOf(t).forEach((line, n) =>
        drawText(cv, x, yy + SLOT_4X + 4 + n * LINE_H, line, t.vanilla ? DIM : INK),
      );
      const rowsTop = yy;
      yy += SLOT_4X + 4 + g.labelH + 8;
      views.forEach((img, k) => drawSlot(cv, xs[k], yy, ZOOM, img, "grey"));
      yy += SLOT_4X + 8;
      views.forEach((img, k) => drawSlot(cv, xs[k], yy, ZOOM, img, "silhouette"));
      if (t.before) {
        const rx = x + SLOT_4X + PAIR_GAP / 2 - 1;
        cv.rect(rx, top, 1, 18, DIM);
        cv.rect(rx, rowsTop, 1, SLOT_4X, DIM);
        cv.rect(rx, yy - SLOT_4X - 8, 1, SLOT_4X * 2 + 8, DIM);
      }
      x += widthOf(t);
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
    t.mature = isMature(sprite);
    if (!img || img.w !== S || img.h !== S) t.fails = ["not a decodable 16x16 PNG"];
    else {
      t.stats = analyse(img);
      t.fails = checks(t);
    }
    textures.push(t);
  }

  const icons = textures.filter((t) => t.profile === "icon" && t.stats);
  // Hand-authored icons: show the procedural drawing they replaced next to them.
  loadPalette();
  for (const t of icons)
    if (existsSync(gridFile(t.name))) {
      const layer = renderSprite(t, { procedural: true });
      const px = new Uint8Array(S * S * 4);
      layer.forEach((v, i) => v && px.set(v, i * 4));
      t.before = { w: S, h: S, px };
    }
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
    "grayscale and 4x silhouette. Red frame = flagged by the linter. Hand-authored icons",
    "(art/simmerfield/pixels/) show the procedural drawing they replaced on the left.",
    "",
    ...groups.map((g) => `${g.title}: ${g.items.map((t) => t.name).join(", ")}`),
    "",
    "Per icon: colours, bounding box, grayscale range, largest flat patch, edge/inner, detail.",
    ...icons.map(
      ({ name, stats: a }) =>
        `  ${name}: ${a.colours} colours, ${a.box}, grey ${a.greyRange}, flat ${a.surface.flatPx}, ` +
        `edge ${a.surface.edgeVsInner.toFixed(2)}, detail ${a.surface.detail.toFixed(2)}`,
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

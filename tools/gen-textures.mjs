// Harvest Kitchen texture generator (plan §4.5, steps 1 and 2). Plain Node, no dependencies.
//
//   node tools/gen-textures.mjs             draw every texture from palette.json
//   node tools/gen-textures.mjs --palette   re-sample palette.json from the installed game first
//
// Output: art/harvest_kitchen/generated/ (never final/, which is hand touch-up).
// --palette reads the vanilla resource packs of the installed game (MC_VERSIONS_DIR and
// MC_GAME_VERSION override the defaults) and needs no network.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { checkGridNames, gridFile, readGrid } from "./pixels.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ART_DIR = path.join(ROOT, "art/harvest_kitchen");
const OUT_DIR = path.join(ART_DIR, "generated");
const PALETTE_FILE = path.join(ART_DIR, "palette.json");
const POT_TEXTURES = path.join(ART_DIR, "models/cooking_pot/textures");

const GAME_VERSION = process.env.MC_GAME_VERSION ?? "1.26.52.3";
const VERSIONS_DIR =
  process.env.MC_VERSIONS_DIR ??
  path.join(os.homedir(), ".var/app/io.mrarm.mcpelauncher/data/mcpelauncher/versions");

// ---------------------------------------------------------------------------------------------
// PNG codec (RGBA out; decodes 8-bit grey/RGB/palette/grey+alpha/RGBA, non-interlaced)
// ---------------------------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** @param {{w: number, h: number, px: Uint8Array}} img RGBA, row-major */
export function encodePng(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0; // filter: none
    Buffer.from(img.px.buffer, img.px.byteOffset + y * img.w * 4, img.w * 4).copy(
      raw,
      y * (img.w * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Returns null for PNG variants we don't need (16-bit, sub-byte depth, interlaced). */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (name === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (name === "PLTE") plte = data;
    else if (name === "tRNS") trns = data;
    else if (name === "IDAT") idat.push(data);
    else if (name === "IEND") break;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (depth !== 8 || interlace !== 0 || !channels) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const pixels = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * stride + x] = v & 0xff;
    }
  }
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * channels;
    let rgba;
    if (type === 0) rgba = [pixels[s], pixels[s], pixels[s], 255];
    else if (type === 2) rgba = [pixels[s], pixels[s + 1], pixels[s + 2], 255];
    else if (type === 3) {
      const k = pixels[s];
      rgba = [
        plte[k * 3],
        plte[k * 3 + 1],
        plte[k * 3 + 2],
        trns && k < trns.length ? trns[k] : 255,
      ];
    } else if (type === 4) rgba = [pixels[s], pixels[s], pixels[s], pixels[s + 1]];
    else rgba = [pixels[s], pixels[s + 1], pixels[s + 2], pixels[s + 3]];
    px.set(rgba, i * 4);
  }
  return { w, h, px };
}

// ---------------------------------------------------------------------------------------------
// Vanilla texture lookup. Since ~1.26 the game ships textures inside .brarchive files:
//   16-byte header (8 magic, u32 count, u32 version), then count × 256-byte entries
//   (u8 name length, 247-byte name, u32 offset, u32 size), then the data blob.
// Resource packs layer: a file in vanilla_<newer> overrides the same path in older ones.
// ---------------------------------------------------------------------------------------------

export function readBrarchive(file) {
  const b = readFileSync(file);
  const count = b.readUInt32LE(8);
  const base = 16 + count * 256;
  const files = new Map();
  for (let i = 0; i < count; i++) {
    const e = 16 + i * 256;
    const name = b.toString("utf8", e + 1, e + 1 + b[e]);
    const off = b.readUInt32LE(e + 248);
    const size = b.readUInt32LE(e + 252);
    files.set(name, b.subarray(base + off, base + off + size));
  }
  return files;
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function vanillaTextures() {
  const rpDir = path.join(VERSIONS_DIR, GAME_VERSION, "assets/assets/resource_packs");
  if (!existsSync(rpDir)) throw new Error(`No vanilla resource packs at ${rpDir}`);
  // Newest layer first, base "vanilla" last.
  const layers = readdirSync(rpDir)
    .filter((d) => /^vanilla(_\d+(\.\d+)*)?$/.test(d))
    .sort((a, b) => {
      const va = a === "vanilla" ? "0" : a.slice(8);
      const vb = b === "vanilla" ? "0" : b.slice(8);
      return compareVersions(vb, va);
    });
  const cache = new Map();
  /** @param {string} texPath e.g. "blocks/carrots_stage_3" (no extension) */
  return function load(texPath) {
    const dir = path.dirname(texPath);
    const name = `${path.basename(texPath)}.png`;
    for (const layer of layers) {
      for (const candidate of [
        path.join(rpDir, layer, "textures", dir, name),
        path.join(rpDir, layer, "__brarchive/textures", `${dir}.brarchive`),
      ]) {
        if (!existsSync(candidate)) continue;
        let data;
        if (candidate.endsWith(".png")) data = readFileSync(candidate);
        else {
          if (!cache.has(candidate)) cache.set(candidate, readBrarchive(candidate));
          data = cache.get(candidate).get(name);
        }
        if (data) {
          const img = decodePng(data);
          if (img) return { img, source: `${layer}/textures/${texPath}.png` };
        }
      }
    }
    throw new Error(`Vanilla texture not found or not decodable: ${texPath}`);
  };
}

// ---------------------------------------------------------------------------------------------
// Palette (step 1). Each ramp samples real pixels from one or more vanilla textures, filtered by
// hue/saturation/lightness, and keeps `n` shades dark → light. Only colours that vanilla actually
// uses end up in a ramp; nothing is interpolated.
// ---------------------------------------------------------------------------------------------

const RAMP_SPECS = {
  // Crops (plan §4: one dominant colour per crop).
  tomato: { from: ["items/apple"], hue: [340, 15], sat: [50, 100] },
  onion: { from: ["items/potato_baked"], hue: [25, 50], sat: [56, 100] },
  onion_flesh: { from: ["items/egg"] },
  cucumber: { from: ["blocks/melon_side"] },
  cucumber_flesh: { from: ["items/slimeball"] },
  chili: { from: ["blocks/flower_rose", "blocks/flower_tulip_red"], hue: [350, 20] },
  // Pink (≈340°), not red: keeps strawberry apart from tomato (art-style.md "distinct hues").
  strawberry: {
    from: ["items/dye_powder_pink", "blocks/glazed_terracotta_pink"],
    hue: [315, 350],
    sat: [30, 100],
  },
  leaf: { from: ["blocks/carrots_stage_3"], hue: [80, 140] },
  bush: { from: ["blocks/sweet_berry_bush_stage2"], hue: [110, 160] },
  // The only purple crop (plan §1.1, D2b).
  eggplant: { from: ["items/dye_powder_purple"], hue: [260, 320] },
  flower_yellow: { from: ["blocks/flower_dandelion"], hue: [25, 60], n: 4 },
  flower_white: { from: ["blocks/flower_oxeye_daisy"], sat: [0, 30], n: 3 },
  dirt: { from: ["blocks/dirt"], sat: [20, 100], n: 4 },
  // Vanilla ingredients that show up inside dishes.
  carrot: { from: ["items/carrot"], hue: [15, 40] },
  potato: { from: ["items/potato"] },
  bread: { from: ["items/bread"] },
  pork: { from: ["items/porkchop_cooked"] },
  meat: { from: ["items/mutton_cooked"] },
  fish: { from: ["items/fish_salmon_cooked"], hue: [10, 30], sat: [40, 100] },
  chicken: { from: ["items/chicken_cooked"] },
  beet: { from: ["items/beetroot"] },
  stew: { from: ["items/rabbit_stew"], hue: [10, 25] },
  sugar: { from: ["items/sugar"], n: 4 },
  cream: { from: ["items/cake"], hue: [30, 60], n: 3 },
  sponge: { from: ["blocks/cake_side"], hue: [10, 30] },
  frosting: { from: ["items/dye_powder_pink"], hue: [300, 350], n: 4 },
  // Station and container materials.
  wood: { from: ["blocks/planks_oak"] },
  bark: { from: ["blocks/log_oak"] },
  bowl: { from: ["items/bowl"] },
  copper: { from: ["items/copper_ingot"] },
  iron: { from: ["items/iron_ingot"] },
  glass: { from: ["items/potion_bottle_empty"], hue: [195, 225] },
  cork: { from: ["items/potion_bottle_empty"], hue: [5, 25], n: 4 },
  leather: { from: ["items/book_normal"], hue: [25, 45] },
  paper: { from: ["items/paper"] },
  fire: { from: ["blocks/fire_0"], hue: [15, 60], light: [0, 95] },
  // Effect families (§1.4): reserved for effect accents.
  family_heal: { from: ["ui/heart_new", "ui/heart"], hue: [350, 10], sat: [50, 100] },
  family_move: { from: ["items/dye_powder_blue_new"], hue: [200, 240] },
  family_work: { from: ["items/gold_ingot"], hue: [20, 60] },
  family_explore: { from: ["items/emerald"] },
};

function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

const luminance = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const toHex = (c) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function inRange(v, [lo, hi], wrap) {
  if (!wrap || lo <= hi) return v >= lo && v <= hi;
  return v >= lo || v <= hi; // hue range across 0°
}

/** Picks n real colours spanning dark → light: the darkest, the lightest, and for each of the
 *  n − 2 equal-width luminance bins in between, its most common colour (or, if the bin is empty,
 *  the unused colour nearest its centre). Single stray pixels are ignored when possible. */
function pickRamp(counts, n) {
  let colours = [...counts].map(([hex, count]) => ({ hex, count, lum: luminance(fromHex(hex)) }));
  if (colours.filter((c) => c.count >= 2).length >= n)
    colours = colours.filter((c) => c.count >= 2);
  colours.sort((a, b) => a.lum - b.lum);
  if (colours.length <= n) return colours.map((c) => c.hex);
  const lo = colours[0];
  const hi = colours.at(-1);
  const picks = [lo, hi];
  const step = (hi.lum - lo.lum) / (n - 1);
  for (let i = 1; i < n - 1; i++) {
    const from = lo.lum + step * (i - 0.5);
    const to = lo.lum + step * (i + 0.5);
    const free = colours.filter((c) => !picks.includes(c));
    const inBin = free.filter((c) => c.lum >= from && c.lum < to);
    const centre = lo.lum + step * i;
    picks.push(
      inBin.length
        ? inBin.reduce((best, c) => (c.count > best.count ? c : best))
        : free.reduce((best, c) =>
            Math.abs(c.lum - centre) < Math.abs(best.lum - centre) ? c : best,
          ),
    );
  }
  return picks.sort((a, b) => a.lum - b.lum).map((c) => c.hex);
}

function samplePalette() {
  const load = vanillaTextures();
  const ramps = {};
  for (const [name, spec] of Object.entries(RAMP_SPECS)) {
    const counts = new Map();
    const sources = [];
    for (const texPath of spec.from) {
      const { img, source } = load(texPath);
      sources.push(source);
      for (let i = 0; i < img.w * img.h; i++) {
        if (img.px[i * 4 + 3] < 128) continue;
        const rgb = [img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]];
        const [h, s, l] = rgbToHsl(rgb);
        if (spec.hue && (s < 5 || !inRange(h, spec.hue, true))) continue;
        if (spec.sat && !inRange(s, spec.sat)) continue;
        if (spec.light && !inRange(l, spec.light)) continue;
        if (!spec.light && (l < 3 || (l > 99 && !spec.sat))) continue; // drop pure black/white
        const hex = toHex(rgb);
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
      }
    }
    if (!counts.size) throw new Error(`Ramp ${name}: no pixels matched in ${spec.from.join(", ")}`);
    const filter = ["hue", "sat", "light"]
      .filter((k) => spec[k])
      .map((k) => `${k} ${spec[k][0]}–${spec[k][1]}`)
      .join(", ");
    ramps[name] = {
      source: sources.join(" + ") + (filter ? ` (${filter})` : ""),
      shades: pickRamp(counts, spec.n ?? 5),
    };
  }
  return {
    note:
      "Sampled from the vanilla resource packs of Minecraft Bedrock " +
      `${GAME_VERSION} by tools/gen-textures.mjs --palette. Shades run dark → light.`,
    ramps,
  };
}

/** Pot ramps come from the S8 model textures (not vanilla), read on every run so the icon and the
 *  pot variants follow any repaint of those files. */
function potRamps() {
  const groups = { pot_iron: new Map(), pot_copper: new Map(), pot_liquid: new Map() };
  for (const file of [
    "cooking_pot_side",
    "cooking_pot_top",
    "cooking_pot_lid",
    "cooking_pot_liquid",
  ]) {
    const img = decodePng(readFileSync(path.join(POT_TEXTURES, `${file}.png`)));
    for (let i = 0; i < img.w * img.h; i++) {
      if (img.px[i * 4 + 3] < 128) continue;
      const rgb = [img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]];
      const [, s] = rgbToHsl(rgb);
      const group =
        s < 15 ? "pot_iron" : file === "cooking_pot_liquid" ? "pot_liquid" : "pot_copper";
      groups[group].set(toHex(rgb), (groups[group].get(toHex(rgb)) ?? 0) + 1);
    }
  }
  return Object.fromEntries(
    Object.entries(groups).map(([k, m]) => [
      k,
      [...m.keys()].sort((a, b) => luminance(fromHex(a)) - luminance(fromHex(b))).map(fromHex),
    ]),
  );
}

/** Hue shifting (art-style.md): palette.json keeps the raw vanilla samples, and this transform runs
 *  at load time. Along a ramp (dark → light), position t ∈ [0, 1]:
 *  - shades below the middle rotate their hue toward cool blue-violet (250°), by up to
 *    HUE_COOL degrees at the darkest shade;
 *  - shades above the middle rotate toward warm orange-yellow (40°), by up to HUE_WARM at the
 *    lightest (a target nearer pure yellow turns browns olive, so browns keep their hue);
 *  - the middle shade keeps its vanilla hue.
 *  Near-grey ramps (iron, sugar, paper) have no hue to rotate, so their darkest shade gets a faint
 *  blue tint and their lightest a faint warm tint instead. Lightness is never changed. */
const HUE_COOL = 14;
const HUE_WARM = 10;
const HUE_COOL_TARGET = 250;
const HUE_WARM_TARGET = 40;

function hslToRgb([h, s, l]) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

function rotateToward(h, target, deg) {
  const d = ((target - h + 540) % 360) - 180; // signed shortest distance
  return (h + Math.sign(d) * Math.min(Math.abs(d), deg) + 360) % 360;
}

function hueShift(ramp) {
  const n = ramp.length;
  if (n < 2) return ramp;
  const grey = ramp.every((rgb) => rgbToHsl(rgb)[1] < 12);
  return ramp.map((rgb, i) => {
    const w = 1 - (2 * i) / (n - 1); // +1 darkest … −1 lightest
    let [h, s, l] = rgbToHsl(rgb);
    if (grey) {
      if (w > 0.99) [h, s] = [230, Math.max(s, 8)];
      else if (w < -0.99) [h, s] = [45, Math.max(s, 8)];
      else return rgb;
    } else if (w > 0) h = rotateToward(h, HUE_COOL_TARGET, w * HUE_COOL);
    else if (w < 0) h = rotateToward(h, HUE_WARM_TARGET, -w * HUE_WARM);
    return hslToRgb([h, s, l]);
  });
}

// ---------------------------------------------------------------------------------------------
// Drawing. A layer is 256 RGBA entries (null = transparent). Sprites are stacks of layers:
// hand-placed pixel rows with a legend, or shape masks shaded automatically.
// ---------------------------------------------------------------------------------------------

const S = 16;
let P = {}; // ramp name -> [[r,g,b], ...] dark → light

const blank = () => new Array(S * S).fill(null);

/** Colour of ramp `name` at `i` (0 = darkest). Negative counts from the light end. */
export function c(name, i) {
  const ramp = P[name];
  if (!ramp) throw new Error(`Unknown ramp ${name}`);
  const idx = i < 0 ? ramp.length + i : Math.min(i, ramp.length - 1);
  return [...ramp[Math.max(0, idx)], 255];
}

/** Legend helper: L("tomato", "01234") maps '0' → shade 0 … '4' → shade 4 (space skips). */
function L(name, chars) {
  const out = {};
  [...chars].forEach((ch, i) => {
    if (ch !== " ") out[ch] = c(name, i);
  });
  return out;
}

function rows(spec, legend, name = "?") {
  const lines = spec
    .trim()
    .split("\n")
    .map((l) => l.trim());
  if (lines.length !== S) throw new Error(`${name}: ${lines.length} rows, want ${S}`);
  const layer = blank();
  lines.forEach((line, y) => {
    if (line.length !== S) throw new Error(`${name}: row ${y} has ${line.length} columns`);
    [...line].forEach((ch, x) => {
      if (ch === "." || ch === " ") return;
      if (!legend[ch]) throw new Error(`${name}: no legend entry for '${ch}'`);
      layer[y * S + x] = legend[ch];
    });
  });
  return layer;
}

/** Mask from '#' rows (any non-'.' char counts). */
function mask(spec) {
  const lines = spec
    .trim()
    .split("\n")
    .map((l) => l.trim());
  const m = new Array(S * S).fill(false);
  lines.forEach((line, y) => [...line].forEach((ch, x) => (m[y * S + x] = ch !== ".")));
  return m;
}

function ellipse(cx, cy, rx, ry) {
  const m = new Array(S * S).fill(false);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      m[y * S + x] = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  return m;
}

/** Thick polyline: points [[x, y, r], ...] with the radius interpolated along each segment. */
function capsule(points) {
  const m = new Array(S * S).fill(false);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      for (let i = 0; i < points.length - 1; i++) {
        const [ax, ay, ar] = points[i];
        const [bx, by, br] = points[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
        const r = ar + (br - ar) * t;
        if ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2 <= r * r) m[y * S + x] = true;
      }
    }
  return m;
}

const union = (...ms) => ms[0].map((_, i) => ms.some((m) => m[i]));
const minus = (a, b) => a.map((v, i) => v && !b[i]);

/** Shading lit from the top left, without a uniform dark rim ("pillow shading"):
 *  - bottom/right edge (4-neighbour outside below or to the right): darkest shade;
 *  - one pixel further in from the bottom/right: shadow shade;
 *  - top/left edge: a mid-light shade, so the lit side has no dark outline;
 *  - one pixel further in from the top/left: light shade; everything else: base.
 *  `shades` = [bottom-right edge, shadow, base, light, top-left edge], as ramp indices. */
function shade(m, name, shades = [0, 1, 2, 3, 2]) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < S && y < S && m[y * S + x];
  const [edgeBR, shadow, base, light, edgeTL = base] = shades;
  const layer = blank();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) continue;
      const outBR = !inside(x + 1, y) || !inside(x, y + 1);
      const outTL = !inside(x - 1, y) || !inside(x, y - 1);
      const nearBR = !inside(x + 2, y) || !inside(x, y + 2) || !inside(x + 1, y + 1);
      const nearTL = !inside(x - 2, y) || !inside(x, y - 2) || !inside(x - 1, y - 1);
      const k = outBR ? edgeBR : outTL ? edgeTL : nearBR ? shadow : nearTL ? light : base;
      layer[y * S + x] = c(name, k);
    }
  return layer;
}

function stack(...layers) {
  const out = blank();
  for (const layer of layers) layer.forEach((v, i) => v && (out[i] = v));
  return out;
}

function toImage(layer) {
  const px = new Uint8Array(S * S * 4);
  layer.forEach((v, i) => v && px.set(v, i * 4));
  return { w: S, h: S, px };
}

function fromImage(img) {
  const layer = blank();
  for (let i = 0; i < S * S; i++)
    if (img.px[i * 4 + 3]) layer[i] = [...img.px.subarray(i * 4, i * 4 + 4)];
  return layer;
}

/** Pads a short top-anchored spec ("rows 0..n") to 16 rows. */
const pad = (spec, top = 0) => {
  const lines = spec
    .trim()
    .split("\n")
    .map((l) => l.trim());
  const filler = ".".repeat(S);
  return [...Array(top).fill(filler), ...lines, ...Array(S - top - lines.length).fill(filler)].join(
    "\n",
  );
};

/** Places a small sprite (any size) at x, y. */
function stamp(spec, legend, x, y) {
  const lines = spec
    .trim()
    .split("\n")
    .map((l) => l.trim());
  const layer = blank();
  lines.forEach((line, dy) =>
    [...line].forEach((ch, dx) => {
      if (ch === "." || ch === " ") return;
      if (!legend[ch]) throw new Error(`stamp: no legend entry for '${ch}'`);
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && py >= 0 && px < S && py < S) layer[py * S + px] = legend[ch];
    }),
  );
  return layer;
}

// ---------------------------------------------------------------------------------------------
// Sprites (step 2). Each entry: [folder, file name, draw()]. Order = contact sheet order.
// ---------------------------------------------------------------------------------------------

export const SPRITES = [];
const def = (folder, name, draw, row) => SPRITES.push({ folder, name, draw, row: row ?? folder });

// --- Produce -----------------------------------------------------------------------------------

def(
  "items",
  "tomato",
  () =>
    stack(
      shade(
        mask(`
          ................
          ................
          ................
          .....######.....
          ...##########...
          ..############..
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          ..############..
          ..############..
          ...##########...
          .....######.....
          ................`),
        "tomato",
      ),
      rows(
        pad(`
          ................
          ........b.......
          .......db.......
          .....ddbbdd.....
          ...dd.dbbb.bd...
          ......b..b......
          ...44...........
          ..44............`),
        { ...L("leaf", " b d"), ...L("tomato", "    4") },
        "tomato",
      ),
    ),
  "produce",
);

def(
  "items",
  "onion",
  () =>
    stack(
      shade(
        mask(`
          ................
          ................
          ........#.......
          .......##.......
          ......####......
          .....######.....
          ....########....
          ...##########...
          ..############..
          ..############..
          ..############..
          ...##########...
          ....########....
          ......####......
          ................
          ................`),
        "onion",
      ),
      rows(
        pad(`
          ................
          ........3.......
          .......34.......
          .......32.......
          .......3........
          ......1..1......
          .....1....1.....
          ....4......1....
          ...44.1.....1...
          ...4..1.....1...
          ......1....1....
          .......1..1.....
          ................
          ................
          .....r.rr.r.....`),
        { ...L("onion", "01234"), r: c("onion_flesh", 2) },
        "onion",
      ),
    ),
  "produce",
);

// Long items run from bottom left to top right (art-style.md).
def(
  "items",
  "cucumber",
  () =>
    stack(
      shade(
        capsule([
          [3.2, 12.8, 2.4],
          [12.6, 3.4, 2.6],
        ]),
        "cucumber",
      ),
      rows(
        pad(`
          ..............bb
          .............bb.
          ................
          ..........4.....
          ........4...3...
          ...........4....
          ......4..3......
          ....4...........
          .......4........
          ..4..3..........
          ....4...........
          ................
          ..3.............`),
        { ...L("cucumber", "0123"), 4: c("cucumber_flesh", 3), b: c("leaf", 1) },
        "cucumber",
      ),
    ),
  "produce",
);

def(
  "items",
  "chili_pepper",
  () =>
    stack(
      shade(
        capsule([
          [10.4, 5.4, 2.9],
          [8, 8.6, 2.6],
          [6, 11.6, 1.9],
          [4.2, 13.4, 1.1],
          [2.4, 14.2, 0.6],
        ]),
        "chili",
      ),
      rows(
        pad(`
          .............ba.
          ............bb..
          ...........db...
          .........bddbb..
          ........bbdbbbb.
          .........b.b.b..
          ........h.......
          .......hh.......
          ......h.........
          .....h..........`),
        { ...L("leaf", " ab d"), h: c("carrot", -1) },
        "chili",
      ),
    ),
  "produce",
);

def(
  "items",
  "strawberry",
  () =>
    stack(
      shade(
        mask(`
          ................
          ................
          ................
          ................
          ...##########...
          ..############..
          ..############..
          ..############..
          ...##########...
          ...##########...
          ....########....
          .....######.....
          ......####......
          .......##.......
          ................
          ................`),
        "strawberry",
      ),
      rows(
        pad(`
          ........bb......
          .......bb.......
          ...bdd.bd.ddb...
          ..bddbbbbbbddb..
          ...b.bb..bb..b..
          ...4..y...y.....
          ..4.y...y...y...
          ....y..y..y.....
          ......y...y.....
          .....y..y.......
          .......y........`),
        { ...L("leaf", " b d"), 4: c("strawberry", 4), y: c("flower_yellow", -1) },
        "strawberry",
      ),
    ),
  "produce",
);

// Eggplant (D2b): the only purple crop. A long item, so it runs from bottom left (the round end)
// to top right (the green cap and stem); fatter at the bottom than the cucumber.
def(
  "items",
  "eggplant",
  () =>
    stack(
      shade(
        capsule([
          [4.6, 11.4, 3.7],
          [8.2, 7.8, 2.7],
          [10.6, 5.4, 1.9],
        ]),
        "eggplant",
      ),
      rows(
        pad(`
          ................
          ................
          .............b..
          ............bb..
          ..........dbbd..
          ..........bdb...
          .........d.d....
          ................
          ......4.........
          .....4..........
          ...44...........
          ...4............`),
        { ...L("leaf", " b d"), 4: c("eggplant", 4) },
        "eggplant",
      ),
    ),
  "produce",
);

// --- Seeds: small, sparse grains like vanilla wheat seeds (5–7 grains of 2–3 px, lots of empty
// space). Every seed has its own grain shape, colour and scatter (art-style.md) -----------------

const scatter = (grain, legend, spots) =>
  stack(...spots.map(([x, y, g]) => stamp(g ?? grain, legend, x, y)));

// Tomato: pale cream-yellow teardrops (3 px), loose scatter.
def(
  "items",
  "tomato_seeds",
  () =>
    scatter(
      `
      lm
      .d`,
      { l: c("onion_flesh", -1), m: c("onion_flesh", 3), d: c("potato", 1) },
      [
        [4, 3],
        [10, 4],
        [7, 7],
        [2, 9],
        [12, 9],
        [6, 12],
      ],
    ),
  "seeds",
);

// Cucumber: long thin mint grains (3 px on a diagonal), all pointing the same way.
def(
  "items",
  "cucumber_seeds",
  () =>
    scatter(
      `
      ..l
      .m.
      d..`,
      { l: c("cucumber_flesh", -1), m: c("cucumber_flesh", 3), d: c("cucumber_flesh", 1) },
      [
        [2, 3],
        [8, 2],
        [11, 7],
        [5, 7],
        [2, 11],
        [9, 11],
      ],
    ),
  "seeds",
);

// Chili: flat orange discs (3 px, an L of a round seed), in a wide ring.
def(
  "items",
  "chili_pepper_seeds",
  () =>
    scatter(
      `
      lm
      d.`,
      { l: c("carrot", -1), m: c("carrot", 3), d: c("carrot", 1) },
      [
        [6, 2],
        [11, 4],
        [12, 9],
        [7, 12],
        [2, 10],
        [2, 5, "lm\n.d"],
      ],
    ),
  "seeds",
);

// Strawberry: tiny 2 px plum-pink grains with a bright core, in a small heart-shaped cloud.
def(
  "items",
  "strawberry_seeds",
  () =>
    scatter(
      `
      l
      d`,
      { l: c("strawberry", 3), m: c("strawberry", 2), d: c("strawberry", 0) },
      [
        [3, 4],
        [6, 3, "m\nd"],
        [9, 3],
        [12, 4, "m\nd"],
        [4, 8, "m\nd"],
        [11, 8],
        [7, 11],
      ],
    ),
  "seeds",
);

// Eggplant: flat tan squares (2×2, the only square grain), in a loose diagonal band.
def(
  "items",
  "eggplant_seeds",
  () =>
    scatter(
      `
      lm
      md`,
      { l: c("potato", -1), m: c("bread", 3), d: c("bread", 1) },
      [
        [2, 3],
        [7, 2],
        [12, 4],
        [4, 8],
        [10, 8],
        [6, 12],
        [12, 12],
      ],
    ),
  "seeds",
);

// --- Prepared ingredients ------------------------------------------------------------------------

function tomatoSlice(cx, cy, r) {
  const layer = stack(
    shade(ellipse(cx, cy, r, r), "tomato", [0, 1, 1, 1, 2]),
    shade(ellipse(cx, cy, r - 1.3, r - 1.3), "tomato", [2, 2, 3, 3, 3]),
  );
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  // Four seed pockets (gel + seed) around a light core.
  for (const [dx, dy] of [
    [-2, -2],
    [1, -2],
    [-2, 1],
    [1, 1],
  ]) {
    layer[(y + dy) * S + x + dx] = c("flower_yellow", -1);
    layer[(y + dy + (dy < 0 ? 1 : 0)) * S + x + dx + (dx < 0 ? 1 : 0)] = c("onion_flesh", -1);
  }
  return layer;
}

def(
  "items",
  "sliced_tomato",
  () => stack(tomatoSlice(10, 6, 5), tomatoSlice(6, 10, 5.2)),
  "prepared",
);

function cucumberSlice(cx, cy, r) {
  const layer = stack(
    shade(ellipse(cx, cy, r, r), "cucumber", [0, 0, 1, 1, 2]),
    shade(ellipse(cx, cy, r - 1, r - 1), "cucumber_flesh", [3, 4, 4, 4, 4]),
  );
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    layer[(y + dy) * S + x + dx] = c("onion_flesh", -2);
  return layer;
}

def(
  "items",
  "sliced_cucumber",
  () => stack(cucumberSlice(11, 5.5, 3.7), cucumberSlice(5, 5, 3.7), cucumberSlice(8, 11, 3.7)),
  "prepared",
);

// Eggplant slices: cream flesh with a purple skin ring and a ring of seed dots. Top-left and
// bottom-right (the tomato slices go the other way), so the two never share a silhouette.
function eggplantSlice(cx, cy, r) {
  const layer = stack(
    shade(ellipse(cx, cy, r, r), "eggplant", [0, 1, 1, 2, 3]),
    shade(ellipse(cx, cy, r - 1.2, r - 1.2), "onion_flesh", [3, 4, 4, 4, 4]),
  );
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  for (const [dx, dy] of [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
    [-1, -1],
    [1, 1],
  ])
    layer[(y + dy) * S + x + dx] = c("bread", 3);
  return layer;
}

def(
  "items",
  "sliced_eggplant",
  () => stack(eggplantSlice(10.2, 10.2, 4.8), eggplantSlice(5.6, 5.6, 4.6)),
  "prepared",
);

// Chopped onion: an onion cut lengthwise (same silhouette as the onion item, its layers drawn as
// nested contours), with a little pile of dice in front.
def(
  "items",
  "chopped_onion",
  () => {
    const half = mask(`
      ................
      ..........#.....
      .........###....
      ........#####...
      .......#######..
      ......#########.
      ......#########.
      ......#########.
      .......#######..
      ........#####...
      ................
      ................
      ................
      ................
      ................
      ................`);
    // Distance (in 4-neighbour steps) from the outside, per pixel.
    const depth = half.map(() => 0);
    let ring = half.slice();
    for (let d = 1; ring.some(Boolean); d++) {
      ring.forEach((v, i) => v && (depth[i] = d));
      const inside = (x, y) => x >= 0 && y >= 0 && x < S && y < S && ring[y * S + x];
      ring = ring.map((v, i) => {
        const x = i % S;
        const y = Math.floor(i / S);
        return v && inside(x + 1, y) && inside(x - 1, y) && inside(x, y + 1) && inside(x, y - 1);
      });
    }
    const skin = shade(half, "onion", [1, 1, 3, 3, 3]);
    const layer = half.map((v, i) => {
      if (!v) return null;
      if (depth[i] === 1) return skin[i];
      return depth[i] % 2 === 0 ? c("onion_flesh", 2) : c("onion_flesh", -1);
    });
    const cube = `
      ll.
      mmd
      md.`;
    const flesh = { l: c("onion_flesh", -1), m: c("onion_flesh", 3), d: c("onion_flesh", 2) };
    return stack(
      layer,
      ...[
        [3, 7],
        [1, 10],
        [5, 10],
        [2, 13],
        [7, 12],
        [10, 11],
      ].map(([x, y]) => stamp(cube, flesh, x, y)),
    );
  },
  "prepared",
);

// --- Dishes ------------------------------------------------------------------------------------

/** One shared bowl (plan §4.2, art-style.md), drawn once; every bowl dish adds only its contents.
 *  12 px wide, 8 rows from the back rim to the rounded foot (6 rows of body below the mouth),
 *  3 colours: dark rim/inside/shadow, mid body, light lit rim. The mouth ('s', rows 6–8) starts
 *  as the dark inside of the bowl. Dishes come in three silhouette classes so they differ by
 *  texture, not only colour: smooth liquid in the mouth, a heap above the rim, and a big
 *  protrusion on one side. */
const BOWL = `
  ................
  ................
  ................
  ................
  ................
  .....DDDDDD.....
  ...DDssssssDD...
  ..DssssssssssD..
  ..LssssssssssD..
  ..LLLLLLLLLLMD..
  ...LMMMMMMMMD...
  ....MMMMMMMD....
  ......DDDD......
  ................
  ................
  ................`;

const bowl = () =>
  rows(BOWL, { D: c("bowl", 0), s: c("bowl", 0), M: c("bowl", 3), L: c("bowl", 4) }, "bowl");
const bowlDish = (name, contents, legend) =>
  def("items", name, () => stack(bowl(), rows(pad(contents), legend(), name)), "dishes");

// Smooth liquid: one flat colour, a highlight streak, one garnish.
bowlDish(
  "tomato_soup",
  `
  ................
  ................
  ................
  ................
  ................
  ................
  .....hhTTwT.....
  ...hTTTwwTTTt...
  ...tTTTTwTgTt...`,
  () => ({
    h: c("carrot", -1),
    T: c("chili", 3),
    t: c("chili", 1),
    w: c("cream", -1),
    g: c("leaf", 3),
  }),
);

// Smooth golden-brown broth with a cheese-topped crouton floating in the middle.
bowlDish(
  "onion_soup",
  `
  ................
  ................
  ................
  ................
  ................
  ......CCCC......
  .....cCCCcc.....
  ...hOObbbbbOO...
  ...OOObbbbOOo...`,
  () => ({
    C: c("flower_yellow", -1),
    c: c("flower_yellow", 2),
    b: c("bread", 4),
    O: c("onion", 1),
    o: c("onion", 0),
    h: c("onion", 3),
  }),
);

// Heaps rise above the rim as a dome no wider than the bowl's mouth (art-style.md: food may rise
// above the rim but never widens the bowl). Envelope: row 2 cols 6–9, row 3 cols 5–10,
// row 4 cols 4–11, rows 5–8 cols 3–12.

// Salsa: orange-red tomato chunks (≈17°, well away from the strawberry cup's crimson) with white
// onion and green herbs, each chunk lit top-left.
bowlDish(
  "salsa",
  `
  ................
  ................
  ......3w32......
  .....32g323.....
  ....3w23322g....
  ...23g2w3232w...
  ...32g12w3212...
  ...12211g21w2...
  ...21122w1221...`,
  () => ({
    1: c("copper", 1),
    2: c("fish", 2),
    3: c("carrot", 3),
    w: c("onion_flesh", -1),
    g: c("leaf", 4),
  }),
);

bowlDish(
  "garden_salad",
  `
  ................
  .......ed.......
  ......edcd......
  .....dcbcde.....
  ....edcRrdcd....
  ...dcbRrbkCkd...
  ...cbrrcbCCCk...
  ...bcbbcbkCkb...
  ...cbcbbcbbcb...`,
  () => ({
    ...L("leaf", " bcd"),
    e: c("leaf", 3),
    ...L("tomato", " rR"),
    k: c("cucumber", 1),
    C: c("cucumber_flesh", -1),
  }),
);

// Strawberry cup: ripe red berries under a cream dollop (not pink, so it never reads as the cake).
const CUP_BERRY = `
  .gg.
  2332
  2y21
  .11.`;

def(
  "items",
  "strawberry_cup",
  () => {
    const berry = {
      ...L("tomato", " 123"),
      g: c("leaf", 1),
      y: c("flower_yellow", -1),
    };
    return stack(
      bowl(),
      rows(
        pad(`
          ................
          ................
          ................
          ................
          ................
          ................
          .....1212121....
          ...1212121212...
          ...2121212121...`),
        L("tomato", " 12"),
        "strawberry_cup",
      ),
      stamp(CUP_BERRY, berry, 3, 4),
      stamp(CUP_BERRY, berry, 9, 4),
      stamp(CUP_BERRY, berry, 6, 3),
      stamp(CUP_BERRY, berry, 4, 6),
      stamp(CUP_BERRY, berry, 8, 6),
      rows(
        pad(`
          .......WW.......
          ......WWWw......
          ......WWww......
          .......ww.......`),
        { W: c("cream", -1), w: c("cream", 0) },
        "strawberry_cup",
      ),
    );
  },
  "dishes",
);

// Chunky stew: carrot, potato, tomato and onion chunks, each lit top-left with its own shadow
// side, heaped in a golden-brown broth.
def(
  "items",
  "vegetable_stew",
  () => {
    const shadow = c("bread", 1);
    const carrot = { l: c("carrot", 3), d: shadow };
    const potato = { l: c("potato", -1), d: shadow };
    const tomato = { l: c("tomato", 2), d: shadow };
    const onion = { l: c("onion_flesh", -1), d: shadow };
    const piece = (legend, x, y) =>
      stamp(
        `
        ll
        ld`,
        legend,
        x,
        y,
      );
    return stack(
      bowl(),
      rows(
        pad(`
          ................
          ................
          ................
          .....ssssss.....
          ....ssssssss....
          ...ssssssssss...
          ...ssssssssss...
          ...ssssssssss...
          ...ssssssssss...`),
        { s: c("bread", 3) },
        "vegetable_stew",
      ),
      piece(potato, 6, 2),
      piece(carrot, 8, 3),
      piece(tomato, 4, 4),
      piece(onion, 7, 5),
      piece(carrot, 10, 5),
      piece(potato, 3, 6),
      piece(carrot, 5, 7),
      piece(tomato, 9, 7),
      piece(onion, 11, 7),
    );
  },
  "dishes",
);

// Protrusions go up, inside the bowl's width: chili on the right, fish in the middle, drumstick
// on the left.
bowlDish(
  "chili_stew",
  `
  ...........dbb..
  ..........34db..
  .........34421..
  ........344211..
  .......34421....
  ......34421.....
  .....B4421BB....
  ...BBB421BBBb...
  ...bBBBB1BBbb...`,
  () => ({
    ...L("chili", " 1234"),
    ...L("leaf", " b d"),
    B: c("beet", 2),
    b: c("beet", 0),
  }),
);

// A silver fish leaping out of the cream chowder: eye, dorsal fin, forked tail.
bowlDish(
  "fish_chowder",
  `
  ................
  .......dd.......
  .....dFFFd...d..
  ....dkFFFd.dd...
  ....FFFFFFFdd...
  ....bbbbbbd.dd..
  .....bbbbd...d..
  ...wwbbbwwwWw...
  ...wWwwgwwWwg...`,
  () => ({
    d: c("iron", 1),
    F: c("iron", 2),
    b: c("iron", -1),
    k: c("bowl", 0),
    w: c("sugar", 2),
    W: c("cream", -1),
    g: c("leaf", 3),
  }),
);

bowlDish(
  "chicken_soup",
  `
  ...WWW..........
  ...WssW.........
  ....sWs.........
  ....sCCc........
  ...CCCCck.......
  ...CCcccck......
  ...CCcccckYY....
  ...CcckkkYyYY...
  ...yYYyYYYyYy...`,
  () => ({
    C: c("chicken", 2),
    c: c("chicken", 1),
    k: c("chicken", 0),
    W: c("sugar", -1),
    s: c("sugar", 1),
    Y: c("cream", -1),
    y: c("potato", -1),
  }),
);

// Not a bowl: the jam comes in a tall jar (it returns a glass bottle).
def(
  "items",
  "strawberry_jam",
  () =>
    rows(
      `
      ................
      ................
      .....KKKKKK.....
      ....KKKKKKKk....
      ....kkkkkkkk....
      .....gHgggg.....
      ....gHJJJjjg....
      ...gHJJJJjjdg...
      ...gHJJJjjjdg...
      ...gHJJjjjjdg...
      ...gHJjjjjjdg...
      ...gHjjjjjddg...
      ...gjjjjjdddg...
      ....gddddddg....
      .....gggggg.....
      ................`,
      {
        K: c("cork", 2),
        k: c("cork", 0),
        g: c("glass", 0),
        H: c("glass", -1),
        J: c("beet", 3),
        j: c("beet", 2),
        d: c("beet", 0),
      },
      "strawberry_jam",
    ),
  "dishes",
);

// Sandwiches: the top bread slice shows its crumb face. Veggie is low and green-red;
// the hearty one is tall with a thick brown meat layer.
const SANDWICH_LEGEND = () => ({
  c: c("bread", 3),
  d: c("bread", 1),
  M: c("cream", -1),
  m: c("cream", 0),
  g: c("cucumber", 1),
  G: c("cucumber_flesh", -1),
  r: c("tomato", 1),
  R: c("tomato", 2),
  p: c("meat", 1),
  P: c("meat", 3),
});

// A long sub roll, bottom left to top right like vanilla bread: the filling shows as a band
// between the two halves of the roll.
def(
  "items",
  "veggie_sandwich",
  () => {
    const axis = (dx, dy, r) =>
      capsule([
        [3.6 + dx, 11.8 + dy, r],
        [11.8 + dx, 3.6 + dy, r],
      ]);
    const filling = shade(axis(0.2, 0.2, 2.9), "cucumber", [1, 1, 2, 2, 2]);
    // Tomato dots along the filling band.
    for (const [x, y] of [
      [5, 12],
      [8, 9],
      [11, 6],
    ])
      filling[y * S + x] = c("tomato", 2);
    return stack(
      shade(axis(1.3, 1.3, 2.4), "bread", [0, 1, 2, 2, 2]),
      filling,
      shade(axis(-0.9, -0.9, 2.5), "bread", [1, 2, 3, 4, 3]),
    );
  },
  "dishes",
);

def(
  "items",
  "hearty_sandwich",
  () =>
    rows(
      `
      .........G......
      .........k......
      ....ccccckcc....
      ...cMMMMMkMMd...
      ...cMMMMMMMmd...
      ...cMMMMMMmmd...
      ...dddddddddd...
      ..gGgGggGgGgg...
      ...rRrRrRRrRrr..
      ..PPPPPPPPPPPp..
      ..PPPPPPPPPPpp..
      ...pppppppppp...
      ...cccccccccd...
      ....dddddddd....
      ................
      ................`,
      { ...SANDWICH_LEGEND(), k: c("cream", -1) },
      "hearty_sandwich",
    ),
  "dishes",
);

// Strawberry cake item: one slice (a wedge in 3/4 view) of the placeable cake. Cream-white
// frosting and sponge dominate; pink accents are the jam stripe and the berry on top.
def(
  "items",
  "strawberry_cake",
  () =>
    rows(
      `
      ................
      ...........gg...
      ..........3443..
      ..........4y32e.
      ........fFF221e.
      ......fFFFFFFFe.
      ....fFFFFFFFFFe.
      ..fFFFFFFFFFFFe.
      .ffffffffffffff.
      .SfSSSSfSSSSfSe.
      .PPPPPPPPPPPPPp.
      .SSSSSSSSSSSSSe.
      .eeeeeeeeeeeeee.
      ................
      ................
      ................`,
      {
        F: c("cream", -1),
        f: c("cream", 1),
        e: c("cream", 0),
        S: c("onion_flesh", 3),
        P: c("strawberry", 2),
        p: c("strawberry", 1),
        ...L("strawberry", " 1234"),
        y: c("flower_yellow", -1),
        g: c("leaf", 3),
      },
      "strawberry_cake",
    ),
  "dishes",
);

// Eggplant dishes (plan §1.3 #17–#21).

// Stuffed eggplant: a roasted eggplant half (dark purple boat, bottom left to top right) with a
// browned meat filling and a few spots of melted cheese. Not a bowl dish (nothing comes back).
def(
  "items",
  "stuffed_eggplant",
  () =>
    rows(
      `
      ................
      ................
      .............g..
      ...........ggg..
      .........MmmGg..
      .......MMYmmm3..
      .....MMmmmmm33..
      ....MYmmmmYm32..
      ...MMmmmmmm332..
      ..MmmmYmmm3322..
      ..3mmmmmm33221..
      ..33mmm333221...
      ..2333333221....
      ...22222211.....
      ................
      ................`,
      {
        Y: c("flower_yellow", -1),
        M: c("meat", 4),
        m: c("meat", 2),
        3: c("eggplant", 2),
        2: c("eggplant", 1),
        1: c("eggplant", 0),
        g: c("leaf", 3),
        G: c("leaf", 1),
      },
      "stuffed_eggplant",
    ),
  "dishes",
);

// Ratatouille: overlapping vegetable slices, mostly eggplant, standing in a thin tomato sauce
// just above the rim.
bowlDish(
  "ratatouille",
  `
  ................
  ................
  ......Ee........
  .....EfeEe......
  ....EfeEfeTE....
  ...EfeEfeTteE...
  ...EfeTEfeCEfe..
  ...feTtfeCCfeT..
  ...sstsssstsss..`,
  () => ({
    E: c("eggplant", 3),
    e: c("eggplant", 1),
    f: c("eggplant", 4),
    T: c("tomato", 3),
    t: c("tomato", 2),
    C: c("cucumber", 4),
    s: c("tomato", 0),
  }),
);

// Eggplant curry: a smooth green curry (the Thai kind, which is made with eggplant) with purple
// eggplant chunks and a red chili slice.
bowlDish(
  "eggplant_curry",
  `
  ................
  ................
  ................
  ................
  ................
  ................
  .....hHHhEeH....
  ...hHEeHHHhrEe..
  ...HHeeHHHHHee..`,
  () => ({
    H: c("cucumber_flesh", 3),
    h: c("cucumber_flesh", -1),
    E: c("eggplant", 3),
    e: c("eggplant", 1),
    r: c("chili", 3),
  }),
);

// Eggplant salad: a heap of eggplant slices (cream with a purple rim), cucumber and white onion.
bowlDish(
  "eggplant_salad",
  `
  ................
  ................
  ......eEEe......
  .....eFFFFe.....
  ....eFFeeFFEcc..
  ...ceFFeEEFeCc..
  ...CceeFFFFeCcw.
  ...ccwweFFewcCw.
  ...wwcwweewwccw.`,
  () => ({
    E: c("eggplant", 3),
    e: c("eggplant", 1),
    F: c("onion_flesh", -1),
    C: c("cucumber_flesh", -1),
    c: c("cucumber", 2),
    w: c("sugar", 2),
  }),
);

// Veggie skewer: a stick from bottom left to top right through eggplant, tomato and onion
// chunks. The stick comes back when it's eaten.
def(
  "items",
  "veggie_skewer",
  () =>
    rows(
      `
      ..............h.
      .............hd.
      ..........EEhd..
      .........EEEe...
      ........eEEe....
      .......TTee.....
      ......TTTt......
      .....rTTr.......
      ....WWrr........
      ...WWWw.........
      ..hwWw..........
      .hdww...........
      hd..............
      d...............
      ................
      ................`,
      {
        h: c("wood", 4),
        d: c("wood", 1),
        E: c("eggplant", 3),
        e: c("eggplant", 1),
        T: c("tomato", 3),
        t: c("tomato", 2),
        r: c("tomato", 1),
        W: c("onion_flesh", -1),
        w: c("onion_flesh", 2),
      },
      "veggie_skewer",
    ),
  "dishes",
);

// --- Mixes (D16): a pot dish's raw ingredients, put together on the crafting table -------------
// Every mix is the shared bowl with raw pieces in it (no broth: the dark inside shows between
// them), one whole ingredient sticking out, each in its own place, and a spoon leaning
// out top right, so all mixes read as one family ("still to be cooked") that no cooked dish
// shares. The spoon is light metal on the bowl's darkest shade: a wooden one added the bowl's
// golden-brown to every mix and made them all read as one hue (lint "similar pair"). Raw pieces stay inside the bowl: a shared heap
// gave every mix the same silhouette (lint "similar pair"). The jam mix comes in its bottle and
// the stuffed eggplant has no container, as their dishes do.

const SPOON = `
  .............hd.
  ............hd..
  ...........hd...
  ..........hd....`;

const spoon = () => rows(pad(SPOON), { h: c("iron", -1), d: c("bowl", 0) }, "spoon");

const mixDish = (name, contents, legend) =>
  def(
    "items",
    `${name}_mix`,
    () => stack(bowl(), rows(pad(contents), legend(), `${name}_mix`), spoon()),
    "mixes",
  );

// A big whole tomato sitting on the right rim, tomato pieces.
mixDish(
  "tomato_soup",
  `
  ................
  ................
  ................
  ...........gg...
  .........tTTTTt.
  ........tTTTTTtr
  ...rRrr.tTTTTttr
  ...RrrrrtTTTttrr
  ...rRr.r.trrrrr.`,
  () => ({
    T: c("tomato", 3),
    t: c("tomato", 2),
    r: c("tomato", 1),
    R: c("tomato", 0),
    g: c("leaf", 3),
  }),
);

// A chili pepper over the left rim, on marbled raw beef and an onion piece.
mixDish(
  "chili_stew",
  `
  ................
  ................
  ................
  ....g...........
  ...gKk..........
  .KKKkk..........
  KKKkkBBbBW......
  kkkbBBWbbBbW....
  ...bbBb.bBbW....`,
  () => ({
    K: c("chili", 4),
    k: c("chili", 2),
    g: c("leaf", 3),
    B: c("meat", 3),
    b: c("meat", 1),
    W: c("onion_flesh", -1),
  }),
);

// A carrot lying over the left rim, leaves up, on more carrot pieces.
mixDish(
  "vegetable_stew",
  `
  ................
  ................
  ......l.l.......
  .....lll........
  ....CCl.........
  ...CCc..........
  .CCCcCCcCC......
  CCCcCCcCCcCc....
  cc.cc.cc.CccC...`,
  () => ({ C: c("carrot", 3), c: c("carrot", 1), l: c("leaf", 3) }),
);

// A raw fish (silver-blue, so it never reads as a cooked dish) with its tail up on the left,
// on potato and onion.
mixDish(
  "fish_chowder",
  `
  ................
  ..f.............
  ..ff............
  ...fG...........
  ...GGg..........
  ...GGgg.........
  ...gGGGGGGkWW...
  ...PgggggggWWW..
  ...Pp.pp...WW...`,
  () => ({
    G: c("glass", 2),
    g: c("glass", 1),
    f: c("glass", 0),
    k: c("bowl", 0),
    P: c("potato", -1),
    p: c("potato", 2),
    W: c("onion_flesh", -1),
  }),
);

// A pale raw drumstick standing in the middle, bone up, with carrot pieces.
mixDish(
  "chicken_soup",
  `
  ......WW........
  ......WsW.......
  .......ss.......
  .......ss.......
  ......cCCc......
  .....cCCCCc.....
  ...OocCCCCCcOo..
  ...OOocCCCcOOo..
  ...Oo.OO.oOOo...`,
  () => ({
    W: c("sugar", -1),
    s: c("sugar", 1),
    C: c("onion_flesh", -1),
    c: c("strawberry", 3),
    O: c("carrot", 3),
    o: c("carrot", 1),
  }),
);

// A whole onion sitting on the right rim, sprouting, on bread.
mixDish(
  "onion_soup",
  `
  .............g..
  ............g...
  ...........34...
  ..........3442..
  .........344421.
  .........344421.
  ...bbbb.3442211.
  ...bbbbb344221..
  ...bbbb.b34211..`,
  () => ({ ...L("onion", " 1234"), b: c("bread", 4), g: c("leaf", 3) }),
);

// A cucumber standing up on the left, eggplant and tomato pieces.
mixDish(
  "ratatouille",
  `
  .....c..........
  ....CCc.........
  ....CCc.........
  ...CCcc.........
  ...CCc..........
  ...Ccc..........
  ...cc.EETteEE...
  ...EEeTTtEEeTt..
  ...Ee.Tt.EeTt...`,
  () => ({
    C: c("cucumber", 4),
    c: c("cucumber", 2),
    E: c("eggplant", 3),
    e: c("eggplant", 1),
    T: c("tomato", 3),
    t: c("tomato", 1),
  }),
);

// A whole eggplant over the left rim, eggplant and chili pieces.
mixDish(
  "eggplant_curry",
  `
  ................
  ................
  ................
  ................
  .g..............
  .GEE............
  ..EEEe..........
  ..EEeeEeKkEe....
  ...eeE.eKk.E....`,
  () => ({
    g: c("leaf", 4),
    G: c("leaf", 2),
    E: c("eggplant", 3),
    e: c("eggplant", 1),
    K: c("chili", 3),
    k: c("chili", 1),
  }),
);

// The jam's glass bottle holding raw strawberries, sugar on top.
def(
  "items",
  "strawberry_jam_mix",
  () =>
    rows(
      `
      ................
      ......gHg.......
      ......gHg.......
      .....gwWwg......
      ....gwWwwwg.....
      ...gHSSsSSsg....
      ...gHSsSSsSg....
      ..gHSSsSSsSsg...
      ..gHsSSsSSsSg...
      ..gHSsSSsSssg...
      ..gHSSsSssssg...
      ...gsSssssssg...
      ....gssssssg....
      .....gggggg.....
      ................
      ................`,
      {
        g: c("glass", 0),
        H: c("glass", -1),
        w: c("sugar", 1),
        W: c("sugar", -1),
        S: c("strawberry", 2),
        s: c("strawberry", 1),
      },
      "strawberry_jam_mix",
    ),
  "mixes",
);

// A raw eggplant half (bright purple boat) filled with raw meat, tomato and onion, before the
// oven-like roast in the pot browns it.
def(
  "items",
  "stuffed_eggplant_mix",
  () =>
    rows(
      `
      ................
      ................
      .............g..
      ...........ggg..
      .........RWrGg..
      .......RWRrrr4..
      .....RRrMrWr44..
      ....RWrMmrmm43..
      ...RRMmmWmr443..
      ..RrWmmMmm4433..
      ..4rMmmmm44332..
      ..44mmm444332...
      ..3444444332....
      ...33333322.....
      ................
      ................`,
      {
        R: c("tomato", 3),
        r: c("tomato", 1),
        W: c("onion_flesh", -1),
        M: c("pork", -1),
        m: c("pork", 3),
        4: c("eggplant", 4),
        3: c("eggplant", 3),
        2: c("eggplant", 2),
        g: c("leaf", 3),
        G: c("leaf", 1),
      },
      "stuffed_eggplant_mix",
    ),
  "mixes",
);

// --- Stations and book ---------------------------------------------------------------------------

// Tall lidded pot with side handles, so it never reads as a bowl dish or a cake.
def(
  "items",
  "cooking_pot",
  () =>
    rows(
      `
      ................
      .......43.......
      ......J320......
      ....JJJJIIii....
      ...JJIIIIIIIi...
      ..iiiiiiiiiiii..
      .JJJJJJJJJJJJIi.
      .i433333333221i.
      .i333333333221i.
      ..333333333221..
      ..333333332221..
      ..222222222210..
      ..222222222110..
      ...0111111110...
      ....00000000....
      ................`,
      {
        ...L("pot_copper", "01234"),
        i: c("pot_iron", 0),
        I: c("pot_iron", 1),
        J: c("pot_iron", 2),
      },
      "cooking_pot",
    ),
  "stations",
);

def(
  "items",
  "cutting_board",
  () => {
    const board = union(
      mask(`
        ................
        ................
        ................
        ................
        ..##########....
        .############...
        .############...
        .############...
        .############...
        .############...
        .############...
        .############...
        .############...
        ..##########....
        ................
        ................`),
      capsule([
        [11.5, 6.5, 1.6],
        [14, 4, 1.6],
      ]),
    );
    const hole = mask(`
      ................
      ................
      ................
      ................
      .............#..
      ................`);
    return stack(
      shade(minus(board, hole), "wood", [0, 1, 3, 4, 3]),
      rows(
        `
        ................
        ................
        ................
        ................
        ................
        ..........K.....
        ...2222..KKk....
        ........KKk.....
        .....2.KKk.222..
        ......kKk.......
        ...222hk........
        ....hhh...222...
        ...hhh..........
        ..hh..2222......
        ................
        ................`,
        { 2: c("wood", 2), K: c("iron", 4), k: c("iron", 2), h: c("bark", 1) },
        "cutting_board",
      ),
    );
  },
  "stations",
);

// The Recipe Poster (D15): a landscape paper sheet in a wooden frame, two red pins, and a tiny
// recipe on it (tomato → bowl of soup), the same shape as the 2×1 poster on the wall.
def(
  "items",
  "recipe_poster",
  () =>
    rows(
      `
      ................
      ................
      .oooooooooooooo.
      .ohhhhhhhhhhhdo.
      .ohrpppppppprdo.
      .ohppppppppppdo.
      .ohptTpapssspdo.
      .ohpttpaabbbpdo.
      .ohppppappbppdo.
      .ohppppppppppdo.
      .ohdddddddddddo.
      .oooooooooooooo.
      ................
      ................
      ................
      ................`,
      {
        o: c("wood", 0),
        h: c("wood", 4),
        d: c("wood", 1),
        p: c("cream", 2),
        r: c("tomato", 2),
        t: c("tomato", 2),
        T: c("tomato", 4),
        a: c("bark", 1),
        s: c("tomato", 3),
        b: c("bowl", 3),
      },
      "recipe_poster",
    ),
  "stations",
);

// The Kitchen Guide: a closed red book from the front, spine on the left, page edges below and
// right (red, not brown: a brown book is a twin of the crafting table icon).
def(
  "items",
  "guide_book",
  () =>
    rows(
      `
      ................
      ..hdhhhhhhhhd...
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..hdlllllllldp..
      ..dddddddddddp..
      ...ppppppppppp..
      ................`,
      { h: c("beet", 3), l: c("beet", 1), d: c("beet", 0), p: c("cream", 1) },
      "guide_book",
    ),
  "stations",
);

// --- Kitchen decor (art/harvest_kitchen/models/_tools/make-kitchen-deco.mjs) ---------------------
// Hand-authored grids only (pixels/<name>.txt); the procedural fallback is a flat placeholder tile.
const DECO_PLACEHOLDER = `
  ................
  ................
  ..bbbbbbbbbbbb..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ..baaaaaaaaaaa..
  ................
  ................`;
for (const [name, ramp] of [
  ["kitchen_counter", "wood"],
  ["kitchen_cabinet", "wood"],
  ["spice_shelf", "wood"],
  ["kitchen_sink", "iron"],
  ["kitchen_stove", "pot_iron"],
  ["hanging_pan", "pot_copper"],
  ["pickle_jar", "cucumber"],
  ["vegetable_basket", "bread"],
])
  def(
    "items",
    name,
    () => rows(DECO_PLACEHOLDER, { a: c(ramp, 1), b: c(ramp, -1) }, name),
    "decor",
  );

// --- UI icons --------------------------------------------------------------------------------------

def(
  "ui",
  "family_heal",
  () =>
    stack(
      shade(
        mask(`
          ................
          ................
          ...###....###...
          ..#####..#####..
          .##############.
          .##############.
          .##############.
          ..############..
          ...##########...
          ....########....
          .....######.....
          ......####......
          .......##.......
          ................
          ................
          ................`),
        "family_heal",
      ),
      rows(
        pad(`
        ................
        ................
        ................
        ...44...........
        ..44............
        ..4.............`),
        L("family_heal", "01234"),
        "family_heal",
      ),
    ),
  "ui",
);

def(
  "ui",
  "family_move",
  () =>
    stack(
      shade(
        mask(`
          ................
          ................
          ....######......
          ....######......
          ....######......
          ....######......
          ....######......
          ....######......
          ....#######.....
          ...##########...
          ...###########..
          ...############.
          ...############.
          ...############.
          ................
          ................`),
        "family_move",
      ),
      rows(
        pad(`
          ................
          ................
          ....000000......
          ....444443......
          ....333332......
          ................
          .....4..........
          .......4........
          .....4...4......
          .......4........
          ..........4.....
          ....3...........
          ...000000000000.
          ...000000000000.`),
        L("family_move", "01234"),
        "family_move",
      ),
    ),
  "ui",
);

def(
  "ui",
  "family_work",
  () =>
    stack(
      shade(
        capsule([
          [2, 14, 1.1],
          [10.5, 5.5, 1.1],
        ]),
        "wood",
        [0, 1, 2, 3],
      ),
      shade(
        capsule([
          [3.5, 3, 1.4],
          [8.5, 2.4, 1.7],
          [12, 4, 1.8],
          [13.6, 7.5, 1.7],
          [13, 12.5, 1.4],
        ]),
        "family_work",
      ),
      rows(
        pad(`
        ................
        ................
        .....444........
        ...44.....4.....
        ...........4....`),
        L("family_work", "01234"),
        "family_work",
      ),
    ),
  "ui",
);

def(
  "ui",
  "family_explore",
  () =>
    stack(
      shade(ellipse(8, 9, 6.6, 6.6), "family_explore", [0, 1, 2, 3, 2]),
      shade(ellipse(8, 9, 4.6, 4.6), "paper", [2, 3, 4, 4, 3]),
      rows(
        `
        ................
        .......00.......
        ......0..0......
        ................
        .......0........
        ................
        ..........1.....
        ..0......10...0.
        ........10......
        .......2g.......
        ......22........
        .....22.........
        ...........0....
        .......0........
        ................
        ................`,
        { 0: c("family_explore", 0), 1: c("iron", 0), 2: c("iron", 2), g: c("family_explore", 1) },
        "family_explore",
      ),
    ),
  "ui",
);

def(
  "ui",
  "locked",
  () =>
    stack(
      shade(
        mask(`
          ................
          ..############..
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          .##############.
          ..############..
          ................`),
        "iron",
        [0, 0, 1, 1, 1],
      ),
      rows(
        `
        ................
        ................
        ................
        ......4444......
        .....440044.....
        ......0..440....
        .........440....
        ........440.....
        .......440......
        .......440......
        ........0.......
        .......44.......
        .......440......
        ........0.......
        ................
        ................`,
        L("iron", "0   4"),
        "locked",
      ),
    ),
  "ui",
);

def(
  "ui",
  "chapter_crops",
  () =>
    stack(
      rows(
        `
        ................
        ................
        ..........dee...
        ..eed....deedc..
        .dddcd..dccdcb..
        ..bccbd.dcbb....
        ....bbcbcb......
        ......cb........
        .......b........
        .......b........
        .......b........
        ................
        ................
        ................
        ................
        ................`,
        L("leaf", "abcde"),
        "chapter_crops",
      ),
      shade(ellipse(8, 14.5, 6.8, 3.8), "dirt", [0, 1, 2, 3]),
      rows(
        pad(
          `
          ................
          .......b........
          ......ss........
          ...........s....`,
          10,
        ),
        { b: c("leaf", 1), s: c("onion_flesh", -1) },
        "chapter_crops",
      ),
    ),
  "ui",
);

// A parchment scroll with an ink "?": "how to play". Hand-authored in pixels/chapter_how_to_play.txt;
// this flat version is only the fallback.
def(
  "ui",
  "chapter_how_to_play",
  () =>
    rows(
      `
      ................
      ..bbbbbbbbbbbbb.
      ..bbbbbbbbbbbbb.
      ...WWWWWWWWWWW..
      ...WWWkkkkkWWW..
      ...WWkkWWWkkWW..
      ...WWWWWWWkkWW..
      ...WWWWWWkkWWW..
      ...WWWWWkkWWWW..
      ...WWWWWkkWWWW..
      ...WWWWWWWWWWW..
      ...WWWWWkkWWWW..
      ...WWWWWWWWWWW..
      ..bbbbbbbbbbbbb.
      ..bbbbbbbbbbbbb.
      ................`,
      { b: c("wood", 2), W: c("cream", 1), k: c("bark", 0) },
      "chapter_how_to_play",
    ),
  "ui",
);

// A magnifying glass over a tomato: "look at what you have". Handle bottom left, lens top right.
def(
  "ui",
  "chapter_what_can_i_make",
  () =>
    stack(
      shade(
        capsule([
          [2, 14, 1.3],
          [6, 10, 1.3],
        ]),
        "wood",
        [1, 1, 1, 3, 3],
      ),
      shade(ellipse(9.5, 6.5, 5.5, 5.5), "iron", [0, 1, 1, 3, 3]),
      shade(ellipse(9.5, 6.5, 3.6, 3.6), "glass", [2, 2, 2, 3, 3]),
      rows(
        `
        ................
        ................
        ................
        ........W.......
        .......W..rr....
        .........rrrr...
        .........rrro...
        ..........oo....
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................`,
        { W: c("sugar", -1), r: c("tomato", 2), o: c("tomato", 1) },
        "chapter_what_can_i_make",
      ),
    ),
  "ui",
);

def(
  "ui",
  "needs_heat",
  () =>
    stack(
      shade(
        mask(`
          ................
          .......#........
          ......##........
          ......###....#..
          ..#...####..##..
          ..##..#####.##..
          ..###.#########.
          ..#############.
          ..############..
          .#############..
          .#############..
          ..############..
          ..###########...
          ...#########....
          .....#####......
          ................`),
        "fire",
        [0, 1, 1, 1],
      ),
      rows(
        `
        ................
        ................
        ................
        ................
        ................
        ................
        .......2........
        ......222.......
        .....22322......
        ....2223222.....
        ....2233322.....
        ....2234322.....
        .....22322......
        ......222.......
        ................
        ................`,
        L("fire", "01234"),
        "needs_heat",
      ),
    ),
  "ui",
);

// --- Recipe-book art (D14): our own drawings of the vanilla ingredients and book props ----------
// The book is rendered from our art only. Colours come from palette.json (sampled from vanilla);
// the shapes are drawn here, so each icon reads as the vanilla item without copying its sprite.
// File name = the vanilla id without "minecraft:".

const ing = (name, draw) => def("ingredients", name, draw, "ingredients");

// The shared bowl base, empty: the dark inside every bowl dish has, and a glint on the lit rim.
ing("bowl", () =>
  stack(
    bowl(),
    rows(
      pad(`
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ...W............
        ..WW............`),
      { W: c("sugar", -1) },
      "bowl",
    ),
  ),
);

// Long items run from bottom left to top right: carrot tip bottom left, leaves top right.
ing("carrot", () =>
  stack(
    shade(
      capsule([
        [2.6, 13.4, 0.6],
        [5, 11, 1.6],
        [9.2, 6.8, 2.4],
        [10.4, 5.6, 2.3],
      ]),
      "carrot",
    ),
    rows(
      pad(`
        .............d..
        ..........d.dc..
        ...........dcbd.
        ..........ccbbc.
        ..........bbb...
        ................
        ......1.........
        .......1........
        ....1...........
        .....1..........`),
      { ...L("leaf", " bcd"), 1: c("carrot", 1) },
      "carrot",
    ),
  ),
);

ing("potato", () =>
  stack(
    shade(
      capsule([
        [4.4, 10.2, 3.4],
        [11.2, 7.4, 3.6],
      ]),
      "potato",
    ),
    rows(
      pad(`
        ................
        ................
        ................
        ................
        ................
        ......4.........
        .....4....1.....
        ................
        ......1.........
        ..........1.....`),
      { 1: c("potato", 1), 4: c("potato", -1) },
      "potato",
    ),
  ),
);

// A short, fat diagonal loaf with score marks across the top (fatter than the veggie sub).
ing("bread", () =>
  stack(
    shade(
      capsule([
        [5.2, 10.4, 3.9],
        [10, 5.6, 3.9],
      ]),
      "bread",
      [0, 2, 3, 4, 3],
    ),
    rows(
      pad(`
        ................
        ................
        ................
        .........4......
        ..........1.....
        ......4.........
        .......1........
        ...4............
        ....1...........`),
      { 1: c("bread", 2), 4: c("bread", 4) },
      "bread",
    ),
  ),
);

// Raw beef: a red steak with white fat marbling and a fat rim along the top.
ing("beef", () =>
  stack(
    shade(
      mask(`
        ................
        ................
        ................
        .......####.....
        ....########....
        ...##########...
        ..############..
        ..#############.
        .##############.
        .#############..
        .############...
        ..##########....
        ...#######......
        ................
        ................
        ................`),
      "chili",
      [0, 1, 2, 3, 3],
    ),
    rows(
      pad(`
        ................
        ................
        ................
        .......WWWW.....
        ....WWW.........
        ...W............
        ..W.....w.......
        ..W....w...w....
        .W....w...w.....
        .....w...w......
        ..........w.....`),
      { W: c("onion_flesh", -1), w: c("onion_flesh", 3) },
      "beef",
    ),
  ),
);

// Raw chicken: a plucked, pale pink bird with a leg and a pale bone end.
// Raw mutton: a lamb chop, pink-red meat with a cream fat rim and the bone sticking out bottom
// left, so it never reads as the beef steak.
ing("mutton", () =>
  stack(
    shade(
      mask(`
        ................
        ................
        ................
        ......#####.....
        ....#########...
        ...###########..
        ...###########..
        ...###########..
        ...##########...
        ....########....
        ....######......
        ...###..........
        ..###...........
        .###............
        .##.............
        ................`),
      "tomato",
      [0, 1, 1, 2, 2],
    ),
    rows(
      pad(`
        ................
        ................
        ................
        ......WWWWW.....
        ....WW.....WW...
        ...W.........W..
        ...W.....w...W..
        ...W...w.....W..
        ...W..w....ww...
        ....W.....w.....
        ....WWW.........
        ...BBB..........
        ..BBb...........
        .BBb............
        .Bb.............`),
      { W: c("onion_flesh", -1), w: c("onion_flesh", 3), B: c("sugar", -1), b: c("sugar", 1) },
      "mutton",
    ),
  ),
);

// Stick: a thin twig from bottom left to top right, like vanilla's.
ing("stick", () =>
  rows(
    `
    ................
    ................
    ............hd..
    ...........hd...
    ..........hd....
    .........hk.....
    ........hd......
    .......hd.......
    ......hd........
    .....hd.........
    ....hd..........
    ...hd...........
    ..hd............
    ..d.............
    ................
    ................`,
    { h: c("wood", 4), d: c("bark", 1), k: c("bark", 3) },
    "stick",
  ),
);

ing("chicken", () =>
  stack(
    shade(
      union(
        ellipse(7.5, 9.5, 6, 4.6),
        capsule([
          [11, 6.5, 1.8],
          [13, 3.2, 1.2],
        ]),
      ),
      "onion_flesh",
      [1, 2, 3, 4, 3],
    ),
    rows(
      pad(`
        ................
        ................
        .............WW.
        ............WW..
        ................
        ................
        ...pp...........
        ..p.......p.....
        ..........p.....
        ....p......p....
        ..........pp....
        .....pp.........`),
      { W: c("sugar", -1), p: c("strawberry", 3) },
      "chicken",
    ),
  ),
);

/** A fish lying from bottom left (forked tail) to top right (head): eye, back stripe, fin. */
function fish(body, back, belly) {
  return stack(
    shade(
      union(
        capsule([
          [5.6, 9.6, 2.5],
          [9.8, 5.4, 3.4],
          [11.6, 3.6, 2.2],
        ]),
        mask(`
          ................
          ................
          ................
          ................
          ................
          ................
          ................
          ................
          ................
          ................
          ##..............
          .###............
          ..###...........
          .#.##...........
          ................
          ................`),
      ),
      body,
    ),
    rows(
      pad(`
        ................
        ..........bb....
        .........bbbb...
        ........bbb..k..
        .......bbb......
        ......bbb.......
        .....bb.........
        ................
        ........l.......
        .......l........
        ......l.........`),
      { b: back, k: c("bowl", 0), l: belly },
      "fish",
    ),
  );
}

ing("cod", () => fish("pork", c("bark", 2), c("pork", -1)));
ing("salmon", () => fish("fish", c("iron", 1), c("fish", -1)));

ing("sugar", () =>
  stack(
    shade(
      mask(`
        ................
        ................
        ................
        ................
        ................
        .......##.......
        ......####......
        .....######.....
        ....########....
        ...##########...
        ..############..
        ..############..
        ...##########...
        ................
        ................
        ................`),
      "sugar",
      [0, 1, 2, 3, 3],
    ),
    rows(
      pad(`
        ................
        ................
        ................
        ................
        ................
        ................
        .......W........
        ......W...W.....
        ..........W.....
        .....W.......W..
        ....W.....W.....`),
      { W: c("cream", -1) },
      "sugar",
    ),
  ),
);

ing("glass_bottle", () =>
  stack(
    shade(
      union(
        ellipse(7.5, 10, 5.2, 4.6),
        mask(`
          ................
          ......####......
          ......####......
          .......##.......
          .......##.......
          ......####......`),
      ),
      "glass",
      [0, 1, 3, 3, 1],
    ),
    rows(
      pad(`
        ................
        ................
        ................
        ................
        ................
        ................
        ....W...........
        ...W............
        ...W............`),
      { W: c("sugar", -1) },
      "glass_bottle",
    ),
  ),
);

// The whole vanilla-style cake (the strawberry cake item is a slice): white frosting with red
// dots on a brown sponge, 12 px wide so it never matches the tall pot.
ing("cake", () =>
  rows(
    `
    ................
    ................
    ................
    ................
    .....FFFFFF.....
    ...fFFrFFFFFe...
    ..fFrFFFFFrFFe..
    ..fFFFFrFFFFee..
    ..SfSSfSSSfSs...
    ..SSSSSSSSSSss..
    ..SSSSSSSSSsss..
    ..ssssssssssss..
    ...kkkkkkkkkk...
    ................
    ................
    ................`,
    {
      F: c("cream", -1),
      f: c("cream", 1),
      e: c("cream", 0),
      r: c("tomato", 2),
      S: c("sponge", 3),
      s: c("sponge", 1),
      k: c("sponge", 0),
    },
    "cake",
  ),
);

// Cooked porkchop: a browned chop with grill marks and a rib bone sticking out.
ing("cooked_porkchop", () =>
  stack(
    shade(
      mask(`
        ................
        ................
        ................
        ................
        ......#####.....
        ....########....
        ...##########...
        ..###########...
        ..############..
        ..###########...
        ...#########....
        ....######......
        ................
        ................
        ................
        ................`),
      "pork",
    ),
    rows(
      pad(`
        ..............WW
        .............Ws.
        ............Ws..
        ...........Ws...
        ................
        .......1........
        ......1...1.....
        .....1...1......
        ....1...1...1...
        .......1...1....
        ......1...1.....`),
      { 1: c("pork", 1), W: c("sugar", -1), s: c("sugar", 1) },
      "cooked_porkchop",
    ),
  ),
);

// A closed leather book lying at an angle, pages showing along the bottom right.
ing("book", () =>
  rows(
    `
    ................
    ................
    .........cccc...
    ......ccCCCCCd..
    ...ccCCCCCCCdd..
    ..cCCCCCCCCdpd..
    ..cCCCCCCCdppd..
    ..cCCCCCCdppd...
    ..cCCCCCdppd....
    ..cCCCCdppd.....
    ..cCCCdppd......
    ..ccCdppd.......
    ...dddpd........
    ....ddd.........
    ................
    ................`,
    { c: c("leather", 3), C: c("leather", -1), d: c("leather", 1), p: c("paper", -1) },
    "book",
  ),
);

// --- Book props ---

ing("short_grass", () =>
  rows(
    `
    ................
    ................
    ..........e.....
    ...e......d.....
    ...d..e...d..e..
    ...dc.d..cd..d..
    ...cc.dc.cc..d..
    .e.cb.cc.cb.dc..
    .d.bb.cb.bb.cc..
    .dcb.ccb.b..cb..
    ..cb.cbb.bc.cb..
    ..bb.bb..bb.bb..
    ..bb.bb..bb.bb..
    ..b..b...b...b..
    ................
    ................`,
    { b: c("leaf", 0), c: c("leaf", 2), d: c("leaf", 3), e: c("leaf", 4) },
    "short_grass",
  ),
);

ing("crafting_table", () =>
  rows(
    `
    ................
    ..dddddddddddd..
    ..d4444d44444d..
    ..d4334d43344d..
    ..dddddddddddd..
    ..d4444d44444d..
    ..dddddddddddd..
    ..2333333333221.
    ..2iII33333h221.
    ..2iIk333hhh221.
    ..23Ik33hhhk221.
    ..233k333hk3221.
    ..233k3333k3221.
    ..2333333333221.
    ..1111111111111.
    ................`,
    {
      d: c("bark", 1),
      4: c("wood", 4),
      3: c("wood", 3),
      2: c("wood", 2),
      1: c("wood", 0),
      i: c("iron", 1),
      I: c("iron", -1),
      k: c("bark", 0),
      h: c("bark", 3),
    },
    "crafting_table",
  ),
);

ing("campfire", () =>
  stack(
    rows(
      `
      ................
      ................
      .......f........
      ......ff........
      ......ff.f......
      .....fFfff......
      .....fFFff......
      ....ffFYFff.....
      ....fFYYYFf.....
      .....fFYFf......
      ................
      .LLLLlllllllll..
      ..kkkkLLkkkkk...
      .LLLLLLlllllll..
      ..kkkkkkkkkkk...
      ................`,
      {
        f: c("fire", 0),
        F: c("fire", 2),
        Y: c("fire", -1),
        L: c("bark", 3),
        l: c("bark", 2),
        k: c("bark", 0),
      },
      "campfire",
    ),
  ),
);

// Farmland: a tilled block with furrows on top and two sprouts, so it never reads as a plain
// dirt or wood cube.
ing("farmland", () =>
  rows(
    `
    ................
    ....g......g....
    ...gG.....gG....
    ....G......G....
    .11111111111111.
    .1222222222222s.
    .11111111111111.
    .1222222222222s.
    .33333333333333.
    .3333333333333s.
    .3332333333233s.
    .3333333323333s.
    .3323333333333s.
    .3333333333333s.
    .ssssssssssssss.
    ................`,
    {
      g: c("leaf", 4),
      G: c("leaf", 2),
      1: c("dirt", 1),
      2: c("dirt", 3),
      3: c("dirt", 2),
      s: c("bark", 0),
    },
    "farmland",
  ),
);

// --- Biome hints for the crop pages: small scenes with distinct silhouettes ---------------------

const biome = (name, draw) => def("ui", `biome_${name}`, draw, "biomes");

// Plains: a strip of grass block with tall grass and a dandelion.
biome("plains", () =>
  rows(
    `
    ................
    ................
    ................
    ................
    ................
    .......y........
    ..d...yYy..c....
    ..dc..dyd.dc.d..
    .dcb.dcbc.cb.dc.
    .cbb.cbbc.bb.cb.
    .eeeeeeeeeeeeee.
    .dddddddddddddd.
    .ssssSsssssSsss.
    .SssssssSssssss.
    ................
    ................`,
    {
      ...L("leaf", " bcde"),
      y: c("flower_yellow", 1),
      Y: c("flower_yellow", -1),
      s: c("dirt", 1),
      S: c("dirt", 2),
    },
    "biome_plains",
  ),
);

/** A round-canopy tree (oak or cherry) as a mask-shaded blob on a trunk. */
function roundTree(cx, cy, r, leaves, trunkX, trunkTop, trunkBottom) {
  const trunk = blank();
  for (let y = trunkTop; y <= trunkBottom; y++) {
    trunk[y * S + trunkX] = c("bark", 2);
    trunk[y * S + trunkX + 1] = c("bark", 0);
  }
  return stack(trunk, shade(ellipse(cx, cy, r, r * 0.9), leaves, [0, 1, 2, 3, 3]));
}

// Forest: two oaks side by side.
biome("forest", () =>
  stack(
    roundTree(4.5, 5.5, 3.6, "leaf", 4, 7, 13),
    roundTree(10.5, 4.5, 4, "leaf", 10, 7, 13),
    rows(pad(`..eeeeeeeeeeee..`, 13), { e: c("leaf", 4) }, "biome_forest"),
  ),
);

// Cherry grove: one wide pink blossom tree with a dark trunk.
biome("cherry_grove", () =>
  stack(
    roundTree(8, 5.5, 5.8, "frosting", 7, 9, 13),
    rows(
      pad(`
        ................
        ................
        .....W.....W....
        ...W......W.....
        ........W.......
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ..eeeeeeeeeeee..`),
      { W: c("frosting", -1), e: c("leaf", 4) },
      "biome_cherry_grove",
    ),
  ),
);

// Taiga: two dark spruces in stacked tiers, snow on the tips.
biome("taiga", () =>
  rows(
    `
    ................
    ....W...........
    ....d......W....
    ...Wcb.....d....
    ..dccbb...Wcb...
    ...Wcb...dccbb..
    ..dccbb...Wcb...
    .Wcccbbb.dccbb..
    ..dccbb.Wcccbbb.
    .Wcccbbb..dcb...
    dccccbbbbdccbb..
    ....kk..dcccbbb.
    ....kk.....kk...
    .ssssssssssssss.
    ................
    ................`,
    { ...L("bush", "abcd"), W: c("sugar", -1), k: c("bark", 0), s: c("dirt", 0) },
    "biome_taiga",
  ),
);

// Savanna: a flat-topped acacia over dry grass.
biome("savanna", () =>
  rows(
    `
    ................
    ................
    ...dddddddddd...
    .dddcccccccccdd.
    ..bbbbbbbbbbbb..
    ......k...k.....
    .......k.k......
    ........k.......
    ........k.......
    .......kk.......
    .......kk.......
    ..y....kk..y....
    .yYy.yykkyyYy...
    .YYYYYYYYYYYYYY.
    ................
    ................`,
    {
      ...L("cucumber", " bcd"),
      k: c("sponge", 1),
      y: c("potato", 2),
      Y: c("potato", -1),
    },
    "biome_savanna",
  ),
);

// Jungle: one tall tree with a big bright crown, vines and a cocoa pod.
biome("jungle", () =>
  rows(
    `
    ..ddddddddddd...
    .dddccccccccdd..
    .dcccccccccccbd.
    ..bbbbbkkbbbbb..
    ..v.v..kk..v.v..
    ..v.v..kk..v....
    ..v....kko.v....
    ..v....kko......
    .......kk.......
    .......kk.......
    .......kk.......
    ......kkkk......
    .....kk..kk.....
    ................
    ................
    ................`,
    {
      ...L("cucumber_flesh", " bcd"),
      k: c("bark", 2),
      v: c("leaf", 1),
      o: c("carrot", 2),
    },
    "biome_jungle",
  ),
);

// Badlands: a terracotta butte in coloured bands, with a cactus.
biome("badlands", () =>
  rows(
    `
    ................
    ................
    .....111111.....
    .....222222.....
    .....333333.....
    .....444444..g..
    .....111111.gg..
    ....55555555gg..
    ...2222222222g..
    ..333333333333..
    .44444444444444.
    .11111111111111.
    .22222222222222.
    ................
    ................
    ................`,
    {
      1: c("sponge", 3),
      2: c("carrot", 2),
      3: c("onion_flesh", 3),
      4: c("sponge", 1),
      5: c("potato", 3),
      g: c("cucumber", 1),
    },
    "biome_badlands",
  ),
);

// Swamp: a murky pool with lily pads and cattails.
biome("swamp", () =>
  rows(
    `
    ................
    ................
    ...k......k.....
    ...k.....kk.....
    ...k.....kk.....
    ...g.....g......
    ...g.....g......
    ..gg....gg......
    ..g.....g.......
    .wwwwwwwwwwwwww.
    .wLLwwwwwwWwww..
    .wwwwwwLLwwwww..
    ..wwWwwwwwwwLL..
    ...xxxxxxxxxx...
    ................
    ................`,
    {
      k: c("bark", 1),
      g: c("leaf", 2),
      L: c("leaf", 4),
      w: c("bush", 1),
      W: c("bush", -1),
      x: c("bush", 0),
    },
    "biome_swamp",
  ),
);

// River: blue water with light wave crests between two grassy banks.
biome("river", () =>
  rows(
    `
    ................
    ................
    ................
    ................
    .eeeeeeeeeeeeee.
    .dddddddddddddd.
    .gggggggggggggg.
    .gWWgggggWWgggg.
    .ggggWWgggggWWg.
    .GGGGGGGGGGGGGG.
    .eeeeeeeeeeeeee.
    .dddddddddddddd.
    ................
    ................
    ................
    ................`,
    {
      e: c("leaf", 4),
      d: c("leaf", 1),
      g: c("glass", 1),
      G: c("glass", 0),
      W: c("glass", -1),
    },
    "biome_river",
  ),
);

// Meadow: a light green hill dotted with flowers.
biome("meadow", () =>
  stack(
    shade(ellipse(8, 14, 7.5, 8), "cucumber_flesh", [1, 2, 3, 4, 3]),
    rows(
      `
      ................
      ................
      ................
      ................
      ................
      ................
      .......w........
      ....p.wyw..y....
      ...pPp.w..yYy...
      ....p....w.y....
      ..y.....wyw..p..
      .yYy.....w..pPp.
      ..y....p.....p..
      ......pPp.......
      .......p........
      ................`,
      {
        w: c("flower_white", -1),
        y: c("flower_yellow", 2),
        Y: c("flower_yellow", -1),
        p: c("strawberry", 2),
        P: c("strawberry", 4),
      },
      "biome_meadow",
    ),
  ),
);

// --- Cooking pot variants, derived from the S8 model textures ------------------------------------

function potTexture(name) {
  return fromImage(decodePng(readFileSync(path.join(POT_TEXTURES, `${name}.png`))));
}

const sameColour = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// Pot liquid colours, one per value of the pot's hk:liquid state (LIQUIDS in
// packs/harvest_kitchen/scripts/data/liquids.ts; tests/pack-files.test.ts checks that every id has
// both PNGs in the pack). `shades` replace the S8 liquid's four shades rank for rank (dark → light),
// so every colour keeps the S8 ripples. `glint` colours the ready sparkle: its arms (default: the
// lightest liquid shade) and its centre (default: the lightest cream). Tomato is the S8 texture.
const POT_LIQUIDS = {
  water: () => ({ shades: [c("glass", 0), c("glass", 1), c("glass", 2), c("glass", 3)] }),
  tomato: () => ({ shades: P.pot_liquid.map((rgb) => [...rgb, 255]) }),
  chili: () => ({ shades: [c("beet", 0), c("beet", 1), c("beet", 3), c("beet", 4)] }),
  jam: () => ({
    shades: [c("strawberry", 0), c("strawberry", 1), c("strawberry", 2), c("strawberry", 3)],
  }),
  stew: () => ({ shades: [c("meat", 1), c("meat", 2), c("meat", 3), c("meat", 4)] }),
  broth: () => ({ shades: [c("onion", 1), c("onion", 2), c("onion", 3), c("onion", 4)] }),
  cream: () => ({
    shades: [c("onion_flesh", 2), c("cream", 0), c("cream", 1), c("cream", 2)],
    // pale on pale: a golden sparkle so the ready glint still shows
    glint: { arms: c("flower_yellow", 2) },
  }),
  eggplant: () => ({
    shades: [c("eggplant", 0), c("eggplant", 1), c("eggplant", 2), c("eggplant", 3)],
  }),
  curry: () => ({
    shades: [
      c("cucumber_flesh", 1),
      c("cucumber_flesh", 2),
      c("cucumber_flesh", 3),
      c("cucumber_flesh", 4),
    ],
  }),
};

/** The S8 liquid recoloured: each S8 shade (P.pot_liquid, dark → light) → `shades` at its rank. */
function potLiquid(shades) {
  const base = potTexture("cooking_pot_liquid");
  if (P.pot_liquid.length !== shades.length) {
    throw new Error(
      `pot liquid has ${P.pot_liquid.length} shades, the recolour gives ${shades.length}`,
    );
  }
  return base.map((v) => {
    const k = P.pot_liquid.findIndex((g) => sameColour(g, v));
    if (k < 0) throw new Error("cooking_pot_liquid.png has a colour outside its own ramp");
    return shades[k];
  });
}

for (const [liquid, look] of Object.entries(POT_LIQUIDS)) {
  def("blocks", `cooking_pot_liquid_${liquid}`, () => potLiquid(look().shades), "pot");
  def(
    "blocks",
    `cooking_pot_liquid_${liquid}_ready`,
    () => {
      const { shades, glint } = look();
      return stack(
        potLiquid(shades),
        rows(
          `
          ................
          ................
          ....l...........
          ...lWl..........
          ....l......l....
          ..........lWl...
          ...........l....
          ................
          ......l.........
          .....lWl........
          ......l.....l...
          ................
          ..l.............
          ................
          .........l......
          ................`,
          { l: glint?.arms ?? shades[shades.length - 1], W: glint?.center ?? c("cream", -1) },
          `cooking_pot_liquid_${liquid}_ready`,
        ),
      );
    },
    "pot",
  );
}

def(
  "blocks",
  "cooking_pot_top_hot",
  () => {
    // Rim = the grey (iron) pixels. Warm them up shade for shade, and make the outer edge glow.
    const top = potTexture("cooking_pot_top");
    const iron = P.pot_iron.map((rgb) => [...rgb, 255]);
    const warm = [c("pot_copper", 0), c("pot_copper", 1), c("pot_copper", 2)];
    return top.map((v, i) => {
      const k = iron.findIndex((g) => sameColour(g, v));
      if (k < 0) return v;
      const x = i % S;
      const y = Math.floor(i / S);
      const border = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      if (border) return (x + y) % 4 === 0 ? c("fire", 3) : c("fire", x === 0 || y === 0 ? 2 : 1);
      return warm[Math.min(k, warm.length - 1)];
    });
  },
  "pot",
);

// --- Crops (cross "#" model, transparent, plant grows up from the bottom row) ------------------

/** Crop legend: a–e = foliage ramp (dark → light), 0–4 = fruit ramp, y/Y = flower, w/W = white
 *  flower, s = dry/soil accent. */
function cropLegend(foliage, fruit, fruitShades = "11234") {
  return {
    ...L(foliage, "abcde"),
    a: c(foliage, 1), // 4 foliage shades: crop stages allow 8 colours in all
    ...(fruit
      ? Object.fromEntries([..."01234"].map((ch, i) => [ch, c(fruit, +fruitShades[i])]))
      : {}),
    y: c("flower_yellow", 1),
    Y: c("flower_yellow", -1),
    w: c("flower_white", 1),
    W: c("flower_white", -1),
    s: c("onion", 4),
  };
}

const CHILI_BUSH_FULL = `
  ................
  ................
  ................
  .....edde.......
  ...edddcdde.....
  ..edcWdcbcdde...
  .edcdcbcdcdWd...
  .dcbdbcbcbdcd...
  .cbcdcbebcbcd...
  ..dcbWbcbcdcbd..
  .edcbcbcdcbcde..
  .dcbcbbcbcbcbc..
  ..cbcbebcbbcb...
  ...bbcbbcbbb....
  .....bbbbb......
  .......b........`;

const CROPS = {
  tomato_crop: {
    legend: () => cropLegend("leaf", "tomato"),
    stages: [
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      .ed.de....ed.de.
      ..cbc......cbc..
      ...b...dc...b...`,
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      .......ee.......
      ....eddcdd......
      ...dcc.bcce.....
      ..dcb..b.dcd....
      .....edbdcbcd...
      ...edcbb..b.....
      ..dcb..b........
      .......b........`,
      `
      ................
      ................
      ................
      .......ed.......
      ...y.eddcde.....
      ..yYdcc.bccd.y..
      ...dcb..b.dcdYy.
      ..dcb.edbdc.cb..
      .edc..dcbbcd....
      ..b.edcb..bcd...
      ...dcc.bedc.ccd.
      .Yedb..bdcb..b..
      .ydcbedcb.cd....
      ...b.dcbbcbcd...
      ....dcb.b..b....
      .......b........`,
      `
      ................
      ......ede.......
      ....edcdcbe.....
      ...dcc.bcbcd....
      ..dcb.edbdcdcd..
      ..b..dcbbc.21b..
      .21.dcb.b..2431.
      2431.edbdcb1221.
      1221dcbbcd..10..
      .10.edcb.bcd....
      ...dcc.bedc.ccd.
      .edcb.21dcb..b..
      ..dcb2431.cd....
      ...b.1221bcbcd..
      ....dc10b..b....
      .......b........`,
    ],
  },
  onion_crop: {
    legend: () => cropLegend("bush", "onion"),
    stages: [
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ...e.....e......
      ...d.e...d...e..
      ...c.d...c.e.d..
      ...c.c...c.d.c..
      ...b.b...b.c.b..`,
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ..e....e........
      ..d.e..d....e...
      ..d.d..c..e.d...
      ..c.d..c..d.c.e.
      ..c.c.ec..d.c.d.
      ..c.c.dc..c.c.d.
      ..c.c.cb..c.b.c.
      ..b.b.cb..b.b.c.
      ..b.b.bb..b.b.b.`,
      `
      ................
      ................
      ................
      .e.....e........
      .d..e..d...e....
      .d..d..d...d..e.
      .c..d..c.e.d..d.
      .c..c..c.d.c..d.
      ..c.c.ec.d.c..c.
      ..c.c.dc.c.c.c..
      ..c.c.dc.c.c.c..
      ..c.c.cb.c.b.c..
      ..c.b.cb.c.b.c..
      ..b.b.cb.b.b.b..
      ..b.b.bb.b.b.b..
      .1331.bb.1331...`,
      `
      ................
      ................
      ..e.....e.......
      ..d..e..d...e...
      ...d.d..d...d...
      ...d.d..c...d.e.
      ...c..c.c..d..d.
      ss.c..c.c..c.d..
      ..sc..c.c.c..c..
      ...cs.cbc.c.c...
      ....c.cbccc.c...
      ....c.cbc.bc....
      ...234c4b3432...
      ..23443b234432..
      ..133421133421..
      ...1221..1221...`,
    ],
  },
  cucumber_crop: {
    legend: () => cropLegend("leaf", "cucumber"),
    stages: [
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ..dde....edd....
      ...bcc..ccb.....
      .....bbb........`,
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ......dde.......
      ....edccdd......
      ....cdcbcc......
      .....bcb.b......
      .dde...b..edd...
      ..bccb.b.bccb...
      ....bbbbbb......
      .......b........`,
      `
      ................
      ................
      ................
      ................
      .....dde........
      ...edccdd..Y....
      ...cdcbcc.YyY...
      ..Y.bcb.b..Y....
      .YyY..b.ddde....
      ..Y..edccdccd...
      ...b.cdcbbcc....
      ...dde.b.b..edd.
      ..bccbcb...bccb.
      ...bb..bb.bb....
      .......b........
      .......b........`,
      `
      ................
      ................
      ...dde....dde...
      .edccdd.edccdd..
      .cdcbcc.cdcbcc..
      ..bab.b.bb.ba...
      ..aa..edde..aa..
      .a43a.dccdd.a43a
      .a32a.cbcc..a32a
      .a42a..b..e.a42a
      .a32a.dde.d.a32a
      .a31abccdd..a31a
      ..aa..bccb..a21a
      ..dde..b.....aa.
      ...bccbbbbccb...
      .......b........`,
    ],
  },
  chili_bush: {
    legend: () => cropLegend("bush", "chili"),
    stages: [
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ......ede.......
      ....eddcdde.....
      ....dcc.ccd.....
      .....bcbcb......
      .......b........`,
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      .....edde.......
      ...edcdcdde.....
      ..edcdcbcdcd....
      ..dcbdbcbcdc....
      ...cbcbbbcbc....
      ...bcbebcbb.....
      ....bbcbbb......
      ......bb........
      .......b........`,
      CHILI_BUSH_FULL,
      () =>
        stack(
          rows(
            CHILI_BUSH_FULL.replace(/W/g, "c"),
            cropLegend("bush", "chili"),
            "chili_bush_stage_3",
          ),
          ...[
            [3, 7],
            [9, 5],
            [6, 10],
            [12, 9],
          ].map(([x, y]) =>
            stamp(
              `
              cd
              43
              32
              21
              1.`,
              cropLegend("bush", "chili"),
              x,
              y,
            ),
          ),
        ),
    ],
  },
  strawberry_bush: {
    legend: () => cropLegend("leaf", "strawberry", "11233"),
    stages: [
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      .....ed.de......
      ....dcc.ccd.....
      .....bcbcb......
      .......b........`,
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ....ede.ede.....
      ...edcd.dcde....
      ...dcbc.cbcd....
      ..ede.b.b.ede...
      ..dcd.bbb.dcd...
      ..cbcb.b.bcbc...
      ....bbbbbbb.....
      .......b........`,
      `
      ................
      ................
      ................
      ................
      ................
      ....ede.ede.....
      ...edcd.dcde....
      ...dcbcWdcbcd...
      .edebcbYbcb.ede.
      .dcdcb.W..bcdcd.
      .cbcb.bbb..bcbc.
      ...b.ede.ede.b..
      ..Wb.dcd.dcd.bW.
      .WYWbcbcbcbcbWYW
      ..Wbbbbbbbbbb.W.
      .......b........`,
      `
      ................
      ................
      ................
      ................
      ................
      ....ede.ede.....
      ...edcd.dcde....
      ...dcbcbdcbcd...
      .edebcb.bcb.ede.
      .dcdcbdcd.bcdcd.
      .cbcb.343.cbcbc.
      .dc.b.4y3.de.b..
      3443dc32.dcddc..
      4y32bcb.bcb3443.
      32y2.bbbbbb4y32.
      .21....b...32y2.`,
    ],
  },
  eggplant_crop: {
    legend: () => cropLegend("leaf", "eggplant"),
    stages: [
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      .....ed..de.....
      ....dcc..ccd....
      ......cbbc......
      .......bb.......`,
      `
      ................
      ................
      ................
      ................
      ................
      ................
      ................
      ......ede.......
      ....edcdcd..e...
      ...dcbcbcde.d...
      ..edcb.b.cdcd...
      ..dcb..b..bcd...
      ...b.edbde.b....
      ....dcbbbcd.....
      .....bcbcb......
      .......b........`,
      `
      ................
      ................
      ................
      ......ede.......
      ....edcdcde.....
      ...dcb3bcbcd....
      ..edcbcbcd4de...
      ..dcb.cbc.bcd...
      .edc..bbb..cde..
      .dcb.edbde.bcd..
      ..b.dc3bcd4.b...
      ...dcbcbbcbcd...
      ....bcb.bcb.....
      .....bbbbb......
      ......bbb.......
      .......b........`,
      `
      ................
      ................
      ................
      ......ede.......
      ....edcdcde.....
      ...dcbcbcbcd....
      ..edcbcbcdcde...
      ..dcbdcbcd.cd...
      .edc.4bbb.dcde..
      .dcb.43bde4bcd..
      ..b.d32bcd43b...
      ...d.32bb.32d...
      ..dc.21bb.21....
      ....b.1bbb.1....
      .....bbbbb......
      .......b........`,
    ],
  },
};

for (const [crop, { legend, stages }] of Object.entries(CROPS))
  stages.forEach((spec, i) =>
    def(
      "blocks",
      `${crop}_stage_${i}`,
      () => (typeof spec === "function" ? spec() : rows(spec, legend(), `${crop}_stage_${i}`)),
      crop,
    ),
  );

// === MAIN ===

/** Ramp name -> hue-shifted shades ([r, g, b], dark → light), after loadPalette(). */
export const ramps = () => P;

export function loadPalette() {
  const { ramps } = JSON.parse(readFileSync(PALETTE_FILE, "utf8"));
  P = Object.fromEntries(
    Object.entries(ramps).map(([k, v]) => [k, hueShift(v.shades.map(fromHex))]),
  );
  // The pot ramps stay raw: the pot icon must match the S8 model textures pixel for pixel.
  Object.assign(P, potRamps());
}

const SCALE = 4;
const GAP = 4;

function contactSheet(rendered) {
  const groups = [];
  for (const r of rendered) {
    let g = groups.find((x) => x.row === r.row);
    if (!g) groups.push((g = { row: r.row, items: [] }));
    g.items.push(r);
  }
  const cell = S * SCALE + GAP;
  const w = GAP + Math.max(...groups.map((g) => g.items.length)) * cell;
  const h = GAP + groups.length * cell;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = ((x >> 3) + (y >> 3)) & 1 ? 0x80 : 0x92;
      px.set([v, v, v, 255], (y * w + x) * 4);
    }
  const lines = [
    `Contact sheet: each texture at ${SCALE}x, rows top to bottom, files left to right.`,
    "",
  ];
  groups.forEach((g, row) => {
    lines.push(`row ${row + 1} (${g.row}): ${g.items.map((r) => r.file).join(", ")}`);
    g.items.forEach((r, col) => {
      const ox = GAP + col * cell;
      const oy = GAP + row * cell;
      r.layer.forEach((v, i) => {
        if (!v) return;
        const a = v[3] / 255;
        for (let sy = 0; sy < SCALE; sy++)
          for (let sx = 0; sx < SCALE; sx++) {
            const d = ((oy + Math.floor(i / S) * SCALE + sy) * w + ox + (i % S) * SCALE + sx) * 4;
            for (let k = 0; k < 3; k++) px[d + k] = Math.round(v[k] * a + px[d + k] * (1 - a));
          }
      });
    });
  });
  writeFileSync(path.join(OUT_DIR, "contact_sheet.png"), encodePng({ w, h, px }));
  writeFileSync(path.join(OUT_DIR, "contact_sheet.txt"), lines.join("\n") + "\n");
}

function main() {
  if (process.argv.includes("--palette")) {
    // Shade lists on one line, as prettier would format them.
    const json = JSON.stringify(samplePalette(), null, 2).replace(
      /\[\s+("#[^\]]*?)\s+\]/g,
      (_, inner) => `[${inner.split(/,\s+/).join(", ")}]`,
    );
    writeFileSync(PALETTE_FILE, json + "\n");
    console.log(`wrote ${path.relative(ROOT, PALETTE_FILE)}`);
  }
  loadPalette();
  checkGridNames(SPRITES);
  for (const dir of ["blocks", "items", "ui", "ingredients"])
    rmSync(path.join(OUT_DIR, dir), { recursive: true, force: true });
  const rendered = [];
  for (const sprite of SPRITES) {
    const layer = renderSprite(sprite);
    const file = `${sprite.folder}/${sprite.name}.png`;
    mkdirSync(path.join(OUT_DIR, sprite.folder), { recursive: true });
    writeFileSync(path.join(OUT_DIR, file), encodePng(toImage(layer)));
    rendered.push({ ...sprite, file, layer });
  }
  contactSheet(rendered);
  console.log(
    `wrote ${rendered.length} textures + contact sheet to ${path.relative(ROOT, OUT_DIR)}/`,
  );
}

/** A sprite's texture: its hand-authored grid (art/harvest_kitchen/pixels/<name>.txt) when one
 *  exists, else the procedural drawing (the fallback). `procedural: true` always draws. */
export function renderSprite(sprite, { procedural = false } = {}) {
  if (!Object.keys(P).length) loadPalette();
  if (!procedural && existsSync(gridFile(sprite.name))) return readGrid(sprite.name, c).layer;
  return sprite.draw();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

// Simmerfield: mockups of the finished Kitchen Guide book (D19/D20), drawn from the real thing.
//
//   node art/simmerfield/mockups/render-book.mjs
//
// Nothing here is laid out by hand:
// - the pages are guide/guide-model.ts's buildPage() (bundled with esbuild), for a made-up player;
// - every position and size is tools/gen-guide-ui.mjs's layout(), the same one guide.json is
//   written from, and each cell is drawn the way its JSON UI template draws it;
// - textures are the pack's own (resource/textures/...), with their 9-slice sidecars, plus vanilla
//   ones from the installed game; text uses the game's own font (font/default8.png) and lang
//   files (ours and vanilla en_US), with labels cut to their boxes and "..." like JSON UI does.
// Each PNG is a 426×240 UI-px screen at GUI scale 3, like the other mockups. Hover tooltips and
// the controller focus frame aren't drawn.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
  decodePng,
  encodePng,
  readBrarchive,
  vanillaTextures,
} from "../../../tools/gen-textures.mjs";
import {
  CHIP,
  FLAME,
  INK,
  LINE,
  ROW,
  SIZE,
  T,
  layout,
  loadLayout,
} from "../../../tools/gen-guide-ui.mjs";
import {
  H,
  SCALE,
  W,
  backdrop,
  get,
  img,
  nine,
  put,
  rect,
  tile,
  upscale,
} from "./render-mockups.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const RP = path.join(ROOT, "packs/simmerfield/resource");

// --- the guide's own code ---------------------------------------------------------------------------

async function loadModel() {
  const result = await build({
    stdin: {
      contents: `export * from "./packs/simmerfield/scripts/guide/guide-model";
export { CROPS } from "./packs/simmerfield/scripts/data/crops";`,
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

// --- textures ---------------------------------------------------------------------------------------

const loadVanilla = vanillaTextures();
const textures = new Map();

/** A texture path as forms and JSON UI name it ("textures/wm_kitchen/ui/book/slot"), with its 9-slice. */
function texture(p) {
  if (textures.has(p)) return textures.get(p);
  let im;
  const ours = path.join(RP, `${p}.png`);
  if (existsSync(ours)) im = decodePng(readFileSync(ours));
  else im = loadVanilla(p.replace(/^textures\//, "")).img;
  if (!im) throw new Error(`no texture ${p}`);
  const sidecar = path.join(RP, `${p}.json`);
  const nineslice = existsSync(sidecar)
    ? JSON.parse(readFileSync(sidecar, "utf8")).nineslice_size
    : undefined;
  const entry = { im, nineslice };
  textures.set(p, entry);
  return entry;
}

const toByte = (rgb) => rgb.map((v) => Math.round(v * 255));

/** An image control: `size` px, 9-sliced when the texture has a sidecar, else stretched. */
function drawImage(dst, p, x, y, w, h, { tiled = false, color, alpha = 1 } = {}) {
  const { im, nineslice } = texture(p);
  const src = color || alpha < 1 ? shade(im, color, alpha) : im;
  if (tiled) tile(dst, src, x, y, w, h);
  else if (nineslice) nine(dst, src, x, y, w, h, nineslice);
  else scaleTo(dst, src, x, y, w, h);
}

/** `color` multiplies the texture (JSON UI image color); `alpha` fades it. */
function shade(im, color, alpha = 1) {
  const out = img(im.w, im.h);
  const c = color ?? [1, 1, 1];
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      const [r, g, b, a] = get(im, x, y);
      out.px.set(
        [Math.round(r * c[0]), Math.round(g * c[1]), Math.round(b * c[2]), Math.round(a * alpha)],
        (y * im.w + x) * 4,
      );
    }
  return out;
}

/** Nearest-neighbour stretch of the whole texture into w×h. */
function scaleTo(dst, src, x, y, w, h) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      put(dst, x + i, y + j, get(src, Math.floor((i * src.w) / w), Math.floor((j * src.h) / h)));
}

/** First frame of a flipbook (square). */
function icon(p) {
  const { im } = texture(p);
  if (im.h <= im.w) return im;
  const out = img(im.w, im.w);
  for (let y = 0; y < im.w; y++) for (let x = 0; x < im.w; x++) put(out, x, y, get(im, x, y));
  return out;
}

// --- text: the game font and lang files ---------------------------------------------------------------

// Same lookup (and env overrides) as tools/gen-textures.mjs.
const VERSIONS_DIR =
  process.env.MC_VERSIONS_DIR ??
  path.join(os.homedir(), ".var/app/io.mrarm.mcpelauncher/data/mcpelauncher/versions");
const GAME_VERSION = process.env.MC_GAME_VERSION ?? "1.26.52.3";
const VANILLA_RP = path.join(VERSIONS_DIR, GAME_VERSION, "assets/assets/resource_packs/vanilla");
const archive = (name) => readBrarchive(path.join(VANILLA_RP, "__brarchive", `${name}.brarchive`));

function parseLang(text) {
  const map = new Map();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    map.set(line.slice(0, eq), line.slice(eq + 1).replace(/\t+#.*$/, ""));
  }
  return map;
}
const LANG = new Map([
  ...parseLang(readFileSync(path.join(VANILLA_RP, "texts/en_US.lang"), "utf8")),
  ...parseLang(readFileSync(path.join(RP, "texts/en_US.lang"), "utf8")),
]);

/** Vanilla item localization keys the game would give (ItemStack.localizationKey). */
const VANILLA_KEYS = {
  "minecraft:cod": "item.fish.name",
  "minecraft:salmon": "item.salmon.name",
  "minecraft:beef": "item.beef.name",
  "minecraft:chicken": "item.chicken.name",
  "minecraft:mutton": "item.muttonRaw.name",
  "minecraft:cooked_porkchop": "item.porkchop_cooked.name",
  "minecraft:glass_bottle": "item.glass_bottle.name",
  "minecraft:cake": "item.cake.name",
};
function itemName(id) {
  if (id.startsWith("wm_kitchen:")) return { translate: `item.${id}.name` };
  const key = VANILLA_KEYS[id] ?? `item.${id.slice(10)}.name`;
  return LANG.has(key) ? { translate: key } : { text: id.slice(10).replace(/_/g, " ") };
}

/** A RawMessage as the client shows it: translated, %n$s filled in. */
function resolve(message) {
  if (!message) return "";
  if (typeof message === "string") return message;
  if (message.rawtext) return message.rawtext.map(resolve).join("");
  if (message.text !== undefined) return message.text;
  if (message.translate) {
    const args = message.with?.rawtext?.map(resolve) ?? message.with ?? [];
    let n = 0;
    return (LANG.get(message.translate) ?? message.translate)
      .replace(/%(\d+)\$s/g, (_, i) => args[Number(i) - 1] ?? "")
      .replace(/%s/g, () => args[n++] ?? "");
  }
  return "";
}

/** default8.png is a 2-bit palette PNG, which tools/gen-textures' decoder skips. */
function decodePalette2(buf) {
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let plte;
  let trns;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (name === "IHDR") [w, h, depth] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8]];
    else if (name === "PLTE") plte = data;
    else if (name === "tRNS") trns = data;
    else if (name === "IDAT") idat.push(data);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((w * depth) / 8);
  const rows = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x > 0 ? rows[y * stride + x - 1] : 0;
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const c = x > 0 && y > 0 ? rows[(y - 1) * stride + x - 1] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rows[y * stride + x] = v & 0xff;
    }
  }
  const out = img(w, h);
  const perByte = 8 / depth;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const byte = rows[y * stride + Math.floor(x / perByte)];
      const k = (byte >> (8 - depth * ((x % perByte) + 1))) & ((1 << depth) - 1);
      put(out, x, y, [plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], trns?.[k] ?? 255]);
    }
  return out;
}

const FONTS = archive("font");
const ASCII = decodePalette2(FONTS.get("default8.png"));
const PAGES = new Map();

/** A glyph as a w×8 white mask: ASCII from default8, anything else from its unicode page. */
const glyphs = new Map();
function glyph(ch) {
  if (glyphs.has(ch)) return glyphs.get(ch);
  const code = ch.codePointAt(0);
  let cell;
  if (code < 128) {
    cell = { src: ASCII, x: (code % 16) * 8, y: Math.floor(code / 16) * 8, size: 8, step: 1 };
  } else {
    const page = (code >> 8).toString(16).toUpperCase().padStart(2, "0");
    if (!PAGES.has(page)) PAGES.set(page, decodePng(FONTS.get(`glyph_${page}.png`)));
    const src = PAGES.get(page);
    const i = code & 0xff;
    cell = { src, x: (i % 16) * 16, y: Math.floor(i / 16) * 16, size: 16, step: 2 };
  }
  const mask = img(8, 8);
  let right = -1;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      let on = false;
      for (let dy = 0; dy < cell.step && !on; dy++)
        for (let dx = 0; dx < cell.step && !on; dx++)
          on = get(cell.src, cell.x + x * cell.step + dx, cell.y + y * cell.step + dy)[3] > 96;
      if (on) {
        put(mask, x, y, [255, 255, 255, 255]);
        right = Math.max(right, x);
      }
    }
  const entry = { mask, width: ch === " " ? 4 : right + 2 };
  glyphs.set(ch, entry);
  return entry;
}

const COLOURS = {
  0: "000000",
  1: "0000AA",
  2: "00AA00",
  3: "00AAAA",
  4: "AA0000",
  5: "AA00AA",
  6: "FFAA00",
  7: "AAAAAA",
  8: "555555",
  9: "5555FF",
  a: "55FF55",
  b: "55FFFF",
  c: "FF5555",
  d: "FF55FF",
  e: "FFFF55",
  f: "FFFFFF",
  g: "DDD605",
  h: "E3D4D1",
};

/** Characters with their colour; § codes set the colour (§r back to `base`). */
function runs(textIn, base) {
  const out = [];
  let colour = base;
  for (let i = 0; i < textIn.length; i++) {
    const ch = textIn[i];
    if (ch === "§") {
      const code = textIn[++i]?.toLowerCase();
      if (code === "r") colour = base;
      else if (COLOURS[code]) {
        const hex = COLOURS[code];
        colour = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
      }
      continue;
    }
    out.push({ ch, colour });
  }
  return out;
}

const widthOf = (chars) => chars.reduce((sum, c) => sum + glyph(c.ch).width, 0);

/** Wraps into lines of ≤ w px; then keeps what fits in maxLines, ending in "..." if cut. */
function layoutText(chars, w, maxLines) {
  const lines = [];
  for (const para of splitLines(chars)) {
    let line = [];
    let word = [];
    const flush = () => {
      if (widthOf([...line, ...word]) > w && line.length) {
        lines.push(trimEnd(line));
        line = [];
      }
      line.push(...word);
      word = [];
    };
    for (const c of para) {
      word.push(c);
      if (c.ch === " ") flush();
    }
    flush();
    lines.push(trimEnd(line));
  }
  if (lines.length <= maxLines && lines.every((l) => widthOf(l) <= w)) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept.length - 1;
  const cut = lines.length > maxLines || widthOf(kept[last]) > w;
  if (cut) {
    const colour = kept[last].at(-1)?.colour ?? [0, 0, 0];
    const dots = [...".."].concat(".").map((ch) => ({ ch, colour }));
    let l = kept[last];
    while (l.length && widthOf([...l, ...dots]) > w) l = l.slice(0, -1);
    kept[last] = [...trimEnd(l), ...dots];
  }
  return kept;
}
const trimEnd = (chars) => {
  const out = [...chars];
  while (out.length && out.at(-1).ch === " ") out.pop();
  return out;
};
function splitLines(chars) {
  const out = [[]];
  for (const c of chars) {
    if (c.ch === "\n") out.push([]);
    else out.at(-1).push(c);
  }
  return out;
}

/**
 * A label in a box: wrapped to the box width (one line when `oneLine`), cut with "..." at the
 * box height. align: left | center; vertical: top | middle. Returns the drawn lines.
 */
function label(
  dst,
  message,
  box,
  {
    colour = INK,
    align = "left",
    vertical = "top",
    oneLine = false,
    shadow = false,
    scale = 1,
  } = {},
) {
  const base = toByte(colour);
  const chars = runs(typeof message === "string" ? message : resolve(message), base);
  const maxLines = oneLine ? 1 : Math.max(1, Math.floor(box.h / LINE));
  const lines = layoutText(chars, Math.floor(box.w / scale), maxLines);
  const total = lines.length * LINE * scale;
  let y = vertical === "middle" ? box.y + Math.round((box.h - total) / 2) : box.y;
  for (const line of lines) {
    const lw = widthOf(line) * scale;
    let x = align === "center" ? box.x + Math.round((box.w - lw) / 2) : box.x;
    for (const c of line) {
      const g = glyph(c.ch);
      const draw = (ox, oy, col) => {
        for (let gy = 0; gy < 8; gy++)
          for (let gx = 0; gx < 8; gx++)
            if (get(g.mask, gx, gy)[3])
              rect(dst, ox + gx * scale, oy + gy * scale, scale, scale, [...col, 255]);
      };
      if (shadow)
        draw(
          x + scale,
          y + 1 + scale,
          c.colour.map((v) => v >> 2),
        );
      draw(x, y + 1, c.colour);
      x += g.width * scale;
    }
    y += LINE * scale;
  }
  return lines;
}

// --- cells, drawn like their JSON UI templates ---------------------------------------------------------

const ROLE = (slot) => slot?.role ?? "e";
const isEmpty = (slot) => ROLE(slot) === "e";
const SILHOUETTE = [0.1, 0.07, 0.05];

/** slot_content: icon (or silhouette + "?"), count, flame; centred in the box. */
function slotContent(dst, slot, x, y, w, h, { size = 16, flame = 9 } = {}) {
  if (isEmpty(slot)) return;
  const locked = slot.role === "l";
  if (slot.icon) {
    const src = icon(slot.icon);
    const ix = x + Math.floor((w - size) / 2);
    const iy = y + Math.floor((h - size) / 2);
    scaleTo(dst, locked ? shade(src, SILHOUETTE) : src, ix, iy, size, size);
  }
  if (locked) {
    const scale = size >= 32 ? 2 : 1;
    label(
      dst,
      "?",
      { x, y: y + Math.floor((h - LINE * scale) / 2), w, h: LINE * scale },
      { colour: [1, 1, 1], align: "center", shadow: true, scale },
    );
  }
  const count =
    typeof slot.count === "number"
      ? slot.count > 1
        ? String(Math.min(slot.count, 99))
        : ""
      : (slot.count ?? "");
  if (count) {
    const cw = widthOf(runs(count, [255, 255, 255]));
    label(
      dst,
      count,
      { x: x + w - cw + 1, y: y + h - LINE + 1, w: cw + 1, h: LINE },
      { colour: [1, 1, 1], shadow: true },
    );
  }
  if (slot.role === "h") drawImage(dst, FLAME, x - 2, y + h - flame + 2, flame, flame);
}

function slotCell(dst, slot, c) {
  const frame = c.vars.$frame ?? `${T}/slot`;
  drawImage(dst, slot?.role === "l" ? `${T}/slot_locked` : frame, c.x, c.y, c.w, c.h);
  slotContent(dst, slot, c.x, c.y, c.w, c.h);
}

/** A button with a 9-slice background, an icon box and a one-line name box (rows, chips). */
function iconAndName(dst, slot, c, bg, metrics) {
  if (isEmpty(slot)) return;
  drawImage(dst, bg, c.x, c.y, c.w, c.h);
  slotContent(dst, slot, c.x + metrics.iconX, c.y + Math.floor((c.h - 16) / 2), metrics.iconW, 16);
  const box = {
    x: c.x + metrics.nameX,
    y: c.y + Math.floor((c.h - LINE) / 2),
    w: c.w - metrics.nameX - metrics.nameRight,
    h: LINE,
  };
  label(dst, slot.text, box, { oneLine: true });
}

function textCell(dst, slot, c) {
  if (isEmpty(slot) || !slot.text) return;
  const ink = c.vars.$ink ?? INK;
  label(dst, slot.text, c, { colour: ink, align: c.vars.$align ?? "center" });
}

function navCell(dst, slot, c) {
  const dead = isEmpty(slot);
  const layer = img(c.w, c.h);
  drawImage(layer, `${T}/button_book`, 0, 0, c.w, c.h);
  if (c.template === "nav_glyph_cell") {
    const [gw, gh] = c.vars.$glyph_size;
    drawImage(layer, c.vars.$glyph, Math.floor((c.w - gw) / 2), Math.floor((c.h - gh) / 2), gw, gh);
  } else {
    drawImage(layer, c.vars.$glyph, 6, 6, 7, 7);
    label(
      layer,
      slot?.text,
      { x: 15, y: 4, w: c.w - 19, h: LINE },
      { oneLine: true, align: "center" },
    );
  }
  blitAlpha(dst, layer, c.x, c.y, dead ? 0.45 : 1);
}

function blitAlpha(dst, src, x, y, alpha) {
  for (let j = 0; j < src.h; j++)
    for (let i = 0; i < src.w; i++) {
      const p = get(src, i, j);
      if (p[3]) put(dst, x + i, y + j, [p[0], p[1], p[2], Math.round(p[3] * alpha)]);
    }
}

function ribbonCell(dst, slot, c) {
  if (isEmpty(slot)) return;
  const active = slot.role === "a";
  drawImage(
    dst,
    `${T}/${active ? "ribbon_tab_active" : "ribbon_tab"}`,
    c.x,
    c.y,
    active ? 33 : 26,
    24,
  );
  if (slot.icon) scaleTo(dst, icon(slot.icon), c.x + (active ? 14 : 9), c.y + 6, 12, 12);
}

function pictureCell(dst, slot, c) {
  slotContent(dst, slot, c.x, c.y, c.w, c.h, { size: 48, flame: 16 });
}

function cookedCell(dst, slot, c) {
  if (isEmpty(slot)) return;
  drawImage(dst, `${T}/arrow_ink`, c.x, c.y + 8, 14, 10);
  slotCell(dst, slot, { ...c, x: c.x + 14, w: 26, h: 26, vars: { $frame: `${T}/slot_large` } });
}

const DRAW = {
  slot_cell: slotCell,
  chip_cell: (dst, slot, c) => iconAndName(dst, slot, c, `${T}/chip`, CHIP),
  row_cell: (dst, slot, c) => iconAndName(dst, slot, c, `${T}/button_book`, ROW),
  text_cell: textCell,
  nav_glyph_cell: navCell,
  nav_text_cell: navCell,
  ribbon_cell: ribbonCell,
  picture: pictureCell,
  cooked: cookedCell,
};

function drawCells(dst, cells, page) {
  for (const c of cells) {
    const draw = DRAW[c.template];
    if (!draw) throw new Error(`no mockup drawing for ${c.template}`);
    draw(dst, page.slots[c.index], c);
  }
}

// --- the book -------------------------------------------------------------------------------------------

function renderBook(L, page) {
  const book = img(SIZE[0], SIZE[1]);
  drawCells(book, L.ribbons, page); // under the cover
  for (const im of L.chrome.images)
    drawImage(book, im.texture, im.x, im.y, im.w, im.h, { tiled: im.tiled });
  label(book, page.title, L.chrome.title, { align: "center", oneLine: true });
  drawCells(book, L.chrome.cells, page);
  drawImage(
    book,
    "textures/ui/close_button_default",
    SIZE[0] - (SIZE[0] - 330) - 3 - 15 - 3,
    3 + 3,
    15,
    15,
  );
  const spread = L.spreads[page.spread];
  label(book, page.body, spread.body, { align: spread.body.align });
  for (const im of spread.images) drawImage(book, im.texture, im.x, im.y, im.w, im.h);
  drawCells(book, spread.cells, page);
  const screen = backdrop();
  const ox = Math.floor((W - SIZE[0]) / 2);
  const oy = Math.floor((H - SIZE[1]) / 2);
  blitAlpha(screen, book, ox, oy, 1);
  return screen;
}

async function main() {
  const d = await loadLayout();
  const L = layout(d);
  const M = await loadModel();
  const found = (...keys) => new Set(keys);
  const ctx = (over) => ({ found: found(), creative: false, counts: {}, itemName, ...over });
  const midGame = ctx({
    found: found("tomato", "onion", "cucumber"),
    counts: {
      "wm_kitchen:tomato": 5,
      "wm_kitchen:onion": 3,
      "minecraft:bowl": 4,
      "minecraft:carrot": 2,
      "minecraft:potato": 2,
      "wm_kitchen:sliced_tomato": 2,
      "wm_kitchen:sliced_cucumber": 1,
    },
  });
  const shots = [
    ["book_home.png", M.HOME, midGame],
    ["book_chapter.png", { kind: "dishes", chapter: "hot", page: 0 }, midGame],
    ["book_dish_hot.png", { kind: "dish", id: "wm_kitchen:tomato_soup" }, midGame],
    ["book_dish_cold.png", { kind: "dish", id: "wm_kitchen:garden_salad" }, midGame],
    ["book_dish_locked.png", { kind: "dish", id: "wm_kitchen:chili_stew" }, midGame],
    ["book_crop.png", { kind: "crop", key: "tomato" }, midGame],
    ["book_what_can_i_make.png", { kind: "what", page: 0 }, midGame],
  ];
  for (const [file, at, context] of shots) {
    const page = M.buildPage(at, context);
    const out = path.join(HERE, file);
    writeFileSync(out, encodePng(upscale(renderBook(L, page), SCALE)));
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
}

await main();

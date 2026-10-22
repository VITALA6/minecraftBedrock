// Hand-authored Harvest Kitchen pixel art: text grids -> PNG, plus the art-loop preview.
//
//   node tools/pixels.mjs                         convert every grid into generated/<folder>/
//   node tools/pixels.mjs --preview <name> [--refs apple,bread,carrot] [--out file.png]
//                                                 8x preview next to vanilla items + lint report
//   node tools/pixels.mjs --export <name> [--force]
//                                                 write the procedural sprite as a starting grid
//   node tools/pixels.mjs --vanilla [pattern]     list vanilla item textures (for --refs)
//
// A grid is art/harvest_kitchen/pixels/<name>.txt, where <name> is a sprite name from
// tools/gen-textures.mjs (tomato, tomato_soup_mix, family_heal, ...). Format:
//
//   # free comments
//   palette
//   R tomato.1          a palette.json ramp shade (hue-shifted, 0 = darkest, -1 = lightest)
//   r #ff5e69           a hex colour
//   b bowl_dark         a name from pixels/_palette.txt
//   grid
//   ................    16 rows of 16 characters; '.' is transparent
//
// Files starting with '_' are not sprites (_palette.txt holds named colours: "<name> <colour>",
// where the colour is a hex or a ramp shade). gen-textures.mjs uses a grid instead of the
// procedural drawing whenever the file exists; the procedural drawing is the fallback.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
export const PIXELS_DIR = path.join(ROOT, "art/harvest_kitchen/pixels");
const GEN_DIR = path.join(ROOT, "art/harvest_kitchen/generated");
const S = 16;

export const gridFile = (name) => path.join(PIXELS_DIR, `${name}.txt`);

// Loaded lazily: gen-textures.mjs imports this module, and this module needs its helpers.
const gen = () => import("./gen-textures.mjs");
let G = null; // gen-textures exports, once loaded (CLI only)
let rampColour = null; // c() from gen-textures, passed to readGrid

const HEX = /^#[0-9a-fA-F]{6}$/;
const RAMP = /^([a-z_]+)\.(-?\d+)$/;

function colourOf(spec, named, where) {
  if (HEX.test(spec)) return [...[1, 3, 5].map((i) => parseInt(spec.slice(i, i + 2), 16)), 255];
  const ramp = RAMP.exec(spec);
  if (ramp) return rampColour(ramp[1], Number(ramp[2]));
  if (named && named.has(spec)) return named.get(spec);
  throw new Error(
    `${where}: unknown colour '${spec}' (want #rrggbb, ramp.N or a _palette.txt name)`,
  );
}

let namedCache = null;
function namedColours() {
  if (namedCache) return namedCache;
  namedCache = new Map();
  const file = path.join(PIXELS_DIR, "_palette.txt");
  if (!existsSync(file)) return namedCache;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((raw, n) => {
      const line = raw.replace(/#(?![0-9a-fA-F]{6}\b).*$/, "").trim();
      if (!line) return;
      const [name, spec] = line.split(/\s+/);
      namedCache.set(name, colourOf(spec, null, `_palette.txt:${n + 1}`));
    });
  return namedCache;
}

/** Parses pixels/<name>.txt into a layer (256 entries, RGBA or null). `c(ramp, i)` resolves ramp
 *  shades (gen-textures' c(), after its palette is loaded). */
export function readGrid(name, c) {
  if (rampColour !== c) namedCache = null;
  rampColour = c;
  const file = gridFile(name);
  const where = path.relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  const legend = new Map();
  const grid = [];
  let section = null;
  lines.forEach((raw, n) => {
    const line = raw.trimEnd();
    if (section !== "grid" && (!line.trim() || line.trim().startsWith("#"))) return;
    if (line.trim() === "palette" || line.trim() === "grid") {
      section = line.trim();
      return;
    }
    if (section === "palette") {
      const m = /^\s*(\S)\s+(\S+)/.exec(line);
      if (!m) throw new Error(`${where}:${n + 1}: palette line wants "<char> <colour>"`);
      if (m[1] === ".") throw new Error(`${where}:${n + 1}: '.' is reserved for transparent`);
      if (legend.has(m[1])) throw new Error(`${where}:${n + 1}: '${m[1]}' defined twice`);
      legend.set(m[1], colourOf(m[2], namedColours(), `${where}:${n + 1}`));
    } else if (section === "grid") {
      if (line.trim()) grid.push(line.trim());
    } else throw new Error(`${where}:${n + 1}: expected "palette" or "grid" first`);
  });
  if (grid.length !== S) throw new Error(`${where}: ${grid.length} grid rows, want ${S}`);
  const layer = new Array(S * S).fill(null);
  grid.forEach((row, y) => {
    if (row.length !== S) throw new Error(`${where}: grid row ${y} has ${row.length} chars`);
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      if (!legend.has(ch)) throw new Error(`${where}: grid row ${y} uses '${ch}', not in palette`);
      layer[y * S + x] = legend.get(ch);
    });
  });
  return { layer, legend };
}

/** Names of all grid files (sprites only, not _palette.txt). */
export const gridNames = () =>
  existsSync(PIXELS_DIR)
    ? readdirSync(PIXELS_DIR)
        .filter((f) => f.endsWith(".txt") && !f.startsWith("_"))
        .map((f) => f.slice(0, -4))
        .sort()
    : [];

/** Throws when a grid file doesn't name a sprite (a typo would silently do nothing). */
export function checkGridNames(sprites) {
  const known = new Set(sprites.map((s) => s.name));
  const stray = gridNames().filter((n) => !known.has(n));
  if (stray.length) throw new Error(`pixels/: no sprite named ${stray.join(", ")}`);
}

const toImage = (layer) => {
  const px = new Uint8Array(S * S * 4);
  layer.forEach((v, i) => v && px.set(v, i * 4));
  return { w: S, h: S, px };
};

// ---------------------------------------------------------------------------------------------
// Export: procedural sprite -> starting grid
// ---------------------------------------------------------------------------------------------

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function exportGrid(sprite, force) {
  const file = gridFile(sprite.name);
  if (existsSync(file) && !force) throw new Error(`${path.relative(ROOT, file)} exists (--force)`);
  const layer = G.renderSprite(sprite, { procedural: true });
  const hex = (v) =>
    `#${v
      .slice(0, 3)
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")}`;
  // Name colours after the ramp shade they came from, when they did.
  const rampOf = new Map();
  for (const [ramp, shades] of Object.entries(G.ramps()))
    shades.forEach((rgb, i) => {
      const h = hex(rgb);
      if (!rampOf.has(h)) rampOf.set(h, `${ramp}.${i}`);
    });
  const named = new Map([...namedColours()].map(([n, v]) => [hex(v), n]));
  const keys = [];
  const charOf = new Map();
  for (const v of layer) {
    if (!v || charOf.has(hex(v))) continue;
    charOf.set(hex(v), CHARS[keys.length]);
    keys.push(hex(v));
  }
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  const palette = keys
    .map((h) => [charOf.get(h), named.get(h) ?? rampOf.get(h) ?? h, h])
    .sort((a, b) => lum(a[2]) - lum(b[2]))
    .map(([ch, spec, h]) => `${ch} ${spec}${spec === h ? "" : `   # ${h}`}`);
  const grid = [];
  for (let y = 0; y < S; y++)
    grid.push(
      layer
        .slice(y * S, y * S + S)
        .map((v) => (v ? charOf.get(hex(v)) : "."))
        .join(""),
    );
  mkdirSync(PIXELS_DIR, { recursive: true });
  writeFileSync(
    file,
    [
      `# ${sprite.name} (${sprite.row}). Exported from the procedural sprite; redraw freely.`,
      "palette",
      ...palette,
      "grid",
      ...grid,
      "",
    ].join("\n"),
  );
  console.log(`wrote ${path.relative(ROOT, file)} (${keys.length} colours)`);
}

// ---------------------------------------------------------------------------------------------
// Preview: the art loop's view
// ---------------------------------------------------------------------------------------------

const DEFAULT_REFS = {
  produce: ["apple", "carrot", "potato"],
  seeds: ["seeds_wheat", "seeds_pumpkin", "seeds_beetroot"],
  prepared: ["melon", "cookie", "beef_cooked"],
  dishes: ["mushroom_stew", "beetroot_soup", "rabbit_stew"],
  mixes: ["mushroom_stew", "suspicious_stew", "bowl"],
  stations: ["cauldron", "cake", "painting"],
  ui: ["compass_item", "clock_item", "book_normal"],
};

async function preview(sprite, refs, out) {
  const lint = await import("./lint-textures.mjs");
  const load = (() => {
    try {
      return G.vanillaTextures();
    } catch {
      return null;
    }
  })();
  const refImgs = [];
  for (const r of refs) {
    try {
      if (!load) throw new Error("game not installed");
      refImgs.push({ name: r, img: load(`items/${r}`).img });
    } catch (error) {
      console.warn(`ref ${r}: ${error.message}`);
    }
  }
  const hasGrid = existsSync(gridFile(sprite.name));
  const after = toImage(G.renderSprite(sprite));
  const before = toImage(G.renderSprite(sprite, { procedural: true }));

  const Z = 8;
  const slot = 18 * Z;
  const gap = 16;
  const labelH = 20;
  const cols = [
    ...refImgs.map((r) => ({ label: r.name, img: r.img })),
    { label: "before", img: before },
    { label: hasGrid ? "grid" : "no grid", img: after },
    { label: "grey", img: after, mode: "grey" },
    { label: "silhouette", img: after, mode: "silhouette" },
  ];
  const w = gap + cols.length * (slot + gap);
  const h = gap + slot + labelH + gap + 18 * 3 + gap;
  const cv = lint.canvas(w, h);
  cols.forEach((col, i) => {
    const x = gap + i * (slot + gap);
    lint.drawSlot(cv, x, gap, Z, col.img, col.mode);
    lint.drawText(cv, x, gap + slot + 6, col.label.slice(0, 17));
  });
  // 1x, 2x, 3x in-game sizes: refs then the grid.
  let x = gap;
  const y = gap + slot + labelH + gap;
  for (const img of [...refImgs.map((r) => r.img), after]) {
    for (const z of [1, 2, 3]) {
      lint.drawSlot(cv, x, y, z, img);
      x += 18 * z + 4;
    }
    x += 12;
  }
  const outFile = out ?? path.join(os.tmpdir(), `hk_pixels_${sprite.name}.png`);
  writeFileSync(outFile, G.encodePng({ w: cv.w, h: cv.h, px: cv.px }));
  console.log(`preview: ${outFile}`);

  // Lint this icon, plus similar pairs against every other icon as currently rendered.
  const report = lint.lintOne(sprite, after);
  console.log(
    `lint: ${report.stats.colours} colours, box ${report.stats.box}, grey range ${report.stats.greyRange}`,
  );
  console.log(report.fails.length ? `FAIL: ${report.fails.join("; ")}` : "lint: ok");
  const others = G.SPRITES.filter(
    (s) => s !== sprite && ["items", "ui", "ingredients"].includes(s.folder),
  ).flatMap((s) => {
    try {
      return [{ sprite: s, img: toImage(G.renderSprite(s)) }];
    } catch (error) {
      console.warn(`skipped ${s.name} in the similar check: ${error.message}`);
      return [];
    }
  });
  const pairs = lint.similarTo(sprite, after, others);
  for (const p of pairs) console.log(`SIMILAR: ${p}`);
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

async function main() {
  G = await gen();
  G.loadPalette();
  rampColour = G.c;
  const args = process.argv.slice(2);
  const opt = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const spriteOf = (name) => {
    const s = G.SPRITES.find((x) => x.name === name);
    if (!s) throw new Error(`no sprite named ${name}`);
    return s;
  };
  if (args.includes("--vanilla")) {
    const pattern = new RegExp(opt("--vanilla") ?? ".");
    const rp = path.join(
      process.env.MC_VERSIONS_DIR ??
        path.join(os.homedir(), ".var/app/io.mrarm.mcpelauncher/data/mcpelauncher/versions"),
      process.env.MC_GAME_VERSION ?? "1.26.52.3",
      "assets/assets/resource_packs",
    );
    const names = new Set();
    for (const layer of readdirSync(rp)) {
      const ar = path.join(rp, layer, "__brarchive/textures/items.brarchive");
      if (existsSync(ar))
        for (const n of G.readBrarchive(ar).keys())
          if (n.endsWith(".png")) names.add(n.slice(0, -4));
    }
    console.log(
      [...names]
        .filter((n) => pattern.test(n))
        .sort()
        .join("\n"),
    );
    return;
  }
  if (args.includes("--export")) {
    exportGrid(spriteOf(opt("--export")), args.includes("--force"));
    return;
  }
  if (args.includes("--preview")) {
    const sprite = spriteOf(opt("--preview"));
    const refs = opt("--refs")?.split(",") ?? DEFAULT_REFS[sprite.row] ?? DEFAULT_REFS.produce;
    await preview(sprite, refs, opt("--out"));
    return;
  }
  // Convert: every grid -> generated/<folder>/<name>.png (gen-textures does the same on a full run).
  checkGridNames(G.SPRITES);
  for (const name of gridNames()) {
    const sprite = spriteOf(name);
    mkdirSync(path.join(GEN_DIR, sprite.folder), { recursive: true });
    writeFileSync(
      path.join(GEN_DIR, sprite.folder, `${name}.png`),
      G.encodePng(toImage(G.renderSprite(sprite))),
    );
  }
  console.log(`converted ${gridNames().length} grids into ${path.relative(ROOT, GEN_DIR)}/`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

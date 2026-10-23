// Reference study and before/after sheets for Simmerfield art
// (docs/simmerfield/art-style.md "Reference study").
//
//   node tools/ref-sheet.mjs                  reference sheet + metrics
//   node tools/ref-sheet.mjs --compare <ref>  before/after sheet: our sprites at git <ref> vs now
//   node tools/ref-sheet.mjs --originality [name ...] [--out file.png]
//                                             each of our icons vs its closest reference icons;
//                                             exits 1 when one is too close (see ORIGINALITY)
//
// The references are third-party textures (Farmer's Delight, Croptopia, Create). They are read
// from the gitignored art/references/mods/rgba/ (set up as in art/references/README.md), and the
// sheets that show them are written next to them, so none of it is committed or shipped.
// The before/after sheet shows only our own art and goes to art/simmerfield/generated/.
// Plain Node, no dependencies.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  SPRITES,
  decodePng,
  encodePng,
  loadPalette,
  renderSprite,
  vanillaTextures,
} from "./gen-textures.mjs";
import { canvas, drawSlot, drawText, labelLines, metrics } from "./lint-textures.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const REF_DIR = path.join(ROOT, "art/references/mods");
const OUT_DIR = path.join(REF_DIR, "sheets");
const GEN_DIR = path.join(ROOT, "art/simmerfield/generated");
const PACK_TEX = path.join(ROOT, "packs/simmerfield/resource/textures/wm_kitchen");
const S = 16;

const SOURCES = {
  fd: "Farmer's Delight",
  cr: "Croptopia",
  cc: "Create",
  v: "vanilla",
  wm_kitchen: "Simmerfield",
};

// What to compare, per group and source. fd/cr/cc paths are under rgba/<mod>/, v paths are
// vanilla Bedrock texture paths, wm_kitchen paths are under generated/ (or the pack's textures/wm_kitchen/).
const GROUPS = [
  {
    title: "produce",
    icons: true,
    fd: ["item/tomato", "item/onion", "item/cabbage", "item/pumpkin_slice", "item/rice_panicle"],
    cr: [
      "item/tomato",
      "item/onion",
      "item/cucumber",
      "item/eggplant",
      "item/chile_pepper",
      "item/strawberry",
      "item/bellpepper",
      "item/garlic",
      "item/lettuce",
    ],
    cc: ["item/honeyed_apple", "item/chocolate_glazed_berries"],
    v: ["items/apple", "items/carrot", "items/potato", "items/beetroot", "items/sweet_berries"],
    wm_kitchen: [
      "items/tomato",
      "items/onion",
      "items/cucumber",
      "items/chili_pepper",
      "items/strawberry",
      "items/eggplant",
    ],
  },
  {
    title: "seeds",
    icons: true,
    fd: ["item/tomato_seeds", "item/cabbage_seeds", "item/rice"],
    cr: [
      "item/tomato_seed",
      "item/onion_seed",
      "item/cucumber_seed",
      "item/eggplant_seed",
      "item/chile_pepper_seed",
      "item/strawberry_seed",
      "item/garlic_seed",
    ],
    v: ["items/seeds_wheat", "items/seeds_pumpkin", "items/seeds_melon", "items/seeds_beetroot"],
    wm_kitchen: [
      "items/tomato_seeds",
      "items/cucumber_seeds",
      "items/chili_pepper_seeds",
      "items/strawberry_seeds",
      "items/eggplant_seeds",
    ],
  },
  {
    title: "prepared food and containers",
    icons: true,
    fd: [
      "item/cabbage_leaf",
      "item/tomato_sauce",
      "item/minced_beef",
      "item/hamburger",
      "item/chicken_sandwich",
      "item/barbecue_stick",
      "item/cake_slice",
      "item/milk_bottle",
      "item/apple_cider",
    ],
    cr: [
      "item/strawberry_jam",
      "item/blt",
      "item/ham_sandwich",
      "item/pickled_cucumber",
      "item/tomato_juice",
      "item/olive_oil",
      "item/cheese",
    ],
    cc: [
      "item/sweet_roll",
      "item/bar_of_chocolate",
      "item/dough",
      "item/wheat_flour",
      "item/builders_tea",
    ],
    v: [
      "items/bread",
      "items/cake",
      "items/cookie",
      "items/pumpkin_pie",
      "items/honey_bottle",
      "items/potion_bottle_empty",
    ],
    wm_kitchen: [
      "items/sliced_tomato",
      "items/sliced_cucumber",
      "items/sliced_eggplant",
      "items/chopped_onion",
      "items/hearty_sandwich",
      "items/veggie_sandwich",
      "items/veggie_skewer",
      "items/strawberry_jam",
      "items/strawberry_cake",
      "items/strawberry_cup",
      "items/stuffed_eggplant",
    ],
  },
  {
    title: "dishes in bowls",
    icons: true,
    fd: [
      "item/beef_stew",
      "item/chicken_soup",
      "item/fish_stew",
      "item/onion_soup",
      "item/vegetable_soup",
      "item/pumpkin_soup",
      "item/noodle_soup",
      "item/ratatouille",
      "item/mixed_salad",
      "item/fried_rice",
      "item/baked_cod_stew",
    ],
    cr: [
      "item/beef_stew",
      "item/leek_soup",
      "item/potato_soup",
      "item/ratatouille",
      "item/salsa",
      "item/veggie_salad",
      "item/leafy_salad",
      "item/borscht",
      "item/cucumber_salad",
    ],
    v: [
      "items/mushroom_stew",
      "items/rabbit_stew",
      "items/beetroot_soup",
      "items/suspicious_stew",
      "items/bowl",
    ],
    wm_kitchen: [
      "items/tomato_soup",
      "items/onion_soup",
      "items/vegetable_stew",
      "items/chili_stew",
      "items/fish_chowder",
      "items/chicken_soup",
      "items/salsa",
      "items/garden_salad",
      "items/ratatouille",
      "items/eggplant_curry",
      "items/eggplant_salad",
      "items/tomato_soup_mix",
      "items/chili_stew_mix",
    ],
  },
  {
    title: "tools",
    icons: true,
    fd: [
      "item/flint_knife",
      "item/iron_knife",
      "item/golden_knife",
      "item/diamond_knife",
      "item/cooking_pot",
      "item/rope",
    ],
    cr: [
      "item/knife",
      "item/frying_pan",
      "item/cooking_pot",
      "item/mortar_and_pestle",
      "item/food_press",
      "item/guide",
    ],
    cc: ["item/whisk", "item/wrench", "item/clipboard", "item/goggles"],
    v: [
      "items/shears",
      "items/book_normal",
      "items/bucket_empty",
      "items/iron_hoe",
      "items/flint_and_steel",
    ],
    wm_kitchen: [
      "items/cooking_pot",
      "items/cutting_board",
      "items/guide_book",
      "items/recipe_poster",
      "items/hanging_pan",
      "items/pickle_jar",
      "items/vegetable_basket",
    ],
  },
  {
    title: "kitchen blocks",
    fd: [
      "block/stove_front",
      "block/stove_top",
      "block/oak_cabinet_front",
      "block/cutting_board",
      "block/cooking_pot_side",
      "block/skillet_top",
      "block/wooden_basket_side",
      "block/tomato_crate_side",
    ],
    cc: ["block/depot_side", "block/mixer_base_side"],
    v: [
      "blocks/furnace_front_off",
      "blocks/smoker_front_off",
      "blocks/crafting_table_front",
      "blocks/barrel_side",
      "blocks/composter_side",
      "blocks/cauldron_side",
    ],
    wm_kitchen: [
      "blocks/deco/kitchen_counter_front",
      "blocks/deco/kitchen_cabinet_front",
      "blocks/deco/kitchen_sink_front",
      "blocks/deco/kitchen_stove_front",
      "blocks/deco/spice_shelf_jars",
      "blocks/deco/vegetable_basket_side",
      "blocks/deco/pickle_jar_side",
      "blocks/cooking_pot_side",
      "blocks/cutting_board_top",
    ],
  },
  {
    title: "crops",
    fd: [
      "block/tomatoes_stage3",
      "block/onions_stage3",
      "block/cabbages_stage7",
      "block/rice_panicles_stage3",
      "block/wild_tomatoes",
    ],
    cr: [
      "block/tomato_crop_stage3",
      "block/onion_crop_stage3",
      "block/cucumber_crop_stage3",
      "block/eggplant_crop_stage3",
      "block/chile_pepper_crop_stage3",
      "block/strawberry_crop_stage3",
    ],
    v: [
      "blocks/wheat_stage_7",
      "blocks/carrots_stage_3",
      "blocks/potatoes_stage_3",
      "blocks/beetroots_stage_3",
      "blocks/sweet_berry_bush_stage3",
    ],
    wm_kitchen: [
      "blocks/tomato_crop_stage_3",
      "blocks/onion_crop_stage_3",
      "blocks/cucumber_crop_stage_3",
      "blocks/eggplant_crop_stage_3",
      "blocks/chili_bush_stage_3",
      "blocks/strawberry_bush_stage_3",
    ],
  },
];

const MOD_DIRS = { fd: "farmersdelight", cr: "croptopia", cc: "create" };

/** The top-left 16×16 of an image (animated strips keep their first frame). */
function crop16(img) {
  if (img.w === S && img.h === S) return img;
  const px = new Uint8Array(S * S * 4);
  for (let y = 0; y < Math.min(S, img.h); y++)
    px.set(img.px.subarray(y * img.w * 4, y * img.w * 4 + Math.min(S, img.w) * 4), y * S * 4);
  return { w: S, h: S, px };
}

function loader() {
  let vanilla = null;
  try {
    vanilla = vanillaTextures();
  } catch (error) {
    console.warn(`[ref-sheet] no vanilla textures: ${error.message}`);
  }
  return (src, p) => {
    if (src === "v") {
      try {
        return vanilla && crop16(vanilla(p).img);
      } catch {
        return null;
      }
    }
    const file =
      src === "wm_kitchen"
        ? [path.join(GEN_DIR, `${p}.png`), path.join(PACK_TEX, `${p}.png`)].find(existsSync)
        : path.join(REF_DIR, "rgba", MOD_DIRS[src], `${p}.png`);
    if (!file || !existsSync(file)) return null;
    const img = decodePng(readFileSync(file));
    return img && crop16(img);
  };
}

const median = (a) => {
  const s = a.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

const COLUMNS = [
  ["n", (ms) => ms.length, 0],
  ["longest", (ms) => median(ms.map((m) => m.longest)), 0],
  ["coverage", (ms) => median(ms.map((m) => m.coverage)), 2],
  ["bboxFill", (ms) => median(ms.map((m) => m.bboxFill)), 2],
  ["colours", (ms) => median(ms.map((m) => m.colours)), 0],
  ["mainShades", (ms) => median(ms.map((m) => m.mainShades)), 0],
  ["families", (ms) => median(ms.map((m) => m.families)), 0],
  ["detail", (ms) => median(ms.map((m) => m.detail)), 2],
  ["flat", (ms) => median(ms.map((m) => m.flat)), 2],
  ["flatPx", (ms) => median(ms.map((m) => m.flatPx)), 0],
  ["edge/inner", (ms) => median(ms.map((m) => m.edgeVsInner)), 2],
  ["darkEdge", (ms) => median(ms.map((m) => m.darkEdge)), 2],
  ["edgeTL-BR", (ms) => median(ms.map((m) => m.edgeTLminusBR)), 0],
  ["lumaRange", (ms) => median(ms.map((m) => m.lumaRange)), 0],
  ["hueShift", (ms) => median(ms.map((m) => m.hueShift)), 0],
  ["warmth", (ms) => median(ms.map((m) => m.warmth)), 0],
  ["hlX", (ms) => median(ms.map((m) => m.highlight[0])), 2],
  ["hlY", (ms) => median(ms.map((m) => m.highlight[1])), 2],
  ["sat", (ms) => median(ms.map((m) => m.sat)), 2],
];

function metricsTable(rows) {
  const head = ["group", "source", ...COLUMNS.map((c) => c[0])];
  const body = rows.map((r) => [
    r.group,
    SOURCES[r.src],
    ...COLUMNS.map(([, f, d]) => {
      const v = f(r.ms);
      return Number.isFinite(v) ? v.toFixed(d) : "-";
    }),
  ]);
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...body.map(line)].join("\n");
}

// ---------------------------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------------------------

const BIG = 8;
const SLOT_BIG = 18 * BIG;
const CELL = SLOT_BIG + 10;
const LABEL_W = 150;
const LINE_H = 12;
const DIM = [0x70, 0x70, 0x70];
const RULE = [0x3f, 0x3f, 0x3f];

/** One group: a row per source, each icon at 8× with its 1× slot and name underneath. */
function groupSheet(group, rows) {
  const PAD = 16;
  const labels = (name) => labelLines(name, Math.floor(CELL / 8)).slice(0, 2);
  const rowH = SLOT_BIG + 6 + 18 + 4 + LINE_H * 2 + 14;
  const w = PAD * 2 + LABEL_W + Math.max(...rows.map((r) => r.cells.length)) * CELL;
  const h = PAD * 2 + LINE_H + 10 + rows.length * rowH;
  const cv = canvas(w, h);
  drawText(cv, PAD, PAD, group.title);
  let y = PAD + LINE_H + 10;
  for (const r of rows) {
    labelLines(SOURCES[r.src].replace(/[' ]/g, "_"), 17).forEach((line, n) =>
      drawText(cv, PAD, y + n * LINE_H, line, r.src === "wm_kitchen" ? [0x80, 0x10, 0x10] : RULE),
    );
    r.cells.forEach((c, k) => {
      const x = PAD + LABEL_W + k * CELL;
      drawSlot(cv, x, y, BIG, c.img);
      drawSlot(cv, x, y + SLOT_BIG + 6, 1, c.img);
      labels(c.name).forEach((line, n) =>
        drawText(cv, x, y + SLOT_BIG + 6 + 18 + 4 + n * LINE_H, line, DIM),
      );
    });
    y += rowH;
    cv.rect(PAD, y - 7, w - PAD * 2, 1, DIM);
  }
  return cv;
}

/** Stacks canvases vertically on the panel grey. */
function stack(cvs) {
  const w = Math.max(...cvs.map((c) => c.w));
  const out = canvas(
    w,
    cvs.reduce((s, c) => s + c.h, 0),
  );
  let y = 0;
  for (const c of cvs) {
    for (let row = 0; row < c.h; row++)
      out.px.set(c.px.subarray(row * c.w * 4, (row + 1) * c.w * 4), (y + row) * w * 4);
    y += c.h;
  }
  return out;
}

const png = (cv) => encodePng({ w: cv.w, h: cv.h, px: cv.px });

function referenceSheet() {
  if (!existsSync(path.join(REF_DIR, "rgba")))
    throw new Error(`No references at ${REF_DIR}/rgba; see art/references/README.md`);
  mkdirSync(OUT_DIR, { recursive: true });
  const load = loader();
  const sheets = [];
  const stats = [];
  for (const g of GROUPS) {
    const rows = [];
    for (const src of Object.keys(SOURCES)) {
      if (!g[src]) continue;
      const cells = [];
      for (const p of g[src]) {
        const img = load(src, p);
        if (!img) console.warn(`[ref-sheet] missing ${src}:${p}`);
        else cells.push({ name: path.basename(p), img });
      }
      if (!cells.length) continue;
      rows.push({ src, cells });
      if (g.icons) stats.push({ group: g.title, src, ms: cells.map((c) => metrics(c.img)) });
    }
    const cv = groupSheet(g, rows);
    writeFileSync(path.join(OUT_DIR, `reference_${g.title.replace(/ /g, "_")}.png`), png(cv));
    sheets.push(cv);
  }
  writeFileSync(path.join(OUT_DIR, "reference_sheet.png"), png(stack(sheets)));

  // Totals per source over every icon group.
  for (const src of Object.keys(SOURCES)) {
    const ms = stats.filter((s) => s.src === src).flatMap((s) => s.ms);
    if (ms.length) stats.push({ group: "ALL ICONS", src, ms });
  }
  const table = metricsTable(stats);
  writeFileSync(path.join(OUT_DIR, "metrics.md"), `${table}\n`);
  console.log(table);
  console.log(`\nWrote ${path.relative(ROOT, OUT_DIR)}/reference_sheet.png (+ one per group)`);
}

// ---------------------------------------------------------------------------------------------
// Before/after: every generated sprite at git <ref> vs the working tree.
// ---------------------------------------------------------------------------------------------

function gitPng(ref, rel) {
  try {
    return decodePng(execFileSync("git", ["show", `${ref}:${rel}`], { cwd: ROOT, stdio: "pipe" }));
  } catch {
    return null;
  }
}

function compareSheet(ref) {
  const ZOOM = 4;
  const PAD = 16;
  const W4 = 18 * ZOOM;
  const PAIR = W4 * 2 + 6;
  const CELLW = PAIR + 14;
  const PER_ROW = 12;
  const groups = [];
  let changed = 0;
  for (const s of SPRITES) {
    const rel = `art/simmerfield/generated/${s.folder}/${s.name}.png`;
    const file = path.join(ROOT, rel);
    if (!existsSync(file)) continue;
    const after = decodePng(readFileSync(file));
    const before = gitPng(ref, rel);
    const same = before && Buffer.compare(Buffer.from(before.px), Buffer.from(after.px)) === 0;
    if (!same) changed++;
    let g = groups.find((x) => x.title === s.row);
    if (!g) groups.push((g = { title: s.row, items: [] }));
    g.items.push({ name: s.name, before, after, same });
  }
  // Groups where nothing changed (the pot liquids) only make the sheet longer.
  groups.splice(0, groups.length, ...groups.filter((g) => g.items.some((t) => !t.same)));
  const rowH = 18 + 6 + W4 + 4 + LINE_H * 2 + 12;
  const h =
    PAD +
    groups.reduce((sum, g) => sum + LINE_H + 8 + Math.ceil(g.items.length / PER_ROW) * rowH, 0) +
    PAD;
  const cv = canvas(PAD * 2 + PER_ROW * CELLW, h);
  let y = PAD;
  for (const g of groups) {
    drawText(cv, PAD, y, `${g.title}   - each: before ${ref} | after`);
    y += LINE_H + 8;
    g.items.forEach((t, n) => {
      const x = PAD + (n % PER_ROW) * CELLW;
      const yy = y + Math.floor(n / PER_ROW) * rowH;
      drawSlot(cv, x, yy, 1, t.before);
      drawSlot(cv, x + W4 + 6, yy, 1, t.after);
      drawSlot(cv, x, yy + 24, ZOOM, t.before);
      if (!t.same) cv.rect(x + W4 + 3, yy + 21, W4 + 6, W4 + 6, [0x20, 0x90, 0x40]);
      drawSlot(cv, x + W4 + 6, yy + 24, ZOOM, t.after);
      labelLines(t.name, Math.floor(PAIR / 8))
        .slice(0, 2)
        .forEach((line, k) =>
          drawText(cv, x, yy + 24 + W4 + 4 + k * LINE_H, line, t.same ? DIM : RULE),
        );
    });
    y += Math.ceil(g.items.length / PER_ROW) * rowH;
  }
  const out = path.join(GEN_DIR, "before_after.png");
  writeFileSync(out, png(cv));
  console.log(`Wrote ${path.relative(ROOT, out)}: ${changed} of ${SPRITES.length} sprites changed`);
}

// ---------------------------------------------------------------------------------------------
// Originality: our icons must not trace or recolour a reference (art-style.md "Reference study").
// Compared with every reference item, as drawn and mirrored, shifted up to 1 px.
// ---------------------------------------------------------------------------------------------

export const ORIGINALITY = {
  // A trace keeps the outline and the shading layout, whatever the colours: flag silhouette
  // overlap only together with correlated brightness inside it. Shared conventions (the vanilla
  // bowl, round fruit, square blocks) overlap in silhouette alone.
  maxIou: 0.85,
  // Brightness correlation on the overlapping pixels. Our icons drawn before the references were
  // downloaded reach 0.78 by chance; a recolour of a reference scores 0.95+.
  maxStructure: 0.8,
  // Shared colour-region borders (hue-blind: a hue-rotated copy keeps them all, 1.00).
  // Independent icons reach 0.78.
  maxRegions: 0.9,
  maxSamePixels: 0.12, // share of our pixels with the very same colour at the same spot
  maxSharedColours: 0.5, // share of our colours found exactly in that reference's palette
};

function allReferenceItems() {
  const refs = [];
  for (const [src, dir] of Object.entries(MOD_DIRS)) {
    const folder = path.join(REF_DIR, "rgba", dir, "item");
    if (!existsSync(folder)) continue;
    for (const f of readdirSync(folder).filter((n) => n.endsWith(".png"))) {
      const img = decodePng(readFileSync(path.join(folder, f)));
      if (img) refs.push({ src, name: f.slice(0, -4), img: crop16(img) });
    }
  }
  return refs;
}

const mirror = (img) => {
  const px = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      px.set(img.px.subarray((y * S + x) * 4, (y * S + x) * 4 + 4), (y * S + (S - 1 - x)) * 4);
  return { w: S, h: S, px };
};

function correlation(a, b) {
  if (a.length < 8) return 0;
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const [ma, mb] = [mean(a), mean(b)];
  let [num, da, db] = [0, 0, 0];
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// The vanilla bowl's lower half: every bowl dish (ours and the references') draws it, so it says
// nothing about tracing. Two bowl dishes are compared on their contents only.
let bowlBody = null;
function bowlMask() {
  if (bowlBody) return bowlBody;
  bowlBody = new Set();
  try {
    const bowl = vanillaTextures()("items/bowl").img;
    const ys = [];
    for (let i = 0; i < S * S; i++) if (bowl.px[i * 4 + 3]) ys.push(Math.floor(i / S));
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    for (let i = 0; i < S * S; i++)
      if (bowl.px[i * 4 + 3] && Math.floor(i / S) >= mid) bowlBody.add(i);
  } catch {
    // no game installed: compare whole icons
  }
  return bowlBody;
}
const isBowlDish = (img) => {
  const mask = bowlMask();
  if (!mask.size) return false;
  let hit = 0;
  for (const i of mask) if (img.px[i * 4 + 3]) hit++;
  return hit / mask.size >= 0.85;
};

export function closeness(ours, ref) {
  const skip = isBowlDish(ours) && isBowlDish(ref) ? bowlMask() : new Set();
  const colourAt = (img, x, y) =>
    x < 0 || y < 0 || x >= S || y >= S || !img.px[(y * S + x) * 4 + 3]
      ? -1
      : (img.px[(y * S + x) * 4] << 16) |
        (img.px[(y * S + x) * 4 + 1] << 8) |
        img.px[(y * S + x) * 4 + 2];
  const palette = (img) => {
    const set = new Set();
    for (let i = 0; i < S * S; i++)
      if (img.px[i * 4 + 3]) set.add(colourAt(img, i % S, Math.floor(i / S)));
    return set;
  };
  const ourColours = palette(ours);
  const refColours = palette(ref);
  const shared = [...ourColours].filter((c) => refColours.has(c)).length / ourColours.size;
  const lumaAt = (img, x, y) => {
    const i = (y * S + x) * 4;
    return 0.299 * img.px[i] + 0.587 * img.px[i + 1] + 0.114 * img.px[i + 2];
  };
  let best = { iou: 0, same: 0, structure: 0, regions: 0, shared, mirrored: false };
  for (const [img, mirrored] of [
    [ref, false],
    [mirror(ref), true],
  ])
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        let inter = 0;
        let union = 0;
        let same = 0;
        let ourCount = 0;
        const la = [];
        const lb = [];
        let bothEdges = 0;
        let anyEdges = 0;
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            if (skip.has(y * S + x)) continue;
            const a = colourAt(ours, x, y);
            const b = colourAt(img, x - dx, y - dy);
            if (a >= 0) ourCount++;
            if (a >= 0 && b >= 0) {
              inter++;
              la.push(lumaAt(ours, x, y));
              lb.push(lumaAt(img, x - dx, y - dy));
            }
            if (a >= 0 || b >= 0) union++;
            if (a >= 0 && a === b) same++;
            // Colour-region borders to the right and below, where both icons are painted.
            for (const [nx, ny] of [
              [x + 1, y],
              [x, y + 1],
            ]) {
              const a2 = colourAt(ours, nx, ny);
              const b2 = colourAt(img, nx - dx, ny - dy);
              if (a < 0 || b < 0 || a2 < 0 || b2 < 0) continue;
              const ea = a !== a2;
              const eb = b !== b2;
              if (ea && eb) bothEdges++;
              if (ea || eb) anyEdges++;
            }
          }
        const iou = union ? inter / union : 0;
        if (iou > best.iou || (iou === best.iou && same / ourCount > best.same))
          best = {
            iou,
            same: ourCount ? same / ourCount : 0,
            structure: correlation(la, lb),
            regions: anyEdges ? bothEdges / anyEdges : 0,
            shared,
            mirrored,
          };
      }
  return best;
}

// References that are themselves recolours of a vanilla bowl item (Croptopia's soups are the
// mushroom stew, structure 0.99): matching them means matching vanilla, our own baseline.
const VANILLA_BASES = ["mushroom_stew", "beetroot_soup", "rabbit_stew", "suspicious_stew", "bowl"];
function markVanillaDerived(refs) {
  let bases;
  try {
    const load = vanillaTextures();
    bases = VANILLA_BASES.map((n) => load(`items/${n}`).img);
  } catch {
    return;
  }
  for (const r of refs)
    r.derived = bases.some((b) => {
      const c = closeness(r.img, b);
      return c.iou >= 0.9 && c.structure >= 0.85;
    });
}

function originality(names, out) {
  const refs = allReferenceItems();
  markVanillaDerived(refs);
  if (!refs.length)
    throw new Error(`No references at ${REF_DIR}/rgba; see art/references/README.md`);
  const ours = SPRITES.filter((s) => ["items", "ui", "ingredients"].includes(s.folder)).filter(
    (s) => !names.length || names.includes(s.name),
  );
  const rows = [];
  let flagged = 0;
  // Rendered from the grids (as gen-textures would), so it works mid-edit without writing
  // generated/.
  loadPalette();
  for (const s of ours) {
    const img = { w: S, h: S, px: new Uint8Array(S * S * 4) };
    renderSprite(s).forEach((v, i) => v && img.px.set(v, i * 4));
    const scored = refs
      .map((r) => ({ ...r, ...closeness(img, r.img) }))
      .sort((a, b) => b.iou * Math.max(0, b.structure) - a.iou * Math.max(0, a.structure));
    const top = scored.slice(0, 4);
    const why = [];
    const worst = (key) => scored.reduce((m, r) => (r[key] > m[key] ? r : m));
    const traced = scored.find(
      (r) =>
        !r.derived &&
        r.iou >= ORIGINALITY.maxIou &&
        (r.structure >= ORIGINALITY.maxStructure || r.regions >= ORIGINALITY.maxRegions),
    );
    const same = worst("same");
    const shared = worst("shared");
    if (traced)
      why.push(
        `traced? silhouette ${traced.iou.toFixed(2)} + structure ${traced.structure.toFixed(2)}, regions ${traced.regions.toFixed(2)} vs ${traced.src}:${traced.name}`,
      );
    if (same.same >= ORIGINALITY.maxSamePixels)
      why.push(`same pixels ${same.same.toFixed(2)} vs ${same.src}:${same.name}`);
    if (shared.shared >= ORIGINALITY.maxSharedColours)
      why.push(`shared colours ${shared.shared.toFixed(2)} vs ${shared.src}:${shared.name}`);
    if (why.length) flagged++;
    console.log(
      `${why.length ? "TOO CLOSE" : "ok       "} ${s.name}: ` +
        (why.length
          ? why.join("; ")
          : `closest ${top[0].src}:${top[0].name} (silhouette ${top[0].iou.toFixed(2)}, structure ${top[0].structure.toFixed(2)})`),
    );
    rows.push({ name: s.name, img, top, flagged: why.length > 0 });
  }

  // Sheet: our icon, then its 4 closest references with their scores.
  const Z = 6;
  const SL = 18 * Z;
  const PAD = 12;
  const CW = SL + 12;
  const RH = SL + LINE_H * 3 + 12;
  const cv = canvas(PAD * 2 + CW * 5 + 10, PAD * 2 + rows.length * RH);
  rows.forEach((r, n) => {
    const y = PAD + n * RH;
    if (r.flagged) cv.rect(PAD - 3, y - 3, SL + 6, SL + 6, [0xe0, 0x30, 0x30]);
    drawSlot(cv, PAD, y, Z, r.img);
    drawText(cv, PAD, y + SL + 4, r.name.slice(0, 13), [0x80, 0x10, 0x10]);
    r.top.forEach((t, k) => {
      const x = PAD + 10 + CW * (k + 1);
      drawSlot(cv, x, y, Z, t.mirrored ? mirror(t.img) : t.img);
      drawText(cv, x, y + SL + 4, `${t.src}:${t.name}`.slice(0, 13), DIM);
      drawText(cv, x, y + SL + 4 + LINE_H, `S${t.iou.toFixed(2)} T${t.structure.toFixed(2)}`, DIM);
      drawText(
        cv,
        x,
        y + SL + 4 + LINE_H * 2,
        `P${t.same.toFixed(2)} C${t.shared.toFixed(2)}${t.mirrored ? " M" : ""}`,
        DIM,
      );
    });
  });
  mkdirSync(OUT_DIR, { recursive: true });
  const file = out ?? path.join(OUT_DIR, "originality.png");
  writeFileSync(file, png(cv));
  console.log(
    `\n${flagged} of ${rows.length} icon(s) too close to a reference. Sheet: ${path.relative(ROOT, file)}` +
      "\n(S silhouette overlap, T brightness structure, P same pixels, C shared colours, M mirrored)",
  );
  if (flagged) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? path.resolve(args[outAt + 1]) : undefined;
  if (args[0] === "--compare") compareSheet(args[1] ?? "HEAD");
  else if (args[0] === "--originality")
    originality(
      args.slice(1).filter((a, i, all) => a !== "--out" && all[i - 1] !== "--out"),
      out,
    );
  else referenceSheet();
}

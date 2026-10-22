// Exports each mod's docs as data for the docs site (docs.<domain>, a separate project): not HTML,
// but one folder per mod in the generic format of tools/docs/schema.d.ts.
//
//   node tools/docs-export.mjs     -> dist/docs/<modId>/{data.json, schema.d.ts, icons/, pages/}
//
// A mod takes part by having an adapter, tools/docs/<mod>.mjs, whose default export is
// `async (ctx) => ({ docs, pagesDir })`: `docs` is the ModDocs object and `pagesDir` holds its
// pages/<id>.md. ctx.icon(png, rel) registers a 16 px PNG of our own art and returns its path in
// the export ("icons/<rel>.png"), or null when the file doesn't exist; this file upscales every
// registered icon 8× nearest-neighbour. Before writing, the export is checked against the
// schema's rules: every id one record names exists, every icon and page is there, and the pages'
// data links and embed directives point at things in data.json. A failed check writes nothing.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gitHash } from "./build.mjs";
import { decodePng, encodePng } from "./gen-textures.mjs";
import { DIST_DIR, ROOT } from "./paths.mjs";

const ADAPTERS = path.join(ROOT, "tools/docs");
const SCHEMA = path.join(ADAPTERS, "schema.d.ts");
const OUT = path.join(DIST_DIR, "docs");
const ICON_SCALE = 8;
const FORMAT = 1;

function upscale(im, k) {
  const out = { w: im.w * k, h: im.h * k, px: new Uint8Array(im.w * k * im.h * k * 4) };
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const s = (Math.floor(y / k) * im.w + Math.floor(x / k)) * 4;
      out.px.set(im.px.subarray(s, s + 4), (y * out.w + x) * 4);
    }
  return out;
}

/** The context an adapter gets: shared helpers and the icon registry. */
function context() {
  const icons = new Map(); // export path -> source file
  return {
    icons,
    root: ROOT,
    build: gitHash(),
    iconScale: ICON_SCALE,
    /** Registers `png` as icons/<rel>.png; null when the file doesn't exist. */
    icon(png, rel) {
      if (!existsSync(png)) return null;
      const out = `icons/${rel}.png`;
      const known = icons.get(out);
      if (known && known !== png) throw new Error(`${out}: two sources (${known}, ${png})`);
      icons.set(out, png);
      return out;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Checks (the rules in schema.d.ts)
// ---------------------------------------------------------------------------------------------

const LINK = /\]\((item|crop|station|recipe|family|page|biome|crafting):([^)\s]+)\)/g;
const EMBED = /^```embed\n([\s\S]*?)^```/gm;
const DIRECTIVES = {
  crops: [],
  stations: [],
  recipes: ["station", "family"],
  crafting: ["id"],
  families: [],
  loop: [],
};

function check(docs, icons, pagesDir) {
  const problems = [];
  const fail = (where, message) => problems.push(`${where}: ${message}`);
  const ids = (list) => new Set(list.map((x) => x.id));
  const known = {
    item: new Set(Object.keys(docs.items)),
    tag: new Set(Object.keys(docs.tags)),
    biome: new Set(Object.keys(docs.biomes)),
    effect: new Set(Object.keys(docs.effects)),
    family: ids(docs.families),
    crop: ids(docs.crops),
    station: ids(docs.stations),
    recipe: ids(docs.recipes),
    crafting: ids(docs.crafting),
    page: ids(docs.pages),
  };
  for (const [kind, list] of Object.entries({
    family: docs.families,
    crop: docs.crops,
    station: docs.stations,
    recipe: docs.recipes,
    crafting: docs.crafting,
    page: docs.pages,
  })) {
    if (known[kind].size !== list.length) fail(kind, "duplicate ids");
  }
  const need = (where, kind, id) => {
    if (id === null || id === undefined) return;
    const ok = kind === "item|tag" ? known.item.has(id) || known.tag.has(id) : known[kind].has(id);
    if (!ok) fail(where, `unknown ${kind} ${JSON.stringify(id)}`);
  };
  const icon = (where, p) => {
    if (p !== null && !icons.has(p)) fail(where, `icon ${p} isn't exported`);
  };
  const ingredients = (where, list) =>
    list.forEach((ing) => {
      if (!(ing.count > 0) || ing.items.length === 0) fail(where, "empty ingredient");
      ing.items.forEach((id) => need(where, "item|tag", id));
    });

  if (docs.format !== FORMAT) fail("format", `${docs.format}, this exporter writes ${FORMAT}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(docs.mod.id)) fail("mod.id", "must be kebab-case");
  icon("mod.icon", docs.mod.icon);
  for (const [id, item] of Object.entries(docs.items)) {
    if (item.id !== id) fail(`items.${id}`, "id mismatch");
    icon(`items.${id}`, item.icon);
    need(`items.${id}.food.leaves`, "item", item.food?.leaves);
  }
  for (const [id, tag] of Object.entries(docs.tags)) {
    tag.items.forEach((i) => need(`tags.${id}`, "item", i));
    icon(`tags.${id}`, tag.icon);
  }
  for (const [id, biome] of Object.entries(docs.biomes)) icon(`biomes.${id}`, biome.icon);
  for (const [id, effect] of Object.entries(docs.effects)) {
    need(`effects.${id}`, "family", effect.family);
  }
  for (const f of docs.families) icon(`families.${f.id}`, f.icon);
  for (const c of docs.crops) {
    const at = `crops.${c.id}`;
    [c.produce, c.seed, c.block, ...c.plantOn].forEach((i) => need(at, "item", i));
    c.harvest.forEach((h) => need(at, "item", h.item));
    c.seedSource?.blocks.forEach((b) => need(at, "item", b));
    c.seedSource?.biomes.forEach((b) => need(at, "biome", b));
    icon(at, c.icon);
  }
  for (const s of docs.stations) {
    const at = `stations.${s.id}`;
    need(at, "item", s.item);
    s.heatSources.forEach((b) => need(at, "item", b));
    icon(at, s.icon);
  }
  for (const r of docs.recipes) {
    const at = `recipes.${r.id}`;
    need(at, "station", r.station);
    need(at, "item", r.result.item);
    ingredients(at, r.ingredients);
    need(at, "effect", r.effect?.effect);
    need(at, "family", r.effect?.family);
  }
  for (const g of docs.crafting) {
    const at = `crafting.${g.id}`;
    need(at, "station", g.station);
    need(at, "item", g.result.item);
    g.grid?.flat().forEach((cell) => need(at, "item|tag", cell));
    if (g.ingredients) ingredients(at, g.ingredients);
    if ((g.shape === "shaped") !== (g.grid !== null)) fail(at, "shape and grid disagree");
    g.unlockedBy.forEach((i) => need(at, "item", i));
  }

  // pages: every listed page exists, starts with its title, and references only known data
  const files = new Set(readdirSync(pagesDir).filter((f) => f.endsWith(".md")));
  for (const page of docs.pages) {
    const at = `pages/${page.id}.md`;
    if (!files.delete(`${page.id}.md`)) {
      fail(at, "missing");
      continue;
    }
    page.steps?.forEach((step) => step.items.forEach((i) => need(`${at} steps`, "item", i)));
    const md = readFileSync(path.join(pagesDir, `${page.id}.md`), "utf8");
    if (md.split("\n")[0] !== `# ${page.title}`) fail(at, `first line isn't "# ${page.title}"`);
    for (const [, kind, id] of md.matchAll(LINK)) need(at, kind, id);
    for (const [, body] of md.matchAll(EMBED)) {
      const [name, ...args] = body.trim().split(/\s+/);
      if (!(name in DIRECTIVES)) fail(at, `unknown embed "${name}"`);
      for (const arg of args) {
        const [key, value] = arg.split("=");
        if (!DIRECTIVES[name]?.includes(key)) fail(at, `embed ${name}: unknown argument ${key}`);
        else need(at, { station: "station", family: "family", id: "crafting" }[key], value);
      }
    }
  }
  for (const stray of files) fail(`pages/${stray}`, "not listed in data.json pages");
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

async function exportMod(adapterFile) {
  const ctx = context();
  const adapter = (await import(pathToFileURL(adapterFile).href)).default;
  const { docs, pagesDir } = await adapter(ctx);
  const problems = check(docs, ctx.icons, pagesDir);
  if (problems.length) {
    throw new Error(`${path.basename(adapterFile)}:\n  ${problems.join("\n  ")}`);
  }
  const out = path.join(OUT, docs.mod.id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(path.join(out, "pages"), { recursive: true });
  writeFileSync(path.join(out, "data.json"), `${JSON.stringify(docs, null, 2)}\n`);
  copyFileSync(SCHEMA, path.join(out, "schema.d.ts"));
  for (const page of docs.pages) {
    copyFileSync(path.join(pagesDir, `${page.id}.md`), path.join(out, "pages", `${page.id}.md`));
  }
  for (const [rel, src] of [...ctx.icons].sort()) {
    const im = decodePng(readFileSync(src));
    if (!im || im.w !== 16 || im.h !== 16) throw new Error(`${src}: not a 16×16 PNG`);
    mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    writeFileSync(path.join(out, rel), encodePng(upscale(im, ICON_SCALE)));
  }
  console.log(
    `[docs] ${path.relative(ROOT, out)}/: ${docs.recipes.length} recipes, ${docs.crops.length} crops, ` +
      `${docs.stations.length} stations, ${docs.pages.length} pages, ${ctx.icons.size} icons`,
  );
}

async function main() {
  const adapters = readdirSync(ADAPTERS)
    .filter((f) => f.endsWith(".mjs"))
    .sort();
  if (adapters.length === 0) throw new Error("no adapters in tools/docs/");
  for (const file of adapters) await exportMod(path.join(ADAPTERS, file));
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`[docs] ${error.message}`);
    process.exitCode = 1;
  }
}

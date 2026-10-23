// Packages Simmerfield for install: a release build of the BP and RP, zipped into one
// .mcaddon (a zip whose top level holds both pack folders; opening it imports both packs).
//
//   node tools/package.mjs     -> dist/Simmerfield-<git short hash>.mcaddon
//
// The hash is the one baked into the build id (chat on join, Content Log, /wm_kitchen:debug validate),
// so a file and a running build can be matched. Uncommitted changes add "-dirty" to the name.
// The zip is written here (no zip dependency): deflate from node:zlib, fixed timestamps and sorted
// entries, so the same dist/ contents give the same bytes (the build id in main.js has the minute).

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { buildPack, gitHash } from "./build.mjs";
import { DIST_DIR, ROOT } from "./paths.mjs";

const PACK = "simmerfield";
const NAME = "Simmerfield";
const FOLDERS = [`${PACK}_BP`, `${PACK}_RP`];

// 1980-01-01 00:00, the earliest DOS date: zip times carry no meaning here.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
const UTF8 = 0x0800;

/** Zip entries for `folders` under `base`: each directory ("name/") and file, sorted. */
function collect(base, folders) {
  const entries = [];
  for (const folder of folders) {
    entries.push({ name: `${folder}/`, dir: true });
    for (const rel of readdirSync(path.join(base, folder), { recursive: true })) {
      const file = path.join(base, folder, rel);
      const name = `${folder}/${rel.split(path.sep).join("/")}`;
      entries.push(statSync(file).isDirectory() ? { name: `${name}/`, dir: true } : { name, file });
    }
  }
  return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// What must never ship: sources and source maps, notes, test files and deploy markers. The build
// only copies behavior/ and resource/ and bundles scripts/main.ts, so none of this should reach
// dist/; this guards against a stray file dropped into a pack folder.
const FORBIDDEN = [
  /\.(ts|mts|map|md|mjs|bbmodel)$/i,
  /(^|\/)\.deployed-from-repo$/,
  /(^|\/)(tests?|docs)\//,
];

// What must always ship: the license, in both packs (packs/simmerfield/*/LICENSE.txt).
const REQUIRED = FOLDERS.map((folder) => `${folder}/LICENSE.txt`);

/** Throws if any entry is a file that doesn't belong in a release, or a required file is missing. */
function checkEntries(entries) {
  const bad = entries.filter((e) => FORBIDDEN.some((re) => re.test(e.name))).map((e) => e.name);
  if (bad.length > 0) throw new Error(`not for release: ${bad.join(", ")}`);
  const missing = REQUIRED.filter((name) => !entries.some((e) => e.name === name));
  if (missing.length > 0) throw new Error(`missing from release: ${missing.join(", ")}`);
}

/** A zip archive of `entries` (no zip64: throws past 4 GiB or 65535 entries). */
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = entry.dir ? Buffer.alloc(0) : readFileSync(entry.file);
    const deflated = entry.dir ? raw : zlib.deflateRawSync(raw, { level: 9 });
    const stored = deflated.length >= raw.length;
    const data = stored ? raw : deflated;
    const crc = zlib.crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed: 2.0 (deflate, directories)
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4); // made by: 2.0, MS-DOS attributes
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(UTF8, 8);
    head.writeUInt16LE(stored ? 0 : 8, 10);
    head.writeUInt16LE(DOS_TIME, 12);
    head.writeUInt16LE(DOS_DATE, 14);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(raw.length, 24);
    head.writeUInt16LE(name.length, 28);
    // 30..37: extra, comment, disk, internal attributes all 0
    head.writeUInt32LE(entry.dir ? 0x10 : 0, 38); // MS-DOS directory attribute
    head.writeUInt32LE(offset, 42);

    locals.push(local, name, data);
    central.push(head, name);
    offset += local.length + name.length + data.length;
    if (offset > 0xffffffff) throw new Error("archive over 4 GiB (no zip64 support)");
  }
  if (entries.length > 0xffff) throw new Error(`${entries.length} entries (no zip64 support)`);
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

async function main() {
  const hash = gitHash();
  await buildPack(PACK, { release: true, hash });
  const entries = collect(DIST_DIR, FOLDERS);
  checkEntries(entries);
  const out = path.join(DIST_DIR, `${NAME}-${hash.replace("+", "-dirty")}.mcaddon`);
  const bytes = zip(entries);
  writeFileSync(out, bytes);
  const files = entries.filter((e) => !e.dir).length;
  console.log(
    `[package] ${path.relative(ROOT, out)}: ${FOLDERS.join(" + ")} (release), ` +
      `${files} files, ${(bytes.length / 1024).toFixed(0)} KiB`,
  );
  if (hash.endsWith("+")) console.warn("[package] uncommitted changes: the build isn't a commit");
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`[package] ${error.message}`);
    process.exitCode = 1;
  }
}

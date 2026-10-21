// Puts the built packs from dist/ where the game loads development packs.
//
//   node tools/deploy.mjs          copy (default; `npm run dev` re-copies after each rebuild)
//   node tools/deploy.mjs --link   symlink instead (needs Flatpak access to dist/; the game
//                                  under mcpelauncher did not pick these up when tested)
//
// dist/<name>_BP -> <GAME_DIR>/development_behavior_packs/<name>_BP
// dist/<name>_RP -> <GAME_DIR>/development_resource_packs/<name>_RP
//
// Only touches entries this script created: symlinks into dist/, or copies holding MARKER.

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readlinkSync } from "node:fs";
import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DIST_DIR, GAME_DIR } from "./paths.mjs";

const FLATPAK_APP = "io.mrarm.mcpelauncher";
const MARKER = ".deployed-from-repo";
const TARGETS = [
  { suffix: "_BP", folder: "development_behavior_packs" },
  { suffix: "_RP", folder: "development_resource_packs" },
];

function builtPacks() {
  if (!existsSync(DIST_DIR)) return [];
  return readdirSync(DIST_DIR).flatMap((name) => {
    const target = TARGETS.find((t) => name.endsWith(t.suffix));
    if (!target) return [];
    return [
      { name, src: path.join(DIST_DIR, name), dest: path.join(GAME_DIR, target.folder, name) },
    ];
  });
}

// The game runs inside a Flatpak sandbox. A symlink to a path the sandbox can't see
// looks like an empty/missing pack to the game, so check before creating links.
// Returns true/false, or null if flatpak isn't available to ask.
function sandboxCanSee(dir) {
  let output;
  try {
    output = [
      execFileSync("flatpak", ["info", "--show-permissions", FLATPAK_APP], { encoding: "utf8" }),
      execFileSync("flatpak", ["override", "--user", "--show", FLATPAK_APP], { encoding: "utf8" }),
    ].join("\n");
  } catch {
    return null;
  }
  const entries = output
    .split("\n")
    .filter((line) => line.startsWith("filesystems="))
    .flatMap((line) => line.slice("filesystems=".length).split(";"))
    .map((entry) => entry.replace(/:(ro|rw|create)$/, ""))
    .filter((entry) => entry && !entry.startsWith("!"));

  return entries.some((entry) => {
    if (entry === "host" || entry === "home") return true;
    const abs = entry.startsWith("~/") ? path.join(os.homedir(), entry.slice(2)) : entry;
    return path.isAbsolute(abs) && (dir === abs || dir.startsWith(abs + path.sep));
  });
}

function isOurs(pack) {
  let stat;
  try {
    stat = lstatSync(pack.dest);
  } catch {
    return "missing";
  }
  if (stat.isSymbolicLink()) return readlinkSync(pack.dest) === pack.src ? "link" : null;
  if (stat.isDirectory() && existsSync(path.join(pack.dest, MARKER))) return "copy";
  return null;
}

function assertOurs(pack) {
  if (isOurs(pack) === null) {
    throw new Error(`${pack.dest} exists and was not created by deploy; move it away first`);
  }
}

async function place(pack, copy) {
  assertOurs(pack);
  if (isOurs(pack) !== "missing") await rm(pack.dest, { recursive: true, force: true });

  await mkdir(path.dirname(pack.dest), { recursive: true });
  if (copy) {
    await cp(pack.src, pack.dest, { recursive: true });
    await writeFile(path.join(pack.dest, MARKER), "");
  } else {
    await symlink(pack.src, pack.dest, "dir");
  }
  console.log(`[deploy] ${copy ? "copied" : "linked"} ${pack.dest}`);
}

export async function deploy({ link }) {
  const copy = !link;
  if (!existsSync(GAME_DIR)) {
    throw new Error(`game dir not found: ${GAME_DIR}\nLaunch the game once, or set MC_GAME_DIR.`);
  }
  const packs = builtPacks();
  if (packs.length === 0) throw new Error("nothing in dist/ — run `npm run build` first");

  if (!copy && GAME_DIR.includes(`/.var/app/${FLATPAK_APP}/`) && !sandboxCanSee(DIST_DIR)) {
    throw new Error(
      [
        `the ${FLATPAK_APP} Flatpak sandbox cannot see ${DIST_DIR}, so symlinks would be broken.`,
        "Either grant read-only access once (then re-run deploy):",
        `  flatpak override --user --filesystem=${DIST_DIR}:ro ${FLATPAK_APP}`,
        "or drop --link to copy instead:",
        "  npm run deploy",
      ].join("\n"),
    );
  }

  // Check every target before touching any, so a conflict can't leave a half-deployed pair.
  packs.forEach(assertOurs);
  for (const pack of packs) await place(pack, copy);
}

// Called by `npm run dev` after each rebuild: symlinks need nothing, copies get refreshed.
export async function refreshCopies() {
  for (const pack of builtPacks()) {
    if (isOurs(pack) === "copy") await place(pack, true);
  }
}

if (import.meta.main) {
  try {
    await deploy({ link: process.argv.includes("--link") });
  } catch (error) {
    console.error(`[deploy] ${error.message}`);
    process.exitCode = 1;
  }
}

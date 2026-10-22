// Builds every pack in packs/ into dist/<name>_BP and dist/<name>_RP.
//
//   node tools/build.mjs             one-off build (a test build)
//   node tools/build.mjs --release   one-off release build: no test-session chat output
//   node tools/build.mjs --watch     rebuild on any change under packs/ (test builds)
//
// Per pack:
//   behavior/        -> copied to dist/<name>_BP/
//   scripts/main.ts  -> bundled by esbuild to dist/<name>_BP/scripts/main.js
//   resource/        -> copied to dist/<name>_RP/

import { existsSync, readdirSync, readFileSync, watch } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { refreshCopies } from "./deploy.mjs";
import { DIST_DIR, PACKS_DIR, ROOT } from "./paths.mjs";

function listPacks() {
  return readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

// Script modules (@minecraft/server, ...) are provided by the game at runtime, so the
// version in manifest.json is what actually runs. The npm package only gives us types.
// Fail the build if the two drift apart, or if someone sneaks in a beta/rc version.
function scriptModuleDependencies(manifestPath) {
  const manifest = readJson(manifestPath);
  const modules = (manifest.dependencies ?? []).filter((dep) => dep.module_name);

  for (const { module_name: name, version } of modules) {
    if (/-/.test(version)) {
      throw new Error(`${manifestPath}: ${name}@${version} is a prerelease; use stable only`);
    }
    const pkgPath = path.join(ROOT, "node_modules", name, "package.json");
    if (!existsSync(pkgPath)) {
      throw new Error(`${manifestPath}: depends on ${name}, but it is not installed (npm i -E)`);
    }
    const installed = readJson(pkgPath).version;
    if (installed !== version) {
      throw new Error(
        `${manifestPath}: ${name} is ${version} in manifest but ${installed} in node_modules`,
      );
    }
  }
  return modules.map((dep) => dep.module_name);
}

// The game only reports broken JSON in the Content Log, once you're in a world. Catch it here.
function checkJsonFiles(dir) {
  for (const file of readdirSync(dir, { recursive: true })) {
    if (!file.endsWith(".json")) continue;
    try {
      JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    } catch (error) {
      throw new Error(
        `${path.relative(ROOT, path.join(dir, file))}: invalid JSON (${error.message})`,
        { cause: error },
      );
    }
  }
}

// Shown in game (chat on join, Content Log, /hk:debug validate) so a test session can tell
// which build is running: deploy only copies files, a world keeps its scripts until re-entered
// or /reload. "<git short hash>[+ if uncommitted changes] <local time>".
export function gitHash() {
  try {
    const hash = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
    const dirty =
      execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "";
    return `${hash}${dirty ? "+" : ""}`;
  } catch {
    return "dev";
  }
}

function buildId(hash = gitHash()) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${hash} ${time}`;
}

// A release build compiles out what only test sessions want: scripts read __RELEASE__ (for
// example, operators no longer get the build id and data-check count in chat on join; both stay
// in the Content Log). /hk:debug stays, operator-only, in both.
const RELEASE = process.argv.includes("--release");

/** Builds one pack into dist/. `hash` is the git hash baked into the build id (tools/package.mjs
 *  passes the one it puts in the file name). */
export async function buildPack(name, { release = RELEASE, hash } = {}) {
  const src = path.join(PACKS_DIR, name);
  const bpOut = path.join(DIST_DIR, `${name}_BP`);
  const rpOut = path.join(DIST_DIR, `${name}_RP`);

  await rm(bpOut, { recursive: true, force: true });
  await rm(rpOut, { recursive: true, force: true });

  const behaviorDir = path.join(src, "behavior");
  if (existsSync(behaviorDir)) {
    checkJsonFiles(behaviorDir);
    const external = scriptModuleDependencies(path.join(behaviorDir, "manifest.json"));
    await cp(behaviorDir, bpOut, { recursive: true });

    const entry = path.join(src, "scripts", "main.ts");
    if (existsSync(entry)) {
      await build({
        entryPoints: [entry],
        outfile: path.join(bpOut, "scripts", "main.js"),
        bundle: true,
        format: "esm",
        platform: "neutral",
        target: "es2022",
        // Game-provided modules stay as imports; everything else is bundled in.
        external,
        define: {
          __BUILD_ID__: JSON.stringify(buildId(hash)),
          __RELEASE__: JSON.stringify(release),
        },
        logLevel: "warning",
      });
    }
  }

  const resourceDir = path.join(src, "resource");
  if (existsSync(resourceDir)) {
    checkJsonFiles(resourceDir);
    await cp(resourceDir, rpOut, { recursive: true });
  }
}

export async function buildAll() {
  await mkdir(DIST_DIR, { recursive: true });
  const packs = listPacks();
  for (const name of packs) {
    await buildPack(name);
  }
  console.log(`[build] ${packs.join(", ")} -> dist/${RELEASE ? " (release)" : ""}`);
}

async function watchMode() {
  const rebuild = async () => {
    try {
      await buildAll();
      await refreshCopies();
    } catch (error) {
      console.error(`[build] failed: ${error.message}`);
    }
  };

  await rebuild();
  console.log("[watch] watching packs/ — use /reload in game for scripts");

  let timer;
  watch(PACKS_DIR, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  });
}

if (import.meta.main) {
  if (process.argv.includes("--watch")) {
    await watchMode();
  } else {
    try {
      await buildAll();
    } catch (error) {
      console.error(`[build] ${error.message}`);
      process.exitCode = 1;
    }
  }
}

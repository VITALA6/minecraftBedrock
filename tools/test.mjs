// Runs the unit tests: packs/*/tests/**/*.test.ts with Node's built-in test runner.
//
//   node tools/test.mjs                          every test file
//   node tools/test.mjs pot                      only files whose path contains "pot"
//   node tools/test.mjs -- --test-name-pattern=chowder   extra flags for node --test
//
// Node's own TypeScript stripping needs explicit ".ts" in imports, which the pack scripts don't
// use (esbuild bundles them for the game). So each test file is bundled by esbuild, like the
// game build, into a temp dir and run from there with `node --test`. Tests may only reach
// game-independent modules: importing @minecraft/* (even through another module) fails the
// bundle and names the importing file. Type-only imports are erased and fine.

import { readdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { PACKS_DIR, ROOT } from "./paths.mjs";

function findTests() {
  const files = [];
  for (const pack of readdirSync(PACKS_DIR, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue;
    const dir = path.join(PACKS_DIR, pack.name, "tests");
    let entries;
    try {
      entries = readdirSync(dir, { recursive: true });
    } catch {
      continue; // no tests/ folder
    }
    for (const file of entries) if (file.endsWith(".test.ts")) files.push(path.join(dir, file));
  }
  return files.sort();
}

/** esbuild plugin: a test bundle must not contain the game modules (they only exist in game). */
const noGameModules = {
  name: "no-game-modules",
  setup(builder) {
    builder.onResolve({ filter: /^@minecraft\// }, (args) => ({
      errors: [
        {
          text: `"${args.path}" is only available in game; tests may import pure modules only`,
        },
      ],
    }));
  },
};

async function main() {
  const separator = process.argv.indexOf("--");
  const args = separator === -1 ? process.argv.slice(2) : process.argv.slice(2, separator);
  const nodeArgs = separator === -1 ? [] : process.argv.slice(separator + 1);

  const tests = findTests().filter((file) =>
    args.every((filter) => path.relative(ROOT, file).includes(filter)),
  );
  if (tests.length === 0) {
    console.error(`[test] no test files found${args.length ? ` matching ${args.join(" ")}` : ""}`);
    process.exitCode = 1;
    return;
  }

  const outdir = await mkdtemp(path.join(os.tmpdir(), "mcb-tests-"));
  try {
    const result = await build({
      absWorkingDir: ROOT,
      entryPoints: tests,
      outdir,
      outbase: ROOT,
      outExtension: { ".js": ".mjs" },
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      external: ["node:*"],
      plugins: [noGameModules],
      sourcemap: "inline",
      logLevel: "silent",
      metafile: true,
    }).catch((error) => {
      for (const { text, location } of error.errors ?? []) {
        const at = location ? `${location.file}:${location.line}: ` : "";
        console.error(`[test] ${at}${text}`);
      }
      return undefined;
    });
    if (!result) {
      process.exitCode = 1;
      return;
    }
    const outputs = Object.keys(result.metafile.outputs)
      .filter((file) => file.endsWith(".mjs"))
      .map((file) => path.resolve(ROOT, file));

    // cwd is the repo root, so tests can read pack files by repo-relative path.
    const run = spawnSync(
      process.execPath,
      ["--enable-source-maps", "--test", ...nodeArgs, ...outputs],
      { cwd: ROOT, stdio: "inherit" },
    );
    process.exitCode = run.status ?? 1;
  } finally {
    await rm(outdir, { recursive: true, force: true });
  }
}

await main();

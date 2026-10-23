// Runs the unit tests: packs/*/tests/**/*.test.ts with Node's built-in test runner.
//
//   node tools/test.mjs                          every test file
//   node tools/test.mjs pot                      only files whose path contains "pot"
//   node tools/test.mjs -- --test-name-pattern=chowder   extra flags for node --test
//   node tools/test.mjs --coverage               coverage of the pure pack modules (npm run
//                                                test:coverage; filters and -- flags still work)
//
// Node's own TypeScript stripping needs explicit ".ts" in imports, which the pack scripts don't
// use (esbuild bundles them for the game). So each test file is bundled by esbuild, like the
// game build, into a temp dir and run from there with `node --test`. Tests may only reach
// game-independent modules: importing @minecraft/* (even through another module) fails the
// bundle and names the importing file. Type-only imports are erased and fine.
//
// --coverage runs the .ts files unbundled instead (see tools/test-coverage-hooks.mjs for why),
// with Node's coverage limited to packs/*/scripts. Every pure module is imported once even when
// no test reaches it, so an untested module shows up with its uncovered functions instead of
// being missing. It prints a per-file table and writes dist/coverage/lcov.info.

import { readdirSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { DIST_DIR, PACKS_DIR, ROOT } from "./paths.mjs";

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

/** packs/<pack>/scripts/**.ts that bundle without any @minecraft/* module, i.e. that tests can reach. */
async function findPureModules() {
  const files = [];
  for (const pack of readdirSync(PACKS_DIR, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue;
    const dir = path.join(PACKS_DIR, pack.name, "scripts");
    let entries;
    try {
      entries = readdirSync(dir, { recursive: true });
    } catch {
      continue;
    }
    for (const file of entries)
      if (file.endsWith(".ts") && !file.endsWith(".d.ts")) files.push(path.join(dir, file));
  }
  const pure = await Promise.all(
    files.map((file) =>
      build({
        absWorkingDir: ROOT,
        entryPoints: [file],
        bundle: true,
        write: false,
        format: "esm",
        platform: "neutral",
        plugins: [noGameModules],
        logLevel: "silent",
      }).then(
        () => file,
        () => undefined,
      ),
    ),
  );
  return pure.filter((file) => file !== undefined).sort();
}

/** lcov text -> per-file { lines, branches, functions } as [hit, found]. */
function parseLcov(text) {
  const files = new Map();
  let current;
  for (const line of text.split("\n")) {
    const [key, value] = line.split(":", 2);
    if (key === "SF") {
      current = { lines: [0, 0], branches: [0, 0], functions: [0, 0] };
      files.set(path.relative(ROOT, value), current);
    } else if (current) {
      const n = Number(value);
      if (key === "LH") current.lines[0] = n;
      else if (key === "LF") current.lines[1] = n;
      else if (key === "BRH") current.branches[0] = n;
      else if (key === "BRF") current.branches[1] = n;
      else if (key === "FNH") current.functions[0] = n;
      else if (key === "FNF") current.functions[1] = n;
    }
  }
  return files;
}

function printCoverageTable(files) {
  const pct = ([hit, found]) => (found === 0 ? "100.00" : ((100 * hit) / found).toFixed(2));
  const cell = (pair) => `${pct(pair).padStart(6)} (${pair[0]}/${pair[1]})`.padEnd(18);
  const total = { lines: [0, 0], branches: [0, 0], functions: [0, 0] };
  const rows = [...files].sort(([a], [b]) => a.localeCompare(b));
  const width = Math.max(5, ...rows.map(([file]) => file.length));
  const row = (name, c) =>
    `${name.padEnd(width)} | ${cell(c.lines)} | ${cell(c.branches)} | ${cell(c.functions)}`;
  console.log(
    `\n${"file".padEnd(width)} | ${"lines %".padEnd(18)} | ${"branches %".padEnd(18)} | functions %`,
  );
  console.log("-".repeat(width + 63));
  for (const [file, c] of rows) {
    console.log(row(file, c));
    for (const key of Object.keys(total)) {
      total[key][0] += c[key][0];
      total[key][1] += c[key][1];
    }
  }
  console.log("-".repeat(width + 63));
  console.log(row(`all files (${rows.length})`, total));
}

async function runCoverage(tests, nodeArgs) {
  const outdir = await mkdtemp(path.join(os.tmpdir(), "mcb-coverage-"));
  try {
    const pure = await findPureModules();
    const loadAll = path.join(outdir, "load-pure-modules.test.mjs");
    await writeFile(
      loadAll,
      [
        'import { it } from "node:test";',
        ...pure.map((file) => `import ${JSON.stringify(pathToFileURL(file).href)};`),
        `it("imports every pure module (${pure.length})", () => {});`,
        "",
      ].join("\n"),
    );
    const lcov = path.join(outdir, "lcov.info");
    const run = spawnSync(
      process.execPath,
      [
        "--enable-source-maps",
        "--import",
        pathToFileURL(path.join(ROOT, "tools/test-coverage-hooks.mjs")).href,
        "--test",
        "--experimental-test-coverage",
        "--test-coverage-include=packs/*/scripts/**",
        "--test-reporter=dot",
        "--test-reporter-destination=stdout",
        "--test-reporter=lcov",
        `--test-reporter-destination=${lcov}`,
        ...nodeArgs,
        ...tests,
        loadAll,
      ],
      { cwd: ROOT, stdio: "inherit" },
    );
    process.exitCode = run.status ?? 1;
    const report = await readFile(lcov, "utf8").catch(() => undefined);
    if (report === undefined) {
      console.error("[test] no coverage report written");
      process.exitCode = 1;
      return;
    }
    printCoverageTable(parseLcov(report));
    const saved = path.join(DIST_DIR, "coverage", "lcov.info");
    await mkdir(path.dirname(saved), { recursive: true });
    await copyFile(lcov, saved);
    console.log(`\n[test] lcov report: ${path.relative(ROOT, saved)}`);
  } finally {
    await rm(outdir, { recursive: true, force: true });
  }
}

async function main() {
  const separator = process.argv.indexOf("--");
  const ownArgs = separator === -1 ? process.argv.slice(2) : process.argv.slice(2, separator);
  const nodeArgs = separator === -1 ? [] : process.argv.slice(separator + 1);
  const coverage = ownArgs.includes("--coverage");
  const args = ownArgs.filter((arg) => arg !== "--coverage");

  const tests = findTests().filter((file) =>
    args.every((filter) => path.relative(ROOT, file).includes(filter)),
  );
  if (tests.length === 0) {
    console.error(`[test] no test files found${args.length ? ` matching ${args.join(" ")}` : ""}`);
    process.exitCode = 1;
    return;
  }
  if (coverage) {
    await runCoverage(tests, nodeArgs);
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

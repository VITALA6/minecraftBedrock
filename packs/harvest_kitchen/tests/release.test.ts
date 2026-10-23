import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// What a release build (npm run build:release, npm run package) leaves in the script bundle, and
// that the two manifests and the changelog agree on the version. The bundle is built in memory
// with tools/build.mjs's own esbuild options (scriptOptions), so dist/ is left alone.
// tools/test.mjs runs tests from the repo root, so paths are repo-relative.

const PACK = "packs/harvest_kitchen";

function bundle(release: boolean): string {
  const script = [
    'import { build } from "esbuild";',
    'import { scriptOptions } from "./tools/build.mjs";',
    `const options = scriptOptions("harvest_kitchen", { release: ${release}, hash: "test" });`,
    "const result = await build({ ...options, write: false });",
    "process.stdout.write(result.outputFiles[0].text);",
  ].join("\n");
  const run = spawnSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
}

describe("release bundle", () => {
  const release = bundle(true);
  const test = bundle(false);

  it("has no console.log, but keeps console.warn and console.error", () => {
    assert.ok(test.includes("console.log("), "the test build still logs (check is meaningful)");
    assert.ok(!release.includes("console.log"), "console.log left in the release bundle");
    assert.ok(release.includes("console.warn("), "console.warn was dropped");
    assert.ok(release.includes("console.error("), "console.error was dropped");
  });

  it("sends no build id or data-check count to chat on join", () => {
    assert.ok(test.includes("hk.debug.problems"), "the test build announces problems on join");
    assert.ok(!release.includes("hk.debug.problems"), "announceProblems left in the release");
    assert.ok(!release.includes("announceBuild"), "announceBuild left in the release");
    assert.ok(!release.includes("] build "), "the build line left in the release");
  });

  it("still registers /hk:debug, operator-only", () => {
    assert.ok(release.includes('"hk:debug"'), "/hk:debug missing from the release");
    assert.ok(release.includes("registerCommand("), "no custom command registered");
    assert.ok(release.includes("CommandPermissionLevel.Admin"), "not registered as Admin");
    assert.ok(release.includes("CustomCommandSource.Entity"), "callback doesn't check the source");
  });
});

interface Manifest {
  header: { uuid: string; version: number[]; min_engine_version: number[] };
  modules: { version: number[] }[];
  dependencies?: { uuid?: string; version: number[] | string }[];
}

const manifest = (side: string): Manifest =>
  JSON.parse(readFileSync(`${PACK}/${side}/manifest.json`, "utf8")) as Manifest;

describe("pack version", () => {
  const bp = manifest("behavior");
  const rp = manifest("resource");
  const version = bp.header.version;

  it("is the same in both headers, every module and the BP's dependency on the RP", () => {
    assert.deepEqual(rp.header.version, version, "RP header");
    for (const m of [...bp.modules, ...rp.modules]) assert.deepEqual(m.version, version, "module");
    const onRp = bp.dependencies?.find((d) => d.uuid === rp.header.uuid);
    assert.ok(onRp, "the BP doesn't depend on the RP's header uuid");
    assert.deepEqual(onRp.version, version, "BP dependency on the RP");
    assert.deepEqual(rp.header.min_engine_version, bp.header.min_engine_version);
  });

  it("has a CHANGELOG.md entry", () => {
    const changelog = readFileSync("CHANGELOG.md", "utf8");
    assert.match(changelog, new RegExp(`^## ${version.join("\\.")} - \\d{4}-\\d{2}-\\d{2}$`, "m"));
  });
});

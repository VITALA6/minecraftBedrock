import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

// What a release build (npm run build:release, npm run package) leaves in the script bundle, and
// that the two manifests and the changelog agree on the version. The bundle is built in memory
// with tools/build.mjs's own esbuild options (scriptOptions), so dist/ is left alone.
// tools/test.mjs runs tests from the repo root, so paths are repo-relative.

const PACK = "packs/simmerfield";

function bundle(release: boolean): string {
  const script = [
    'import { build } from "esbuild";',
    'import { scriptOptions } from "./tools/build.mjs";',
    `const options = scriptOptions("simmerfield", { release: ${release}, hash: "test" });`,
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
    assert.ok(
      test.includes("wm_kitchen.debug.problems"),
      "the test build announces problems on join",
    );
    assert.ok(
      !release.includes("wm_kitchen.debug.problems"),
      "announceProblems left in the release",
    );
    assert.ok(!release.includes("announceBuild"), "announceBuild left in the release");
    assert.ok(!release.includes("] build "), "the build line left in the release");
  });

  it("still registers /wm_kitchen:debug, operator-only", () => {
    assert.ok(release.includes('"wm_kitchen:debug"'), "/wm_kitchen:debug missing from the release");
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

// The rename of 2026-10-23: "Harvest Kitchen" became Simmerfield and the namespace hk became
// wm_kitchen. What a build ships is behavior/ and resource/ as they are, plus the script bundle
// (tools/build.mjs buildPack), so those are what's searched: every path, and the content of every
// text file. "§h§k" (the Kitchen Guide's form-title marker) isn't the namespace and doesn't match.
describe("shipped names", () => {
  const OLD_NAME = /harvest[ _-]?kitchen/i;
  // hk as an id part: "hk:tomato", "hk_tomato", "hk.guide.title", "textures/hk/", "variable.hk_icon".
  const OLD_NAMESPACE = /(?<![A-Za-z0-9])hk(?=[:_./\\-]|$)/m;
  const TEXT = /\.(json|lang|txt)$/;

  const shipped = ["behavior", "resource"].flatMap((side) =>
    readdirSync(`${PACK}/${side}`, { recursive: true }).map((rel) => `${PACK}/${side}/${rel}`),
  );
  const texts = shipped.filter((file) => TEXT.test(file));
  const sources: [string, string][] = [
    ...texts.map((file): [string, string] => [file, readFileSync(file, "utf8")]),
    ["scripts/main.js (release)", bundle(true)],
    ["scripts/main.js (test build)", bundle(false)],
  ];

  it("only has text formats this test reads, besides PNGs", () => {
    const files = shipped.filter((file) => /\.[a-z]+$/.test(file));
    const other = files.filter((file) => !TEXT.test(file) && !file.endsWith(".png"));
    assert.deepEqual(other, [], "a new file type: add it to TEXT");
  });

  it('has no "Harvest Kitchen" in any form', () => {
    for (const [where, text] of sources) {
      const hit = OLD_NAME.exec(text);
      assert.equal(hit, null, `${where}: "${hit?.[0]}"`);
    }
    assert.deepEqual(
      shipped.filter((file) => OLD_NAME.test(file)),
      [],
    );
  });

  it("has no hk: identifier, hk_ shortname, hk. key or hk/ folder", () => {
    for (const [where, text] of sources) {
      const hit = OLD_NAMESPACE.exec(text);
      const around = hit ? text.slice(Math.max(0, hit.index - 30), hit.index + 30) : "";
      assert.equal(hit, null, `${where}: ...${around}...`);
    }
    assert.deepEqual(
      shipped.filter((file) => OLD_NAMESPACE.test(file)),
      [],
    );
  });

  it("uses wm_kitchen and Simmerfield instead (so the searches above can't pass by accident)", () => {
    const release = sources.find(([where]) => where.endsWith("(release)"))?.[1] ?? "";
    assert.ok(release.includes('"wm_kitchen:tomato"'), "release bundle");
    const lang = readFileSync(`${PACK}/resource/texts/en_US.lang`, "utf8");
    assert.match(lang, /^pack\.name=Simmerfield RP$/m);
    assert.match(lang, /^wm_kitchen\.guide\.title=/m);
    assert.ok(shipped.some((file) => file.includes("textures/wm_kitchen/items/")));
    const ui = readFileSync(`${PACK}/resource/ui/server_form.json`, "utf8");
    assert.ok(ui.includes("§h§k"), "the book marker is still there");
  });
});

// Module hooks for `node tools/test.mjs --coverage` (loaded with `node --import`).
//
// The normal test run bundles each test file with esbuild. That doesn't work for coverage: Node
// maps a bundle's V8 ranges back through the source map one range at a time, so the bundle's single
// top-level range lands in one source file and every other file's top-level code reads as
// uncovered. So coverage runs the .ts files unbundled: each one is compiled on its own by the
// TypeScript compiler (already a devDependency; it keeps comments and supports parameter
// properties, which Node's own type stripping refuses) with an inline source map, and Node reports
// coverage per original file.
//
// The resolve hook adds the ".ts" the pack scripts leave out of their imports, and refuses
// @minecraft/* like the bundling run does (tests may reach pure modules only).

import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
  verbatimModuleSyntax: true,
  inlineSourceMap: true,
  inlineSources: true,
};

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@minecraft/")) {
      const from = context.parentURL ? fileURLToPath(context.parentURL) : "?";
      throw new Error(
        `"${specifier}" (imported by ${from}) is only available in game; tests may import pure modules only`,
      );
    }
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (relative && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.endsWith(".ts")) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // not a .ts file: let Node resolve it as written
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.startsWith("file:") || !url.endsWith(".ts")) return next(url, context);
    const fileName = fileURLToPath(url);
    const { outputText } = ts.transpileModule(readFileSync(fileName, "utf8"), {
      fileName,
      compilerOptions,
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});

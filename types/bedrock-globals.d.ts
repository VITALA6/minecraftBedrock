// Globals the Bedrock script runtime provides. tsconfig leaves out the DOM lib on purpose
// (there's no window or setTimeout in game), so declare what does exist here.
// console output goes to the Content Log (GUI and file), tagged [Scripting].
declare const console: {
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};

// Injected by tools/build.mjs (esbuild define): "<git short hash>[+] <time>" of the build.
declare const __BUILD_ID__: string;

// Injected by tools/build.mjs: true for `node tools/build.mjs --release` (npm run build:release).
declare const __RELEASE__: boolean;

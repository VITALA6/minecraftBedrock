// The few Node built-ins the tests use, typed by hand: the workspace has no @types/node, and the
// pack scripts must not see Node's globals (tsconfig "types": []). Tests run in Node through
// tools/test.mjs; nothing here is available in game.

declare module "node:test" {
  type Body = () => void | Promise<void>;
  // Node returns a promise from these; typed as void so top-level calls aren't "floating".
  export function describe(name: string, body: Body): void;
  export function it(name: string, body: Body): void;
  export function test(name: string, body: Body): void;
}

declare module "node:assert/strict" {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    match(value: string, pattern: RegExp, message?: string): void;
    fail(message?: string): never;
  }
  const assert: Assert;
  export default assert;
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readdirSync(path: string, options?: { recursive?: boolean }): string[];
  export function existsSync(path: string): boolean;
}

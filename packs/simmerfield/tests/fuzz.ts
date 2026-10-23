// Property-based tests without a dependency: a small seeded PRNG and a runner that tries a
// property on many generated cases and, when one fails, says how to replay exactly that case.
//
//   FUZZ_SEED=<n>     base seed (default fixed, so `npm test` is reproducible); "random" picks one
//   FUZZ_RUNS=<n>     multiplies every property's number of cases (e.g. 20 for a long soak)
//   FUZZ_CASE=<hex>   runs only the case with this seed (copied from a failure message)
//
// Each case gets its own seed, derived from the base seed, the property name and the case number,
// so adding a property or changing one's run count doesn't change the cases of the others.

import process from "node:process";

/** mulberry32: 32-bit state, good enough to generate test cases (not for anything secret). */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error("Rng.pick from an empty list");
    return list[Math.floor(this.next() * list.length)] as T;
  }

  /** A shuffled copy (Fisher-Yates). */
  shuffle<T>(list: readonly T[]): T[] {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Picks by weight: `[["add", 5], ["tick", 3]]`. */
  weighted<T>(choices: readonly (readonly [T, number])[]): T {
    const total = choices.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * total;
    for (const [value, weight] of choices) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return (choices[choices.length - 1] as readonly [T, number])[0];
  }
}

/** FNV-1a, to turn a property name into part of its seed. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const hex = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, "0")}`;

function envSeed(): number {
  const raw = process.env.FUZZ_SEED;
  if (raw === undefined || raw === "") return 0x5eed2026;
  if (raw === "random") {
    const seed = Math.floor(Math.random() * 2 ** 32);
    console.log(`[fuzz] FUZZ_SEED=random -> ${seed}`);
    return seed;
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`FUZZ_SEED must be an integer or "random", got ${raw}`);
  return n >>> 0;
}

export const FUZZ_SEED: number = envSeed();
const RUN_FACTOR = Math.max(1, Number(process.env.FUZZ_RUNS ?? "1") || 1);
const ONLY_CASE = process.env.FUZZ_CASE ? Number(process.env.FUZZ_CASE) >>> 0 : undefined;

/** What a case prints when it fails: call it with the generated input (JSON-serialised). */
export type Note = (label: string, value: unknown) => void;

/**
 * Runs `body` on `runs` generated cases (× FUZZ_RUNS). A failing case throws with its seed and the
 * last values it passed to `note`, so the failure can be replayed with FUZZ_CASE.
 */
export function property(name: string, runs: number, body: (rng: Rng, note: Note) => void): void {
  const total = ONLY_CASE === undefined ? runs * RUN_FACTOR : 1;
  for (let run = 0; run < total; run++) {
    const seed =
      ONLY_CASE ?? (hash(name) ^ Math.imul(FUZZ_SEED, 0x9e3779b1) ^ (run * 0x85ebca6b)) >>> 0;
    const notes: string[] = [];
    const note: Note = (label, value) => notes.push(`  ${label}: ${JSON.stringify(value)}`);
    try {
      body(new Rng(seed), note);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        [
          `property "${name}" failed on case ${run + 1}/${total} (FUZZ_SEED=${FUZZ_SEED}, ` +
            `replay with FUZZ_CASE=${hex(seed)})`,
          ...notes,
          message,
        ].join("\n"),
        { cause: error },
      );
    }
  }
}

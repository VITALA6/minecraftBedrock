import type { RGB, Vector3 } from "@minecraft/server";
import { PARTICLE } from "../config";

// The Molang variables each vanilla particle we spawn reads, beyond the ones the engine always
// sets (variable.particle_*, variable.emitter_*). A particle that reads a variable nobody set logs
// "unable to find member variable" / "unhandled request for unknown variable" on every spawn, so
// lib/feedback.ts builds each spawn's MolangVariableMap from this table.
//
// Read from the 1.26.52.3 vanilla resource packs (particles.brarchive, newest layer wins) on
// 2026-10-22. Re-check after a game update, or when adding a particle to PARTICLE:
//   water_splash_particle   variable.direction.x/.y/.z (its emitter direction; left unset,
//                           it caused the Content Log's .x/.y/.z Molang errors)
//   falling_dust            variable.color.r/.g/.b
//   crop_growth_emitter     variable.size (sets it itself in its emitter initialisation)
//   basic_smoke_particle, heart_particle, villager_happy, white_smoke_particle: built-ins only

export type ParticleId = (typeof PARTICLE)[keyof typeof PARTICLE];

export interface ParticleInputs {
  /** RGB variable (`<name>.r/.g/.b`), set with setColorRGB. */
  readonly color?: string;
  /** Vector variable (`<name>.x/.y/.z`), set with setVector3, and the value we give it. */
  readonly vector?: { readonly name: string; readonly value: Vector3 };
}

/** Straight up: the splash sprays out of the pot. */
const UP: Vector3 = { x: 0, y: 1, z: 0 };

/** Every particle in PARTICLE must have an entry (the Record type enforces it). */
export const PARTICLE_INPUTS: Readonly<Record<ParticleId, ParticleInputs>> = {
  [PARTICLE.splash]: { vector: { name: "variable.direction", value: UP } },
  [PARTICLE.puff]: {},
  [PARTICLE.sparkle]: {},
  [PARTICLE.steam]: {},
  [PARTICLE.bits]: { color: "variable.color" },
  [PARTICLE.hearts]: {},
  [PARTICLE.growth]: {},
};

/** Used when a colour particle is spawned without a colour: a neutral light grey. */
export const DEFAULT_PARTICLE_COLOR: RGB = { red: 0.8, green: 0.8, blue: 0.8 };

export type MolangInput =
  | { readonly kind: "color"; readonly name: string; readonly value: RGB }
  | { readonly kind: "vector"; readonly name: string; readonly value: Vector3 };

/**
 * The variables one spawn of `id` needs. `color` only applies to particles that read a colour
 * (it's dropped for the others); a colour particle without one gets DEFAULT_PARTICLE_COLOR.
 * Unknown ids get none.
 */
export function particleInputs(id: string, color?: RGB): MolangInput[] {
  const inputs = (PARTICLE_INPUTS as Readonly<Record<string, ParticleInputs>>)[id];
  if (!inputs) return [];
  const out: MolangInput[] = [];
  if (inputs.color) {
    out.push({ kind: "color", name: inputs.color, value: color ?? DEFAULT_PARTICLE_COLOR });
  }
  if (inputs.vector) out.push({ kind: "vector", ...inputs.vector });
  return out;
}

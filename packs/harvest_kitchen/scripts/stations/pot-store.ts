import { world, type Dimension, type Vector3 } from "@minecraft/server";
import { POT_PROPERTY_PREFIX } from "../config";

// Each cooking pot's contents live in one world dynamic property keyed by position:
//   "hk:pot:minecraft:overworld:10,64,-3" ->
//   '{"dim":"minecraft:overworld","pos":[10,64,-3],"items":{"hk:tomato":2},"job":{...}}'
// dim/pos are repeated in the value so active pots can be found again after a reload without
// parsing keys. An empty, idle pot has no property at all.

export interface PotRef {
  readonly dimension: Dimension;
  readonly location: Vector3;
}

export interface CookingJob {
  readonly recipe: string;
  /** Date.now() when the dish is done. Wall-clock, so it survives /reload and world restarts. */
  readonly readyAt: number;
  /** Player id of whoever started it; they get the dish if they're nearby. */
  readonly cook: string;
}

export interface PotState {
  readonly items: Readonly<Record<string, number>>;
  readonly job?: CookingJob;
}

export const EMPTY_POT: PotState = { items: {} };

export function potKey({ dimension, location: { x, y, z } }: PotRef): string {
  return `${POT_PROPERTY_PREFIX}${dimension.id}:${x},${y},${z}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseItems(raw: unknown): Record<string, number> {
  const items: Record<string, number> = {};
  if (!isRecord(raw)) return items;
  for (const [id, count] of Object.entries(raw)) {
    if (typeof count === "number" && Number.isInteger(count) && count > 0) items[id] = count;
  }
  return items;
}

function parseJob(raw: unknown): CookingJob | undefined {
  if (!isRecord(raw)) return undefined;
  const { recipe, readyAt, cook } = raw;
  if (typeof recipe !== "string" || typeof readyAt !== "number" || typeof cook !== "string") {
    return undefined;
  }
  return { recipe, readyAt, cook };
}

function parse(raw: string): { state: PotState; dim?: string; pos?: Vector3 } | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  const job = parseJob(value.job);
  const state: PotState = job
    ? { items: parseItems(value.items), job }
    : { items: parseItems(value.items) };
  const { dim, pos } = value;
  const validPos =
    Array.isArray(pos) && pos.length === 3 && pos.every((n) => typeof n === "number")
      ? { x: pos[0] as number, y: pos[1] as number, z: pos[2] as number }
      : undefined;
  return { state, dim: typeof dim === "string" ? dim : undefined, pos: validPos };
}

export function readPot(pot: PotRef): PotState {
  const raw = world.getDynamicProperty(potKey(pot));
  if (raw === undefined) return EMPTY_POT;
  const parsed = typeof raw === "string" ? parse(raw) : undefined;
  if (!parsed) {
    console.warn(`[harvest_kitchen] unreadable pot data at ${potKey(pot)}; treating it as empty`);
    return EMPTY_POT;
  }
  return parsed.state;
}

export function writePot(pot: PotRef, state: PotState): void {
  if (!state.job && Object.keys(state.items).length === 0) {
    world.setDynamicProperty(potKey(pot), undefined);
    return;
  }
  const { x, y, z } = pot.location;
  world.setDynamicProperty(
    potKey(pot),
    JSON.stringify({ dim: pot.dimension.id, pos: [x, y, z], items: state.items, job: state.job }),
  );
}

export function clearPot(pot: PotRef): void {
  world.setDynamicProperty(potKey(pot), undefined);
}

/** Every pot with a cooking job, from saved data. Used once at world load. */
export function findCookingPots(): PotRef[] {
  const pots: PotRef[] = [];
  for (const id of world.getDynamicPropertyIds()) {
    if (!id.startsWith(POT_PROPERTY_PREFIX)) continue;
    const raw = world.getDynamicProperty(id);
    const parsed = typeof raw === "string" ? parse(raw) : undefined;
    if (!parsed?.state.job || !parsed.dim || !parsed.pos) continue;
    try {
      pots.push({ dimension: world.getDimension(parsed.dim), location: parsed.pos });
    } catch {
      console.warn(`[harvest_kitchen] pot ${id} is in unknown dimension ${parsed.dim}`);
    }
  }
  return pots;
}

import { world, type Dimension, type Vector3 } from "@minecraft/server";
import { STATION_PROPERTY_PREFIX } from "../config";
import { stationById, type ContainerStation } from "../data/stations";

// Each non-empty station's contents live in one world dynamic property keyed by position, because
// custom blocks have no block entities:
//   "hk:st:pot:minecraft:overworld:10,64,-3" ->
//   '{"st":"pot","dim":"minecraft:overworld","pos":[10,64,-3],"items":{"hk:tomato":2},
//     "job":{"recipe":"hk:tomato_soup","ticks":60,"total":100},"out":{"item":"…","count":1}}'
// st/dim/pos are repeated in the value so active stations can be found again after a reload
// without parsing keys. An empty station stores nothing. Values are validated on read; broken
// data is treated as empty with a warning.

export interface StationRef {
  readonly station: ContainerStation;
  readonly dimension: Dimension;
  readonly location: Vector3;
}

export interface StationJob {
  readonly recipe: string;
  /** Cook time left. Counts down only while the station has heat, so it pauses without it. */
  readonly ticks: number;
  /** Cook time at the start, for the progress bar. */
  readonly total: number;
}

/** A finished dish waiting in the station until someone collects it. */
export interface StationOutput {
  readonly item: string;
  readonly count: number;
}

export interface StationState {
  readonly items: Readonly<Record<string, number>>;
  readonly job?: StationJob;
  readonly out?: StationOutput;
}

export const EMPTY: StationState = { items: {} };

export function stationKey({ station, dimension, location: { x, y, z } }: StationRef): string {
  return `${STATION_PROPERTY_PREFIX}${station.id}:${dimension.id}:${x},${y},${z}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseItems(raw: unknown): Record<string, number> {
  const items: Record<string, number> = {};
  if (!isRecord(raw)) return items;
  for (const [id, count] of Object.entries(raw)) if (positiveInt(count)) items[id] = count;
  return items;
}

function parseJob(raw: unknown): StationJob | undefined {
  if (!isRecord(raw)) return undefined;
  const { recipe, ticks, total } = raw;
  if (typeof recipe !== "string" || typeof ticks !== "number" || !positiveInt(total)) return;
  return { recipe, ticks: Math.max(0, Math.floor(ticks)), total };
}

function parseOut(raw: unknown): StationOutput | undefined {
  if (!isRecord(raw)) return undefined;
  const { item, count } = raw;
  return typeof item === "string" && positiveInt(count) ? { item, count } : undefined;
}

interface Parsed {
  readonly state: StationState;
  readonly station?: string;
  readonly dim?: string;
  readonly pos?: Vector3;
}

function parse(raw: string): Parsed | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  const job = parseJob(value.job);
  const out = parseOut(value.out);
  const state: StationState = {
    items: parseItems(value.items),
    ...(job ? { job } : {}),
    ...(out ? { out } : {}),
  };
  const { st, dim, pos } = value;
  const validPos =
    Array.isArray(pos) && pos.length === 3 && pos.every((n) => typeof n === "number")
      ? { x: pos[0] as number, y: pos[1] as number, z: pos[2] as number }
      : undefined;
  return {
    state,
    station: typeof st === "string" ? st : undefined,
    dim: typeof dim === "string" ? dim : undefined,
    pos: validPos,
  };
}

export function isEmpty(state: StationState): boolean {
  return !state.job && !state.out && Object.keys(state.items).length === 0;
}

export function readStation(ref: StationRef): StationState {
  const key = stationKey(ref);
  const raw = world.getDynamicProperty(key);
  if (raw === undefined) return EMPTY;
  const parsed = typeof raw === "string" ? parse(raw) : undefined;
  if (!parsed) {
    console.warn(`[harvest_kitchen] unreadable station data at ${key}; treating it as empty`);
    return EMPTY;
  }
  return parsed.state;
}

export function writeStation(ref: StationRef, state: StationState): void {
  if (isEmpty(state)) {
    world.setDynamicProperty(stationKey(ref), undefined);
    return;
  }
  const { x, y, z } = ref.location;
  world.setDynamicProperty(
    stationKey(ref),
    JSON.stringify({
      st: ref.station.id,
      dim: ref.dimension.id,
      pos: [x, y, z],
      items: state.items,
      job: state.job,
      out: state.out,
    }),
  );
}

export function clearStation(ref: StationRef): void {
  world.setDynamicProperty(stationKey(ref), undefined);
}

/** Size of the saved JSON in characters (for /hk:debug pot). */
export function storedSize(ref: StationRef): number {
  const raw = world.getDynamicProperty(stationKey(ref));
  return typeof raw === "string" ? raw.length : 0;
}

/** Every station with saved contents. Used at world load to rebuild the active list. */
export function findSavedStations(): StationRef[] {
  const refs: StationRef[] = [];
  for (const id of world.getDynamicPropertyIds()) {
    if (!id.startsWith(STATION_PROPERTY_PREFIX)) continue;
    const raw = world.getDynamicProperty(id);
    const parsed = typeof raw === "string" ? parse(raw) : undefined;
    const station = parsed?.station ? stationById(parsed.station) : undefined;
    if (!parsed || !station || !parsed.dim || !parsed.pos || isEmpty(parsed.state)) continue;
    try {
      refs.push({ station, dimension: world.getDimension(parsed.dim), location: parsed.pos });
    } catch {
      console.warn(`[harvest_kitchen] station ${id} is in unknown dimension ${parsed.dim}`);
    }
  }
  return refs;
}

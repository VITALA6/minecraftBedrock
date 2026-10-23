import { world, type Dimension, type Vector3 } from "@minecraft/server";
import { STATION_PROPERTY_PREFIX } from "../config";
import { stationById, type ContainerStation } from "../data/stations";
import { EMPTY, isEmpty, parseSaved, serializeSaved, type StationState } from "./station-logic";

// Each non-empty station's contents live in one world dynamic property keyed by position, because
// custom blocks have no block entities: "wm_kitchen:st:pot:minecraft:overworld:10,64,-3" -> JSON (format
// and parsing in station-logic.ts). An empty station stores nothing. Broken data is treated as
// empty with a warning.

export interface StationRef {
  readonly station: ContainerStation;
  readonly dimension: Dimension;
  readonly location: Vector3;
}

export function stationKey({ station, dimension, location: { x, y, z } }: StationRef): string {
  return `${STATION_PROPERTY_PREFIX}${station.id}:${dimension.id}:${x},${y},${z}`;
}

export function readStation(ref: StationRef): StationState {
  const key = stationKey(ref);
  const raw = world.getDynamicProperty(key);
  if (raw === undefined) return EMPTY;
  const parsed = typeof raw === "string" ? parseSaved(raw) : undefined;
  if (!parsed) {
    console.warn(`[simmerfield] unreadable station data at ${key}; treating it as empty`);
    return EMPTY;
  }
  return parsed.state;
}

export function writeStation(ref: StationRef, state: StationState): void {
  if (isEmpty(state)) {
    world.setDynamicProperty(stationKey(ref), undefined);
    return;
  }
  world.setDynamicProperty(
    stationKey(ref),
    serializeSaved(ref.station.id, ref.dimension.id, ref.location, state),
  );
}

export function clearStation(ref: StationRef): void {
  world.setDynamicProperty(stationKey(ref), undefined);
}

/** Size of the saved JSON in characters (for /wm_kitchen:debug pot). */
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
    const parsed = typeof raw === "string" ? parseSaved(raw) : undefined;
    const station = parsed?.station ? stationById(parsed.station) : undefined;
    if (!parsed || !station || !parsed.dim || !parsed.pos || isEmpty(parsed.state)) continue;
    try {
      refs.push({ station, dimension: world.getDimension(parsed.dim), location: parsed.pos });
    } catch {
      console.warn(`[simmerfield] station ${id} is in unknown dimension ${parsed.dim}`);
    }
  }
  return refs;
}

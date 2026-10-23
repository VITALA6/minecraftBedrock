import { FX_CAPS, type FxCaps, type FxKind } from "./fx-config";

// Bookkeeping for the live fx entities: one entry per owner (a board or a pot), the caps per area
// and in total, and knife expiry. No @minecraft/server import: the entity handle is generic, so
// tests use plain objects (tests/fx-registry.test.ts).

/** A block position in a dimension. */
export interface FxSpot {
  readonly dimension: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FxEntry<H> {
  /** "knife:<dim>:x,y,z" or "spoon:<dim>:x,y,z": one fx per station block and kind. */
  readonly owner: string;
  readonly kind: FxKind;
  readonly spot: FxSpot;
  /** The entity's id, to match load/remove events. */
  readonly id: string;
  readonly handle: H;
  /** Game tick after which the loop removes it (knives); undefined = until told (spoons). */
  expires?: number;
}

export function ownerKey(kind: FxKind, { dimension, x, y, z }: FxSpot): string {
  return `${kind}:${dimension}:${x},${y},${z}`;
}

export function areaKey({ dimension, x, z }: FxSpot, size: number): string {
  return `${dimension}:${Math.floor(x / size)},${Math.floor(z / size)}`;
}

export class FxRegistry<H> {
  private readonly byOwner = new Map<string, FxEntry<H>>();
  private readonly byId = new Map<string, FxEntry<H>>();
  private readonly areas = new Map<string, Record<FxKind, number>>();

  constructor(private readonly caps: FxCaps = FX_CAPS) {}

  get size(): number {
    return this.byOwner.size;
  }

  get(owner: string): FxEntry<H> | undefined {
    return this.byOwner.get(owner);
  }

  hasId(id: string): boolean {
    return this.byId.has(id);
  }

  /** Counts in the area of `spot`: [this kind, all kinds]. */
  private counts(kind: FxKind, spot: FxSpot): [number, number] {
    const area = this.areas.get(areaKey(spot, this.caps.areaSize));
    return area ? [area[kind], area.knife + area.spoon] : [0, 0];
  }

  /** Whether one more `kind` fits at `spot` (an entry of the same owner is replaced, so free). */
  canAdd(kind: FxKind, spot: FxSpot): boolean {
    const same = this.byOwner.get(ownerKey(kind, spot));
    const free = same ? 1 : 0;
    const [ofKind, all] = this.counts(kind, spot);
    return (
      ofKind - free < this.caps.perAreaKind[kind] &&
      all - free < this.caps.perArea &&
      this.size - free < this.caps.total
    );
  }

  /** Adds (or replaces the owner's entry). False, and nothing changes, if a cap is reached. */
  add(entry: FxEntry<H>): boolean {
    if (!this.canAdd(entry.kind, entry.spot)) return false;
    this.remove(entry.owner);
    this.byOwner.set(entry.owner, entry);
    this.byId.set(entry.id, entry);
    const key = areaKey(entry.spot, this.caps.areaSize);
    const area = this.areas.get(key) ?? { knife: 0, spoon: 0 };
    area[entry.kind]++;
    this.areas.set(key, area);
    return true;
  }

  remove(owner: string): FxEntry<H> | undefined {
    const entry = this.byOwner.get(owner);
    if (!entry) return undefined;
    this.byOwner.delete(owner);
    this.byId.delete(entry.id);
    const key = areaKey(entry.spot, this.caps.areaSize);
    const area = this.areas.get(key);
    if (area) {
      area[entry.kind]--;
      if (area.knife + area.spoon <= 0) this.areas.delete(key);
    }
    return entry;
  }

  removeId(id: string): FxEntry<H> | undefined {
    const entry = this.byId.get(id);
    return entry && this.remove(entry.owner);
  }

  /** Moves the owner's expiry to `tick`. False if there's no such entry. */
  extend(owner: string, tick: number): boolean {
    const entry = this.byOwner.get(owner);
    if (!entry) return false;
    entry.expires = tick;
    return true;
  }

  /** Entries whose expiry is at or before `tick` (still registered; the caller removes them). */
  expired(tick: number): FxEntry<H>[] {
    return [...this.byOwner.values()].filter((e) => e.expires !== undefined && e.expires <= tick);
  }

  entries(kind?: FxKind): FxEntry<H>[] {
    const all = [...this.byOwner.values()];
    return kind ? all.filter((e) => e.kind === kind) : all;
  }

  count(kind: FxKind): number {
    return this.entries(kind).length;
  }
}

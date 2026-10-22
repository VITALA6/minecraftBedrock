// A per-key rate limit counted in game ticks: lets one action through per key, then refuses that
// key until `minGap` ticks have passed. No @minecraft/server import, so tests run it in Node; the
// caller passes system.currentTick.
//
// Used for the recipe poster (both parts of the multi-block may report one click: act once) and the
// sliced dish (holding use must not eat the whole cake at once). Keys are player ids; one number
// per player seen this session, so entries are never cleaned up.

export class TickGate {
  private readonly last = new Map<string, number>();

  constructor(private readonly minGap: number) {}

  /** True, and remembers `tick`, if `key` never passed or last passed `minGap`+ ticks ago. */
  pass(key: string, tick: number): boolean {
    const last = this.last.get(key);
    if (last !== undefined && tick - last < this.minGap) return false;
    this.last.set(key, tick);
    return true;
  }
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISHES, findDish } from "../scripts/data/dishes";
import { CRAFTING_RECIPES, STATION_RECIPES } from "../scripts/data/recipes";
import {
  FACINGS,
  POSTER_BLANK,
  POSTER_COUNT,
  POSTER_DISHES,
  POSTER_MAX_STATES,
  POSTER_PAGES,
  discoveredPosters,
  facingOfDirection,
  firstPoster,
  halfStem,
  halfTexture,
  halvesOf,
  nextPoster,
  opposite,
  posterDish,
  posterIndex,
  posterIndexOf,
  posterIndices,
  posterStates,
  posterStem,
  startHalf,
  step,
  viewerRight,
  wallPosition,
  posterPosition,
  settleFacing,
  halfOfPart,
  type Discovery,
} from "../scripts/posters/poster-logic";

const found = (...keys: string[]): Discovery => ({ found: new Set(keys), creative: false });
const NOTHING = found();
const CREATIVE: Discovery = { found: new Set(), creative: true };
const ALL_CROPS = found("tomato", "onion", "cucumber", "chili", "strawberry", "eggplant");
const dishAt = (index: number | undefined) => (index === undefined ? undefined : posterDish(index));

describe("poster state <-> dish", () => {
  it("one index per dish plus the blank, split over pages of 16 (the int state limit)", () => {
    assert.equal(POSTER_COUNT, DISHES.length + 1);
    assert.deepEqual(posterIndices(), [...Array(POSTER_COUNT).keys()]);
    assert.equal(POSTER_MAX_STATES, 16);
    assert.equal(POSTER_PAGES, Math.ceil(POSTER_COUNT / 16));
    assert.ok(POSTER_COUNT > 16, "19 posters need the page state");
  });

  it("every index round-trips through hk:poster + hk:poster_page", () => {
    for (const index of posterIndices()) {
      const { slot, page } = posterStates(index);
      assert.ok(slot >= 0 && slot < POSTER_MAX_STATES, `${index}`);
      assert.ok(page >= 0 && page < POSTER_PAGES, `${index}`);
      assert.equal(posterIndexOf(slot, page), index);
    }
    assert.deepEqual(posterStates(16), { slot: 0, page: 1 });
    assert.equal(posterIndexOf(3), 3, "no page state counts as page 0");
  });

  it("recipe order: pot recipes first, then crafting, each dish once (mixes aren't dishes)", () => {
    const order = [...STATION_RECIPES, ...CRAFTING_RECIPES]
      .map((r) => r.result)
      .filter((id) => findDish(id));
    assert.deepEqual(POSTER_DISHES, [...new Set(order)]);
    assert.equal(POSTER_DISHES[0], "hk:tomato_soup");
    assert.equal(POSTER_DISHES.at(-1), "hk:veggie_skewer");
    assert.ok(POSTER_DISHES.every((id) => !id.endsWith("_mix")));
    assert.deepEqual([...POSTER_DISHES].sort(), DISHES.map((d) => d.id).sort(), "every dish");
  });

  it("round-trips every dish; 0 and unknowns are the blank", () => {
    for (const id of POSTER_DISHES) assert.equal(posterDish(posterIndex(id)), id);
    assert.equal(posterDish(POSTER_BLANK), undefined);
    assert.equal(posterDish(POSTER_COUNT), undefined, "past the end");
    assert.equal(posterDish(-1), undefined);
    assert.equal(posterIndex("hk:recipe_poster"), POSTER_BLANK);
    assert.equal(posterIndex("minecraft:bread"), POSTER_BLANK);
  });

  it("names the textures after the dish, one per half", () => {
    assert.equal(posterStem(POSTER_BLANK), "blank");
    assert.equal(posterStem(1), "tomato_soup");
    assert.equal(halfStem(1, "left"), "tomato_soup_left");
    assert.deepEqual(halfTexture(1, "right"), {
      path: "textures/hk/poster/tomato_soup_right",
      shortname: "hk_poster_tomato_soup_right",
    });
    const stems = posterIndices().flatMap((i) => [halfStem(i, "left"), halfStem(i, "right")]);
    assert.equal(new Set(stems).size, stems.length, "no two states share a texture");
  });
});

describe("sneak + use cycle", () => {
  it("nothing discovered: no next poster (the caller shows the hint)", () => {
    assert.equal(nextPoster(POSTER_BLANK, NOTHING), undefined);
    assert.equal(nextPoster(3, NOTHING), undefined, "even on a poster someone else set");
    assert.deepEqual(discoveredPosters(NOTHING), []);
  });

  it("skips undiscovered dishes and wraps around", () => {
    // tomato alone unlocks only Tomato Soup
    const tomato = found("tomato");
    assert.deepEqual(discoveredPosters(tomato).map(dishAt), ["hk:tomato_soup"]);
    assert.equal(dishAt(nextPoster(POSTER_BLANK, tomato)), "hk:tomato_soup");
    assert.equal(dishAt(nextPoster(posterIndex("hk:tomato_soup"), tomato)), "hk:tomato_soup");

    // onion: the three onion-only soups, in recipe order, then back to the first
    const onion = found("onion");
    const shown = discoveredPosters(onion).map(dishAt);
    assert.deepEqual(shown, ["hk:fish_chowder", "hk:chicken_soup", "hk:onion_soup"]);
    let at = nextPoster(POSTER_BLANK, onion);
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(dishAt(at));
      at = nextPoster(at ?? POSTER_BLANK, onion);
    }
    assert.deepEqual(seen, [...shown, "hk:fish_chowder"]);
  });

  it("from an undiscovered dish, goes on to the next discovered one after it", () => {
    const onion = found("onion");
    // Vegetable Stew (needs tomato too) sits between Tomato Soup and Fish Chowder
    assert.equal(dishAt(nextPoster(posterIndex("hk:vegetable_stew"), onion)), "hk:fish_chowder");
    // past the last discovered one, wraps to the first
    assert.equal(dishAt(nextPoster(posterIndex("hk:salsa"), onion)), "hk:fish_chowder");
  });

  it("creative cycles through every dish, then back to the first (never the blank)", () => {
    let at = POSTER_BLANK;
    const seen: string[] = [];
    for (let i = 0; i < POSTER_DISHES.length + 1; i++) {
      const next = nextPoster(at, CREATIVE);
      assert.ok(next !== undefined && next !== POSTER_BLANK);
      seen.push(posterDish(next) ?? "");
      at = next;
    }
    assert.deepEqual(seen, [...POSTER_DISHES, POSTER_DISHES[0]]);
  });

  it("all crops found shows the same set as creative", () => {
    assert.deepEqual(discoveredPosters(ALL_CROPS), discoveredPosters(CREATIVE));
  });

  it("a new poster shows the first discovered dish, or the blank", () => {
    assert.equal(firstPoster(NOTHING), POSTER_BLANK);
    assert.equal(dishAt(firstPoster(found("strawberry"))), "hk:strawberry_jam");
    assert.equal(dishAt(firstPoster(CREATIVE)), "hk:tomato_soup");
  });
});

describe("wall geometry", () => {
  it("Script API directions map to horizontal facings only", () => {
    assert.equal(facingOfDirection("North"), "north");
    assert.equal(facingOfDirection("West"), "west");
    assert.equal(facingOfDirection("Up"), undefined);
    assert.equal(facingOfDirection("Down"), undefined);
  });

  it("the viewer's right: reading a south-facing poster you look north, east is right", () => {
    assert.equal(viewerRight("south"), "east");
    assert.equal(viewerRight("north"), "west");
    assert.equal(viewerRight("east"), "north");
    assert.equal(viewerRight("west"), "south");
    for (const f of FACINGS) {
      const r = step(viewerRight(f));
      const out = step(f);
      assert.equal(Math.abs(r.x * out.x + r.z * out.z), 0, `${f}: right runs along the wall`);
      assert.equal(opposite(opposite(f)), f);
    }
  });

  it("halves come from where the parts really are", () => {
    // facing south: right is +x
    assert.deepEqual(halvesOf("south", { x: 0, z: 0 }, { x: 1, z: 0 }), ["left", "right"]);
    assert.deepEqual(halvesOf("south", { x: 1, z: 0 }, { x: 0, z: 0 }), ["right", "left"]);
    // facing north: right is -x
    assert.deepEqual(halvesOf("north", { x: 5, z: 2 }, { x: 4, z: 2 }), ["left", "right"]);
    // facing east: you look west, right is north (-z)
    assert.deepEqual(halvesOf("east", { x: 0, z: 1 }, { x: 0, z: 0 }), ["left", "right"]);
  });

  it("parts that aren't side by side along the wall are refused", () => {
    assert.equal(halvesOf("south", { x: 0, z: 0 }, { x: 0, z: 1 }), undefined, "out of the wall");
    assert.equal(halvesOf("south", { x: 0, z: 0 }, { x: 0, z: -1 }), undefined, "into the wall");
    assert.equal(halvesOf("south", { x: 0, z: 0 }, { x: 2, z: 0 }), undefined, "not neighbours");
    assert.equal(halvesOf("south", { x: 0, z: 0 }, { x: 0, z: 0 }), undefined);
  });

  it("the starting half guess follows the cardinal direction; along the facing is refused", () => {
    assert.equal(startHalf("south", "east"), "left", "second part to the viewer's right");
    assert.equal(startHalf("south", "west"), "right");
    assert.equal(startHalf("south", "south"), undefined);
    assert.equal(startHalf("south", "north"), undefined);
    for (const f of FACINGS) {
      assert.equal(startHalf(f, viewerRight(f)), "left");
      assert.equal(startHalf(f, opposite(viewerRight(f))), "right");
      assert.equal(startHalf(f, f), undefined);
    }
  });
});

describe("poster support by facing (the wall is behind the poster, never below it)", () => {
  const at = { x: 10, y: 64, z: -3 };
  // facing = where the poster's front points; the wall is one block the other way, same y.
  const expected = {
    north: { x: 10, y: 64, z: -2 },
    south: { x: 10, y: 64, z: -4 },
    east: { x: 9, y: 64, z: -3 },
    west: { x: 11, y: 64, z: -3 },
  } as const;

  for (const facing of FACINGS) {
    it(`facing ${facing}: the wall is ${opposite(facing)} of the poster, at the same height`, () => {
      const wall = wallPosition(at, facing);
      assert.deepEqual(wall, expected[facing]);
      assert.equal(wall.y, at.y, "support is never the block below");
    });

    it(`facing ${facing}: posterPosition is the inverse of wallPosition`, () => {
      assert.deepEqual(posterPosition(wallPosition(at, facing), facing), at);
    });
  }

  it("removing a wall only concerns the poster in front of it with that facing", () => {
    const wall = { x: 0, y: 70, z: 0 };
    const hanging = FACINGS.map((facing) => ({ facing, at: posterPosition(wall, facing) }));
    for (const { facing, at: pos } of hanging) {
      assert.deepEqual(wallPosition(pos, facing), wall);
      for (const other of FACINGS.filter((f) => f !== facing)) {
        assert.ok(
          JSON.stringify(wallPosition(pos, other)) !== JSON.stringify(wall),
          `${facing} poster checked as ${other}`,
        );
      }
    }
  });

  it("both halves of a poster on a 2-wide wall have their own wall block behind them", () => {
    for (const facing of FACINGS) {
      const left = { x: 0, y: 64, z: 0 };
      const r = step(viewerRight(facing));
      const right = { x: left.x + r.x, y: 64, z: left.z + r.z };
      const a = wallPosition(left, facing);
      const b = wallPosition(right, facing);
      assert.deepEqual({ x: b.x - a.x, z: b.z - a.z }, r, `${facing}: walls side by side`);
    }
  });
});

describe("settleFacing: the facing comes from where the wall really is", () => {
  type P = { x: number; y: number; z: number };
  const key = (p: P) => `${p.x},${p.y},${p.z}`;
  const world = (...solid: P[]) => {
    const set = new Set(solid.map(key));
    return (at: P) => set.has(key(at));
  };
  // the in-game case from 2026-10-22: parts along z at x=85, wall at x=84 -> front faces east
  const parts = [
    { x: 85, y: 73, z: -118 },
    { x: 85, y: 73, z: -119 },
  ];
  const wallWest = world({ x: 84, y: 73, z: -118 }, { x: 84, y: 73, z: -119 });
  const wallEast = world({ x: 86, y: 73, z: -118 }, { x: 86, y: 73, z: -119 });

  it("wall at x-1 -> faces east, whatever the hint says", () => {
    assert.equal(settleFacing(parts, "west", wallWest), "east");
    assert.equal(settleFacing(parts, "east", wallWest), "east");
    assert.equal(settleFacing(parts, undefined, wallWest), "east");
  });

  it("wall at x+1 -> faces west", () => {
    assert.equal(settleFacing(parts, "east", wallEast), "west");
  });

  it("parts along x -> north or south only", () => {
    const along = [
      { x: 0, y: 64, z: 5 },
      { x: 1, y: 64, z: 5 },
    ];
    assert.equal(settleFacing(along, undefined, world({ x: 0, y: 64, z: 6 }, { x: 1, y: 64, z: 6 })), "north"); // prettier-ignore
    assert.equal(settleFacing(along, undefined, world({ x: 0, y: 64, z: 4 }, { x: 1, y: 64, z: 4 })), "south"); // prettier-ignore
  });

  it("walls on both sides -> the hint decides", () => {
    const both = (at: P) => wallWest(at) || wallEast(at);
    assert.equal(settleFacing(parts, "west", both), "west");
    assert.equal(settleFacing(parts, "east", both), "east");
  });

  it("only one part has a wall behind it -> refused (needs a 2-block wall)", () => {
    assert.equal(settleFacing(parts, "east", world({ x: 84, y: 73, z: -118 })), undefined);
  });

  it("no wall, or parts not neighbours -> refused", () => {
    assert.equal(settleFacing(parts, "east", world()), undefined);
    const apart = [parts[0]!, { x: 85, y: 73, z: -120 }];
    assert.equal(settleFacing(apart, "east", wallWest), undefined);
  });

  it("one part only -> just the hint is checked", () => {
    assert.equal(settleFacing([parts[0]!], "east", wallWest), "east");
    assert.equal(settleFacing([parts[0]!], "west", wallWest), undefined);
  });
});

describe("halfOfPart: each part's half from its part number and the placement direction", () => {
  // in game 2026-10-22: front east (wall at x-1), cardinal south, part 1 at z+1. Reading an
  // east-facing poster you look west, so north (z-1) is on your right: part 1 (south) is the left.
  it("the in-game case: facing east, cardinal south -> part 0 right, part 1 left", () => {
    assert.equal(halfOfPart("east", "south", 0), "right");
    assert.equal(halfOfPart("east", "south", 1), "left");
  });

  it("part 1 toward the viewer's right -> part 0 left, part 1 right", () => {
    for (const facing of FACINGS) {
      const right = viewerRight(facing);
      assert.equal(halfOfPart(facing, right, 0), "left");
      assert.equal(halfOfPart(facing, right, 1), "right");
      assert.equal(halfOfPart(facing, opposite(right), 0), "right");
      assert.equal(halfOfPart(facing, opposite(right), 1), "left");
    }
  });

  it("the two parts always show different halves", () => {
    for (const facing of FACINGS)
      for (const cardinal of [viewerRight(facing), opposite(viewerRight(facing))])
        assert.notEqual(halfOfPart(facing, cardinal, 0), halfOfPart(facing, cardinal, 1));
  });

  it("cardinal into or out of the wall -> no half (refused on place)", () => {
    for (const facing of FACINGS) {
      assert.equal(halfOfPart(facing, facing, 0), undefined);
      assert.equal(halfOfPart(facing, opposite(facing), 1), undefined);
    }
  });

  it("agrees with halvesOf on the real part positions", () => {
    for (const facing of FACINGS)
      for (const cardinal of [viewerRight(facing), opposite(viewerRight(facing))]) {
        const a = { x: 0, z: 0 };
        const s = step(cardinal);
        const b = { x: s.x, z: s.z }; // part 1 lies one block toward cardinal
        assert.deepEqual(halvesOf(facing, a, b), [
          halfOfPart(facing, cardinal, 0),
          halfOfPart(facing, cardinal, 1),
        ]);
      }
  });
});

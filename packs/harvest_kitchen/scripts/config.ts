// Identifiers and tuning numbers shared by all modules.
// "hk" is the placeholder namespace until the publisher namespace is decided; keep it literal so
// renaming stays one search-and-replace.
//
// Saved-data ids (dynamic property keys, block state names, recipe ids, crop keys) freeze at the
// first public build. Don't rename them after that.

// --- items ---------------------------------------------------------------------------------------
export const ITEM_TOMATO = "hk:tomato";
export const ITEM_ONION = "hk:onion"; // also its own seed
export const ITEM_CUCUMBER = "hk:cucumber";
export const ITEM_CHILI = "hk:chili_pepper";
export const ITEM_STRAWBERRY = "hk:strawberry";

export const ITEM_TOMATO_SEEDS = "hk:tomato_seeds";
export const ITEM_CUCUMBER_SEEDS = "hk:cucumber_seeds";
export const ITEM_CHILI_SEEDS = "hk:chili_pepper_seeds";
export const ITEM_STRAWBERRY_SEEDS = "hk:strawberry_seeds";

export const ITEM_SLICED_TOMATO = "hk:sliced_tomato";
export const ITEM_CHOPPED_ONION = "hk:chopped_onion";
export const ITEM_SLICED_CUCUMBER = "hk:sliced_cucumber";

export const ITEM_TOMATO_SOUP = "hk:tomato_soup";
export const ITEM_VEGETABLE_STEW = "hk:vegetable_stew";
export const ITEM_CHILI_STEW = "hk:chili_stew";
export const ITEM_FISH_CHOWDER = "hk:fish_chowder";
export const ITEM_CHICKEN_SOUP = "hk:chicken_soup";
export const ITEM_ONION_SOUP = "hk:onion_soup";
export const ITEM_STRAWBERRY_JAM = "hk:strawberry_jam";
export const ITEM_GARDEN_SALAD = "hk:garden_salad";
export const ITEM_SALSA = "hk:salsa";
export const ITEM_VEGGIE_SANDWICH = "hk:veggie_sandwich";
export const ITEM_HEARTY_SANDWICH = "hk:hearty_sandwich";
export const ITEM_STRAWBERRY_CUP = "hk:strawberry_cup";
export const ITEM_STRAWBERRY_CAKE = "hk:strawberry_cake"; // item and block share the id

export const ITEM_RECIPE_POSTER = "hk:recipe_poster"; // item and block share the id
export const ITEM_COOKING_POT = "hk:cooking_pot"; // item and block share the id
export const ITEM_CUTTING_BOARD = "hk:cutting_board"; // item and block share the id

// --- blocks --------------------------------------------------------------------------------------
export const BLOCK_TOMATO_CROP = "hk:tomato_crop";
export const BLOCK_ONION_CROP = "hk:onion_crop";
export const BLOCK_CUCUMBER_CROP = "hk:cucumber_crop";
export const BLOCK_CHILI_BUSH = "hk:chili_bush";
export const BLOCK_STRAWBERRY_BUSH = "hk:strawberry_bush";
export const BLOCK_COOKING_POT = "hk:cooking_pot";
export const BLOCK_CUTTING_BOARD = "hk:cutting_board";
export const BLOCK_STRAWBERRY_CAKE = "hk:strawberry_cake";
export const BLOCK_RECIPE_POSTER = "hk:recipe_poster"; // a 2×1 wall multi-block (posters/)

// --- custom components (listed in JSON, registered in system.beforeEvents.startup) ---------------
export const COMPONENT_CROP_GROWTH = "hk:crop_growth"; // block
export const COMPONENT_CUTTING_STATION = "hk:cutting_station"; // block
export const COMPONENT_CONTAINER_STATION = "hk:container_station"; // block; station from data/stations.ts
export const COMPONENT_SLICED_DISH = "hk:sliced_dish"; // block
export const COMPONENT_DISH = "hk:dish"; // item
export const COMPONENT_RECIPE_POSTER = "hk:recipe_poster"; // block

// --- block states (declared in each block's description.states) ----------------------------------
export const STATE_GROWTH = "hk:growth"; // crops and bushes, 0..max_stage
export const STATE_FILL = "hk:fill"; // container stations, 0..3
export const STATE_PHASE = "hk:phase"; // container stations: idle | ready | cooking | done
export const STATE_HOT = "hk:hot"; // container stations: heat below, cached for the visual
export const STATE_LIQUID = "hk:liquid"; // container stations: liquid colour (data/liquids.ts)
export const STATE_SLICES = "hk:slices"; // sliced dishes: slices eaten
export const STATE_POSTER = "hk:poster"; // recipe poster: 0 blank, 1.. dish (posters/poster-logic.ts)
export const STATE_FACING = "hk:facing"; // recipe poster: north|south|east|west, out of the wall
export const STATE_RIGHT = "hk:right"; // recipe poster part: shows the right half of the image
export const STATE_CARDINAL = "minecraft:cardinal_direction"; // placement_direction trait

// --- dynamic properties --------------------------------------------------------------------------
/** World property per non-empty station: "hk:st:<station>:<dimension>:<x>,<y>,<z>" -> JSON. */
export const STATION_PROPERTY_PREFIX = "hk:st:";
/** Player property: comma-separated crop keys the player has found ("tomato,onion"). */
export const PLAYER_FOUND_CROPS = "hk:found";
/** Player property: true once the starter Recipe Poster was handed out (or the player had one). */
export const PLAYER_POSTER_GIVEN = "hk:poster_given";
/** World property: debug "fast cooking" toggle (/hk:debug fast). */
export const WORLD_DEBUG_FAST = "hk:debug_fast";

// --- tuning --------------------------------------------------------------------------------------
export const STATION_SWEEP_TICKS = 10; // one interval drives every active station
export const STATION_SPARKLE_EVERY = 4; // "ready" sparkle every Nth sweep (particle cap)
export const DONE_NOTIFY_RADIUS = 8; // players this close see "Soup is ready!"
export const FAST_COOK_TICKS = 20; // cook time while /hk:debug fast is on

export const CHOP_INTERVAL_TICKS = 6; // sneak-chop: one item every N ticks (S6)
export const CHOP_MAX_DISTANCE = 4; // sneak-chop stops when the player is farther than this

export const UNLOCK_TOAST_COOLDOWN_TICKS = 60; // "★ New recipe!" at most once per 3 s
export const POSTER_USE_GAP_TICKS = 5; // one use per click, even if both poster parts report it
export const POSTER_SYNC_RETRY_TICKS = 20; // a part placed late (chunk edge) is synced once more
export const SLICE_BITE_GAP_TICKS = 10; // a held use button eats at most 2 slices per second
export const PISTON_SETTLE_TICKS = 3; // a pushed block lands ~2 ticks after the piston fires

export const DEBUG_GROW_RADIUS = 8; // /hk:debug grow

// --- ghost ingredients above the pot (D15; stations/ghosts.ts, stations/ghost-logic.ts) ----------
// Per-player particles (Player.spawnParticle), re-spawned on one interval from the engine's list of
// stations with contents. No per-block tick, no world scan, nothing saved.
export const GHOST_UPDATE_TICKS = 10; // one update every 0.5 s re-spawns every visible ghost
/** Lifetime = update period + one fade: the old ghost fades out while the new one fades in. */
export const GHOST_FADE_SECONDS = 0.1;
export const GHOST_LIFETIME_SECONDS = GHOST_UPDATE_TICKS / 20 + GHOST_FADE_SECONDS;
export const GHOST_RADIUS = 6; // feet to pot centre; covers creative reach, so a use always sees them
export const GHOST_MAX_POTS_PER_PLAYER = 2; // the nearest ones
export const GHOST_MAX_SPAWNS_PER_UPDATE = 48; // emitters per update, all players together
export const GHOST_MAX_ICONS = 5; // per pot (a recipe has at most 5 items, one is already in)
export const GHOST_HEIGHT = 1.15; // row centre above the pot's block origin (the rim is at 0.56)
export const GHOST_SPACING = 0.42; // between icon centres, across the player's view
export const GHOST_ICON_SIZE = 0.18; // billboard half-size in blocks (icon ≈ 0.36 blocks wide)
export const GHOST_ALPHA = 0.65; // missing ingredients and a dish that's ready to cook
export const GHOST_DONE_ALPHA = 0.95; // the finished dish waiting in the pot is real, not a ghost
export const GHOST_BOB_SECONDS = 3; // one slow up-and-down
export const GHOST_BOB_HEIGHT = 0.05; // blocks, either way
export const GHOST_WAVE_SECONDS = 0.4; // bob phase step between neighbouring icons
export const GHOST_ALT_TICKS = 40; // a "cod or salmon" ghost shows each choice for 2 s
export const GHOST_PARTICLE = {
  icon: "hk:ghost_icon",
  sparkle: "hk:ghost_sparkle",
  pop: "hk:ghost_pop",
} as const;

// --- vanilla sounds and particles ----------------------------------------------------------------
// Every id below was checked on 2026-10-21 against the 1.26.52.3 vanilla resource packs
// (sound_definitions.json, particles/). Vanilla only; custom hk.* sounds come later (plan §4.4).
export const SOUND = {
  potAccept: "block.decorated_pot.insert",
  potRefuse: "block.decorated_pot.insert_fail",
  ready: "note.chime",
  lid: "block.lantern.place",
  bubble: "bubble.up",
  bubbleShort: "bubble.pop",
  done: "note.bell",
  pop: "random.pop",
  fizz: "random.fizz",
  tap: "random.click",
  chop: "hit.wood",
  chopSquish: "mob.slime.squish",
  thud: "hit.wood",
  eat: "random.eat",
  chime: "random.orb",
  pageTurn: "item.book.page_turn",
  boneMeal: "item.bone_meal.use",
  berryPick: "block.sweet_berry_bush.pick",
} as const;

export const PARTICLE = {
  splash: "minecraft:water_splash_particle",
  puff: "minecraft:basic_smoke_particle",
  sparkle: "minecraft:villager_happy",
  steam: "minecraft:white_smoke_particle",
  bits: "minecraft:falling_dust", // takes variable.color, so bits match the crop
  hearts: "minecraft:heart_particle",
  growth: "minecraft:crop_growth_emitter",
} as const;

/** Tell operators which build is running when they join (test sessions). Off for release. */
export const ANNOUNCE_BUILD = true;

/** Report every recipe poster placement step to the placer's chat (test sessions). Off for release. */
export const DEBUG_POSTERS = true;

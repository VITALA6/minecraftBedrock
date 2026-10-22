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

export const ITEM_RECIPE_BOOK = "hk:recipe_book";
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

// --- custom components (listed in JSON, registered in system.beforeEvents.startup) ---------------
export const COMPONENT_CROP_GROWTH = "hk:crop_growth"; // block
export const COMPONENT_CUTTING_STATION = "hk:cutting_station"; // block
export const COMPONENT_CONTAINER_STATION = "hk:container_station"; // block; station from data/stations.ts
export const COMPONENT_SLICED_DISH = "hk:sliced_dish"; // block
export const COMPONENT_DISH = "hk:dish"; // item
export const COMPONENT_RECIPE_BOOK = "hk:recipe_book"; // item

// --- block states (declared in each block's description.states) ----------------------------------
export const STATE_GROWTH = "hk:growth"; // crops and bushes, 0..max_stage
export const STATE_FILL = "hk:fill"; // container stations, 0..3
export const STATE_PHASE = "hk:phase"; // container stations: idle | ready | cooking | done
export const STATE_HOT = "hk:hot"; // container stations: heat below, cached for the visual
export const STATE_SLICES = "hk:slices"; // sliced dishes: slices eaten

// --- dynamic properties --------------------------------------------------------------------------
/** World property per non-empty station: "hk:st:<station>:<dimension>:<x>,<y>,<z>" -> JSON. */
export const STATION_PROPERTY_PREFIX = "hk:st:";
/** Player property: comma-separated crop keys the player has found ("tomato,onion"). */
export const PLAYER_FOUND_CROPS = "hk:found";
/** Player property: true once the recipe book was handed out (or the player had one). */
export const PLAYER_BOOK_GIVEN = "hk:book_given";
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
export const BOOK_OPEN_GAP_TICKS = 5; // onUse + onUseOn of one click open the book once
export const SLICE_BITE_GAP_TICKS = 10; // a held use button eats at most 2 slices per second

export const DEBUG_GROW_RADIUS = 8; // /hk:debug grow

/** Which icon the book's dish page shows on its effect button: vanilla effect icon or ours. */
export const EFFECT_BUTTON_ICON: "effect" | "family" = "effect";

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

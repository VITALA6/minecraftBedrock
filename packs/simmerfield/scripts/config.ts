// Identifiers and tuning numbers shared by all modules.
// "wm_kitchen" is the final namespace (Wendermods; chosen 2026-10-23, replacing the placeholder "hk").
// Keep it literal, so every id stays greppable.
//
// Saved-data ids (dynamic property keys, block state names, recipe ids, crop keys) freeze at the
// first public build. Don't rename them after that.

// --- items ---------------------------------------------------------------------------------------
export const ITEM_TOMATO = "wm_kitchen:tomato";
export const ITEM_ONION = "wm_kitchen:onion"; // also its own seed
export const ITEM_CUCUMBER = "wm_kitchen:cucumber";
export const ITEM_CHILI = "wm_kitchen:chili_pepper";
export const ITEM_STRAWBERRY = "wm_kitchen:strawberry";
export const ITEM_EGGPLANT = "wm_kitchen:eggplant";

export const ITEM_TOMATO_SEEDS = "wm_kitchen:tomato_seeds";
export const ITEM_CUCUMBER_SEEDS = "wm_kitchen:cucumber_seeds";
export const ITEM_CHILI_SEEDS = "wm_kitchen:chili_pepper_seeds";
export const ITEM_STRAWBERRY_SEEDS = "wm_kitchen:strawberry_seeds";
export const ITEM_EGGPLANT_SEEDS = "wm_kitchen:eggplant_seeds";

export const ITEM_SLICED_TOMATO = "wm_kitchen:sliced_tomato";
export const ITEM_CHOPPED_ONION = "wm_kitchen:chopped_onion";
export const ITEM_SLICED_CUCUMBER = "wm_kitchen:sliced_cucumber";
export const ITEM_SLICED_EGGPLANT = "wm_kitchen:sliced_eggplant";

// Mixes (D16): a pot dish's raw ingredients, put together on the crafting table; the pot cooks the mix.
export const ITEM_TOMATO_SOUP_MIX = "wm_kitchen:tomato_soup_mix";
export const ITEM_VEGETABLE_STEW_MIX = "wm_kitchen:vegetable_stew_mix";
export const ITEM_CHILI_STEW_MIX = "wm_kitchen:chili_stew_mix";
export const ITEM_FISH_CHOWDER_MIX = "wm_kitchen:fish_chowder_mix";
export const ITEM_CHICKEN_SOUP_MIX = "wm_kitchen:chicken_soup_mix";
export const ITEM_ONION_SOUP_MIX = "wm_kitchen:onion_soup_mix";
export const ITEM_STRAWBERRY_JAM_MIX = "wm_kitchen:strawberry_jam_mix";
export const ITEM_STUFFED_EGGPLANT_MIX = "wm_kitchen:stuffed_eggplant_mix";
export const ITEM_RATATOUILLE_MIX = "wm_kitchen:ratatouille_mix";
export const ITEM_EGGPLANT_CURRY_MIX = "wm_kitchen:eggplant_curry_mix";

export const ITEM_TOMATO_SOUP = "wm_kitchen:tomato_soup";
export const ITEM_VEGETABLE_STEW = "wm_kitchen:vegetable_stew";
export const ITEM_CHILI_STEW = "wm_kitchen:chili_stew";
export const ITEM_FISH_CHOWDER = "wm_kitchen:fish_chowder";
export const ITEM_CHICKEN_SOUP = "wm_kitchen:chicken_soup";
export const ITEM_ONION_SOUP = "wm_kitchen:onion_soup";
export const ITEM_STRAWBERRY_JAM = "wm_kitchen:strawberry_jam";
export const ITEM_GARDEN_SALAD = "wm_kitchen:garden_salad";
export const ITEM_SALSA = "wm_kitchen:salsa";
export const ITEM_VEGGIE_SANDWICH = "wm_kitchen:veggie_sandwich";
export const ITEM_HEARTY_SANDWICH = "wm_kitchen:hearty_sandwich";
export const ITEM_STRAWBERRY_CUP = "wm_kitchen:strawberry_cup";
export const ITEM_STRAWBERRY_CAKE = "wm_kitchen:strawberry_cake"; // item and block share the id
export const ITEM_STUFFED_EGGPLANT = "wm_kitchen:stuffed_eggplant";
export const ITEM_RATATOUILLE = "wm_kitchen:ratatouille";
export const ITEM_EGGPLANT_CURRY = "wm_kitchen:eggplant_curry";
export const ITEM_EGGPLANT_SALAD = "wm_kitchen:eggplant_salad";
export const ITEM_VEGGIE_SKEWER = "wm_kitchen:veggie_skewer";

export const ITEM_RECIPE_POSTER = "wm_kitchen:recipe_poster"; // item and block share the id
export const ITEM_COOKING_POT = "wm_kitchen:cooking_pot"; // item and block share the id
export const ITEM_CUTTING_BOARD = "wm_kitchen:cutting_board"; // item and block share the id
export const ITEM_GUIDE_BOOK = "wm_kitchen:guide_book"; // the Kitchen Guide: use it to open the guide (guide/)

// --- blocks --------------------------------------------------------------------------------------
export const BLOCK_TOMATO_CROP = "wm_kitchen:tomato_crop";
export const BLOCK_ONION_CROP = "wm_kitchen:onion_crop";
export const BLOCK_CUCUMBER_CROP = "wm_kitchen:cucumber_crop";
export const BLOCK_CHILI_BUSH = "wm_kitchen:chili_bush";
export const BLOCK_STRAWBERRY_BUSH = "wm_kitchen:strawberry_bush";
export const BLOCK_EGGPLANT_CROP = "wm_kitchen:eggplant_crop";
export const BLOCK_COOKING_POT = "wm_kitchen:cooking_pot";
export const BLOCK_CUTTING_BOARD = "wm_kitchen:cutting_board";
export const BLOCK_STRAWBERRY_CAKE = "wm_kitchen:strawberry_cake";
export const BLOCK_RECIPE_POSTER = "wm_kitchen:recipe_poster"; // a 2×1 wall multi-block (posters/)
export const BLOCK_KITCHEN_STOVE = "wm_kitchen:kitchen_stove"; // decor that heats a pot while lit (D22)

// --- custom components (listed in JSON, registered in system.beforeEvents.startup) ---------------
export const COMPONENT_CROP_GROWTH = "wm_kitchen:crop_growth"; // block
export const COMPONENT_CUTTING_STATION = "wm_kitchen:cutting_station"; // block
export const COMPONENT_CONTAINER_STATION = "wm_kitchen:container_station"; // block; station from data/stations.ts
export const COMPONENT_SLICED_DISH = "wm_kitchen:sliced_dish"; // block
export const COMPONENT_DISH = "wm_kitchen:dish"; // item
export const COMPONENT_GUIDE_BOOK = "wm_kitchen:guide_book"; // item
export const COMPONENT_RECIPE_POSTER = "wm_kitchen:recipe_poster"; // block
export const COMPONENT_STOVE = "wm_kitchen:stove"; // block: use switches the kitchen stove on and off

// --- block states (declared in each block's description.states) ----------------------------------
export const STATE_GROWTH = "wm_kitchen:growth"; // crops and bushes, 0..max_stage
export const STATE_FILL = "wm_kitchen:fill"; // container stations, 0..3
export const STATE_PHASE = "wm_kitchen:phase"; // container stations: idle | ready | cooking | done
export const STATE_HOT = "wm_kitchen:hot"; // container stations: heat below, cached for the visual
export const STATE_LIQUID = "wm_kitchen:liquid"; // container stations: liquid colour (data/liquids.ts)
export const STATE_SLICES = "wm_kitchen:slices"; // sliced dishes: slices eaten
export const STATE_POSTER = "wm_kitchen:poster"; // recipe poster: 0 blank, 1.. dish, 0..15 per page (posters/poster-logic.ts)
export const STATE_POSTER_PAGE = "wm_kitchen:poster_page"; // recipe poster: which 16 posters wm_kitchen:poster counts in
export const STATE_FACING = "wm_kitchen:facing"; // recipe poster: north|south|east|west, out of the wall
export const STATE_CARDINAL = "minecraft:cardinal_direction"; // placement_direction trait
export const STATE_LIT = "wm_kitchen:lit"; // kitchen stove: switched on (heat for the pot above, light)

// --- dynamic properties --------------------------------------------------------------------------
/** World property per non-empty station: "wm_kitchen:st:<station>:<dimension>:<x>,<y>,<z>" -> JSON. */
export const STATION_PROPERTY_PREFIX = "wm_kitchen:st:";
/** Player property: comma-separated crop keys the player has found ("tomato,onion"). */
export const PLAYER_FOUND_CROPS = "wm_kitchen:found";
/** Player property: true once the starter Recipe Poster was handed out (or the player had one). */
export const PLAYER_POSTER_GIVEN = "wm_kitchen:poster_given";
/** Player property: true once the welcome lines were shown in chat (first join). */
export const PLAYER_WELCOMED = "wm_kitchen:welcomed";
/** Player property: true once the player placed a poster (their first one shows the guide). */
export const PLAYER_GUIDE_PLACED = "wm_kitchen:guide_placed";
/** Player property: true once the Kitchen Guide book was handed out (first join). */
export const PLAYER_GUIDE_BOOK_GIVEN = "wm_kitchen:guide_book_given";
/** World property: debug "fast cooking" toggle (/wm_kitchen:debug fast). */
export const WORLD_DEBUG_FAST = "wm_kitchen:debug_fast";

// --- tuning --------------------------------------------------------------------------------------
export const STATION_SWEEP_TICKS = 10; // one interval drives every active station
export const STATION_SPARKLE_EVERY = 4; // "ready" sparkle every Nth sweep (particle cap)
export const DONE_NOTIFY_RADIUS = 8; // players this close see "Soup is ready!"
export const FAST_COOK_TICKS = 20; // cook time while /wm_kitchen:debug fast is on

export const CHOP_INTERVAL_TICKS = 6; // sneak-chop: one item every N ticks (S6)
export const CHOP_MAX_DISTANCE = 4; // sneak-chop stops when the player is farther than this

export const UNLOCK_TOAST_COOLDOWN_TICKS = 60; // "★ New recipe!" at most once per 3 s
export const POSTER_USE_GAP_TICKS = 5; // one use per click, even if both poster parts report it
export const GUIDE_OPEN_GAP_TICKS = 10; // one Kitchen Guide per click, even if onUse and onUseOn both fire
export const POSTER_SYNC_RETRY_TICKS = 20; // a part placed late (chunk edge) is synced once more
export const SLICE_BITE_GAP_TICKS = 10; // a held use button eats at most 2 slices per second
export const PISTON_SETTLE_TICKS = 3; // a pushed block lands ~2 ticks after the piston fires
export const STOVE_PRESS_GAP_TICKS = 8; // one stove switch per press, even if a held use repeats
export const POT_FORM_PRESS_GAP_TICKS = 8; // one choice form per press (a held use repeats)

export const DEBUG_GROW_RADIUS = 8; // /wm_kitchen:debug grow

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
export const GHOST_HINT_TICKS = 60; // a raw ingredient used on the pot shows its mix for 3 s (D16)
export const GHOST_PARTICLE = {
  icon: "wm_kitchen:ghost_icon",
  sparkle: "wm_kitchen:ghost_sparkle",
  pop: "wm_kitchen:ghost_pop",
} as const;

// --- vanilla sounds and particles ----------------------------------------------------------------
// Every id below was checked on 2026-10-21 against the 1.26.52.3 vanilla resource packs
// (sound_definitions.json, particles/). Vanilla only; custom wm_kitchen.* sounds come later (plan §4.4).
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
  ignite: "fire.ignite",
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

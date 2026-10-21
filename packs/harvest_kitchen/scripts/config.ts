// Identifiers and tuning numbers shared by all modules.
// "hk" is the placeholder namespace until the publisher namespace is decided; keep it literal so
// renaming stays one search-and-replace.

export const ITEM_TOMATO_SEEDS = "hk:tomato_seeds";
export const ITEM_TOMATO = "hk:tomato";
export const ITEM_SLICED_TOMATO = "hk:sliced_tomato";
export const ITEM_TOMATO_SOUP = "hk:tomato_soup";
export const ITEM_SALAD = "hk:salad";
export const ITEM_STUFFED_TOMATO = "hk:stuffed_tomato";

export const BLOCK_TOMATO_CROP = "hk:tomato_crop";
export const BLOCK_CUTTING_BOARD = "hk:cutting_board";
export const BLOCK_COOKING_POT = "hk:cooking_pot";

// Custom components, listed in block JSON and registered in system.beforeEvents.startup.
export const COMPONENT_CROP_GROWTH = "hk:crop_growth";
export const COMPONENT_CUTTING_STATION = "hk:cutting_station";
export const COMPONENT_COOKING_STATION = "hk:cooking_station";
export const COMPONENT_DISH = "hk:dish"; // item component

// Block states, declared in each block's description.states.
export const GROWTH_STATE = "hk:growth";
export const COOKING_STATE = "hk:cooking";

// World dynamic property per cooking pot: "hk:pot:<dimension>:<x>,<y>,<z>" -> JSON (pot-store.ts).
export const POT_PROPERTY_PREFIX = "hk:pot:";

export const POT_CAPACITY = 8; // total ingredient items a pot holds
export const POT_SWEEP_TICKS = 10; // how often active pots steam and check for finished dishes
export const DELIVERY_RADIUS = 8; // a finished dish goes to the cook if they're this close, else drops

// Vanilla wheat seeds drop from short grass 1 time in 8. Tomatoes are rarer, so wheat stays common.
export const SEED_DROP_CHANCE = 0.1;

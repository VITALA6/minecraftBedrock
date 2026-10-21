// Identifiers and tuning numbers shared by all modules.

export const ITEM_RUBY = "myteam:ruby";
export const ITEM_WALLET = "myteam:wallet";
export const BLOCK_RUBY = "myteam:ruby_block";
export const ENTITY_SLIME_CUBE = "myteam:slime_cube";

// Dynamic property keys (stored on the player or the world, saved with the world).
export const COINS_PROPERTY = "myteam:coins";
export const GOT_WALLET_PROPERTY = "myteam:got_wallet";
export const OWNER_PROPERTY_PREFIX = "myteam:owner:";

// Scoreboard objective ids get typed into commands (/scoreboard ...), so keep them to [a-z0-9_].
export const COINS_OBJECTIVE = "myteam_coins";

// Scores are 32-bit ints; stay far below that.
export const MAX_COINS = 1_000_000;
export const COINS_PER_KILL = 5;
export const PASSIVE_INCOME = 1;
export const PASSIVE_INTERVAL_TICKS = 60 * 20; // 20 ticks per second
export const PASSIVE_RADIUS = 4;
export const MAX_PURCHASE = 64;

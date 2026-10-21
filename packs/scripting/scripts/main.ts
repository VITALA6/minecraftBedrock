// Entry point: wiring only. Each feature lives in its own module.
//
// Top-level code runs in early-execution mode, before the world exists. Only subscribe to events
// here. Touch the world (scoreboard, players, timers) from worldLoad or later.

import { system, world } from "@minecraft/server";
import { registerRubyBank } from "./components/ruby-bank";
import { registerScriptEventHook, registerSetCoinsCommand } from "./events/admin";
import { registerBlockProtection } from "./events/block-protection";
import { registerEarning } from "./events/earning";
import { startPassiveIncome } from "./events/passive-income";
import { registerPlayerJoin, syncScore } from "./events/player-join";
import { registerWalletItem } from "./events/wallet-item";
import { showCoinsSidebar } from "./scoreboard";

// Custom components and commands can only be registered during startup.
system.beforeEvents.startup.subscribe(({ blockComponentRegistry, customCommandRegistry }) => {
  registerRubyBank(blockComponentRegistry);
  registerSetCoinsCommand(customCommandRegistry);
});

world.afterEvents.worldLoad.subscribe(() => {
  showCoinsSidebar();
  for (const player of world.getAllPlayers()) syncScore(player);
  startPassiveIncome();
});

registerPlayerJoin();
registerEarning();
registerWalletItem();
registerBlockProtection();
registerScriptEventHook();

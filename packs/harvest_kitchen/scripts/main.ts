// Entry point: wiring only. Each feature lives in its own module.
//
// Top-level code runs in early-execution mode, before the world exists. Only subscribe to events
// here. Touch the world from worldLoad or later.

import { system, world } from "@minecraft/server";
import { registerRecipeBook } from "./book/book-item";
import { registerDiscovery } from "./book/discovery";
import { registerCropGrowth } from "./crops/crop-growth";
import { registerSeedDrops } from "./crops/seed-drops";
import { validateData } from "./data/validate";
import { announceProblems, registerDebugCommand } from "./debug/debug-command";
import { registerDish } from "./food/dish";
import { registerSlicedDish } from "./food/sliced-dish";
import { registerContainerStation, registerStationEvents } from "./stations/container-station";
import { registerCuttingBoard, registerCuttingBoardEvents } from "./stations/cutting-board";
import { startStationSweep } from "./stations/station-engine";

// Custom components and commands can only be registered during startup.
system.beforeEvents.startup.subscribe(
  ({ blockComponentRegistry, itemComponentRegistry, customCommandRegistry }) => {
    registerCropGrowth(blockComponentRegistry);
    registerCuttingBoard(blockComponentRegistry);
    registerContainerStation(blockComponentRegistry);
    registerSlicedDish(blockComponentRegistry);
    registerDish(itemComponentRegistry);
    registerRecipeBook(itemComponentRegistry);
    registerDebugCommand(customCommandRegistry);
  },
);

world.afterEvents.worldLoad.subscribe(() => {
  validateData();
  startStationSweep();
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) system.runTimeout(() => player.isValid && announceProblems(player), 40);
});

registerSeedDrops();
registerStationEvents();
registerCuttingBoardEvents();
registerDiscovery();

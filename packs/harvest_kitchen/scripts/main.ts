// Entry point: wiring only. Each feature lives in its own module.
//
// Top-level code runs in early-execution mode, before the world exists. Only subscribe to events
// here. Touch the world from worldLoad or later.

import { system, world } from "@minecraft/server";
import { catchUpDiscovery, registerDiscovery } from "./discovery/discovery";
import { registerCropGrowth } from "./crops/crop-growth";
import { registerSeedDrops } from "./crops/seed-drops";
import { validateData } from "./data/validate";
import { announceBuild, announceProblems, registerDebugCommand } from "./debug/debug-command";
import { registerDish } from "./food/dish";
import { registerDishSupport } from "./food/dish-support";
import { registerSlicedDish } from "./food/sliced-dish";
import { registerFx } from "./fx/fx";
import { giveGuideBookOnce, registerGuideBook } from "./guide/guide-book";
import { registerPosterEvents, registerRecipePoster } from "./posters/poster";
import { registerPosterSupport } from "./posters/poster-support";
import { registerContainerStation, registerStationEvents } from "./stations/container-station";
import { registerCuttingBoard, registerCuttingBoardEvents } from "./stations/cutting-board";
import { startStationSweep } from "./stations/station-engine";
import { registerStove } from "./stations/stove";

// Custom components and commands can only be registered during startup.
system.beforeEvents.startup.subscribe(
  ({ blockComponentRegistry, itemComponentRegistry, customCommandRegistry }) => {
    registerCropGrowth(blockComponentRegistry);
    registerCuttingBoard(blockComponentRegistry);
    registerContainerStation(blockComponentRegistry);
    registerStove(blockComponentRegistry);
    registerSlicedDish(blockComponentRegistry);
    registerRecipePoster(blockComponentRegistry);
    registerDish(itemComponentRegistry);
    registerGuideBook(itemComponentRegistry);
    registerDebugCommand(customCommandRegistry);
  },
);

world.afterEvents.worldLoad.subscribe(() => {
  console.log(`[harvest_kitchen] build ${__BUILD_ID__}`);
  validateData();
  startStationSweep();
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  system.runTimeout(() => {
    if (!player.isValid) return;
    announceBuild(player);
    announceProblems(player);
    catchUpDiscovery(player);
    giveGuideBookOnce(player);
  }, 40);
});

registerSeedDrops();
registerStationEvents();
registerCuttingBoardEvents();
registerDiscovery();
registerDishSupport();
registerPosterEvents();
registerPosterSupport();
registerFx();

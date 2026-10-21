// Entry point: wiring only. Each feature lives in its own module.
//
// Top-level code runs in early-execution mode, before the world exists. Only subscribe to events
// here. Touch the world from worldLoad or later.

import { system, world } from "@minecraft/server";
import { registerCropGrowth } from "./crops/crop-growth";
import { registerSeedDrops } from "./crops/seed-drops";
import { validateData } from "./data/validate";
import { registerDish } from "./food/dish";
import { startCookingSweep } from "./stations/cooking";
import { registerCookingPot } from "./stations/cooking-pot";
import { registerCuttingBoard } from "./stations/cutting-board";

// Custom components can only be registered during startup.
system.beforeEvents.startup.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
  registerCropGrowth(blockComponentRegistry);
  registerCuttingBoard(blockComponentRegistry);
  registerCookingPot(blockComponentRegistry);
  registerDish(itemComponentRegistry);
});

world.afterEvents.worldLoad.subscribe(() => {
  validateData();
  startCookingSweep();
});

registerSeedDrops();

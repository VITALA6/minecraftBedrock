import { world } from "@minecraft/server";

// playerSpawn fires on every spawn (join, respawn after death);
// initialSpawn is true only for the first spawn after joining the world.
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  event.player.sendMessage("Hello from hello pack");
});

import { Player, world } from "@minecraft/server";
import { COINS_PER_KILL, ENTITY_SLIME_CUBE } from "../config";
import { addCoins } from "../wallet";

export function registerEarning(): void {
  world.afterEvents.entityDie.subscribe(
    ({ damageSource }) => {
      // For arrows/tridents, damagingEntity is the shooter.
      const killer = damageSource.damagingEntity;
      if (!(killer instanceof Player) || !killer.isValid) return;

      const added = addCoins(killer, COINS_PER_KILL);
      killer.onScreenDisplay.setActionBar(
        added > 0 ? `§a+${added} coins§r (slime cube)` : "§eYour wallet is full",
      );
    },
    // The filter runs in the engine, so the callback only fires for our mob.
    { entityTypes: [ENTITY_SLIME_CUBE] },
  );
}

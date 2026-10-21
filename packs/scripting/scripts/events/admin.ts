import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  Player,
  system,
  type CustomCommandRegistry,
} from "@minecraft/server";
import { MAX_COINS } from "../config";
import { setCoins } from "../wallet";

const SET_COINS = "myteam:setcoins";

function parseAmount(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,9}$/.test(trimmed)) return undefined;
  const amount = Number(trimmed);
  return amount <= MAX_COINS ? amount : undefined;
}

/** `/scriptevent myteam:setcoins <amount>`: sets the balance of the player who ran it. */
export function registerScriptEventHook(): void {
  system.afterEvents.scriptEventReceive.subscribe(
    ({ id, message, sourceEntity }) => {
      if (id !== SET_COINS) return;
      if (!(sourceEntity instanceof Player)) {
        console.warn(`[admin] ${SET_COINS} must be run by a player, not a command block/console`);
        return;
      }
      const amount = parseAmount(message);
      if (amount === undefined) {
        sourceEntity.sendMessage(`§cUsage: /scriptevent ${SET_COINS} <0-${MAX_COINS}>`);
        return;
      }
      sourceEntity.sendMessage(`Coins set to ${setCoins(sourceEntity, amount)}.`);
    },
    { namespaces: ["myteam"] },
  );
}

/** `/myteam:setcoins <amount> [player]`: a real slash command with typed, autocompleted args. */
export function registerSetCoinsCommand(registry: CustomCommandRegistry): void {
  registry.registerCommand(
    {
      name: SET_COINS,
      description: "Set a player's ruby coin balance (testing).",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [{ name: "amount", type: CustomCommandParamType.Integer }],
      optionalParameters: [{ name: "player", type: CustomCommandParamType.PlayerSelector }],
    },
    (origin, amount: unknown, targets: unknown) => {
      if (
        typeof amount !== "number" ||
        !Number.isInteger(amount) ||
        amount < 0 ||
        amount > MAX_COINS
      ) {
        return { status: CustomCommandStatus.Failure, message: `Amount must be 0-${MAX_COINS}.` };
      }
      const candidates: unknown[] =
        targets === undefined ? [origin.sourceEntity] : Array.isArray(targets) ? targets : [];
      const players = candidates.filter((p): p is Player => p instanceof Player);
      if (players.length === 0) {
        return { status: CustomCommandStatus.Failure, message: "No player to target." };
      }

      // Command callbacks run in restricted mode, like before-events: defer the write.
      system.run(() => {
        for (const player of players) if (player.isValid) setCoins(player, amount);
      });
      return {
        status: CustomCommandStatus.Success,
        message: `Set ${players.map((p) => p.name).join(", ")} to ${amount} coins.`,
      };
    },
  );
}

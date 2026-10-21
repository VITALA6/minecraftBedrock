import { DisplaySlotId, world, type Player, type ScoreboardObjective } from "@minecraft/server";
import { COINS_OBJECTIVE } from "./config";

// Display only: the wallet (dynamic properties) is the source of truth.
// Someone can delete the objective with /scoreboard, so re-create it when it goes invalid.
let cached: ScoreboardObjective | undefined;

function coinsObjective(): ScoreboardObjective {
  if (cached?.isValid) return cached;
  cached =
    world.scoreboard.getObjective(COINS_OBJECTIVE) ??
    world.scoreboard.addObjective(COINS_OBJECTIVE, "Ruby Coins");
  return cached;
}

export function showCoinsSidebar(): void {
  world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
    objective: coinsObjective(),
  });
}

export function mirrorScore(player: Player, coins: number): void {
  coinsObjective().setScore(player, coins);
}

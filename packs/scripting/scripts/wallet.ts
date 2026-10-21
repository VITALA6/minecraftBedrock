import type { Player } from "@minecraft/server";
import { COINS_PROPERTY, MAX_COINS } from "./config";
import { mirrorScore } from "./scoreboard";

function clampCoins(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.min(MAX_COINS, Math.max(0, Math.floor(amount)));
}

export function getCoins(player: Player): number {
  const value = player.getDynamicProperty(COINS_PROPERTY);
  return typeof value === "number" ? clampCoins(value) : 0;
}

/** Sets the balance (clamped to 0..MAX_COINS) and returns the stored value. */
export function setCoins(player: Player, amount: number): number {
  const value = clampCoins(amount);
  player.setDynamicProperty(COINS_PROPERTY, value);
  mirrorScore(player, value);
  return value;
}

/** Adds coins and returns how many were actually added (less if the wallet hits MAX_COINS). */
export function addCoins(player: Player, amount: number): number {
  const before = getCoins(player);
  return setCoins(player, before + amount) - before;
}

/** Removes `amount` coins if the player has them. Returns false (and changes nothing) otherwise. */
export function trySpend(player: Player, amount: number): boolean {
  if (!Number.isInteger(amount) || amount < 0) return false;
  const balance = getCoins(player);
  if (balance < amount) return false;
  setCoins(player, balance - amount);
  return true;
}

export function roomInWallet(player: Player): number {
  return MAX_COINS - getCoins(player);
}

import type { Player } from "@minecraft/server";
import { BLOCK_RUBY, MAX_PURCHASE } from "./config";
import { capacityFor, getContainer, giveItems } from "./inventory";
import { addCoins, getCoins, trySpend } from "./wallet";

export interface ShopItem {
  readonly typeId: string;
  readonly label: string;
  readonly price: number;
  readonly icon?: string;
}

export const CATALOG: readonly ShopItem[] = [
  {
    typeId: BLOCK_RUBY,
    label: "Block of Ruby",
    price: 12,
    icon: "textures/myteam/blocks/ruby_block",
  },
  { typeId: "minecraft:bread", label: "Bread", price: 2, icon: "textures/items/bread" },
  {
    typeId: "minecraft:iron_ingot",
    label: "Iron Ingot",
    price: 5,
    icon: "textures/items/iron_ingot",
  },
  { typeId: "minecraft:emerald", label: "Emerald", price: 20, icon: "textures/items/emerald" },
  { typeId: "minecraft:diamond", label: "Diamond", price: 40, icon: "textures/items/diamond" },
];

export type PurchaseResult =
  | { readonly ok: true; readonly quantity: number; readonly cost: number }
  | { readonly ok: false; readonly reason: string };

export type PurchaseLimit =
  | { readonly max: number; readonly reason?: undefined }
  | { readonly max: 0; readonly reason: string };

/** The most the player can buy right now: limited by coins, free inventory space and MAX_PURCHASE. */
export function purchaseLimit(player: Player, item: ShopItem): PurchaseLimit {
  const container = getContainer(player);
  if (!container) return { max: 0, reason: "Your inventory isn't available." };

  const affordable = Math.floor(getCoins(player) / item.price);
  if (affordable < 1)
    return { max: 0, reason: `You need ${item.price} coins for one ${item.label}.` };

  const space = capacityFor(container, item.typeId);
  if (space < 1) return { max: 0, reason: "Your inventory is full." };

  return { max: Math.min(affordable, space, MAX_PURCHASE) };
}

/**
 * Validates and performs a purchase in one synchronous step. Everything is re-checked here,
 * because the balance or inventory may have changed while the form was open, and form values
 * come from the client.
 */
export function purchase(player: Player, item: ShopItem, quantity: number): PurchaseResult {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PURCHASE) {
    return { ok: false, reason: "Invalid quantity." };
  }
  const container = getContainer(player);
  if (!container) return { ok: false, reason: "Your inventory isn't available." };

  const cost = quantity * item.price;
  const space = capacityFor(container, item.typeId);
  if (space < quantity) {
    return { ok: false, reason: `Not enough inventory space (room for ${space}).` };
  }
  if (!trySpend(player, cost)) {
    return { ok: false, reason: `Not enough coins: ${cost} needed, you have ${getCoins(player)}.` };
  }

  const notGiven = giveItems(container, item.typeId, quantity);
  if (notGiven > 0) addCoins(player, notGiven * item.price); // shouldn't happen after the space check
  const given = quantity - notGiven;
  return { ok: true, quantity: given, cost: given * item.price };
}

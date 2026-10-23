import { EntityComponentTypes, TicksPerSecond, type Entity, type Player } from "@minecraft/server";
import type { DishEffect } from "../data/dishes";

// Feeding from script, for food that isn't an item (a cake slice). Vanilla rules: saturation
// gained = nutrition × modifier × 2, and saturation never exceeds the hunger level.

export function feed(player: Player, nutrition: number, saturationModifier: number): void {
  const hunger = player.getComponent(EntityComponentTypes.Hunger);
  const saturation = player.getComponent(EntityComponentTypes.Saturation);
  if (!hunger) return;
  const food = Math.min(hunger.effectiveMax, hunger.currentValue + nutrition);
  hunger.setCurrentValue(food);
  if (saturation) {
    const gain = nutrition * saturationModifier * 2;
    saturation.setCurrentValue(Math.min(food, saturation.currentValue + gain));
  }
}

export function applyEffect(entity: Entity, effect: DishEffect | undefined): void {
  if (!effect) return;
  entity.addEffect(effect.effect, Math.round(effect.seconds * TicksPerSecond), {
    amplifier: effect.amplifier,
  });
}

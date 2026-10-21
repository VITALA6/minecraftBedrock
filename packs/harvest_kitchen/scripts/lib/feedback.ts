import {
  MolangVariableMap,
  type Dimension,
  type Player,
  type RawMessage,
  type RGB,
  type Vector3,
} from "@minecraft/server";

// The feedback vocabulary (plan §2.2): every action answers with a sound, a particle and at most
// one short action bar line. Effects are best-effort: a particle or sound that fails (unloaded
// chunk, a player who just left) must never break the action that triggered it.

export function sound(
  dimension: Dimension,
  id: string,
  location: Vector3,
  options?: { volume?: number; pitch?: number },
): void {
  try {
    dimension.playSound(id, location, options);
  } catch (error) {
    console.warn(`[harvest_kitchen] sound ${id} failed: ${String(error)}`);
  }
}

export function particle(
  dimension: Dimension,
  id: string,
  location: Vector3,
  count = 1,
  spread = 0.25,
  color?: RGB,
): void {
  let vars: MolangVariableMap | undefined;
  if (color) {
    vars = new MolangVariableMap();
    vars.setColorRGB("variable.color", color);
  }
  try {
    for (let i = 0; i < count; i++) {
      const at =
        count === 1
          ? location
          : {
              x: location.x + (Math.random() - 0.5) * 2 * spread,
              y: location.y + Math.random() * spread,
              z: location.z + (Math.random() - 0.5) * 2 * spread,
            };
      dimension.spawnParticle(id, at, vars);
    }
  } catch (error) {
    console.warn(`[harvest_kitchen] particle ${id} failed: ${String(error)}`);
  }
}

export function actionBar(player: Player, message: RawMessage): void {
  if (player.isValid) player.onScreenDisplay.setActionBar(message);
}

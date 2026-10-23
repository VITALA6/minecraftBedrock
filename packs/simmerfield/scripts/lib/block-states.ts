import { BlockPermutation, type Block } from "@minecraft/server";

// BlockPermutation.getState/withState are typed against vanilla state names only, so custom
// states like "wm_kitchen:growth" don't type-check there. getAllStates() and resolve() take any name.

export type StateValue = boolean | number | string;

export function getState(block: Block, state: string): StateValue | undefined {
  return block.permutation.getAllStates()[state];
}

export function getNumberState(block: Block, state: string): number | undefined {
  const value = getState(block, state);
  return typeof value === "number" ? value : undefined;
}

export function setState(block: Block, state: string, value: StateValue): void {
  setStates(block, { [state]: value });
}

/** withState typed for any state name (the d.ts only lists vanilla names). */
type AnyStatePermutation = { withState(name: string, value: StateValue): BlockPermutation };

/**
 * Sets several states in one permutation change; does nothing if they already match. Builds on
 * the block's own permutation with withState (as Microsoft's multi-block sample does), so states
 * getAllStates() may not list, such as minecraft:multi_block_part, are kept: re-resolving from
 * getAllStates() is the suspected reason a recipe poster vanished after its states were set.
 */
export function setStates(block: Block, patch: Readonly<Record<string, StateValue>>): void {
  const current = block.permutation.getAllStates();
  if (Object.entries(patch).every(([name, value]) => current[name] === value)) return;
  let permutation = block.permutation;
  for (const [name, value] of Object.entries(patch)) {
    permutation = (permutation as unknown as AnyStatePermutation).withState(name, value);
  }
  block.setPermutation(permutation);
}

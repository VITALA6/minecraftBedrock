import { BlockPermutation, type Block } from "@minecraft/server";

// BlockPermutation.getState/withState are typed against vanilla state names only, so custom
// states like "hk:growth" don't type-check there. getAllStates() and resolve() take any name.

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

/** Sets several states in one permutation change; does nothing if they already match. */
export function setStates(block: Block, patch: Readonly<Record<string, StateValue>>): void {
  const current = block.permutation.getAllStates();
  if (Object.entries(patch).every(([name, value]) => current[name] === value)) return;
  block.setPermutation(BlockPermutation.resolve(block.typeId, { ...current, ...patch }));
}

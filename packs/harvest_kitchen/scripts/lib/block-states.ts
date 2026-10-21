import { BlockPermutation, type Block } from "@minecraft/server";

// BlockPermutation.getState/withState are typed against vanilla state names only, so custom
// states like "hk:growth" don't type-check there. getAllStates() and resolve() take any name.

export function getNumberState(block: Block, state: string): number | undefined {
  const value = block.permutation.getAllStates()[state];
  return typeof value === "number" ? value : undefined;
}

export function setState(block: Block, state: string, value: boolean | number | string): void {
  const states = { ...block.permutation.getAllStates(), [state]: value };
  block.setPermutation(BlockPermutation.resolve(block.typeId, states));
}

import {
  BLOCK_COOKING_POT,
  ITEM_COOKING_POT,
  STATE_FILL,
  STATE_HOT,
  STATE_LIQUID,
  STATE_PHASE,
} from "../config";

// Container stations as config (plan §5.2): a block that holds ingredients, matches recipes from
// data/recipes.ts, cooks over time and shows its state through block states. The pot is the only
// v1 station; an oven in v1.1 is one more entry here (plus its block JSON and recipes), not code.

export type StationId = "pot";

export interface ContainerStation {
  readonly id: StationId;
  readonly block: string;
  /** Item whose icon stands for the station in forms and the book. */
  readonly icon: string;
  readonly nameKey: string;
  /** Total ingredient items it holds. */
  readonly capacity: number;
  /** Needs a heat source directly below to cook (D5). Rules in stations/heat.ts. */
  readonly needsHeat: boolean;
  /** Block states the engine drives. Each is optional, so a station can skip a visual. */
  readonly states: {
    /** Int state 0..levels, from how full the station is. */
    readonly fill?: { readonly name: string; readonly levels: number };
    /** String state with values idle | ready | cooking | done. */
    readonly phase?: string;
    /** Bool state: heat below right now (cached; refreshed by the sweep and on use). */
    readonly hot?: string;
    /** String state with the values of LIQUIDS (data/liquids.ts): the liquid's colour. */
    readonly liquid?: string;
  };
}

export const STATIONS: readonly ContainerStation[] = [
  {
    id: "pot",
    block: BLOCK_COOKING_POT,
    icon: ITEM_COOKING_POT,
    nameKey: "hk.station.pot",
    capacity: 8,
    needsHeat: true,
    states: {
      fill: { name: STATE_FILL, levels: 3 },
      phase: STATE_PHASE,
      hot: STATE_HOT,
      liquid: STATE_LIQUID,
    },
  },
];

export function stationById(id: string): ContainerStation | undefined {
  return STATIONS.find((station) => station.id === id);
}

export function stationByBlock(blockId: string): ContainerStation | undefined {
  return STATIONS.find((station) => station.block === blockId);
}

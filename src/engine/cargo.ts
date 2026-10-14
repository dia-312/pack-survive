import { CONFIG } from './config';
import type { Cargo, Config, ItemId } from './types';

export const ITEM_ORDER: ItemId[] = [
  'solar',
  'battery',
  'reactor',
  'o2gen',
  'o2tank',
  'recycler',
  'watertank',
  'food',
  'greenhouse',
  'shield',
  'excavator',
  'shelter',
  'spare',
];

export function cargoMass(cargo: Cargo, cfg: Config = CONFIG): number {
  let m = 0;
  for (const id of ITEM_ORDER) m += (cargo[id] ?? 0) * cfg.items[id].mass;
  return m;
}

export interface CargoCheck {
  mass: number;
  budget: number;
  over: boolean;
  /** items packed above their per-item maximum */
  overMax: ItemId[];
  canLaunch: boolean;
}

export function checkCargo(cargo: Cargo, cfg: Config = CONFIG): CargoCheck {
  const mass = cargoMass(cargo, cfg);
  const budget = cfg.params.massBudget;
  const overMax = ITEM_ORDER.filter((id) => (cargo[id] ?? 0) > cfg.items[id].max);
  const over = mass > budget;
  return { mass, budget, over, overMax, canLaunch: !over && overMax.length === 0 && mass > 0 };
}

export function addItem(cargo: Cargo, id: ItemId, cfg: Config = CONFIG): Cargo {
  const n = cargo[id] ?? 0;
  if (n >= cfg.items[id].max) return cargo;
  return { ...cargo, [id]: n + 1 };
}

export function removeItem(cargo: Cargo, id: ItemId): Cargo {
  const n = cargo[id] ?? 0;
  if (n <= 0) return cargo;
  const next = { ...cargo, [id]: n - 1 };
  if (next[id] === 0) delete next[id];
  return next;
}

/** Compact, readable key such as "reactor1 o2gen1 food6". */
export function cargoLabel(cargo: Cargo): string {
  return ITEM_ORDER.filter((id) => (cargo[id] ?? 0) > 0)
    .map((id) => `${id}×${cargo[id]}`)
    .join(' ');
}

/**
 * Every cargo within the mass budget (respecting per-item max). Includes the empty cargo.
 * Depth-first over ITEM_ORDER so the result is deterministic.
 */
export function* enumerateCargos(cfg: Config = CONFIG): Generator<Cargo> {
  const budget = cfg.params.massBudget;
  const counts: number[] = new Array(ITEM_ORDER.length).fill(0);
  function* rec(i: number, mass: number): Generator<Cargo> {
    if (i === ITEM_ORDER.length) {
      const c: Cargo = {};
      for (let k = 0; k < ITEM_ORDER.length; k++) if (counts[k] > 0) c[ITEM_ORDER[k]] = counts[k];
      yield c;
      return;
    }
    const def = cfg.items[ITEM_ORDER[i]];
    for (let n = 0; n <= def.max && mass + n * def.mass <= budget; n++) {
      counts[i] = n;
      yield* rec(i + 1, mass + n * def.mass);
    }
    counts[i] = 0;
  }
  yield* rec(0, 0);
}

/**
 * Suggested cargo for Easy mode. Tuned with scripts/balance.ts: a reactor keeps the
 * base alive through both dark spells, the generator + recycler stretch the water and
 * air, a shelter covers the storm, and the food crates feed the crew. It has no spare part:
 * that is the trade-off Radar points out.
 */
export const SUGGESTED_CARGO: Cargo = {
  reactor: 1,
  o2gen: 1,
  recycler: 1,
  watertank: 2,
  food: 6,
  shelter: 1,
};

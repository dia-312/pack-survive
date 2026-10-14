/** Shared helpers for the balance script (kid model and cargo checklists). */
import { CONFIG } from '../src/engine/config';
import { makeRng } from '../src/engine/rng';
import { smartPolicy, type Policy } from '../src/engine/policy';
import type { Cargo } from '../src/engine/types';

export const SKILL = 0.85;

/** A commander who sometimes fumbles the hands-on tasks. Deterministic per (seed, day). */
export function kidPolicy(seed: number): Policy {
  const rng = makeRng(seed * 7919 + 13);
  return (s, ev, cfg) => {
    const choice = smartPolicy(s, ev, cfg);
    const hands = cfg.events[ev].hands;
    const flub = hands && rng.next() > SKILL;
    if (!flub) return choice;
    if (ev === 'storm') return 'late';
    return cfg.events[ev].default;
  };
}

export const has = (c: Cargo, id: keyof Cargo) => c[id] ?? 0;

/** Does the cargo name at least one item for each basic need (power, air, water, food)? */
export function coversBasics(c: Cargo): boolean {
  return (
    has(c, 'solar') + has(c, 'reactor') > 0 &&
    has(c, 'o2gen') + has(c, 'o2tank') > 0 &&
    has(c, 'recycler') + has(c, 'watertank') > 0 &&
    has(c, 'food') + has(c, 'greenhouse') > 0
  );
}

/**
 * A thoughtful kid does the sums for 30 days: enough power (also through the dark spell),
 * air, water and food, plus some cover from radiation.
 */
export function isThoughtful(c: Cargo): boolean {
  const days = CONFIG.params.missionDays;
  const I = CONFIG.items;
  const crew = CONFIG.params.crewSize;
  const need =
    CONFIG.params.baseLoad +
    (has(c, 'o2gen') ? 3 : 0) +
    (has(c, 'recycler') ? 2 : 0);
  const power = has(c, 'reactor')
    ? need <= 8
    : has(c, 'solar') * 6 >= need && has(c, 'battery') * 10 >= need * 3;
  const air =
    CONFIG.params.startOxygen + has(c, 'o2tank') * 20 + (has(c, 'o2gen') ? 4 * days : 0) >= crew * days;
  const waterNeed = (has(c, 'recycler') ? crew * days * 0.02 : crew * days) + (has(c, 'o2gen') ? days : 0);
  const water = has(c, 'watertank') * (I.watertank.water ?? 0) >= waterNeed;
  const food = has(c, 'food') * (I.food.food ?? 0) >= crew * days * 0.8;
  const radiation = has(c, 'shelter') + has(c, 'shield') > 0;
  return power && air && water && food && radiation;
}


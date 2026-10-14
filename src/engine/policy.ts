import { CONFIG } from './config';
import { availableChoices, createMission, resolveEvent } from './mission';
import type { Rng } from './rng';
import { tick } from './tick';
import type { Cargo, Config, EventId, MissionState } from './types';

export type Policy = (s: MissionState, ev: EventId, cfg: Config) => string;

/** A sensible commander: uses spares on breakdowns, hides from storms, looks after the crew. */
export const smartPolicy: Policy = (s, ev, cfg) => {
  const can = availableChoices(s, ev, cfg);
  const has = (c: string) => can.includes(c);
  switch (ev) {
    case 'darkness':
      return (s.cargo.reactor ?? 0) > 0 ? 'keep' : 'save';
    case 'storm':
      return 'shelter';
    case 'recycler_break':
      return has('spare') ? 'spare' : 'ration';
    case 'meteoroid':
      return has('spare') ? 'spare' : 'ignore';
    case 'dust':
      return 'clean';
    case 'leak':
      return 'patch';
    case 'mold':
      return (s.cargo.reactor ?? 0) > 0 ? 'airflow' : 'cut';
    case 'rock':
      return 'scan';
    case 'home':
      return s.morale < 70 ? 'call' : 'data';
    case 'tired':
      return 'rest';
  }
};

/** Always the second (usually "skip it / keep going") option: a careless commander. */
export const carelessPolicy: Policy = (_s, ev, cfg) => cfg.events[ev].choices[1];

export function randomPolicy(rng: Rng): Policy {
  return (s, ev, cfg) => rng.pick(availableChoices(s, ev, cfg));
}

/** Play a whole mission headlessly. Used by the balance script and by tests. */
export function simulate(
  cargo: Cargo,
  seed: number,
  policy: Policy = smartPolicy,
  cfg: Config = CONFIG,
): MissionState {
  const s = createMission(cargo, seed, cfg);
  while (s.status === 'running') {
    if (s.pending) resolveEvent(s, s.pending, policy(s, s.pending, cfg), cfg);
    tick(s, cfg);
  }
  return s;
}

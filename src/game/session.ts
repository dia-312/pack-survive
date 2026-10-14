import { configFor } from '../engine/config';
import { createMission } from '../engine/mission';
import type { Cargo } from '../engine/types';
import { getState, setState } from '../ui/store';

/** A mission seed: ?seed=123 in the address replays a mission exactly. */
export function pickSeed(): number {
  try {
    const p = new URLSearchParams(window.location.search).get('seed');
    if (p && /^\d+$/.test(p)) return Number(p) >>> 0;
  } catch {
    /* ignore */
  }
  return Math.floor(Math.random() * 0x7fffffff);
}

export function startMission(cargo: Cargo, seed: number = pickSeed()): void {
  const mission = createMission(cargo, seed, configFor(getState().easy ? 'easy' : 'normal'));
  setState({
    cargo: { ...cargo },
    seed,
    mission,
    rev: 0,
    screen: 'play',
    landing: true,
    overlay: null,
    task: null,
    storm: null,
    dayProgress: 0,
    toasts: [],
    nearby: null,
    radar: { key: 'radar.landing' },
    answers: ['', '', ''],
  });
}

import { configFor } from '../../engine/config';
import type { MissionState } from '../../engine/types';
import { useStore } from '../store';

/** Re-renders whenever the (mutated in place) mission changes. */
export function useMission(): MissionState {
  useStore((s) => s.rev);
  return useStore((s) => s.mission)!;
}

export type Level = 'ok' | 'warn' | 'bad';

/**
 * Rough days of supply from today's flows (what the HUD shows as "lasts ~N days").
 * Before the first day ends, assume every packed system will run.
 */
export function supplyDays(m: MissionState): { oxygen: number; water: number; food: number } {
  const CONFIG = configFor(m.difficulty);
  const crew = m.crew.length;
  const first = m.log.length === 0;
  const run = (k: 'o2gen' | 'recycler' | 'greenhouse') => (first ? m.systems[k].on && !m.systems[k].broken : m.systems[k].running);
  const grown = m.greenhouseGrowth >= (CONFIG.items.greenhouse.growDays ?? 9);
  const ghMakes = run('greenhouse') && grown;
  const oxNet = crew + (m.effects.leakDays > 0 ? CONFIG.params.effects.leakOxygenPerDay : 0) - (run('o2gen') ? 4 : 0) - (ghMakes ? 1 : 0);
  const rationing = m.effects.rationDays > 0 && m.systems.recycler.broken;
  const waterNet =
    crew * (rationing ? CONFIG.params.effects.rationWaterFactor : 1) * (run('recycler') ? 1 - (CONFIG.items.recycler.recovery ?? 0) : 1) +
    (run('o2gen') ? 1 : 0) +
    (run('greenhouse') ? 1 : 0);
  const foodNet = crew - (ghMakes ? 2 : 0);
  const d = (stock: number, net: number) => (net <= 0.001 ? Infinity : stock / net);
  return { oxygen: d(m.oxygen, oxNet), water: d(m.water, waterNet), food: d(m.food, foodNet) };
}

export function daysLevel(days: number, daysLeftInMission: number): Level {
  if (days >= daysLeftInMission + 1) return 'ok';
  if (days <= 1.5) return 'bad';
  if (days <= 4) return 'warn';
  return 'ok';
}

export const round1 = (x: number): number => Math.round(x * 10) / 10;
export const fmt = (x: number): string => (Number.isInteger(x) ? String(x) : round1(x).toFixed(1));

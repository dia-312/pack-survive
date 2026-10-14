import { CONFIG } from './config';
import { createMission } from './mission';
import { tick } from './tick';
import type { Cargo, Config } from './types';

export type PlanKind = 'oxygen' | 'water' | 'food' | 'power' | 'night' | 'cover';

export interface PlanIssue {
  kind: PlanKind;
  /** the mission day the problem first shows up (not used for 'cover') */
  day: number;
}

export interface CargoPlan {
  /** survives all 30 days if nothing unexpected happens */
  finishes: boolean;
  endDay: number;
  issues: PlanIssue[];
  /** radiation after a quiet mission, in mSv */
  quietDose: number;
}

/**
 * "Radar's check": a dry run of the mission with no surprises (no storm, no breakdowns).
 * It tells the kid which supplies run short and when; it cannot see the surprises, which
 * is exactly why spares, shelters and shields are worth their mass.
 */
export function planCargo(cargo: Cargo, cfg: Config = CONFIG): CargoPlan {
  const s = createMission(cargo, 1, cfg);
  s.schedule = { stormDay: 999, events: {} };
  s.pending = null;
  while (s.status === 'running') tick(s, cfg);

  const first = (pred: (l: (typeof s.log)[number]) => boolean) => s.log.find(pred)?.day;
  const issues: PlanIssue[] = [];
  const add = (kind: PlanKind, day: number | undefined) => {
    if (day !== undefined) issues.push({ kind, day });
  };
  add('oxygen', s.endReason === 'oxygen' ? s.endDay ?? undefined : undefined);
  add('water', first((l) => l.waterShort));
  add('food', first((l) => l.foodShort));
  add('night', first((l) => l.sun === 0 && (l.baseCold || l.shed.length > 0)));
  add('power', first((l) => l.sun > 0 && (l.baseCold || l.shed.length > 0)));
  if (!(cargo.shelter ?? 0) && !(cargo.shield ?? 0) && !(cargo.excavator ?? 0)) {
    issues.push({ kind: 'cover', day: 0 });
  }
  issues.sort((a, b) => a.day - b.day);
  return {
    finishes: s.status === 'success',
    endDay: s.endDay ?? s.day,
    issues,
    quietDose: s.dose,
  };
}

import { CONFIG } from './config';
import type { Config, DayLog, EventId, MissionState } from './types';

export function averageHealth(s: MissionState): number {
  return Math.round(s.crew.reduce((a, c) => a + c.health, 0) / s.crew.length);
}

/** 1-3 stars. Evacuation is a safe ending, so it still earns 1 (2 if the crew nearly made it). */
export function stars(s: MissionState, cfg: Config = CONFIG): 1 | 2 | 3 {
  const st = cfg.params.stars;
  if (s.status === 'success') {
    const good =
      averageHealth(s) >= st.minHealth && s.dose <= st.maxDose && s.morale >= st.minMorale;
    return good ? 3 : 2;
  }
  return (s.endDay ?? 0) >= st.lateEvacuationDay ? 2 : 1;
}

export type TurningKind =
  | 'no_power_air' // oxygen ran out because the generator lost power
  | 'no_oxygen_gen' // no way to make oxygen
  | 'no_water_air' // generator had no water
  | 'leak_air' // an unpatched leak drained the air
  | 'storm_dose' // storm without cover pushed the dose over the limit
  | 'cosmic_dose' // slow build-up over the limit
  | 'cold_health' // unpowered base
  | 'thirst_health' // water ran out
  | 'hunger_health' // food ran out
  | 'storm_shelter' // success: shelter saved the day
  | 'spare_saved' // success: spare part used
  | 'night_survived' // success: got through the dark days
  | 'balanced'; // success: good all-round plan

export interface TurningPoint {
  kind: TurningKind;
  day: number;
}

function firstDay(log: DayLog[], pred: (d: DayLog) => boolean): number | null {
  const d = log.find(pred);
  return d ? d.day : null;
}

/** The single moment that best explains how the mission ended (shown as one sentence). */
export function turningPoint(s: MissionState, cfg: Config = CONFIG): TurningPoint {
  const day = s.endDay ?? s.day;
  const decided = (ev: EventId, choice?: string) =>
    s.decisions.find((d) => d.event === ev && (choice === undefined || d.choice === choice));
  const stormDay = s.schedule.stormDay;

  if (s.status === 'evacuated') {
    switch (s.endReason) {
      case 'radiation': {
        const hitStorm = s.log.some((l) => l.storm);
        const prot = decided('storm');
        const unprotected = !prot || prot.choice !== 'shelter' || !(s.cargo.shelter ?? 0);
        return hitStorm && unprotected
          ? { kind: 'storm_dose', day: stormDay }
          : { kind: 'cosmic_dose', day };
      }
      case 'oxygen': {
        if (!(s.cargo.o2gen ?? 0) && !(s.cargo.greenhouse ?? 0)) return { kind: 'no_oxygen_gen', day };
        const leak = decided('leak', 'ignore');
        const shed = firstDay(s.log, (l) => l.shed.includes('o2gen'));
        if (shed !== null) return { kind: 'no_power_air', day: shed };
        const starved = firstDay(s.log, (l) => l.o2genStarved);
        if (starved !== null) return { kind: 'no_water_air', day: starved };
        if (leak) return { kind: 'leak_air', day: leak.day };
        return { kind: 'no_oxygen_gen', day };
      }
      case 'medical': {
        const cold = firstDay(s.log, (l) => l.baseCold);
        const thirst = firstDay(s.log, (l) => l.waterShort);
        const hunger = firstDay(s.log, (l) => l.foodShort);
        const cands = [
          { kind: 'cold_health' as const, d: cold },
          { kind: 'thirst_health' as const, d: thirst },
          { kind: 'hunger_health' as const, d: hunger },
        ].filter((c) => c.d !== null) as { kind: TurningKind; d: number }[];
        cands.sort((a, b) => a.d - b.d);
        return cands.length ? { kind: cands[0].kind, day: cands[0].d } : { kind: 'hunger_health', day };
      }
      default:
        return { kind: 'cosmic_dose', day };
    }
  }

  // Success: name the choice that mattered most.
  const prot = decided('storm', 'shelter');
  if (prot && (s.cargo.shelter ?? 0) > 0) return { kind: 'storm_shelter', day: stormDay };
  const spare = s.decisions.find((d) => d.choice === 'spare');
  if (spare) return { kind: 'spare_saved', day: spare.day };
  const dark = s.log.filter((l) => l.sun === 0);
  if (dark.length && dark.every((l) => l.shed.length === 0 && !l.baseCold))
    return { kind: 'night_survived', day: dark[0].day };
  void cfg;
  return { kind: 'balanced', day };
}

/** Story and tip keys for each turning point (texts in i18n, sources in facts.json). */
export const TURNING_LINKS: Record<TurningKind, { story: string; tip: string }> = {
  no_power_air: { story: 'opportunity', tip: 'power_first' },
  no_oxygen_gen: { story: 'apollo13', tip: 'air_plan' },
  no_water_air: { story: 'iss_water', tip: 'water_loop' },
  leak_air: { story: 'apollo13', tip: 'fix_leaks' },
  storm_dose: { story: 'apollo1972', tip: 'shelter_up' },
  cosmic_dose: { story: 'apollo1972', tip: 'shield_early' },
  cold_health: { story: 'lunar_night', tip: 'power_first' },
  thirst_health: { story: 'iss_water', tip: 'water_loop' },
  hunger_health: { story: 'veggie', tip: 'food_margin' },
  storm_shelter: { story: 'apollo1972', tip: 'shelter_up' },
  spare_saved: { story: 'apollo13', tip: 'spares' },
  night_survived: { story: 'lunar_night', tip: 'night_power' },
  balanced: { story: 'veggie', tip: 'balance' },
};

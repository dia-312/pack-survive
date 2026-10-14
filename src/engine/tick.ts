import { CONFIG } from './config';
import { clamp, r3, resolveEvent, startDay, sunFactor } from './mission';
import {
  SYSTEM_ORDER,
  type AlertCode,
  type Config,
  type DayLog,
  type MissionState,
  type Protection,
  type SystemId,
} from './types';

export interface PowerPlan {
  produced: number;
  sun: number;
  /** Demands in priority order: base first, then the systems. */
  demands: { id: 'base' | SystemId; amount: number }[];
}

/** What would run today, in priority order (also used by the UI to show "needs power"). */
export function planPower(s: MissionState, cfg: Config = CONFIG): PowerPlan {
  const { params: P, items: I } = cfg;
  const fx = s.effects;
  const sun = sunFactor(s.day, cfg);
  let solarMult = sun;
  if (fx.dust) solarMult *= P.effects.dustOutputFactor;
  if (fx.meteoroid) solarMult *= P.effects.meteoroidOutputFactor;
  const produced = r3(
    (s.cargo.solar ?? 0) * (I.solar.power ?? 0) * solarMult +
      (s.cargo.reactor ?? 0) * (I.reactor.power ?? 0),
  );

  const forcedOff = (id: SystemId) =>
    ((id === 'greenhouse' || id === 'excavator') && fx.powerSaveDays > 0) ||
    (id === 'excavator' && fx.restDay);
  const wants = (id: SystemId) => {
    const sys = s.systems[id];
    return sys.present && sys.on && !sys.broken && !forcedOff(id);
  };

  const demands: PowerPlan['demands'] = [];
  const base =
    P.baseLoad -
    (fx.powerSaveDays > 0 ? P.effects.powerSaveBaseCut : 0) +
    (fx.videoCall ? P.effects.videoCallPower : 0);
  demands.push({ id: 'base', amount: base });
  for (const id of SYSTEM_ORDER) {
    if (!wants(id)) continue;
    const def = I[id];
    // Systems that drink water cannot run on an empty tank, so they do not reserve power either.
    if ((def.waterUse ?? 0) > s.water) continue;
    let amount = def.powerUse ?? 0;
    if (id === 'greenhouse' && fx.airflowDays > 0) amount += P.effects.airflowExtraPower;
    demands.push({ id, amount });
  }
  return { produced, sun, demands };
}

/**
 * Advance one mission day. The day in progress ends, in this order:
 *  1 produce power  2 distribute by priority  3 run systems  4 crew consumes
 *  5 radiation      6 health & morale         7 end checks
 * Mutates and returns the day's log entry. An unresolved situation takes its default choice.
 */
export function tick(s: MissionState, cfg: Config = CONFIG): DayLog {
  if (s.status !== 'running') throw new Error('mission is over');
  const { params: P, items: I } = cfg;
  if (s.pending) resolveEvent(s, s.pending, cfg.events[s.pending].default, cfg);

  const day = s.day;
  const fx = s.effects;
  const alerts: AlertCode[] = [];
  const alert = (code: AlertCode, system?: SystemId) => {
    s.alerts.push({ day, code, system });
    alerts.push(code);
  };

  // 1 + 2: produce, then distribute by strict priority --------------------------------------
  const plan = planPower(s, cfg);
  let remaining = plan.produced + s.battery;
  let used = 0;
  let shedFrom = false;
  let baseCold = false;
  const shed: SystemId[] = [];
  const powered = new Set<'base' | SystemId>();
  for (const d of plan.demands) {
    if (!shedFrom && remaining >= d.amount) {
      powered.add(d.id);
      remaining -= d.amount;
      used += d.amount;
    } else {
      shedFrom = true;
      if (d.id === 'base') baseCold = true;
      else {
        shed.push(d.id);
        alert('shutdown', d.id);
      }
    }
  }
  if (baseCold) alert('base_cold');
  if (shedFrom) alert('battery_empty');
  s.battery = r3(Math.min(s.batteryCap, s.battery + plan.produced - used));
  for (const id of SYSTEM_ORDER) {
    s.systems[id].running = powered.has(id);
  }

  // 3: run powered systems ------------------------------------------------------------------
  const o2genStarved =
    s.systems.o2gen.present &&
    s.systems.o2gen.on &&
    !s.systems.o2gen.broken &&
    (I.o2gen.waterUse ?? 0) > s.water;
  if (powered.has('o2gen')) {
    s.water = r3(Math.max(0, s.water - (I.o2gen.waterUse ?? 0)));
    s.oxygen = r3(s.oxygen + (I.o2gen.oxygen ?? 0));
  }
  if (powered.has('greenhouse') && s.water >= (I.greenhouse.waterUse ?? 0)) {
    s.water = r3(s.water - (I.greenhouse.waterUse ?? 0));
    s.greenhouseGrowth += 1;
    if (s.greenhouseGrowth > (I.greenhouse.growDays ?? 0)) {
      const foodMult = fx.moldCutDays > 0 ? P.effects.moldFoodFactor : 1;
      s.food = r3(s.food + (I.greenhouse.food ?? 0) * foodMult);
      s.oxygen = r3(s.oxygen + (I.greenhouse.oxygen ?? 0));
    }
  }
  if (powered.has('excavator')) {
    s.shieldProgress += 1;
    if (s.shieldProgress >= (I.excavator.daysPerLevel ?? 5)) {
      s.shieldProgress = 0;
      s.shieldLevel = Math.min(P.maxShieldLevel, s.shieldLevel + 1);
    }
  }

  // 4: crew consumes ------------------------------------------------------------------------
  const crewN = s.crew.length;
  const leak = fx.leakDays > 0 ? P.effects.leakOxygenPerDay : 0;
  s.oxygen = r3(Math.max(0, s.oxygen - leak));
  const oxNeed = crewN * P.perCrewPerDay.oxygen;
  const oxShort = s.oxygen < oxNeed;
  s.oxygen = r3(Math.max(0, s.oxygen - oxNeed));

  const foodNeed = crewN * P.perCrewPerDay.food;
  const foodShort = s.food < foodNeed;
  s.food = r3(Math.max(0, s.food - foodNeed));

  const rationing = fx.rationDays > 0 && s.systems.recycler.broken;
  const recovery = powered.has('recycler') ? (I.recycler.recovery ?? 0) : 0;
  const waterNeed = crewN * P.perCrewPerDay.water * (rationing ? P.effects.rationWaterFactor : 1);
  const waterNet = r3(waterNeed * (1 - recovery));
  const waterShort = s.water < waterNet;
  s.water = r3(Math.max(0, s.water - waterNet));
  if (foodShort) alert('no_food');
  if (waterShort) alert('no_water');
  if (s.oxygen < oxNeed) alert('low_oxygen');

  // 5: radiation ----------------------------------------------------------------------------
  const storm = day === s.schedule.stormDay;
  const shieldF = P.shieldFactors[Math.min(s.shieldLevel, P.shieldFactors.length - 1)];
  if (storm) {
    const prot: Protection = fx.stormProtection ?? 'none';
    s.dose = r3(s.dose + P.stormDoseMSv * shieldF * P.stormProtection[prot]);
  } else {
    // Shields stop storm particles well but cosmic rays only a little.
    const cosmicF = 1 - (1 - shieldF) * P.cosmicShieldEffectiveness;
    s.dose = r3(s.dose + P.dailyDoseMSv * cosmicF);
  }

  // 6: health & morale ----------------------------------------------------------------------
  const H = P.health;
  for (const c of s.crew) {
    let d = 0;
    if (foodShort) d += H.noFood;
    if (waterShort) d += H.noWater;
    if (baseCold) d += H.cold;
    if (d === 0) d = H.recover;
    if (fx.restDay) d += P.effects.restHealth;
    c.health = clamp(c.health + d, 0, H.max);
  }
  let dm = 0;
  if (baseCold) dm += P.morale.cold;
  if (foodShort) dm += P.morale.shortage;
  if (waterShort) dm += P.morale.shortage;
  if (fx.powerSaveDays > 0) dm += P.effects.powerSaveMoralePerDay;
  if (rationing) dm += P.effects.rationMorale;
  if (dm === 0) dm = P.morale.calmDay;
  s.morale = clamp(s.morale + dm, 0, P.morale.max);

  const avgHealth = s.crew.reduce((a, c) => a + c.health, 0) / crewN;
  const entry: DayLog = {
    day,
    sun: plan.sun,
    produced: plan.produced,
    used: r3(used),
    battery: s.battery,
    oxygen: s.oxygen,
    water: s.water,
    food: s.food,
    dose: s.dose,
    health: Math.round(avgHealth),
    morale: s.morale,
    shieldLevel: s.shieldLevel,
    shed,
    baseCold,
    foodShort,
    waterShort,
    o2genStarved,
    storm,
    alerts,
  };
  s.log.push(entry);

  // 7: end checks (oxygen, health, dose, then the last day) ----------------------------------
  if (oxShort || (s.oxygen <= 0 && day < P.missionDays)) {
    finish(s, 'evacuated', 'oxygen', day);
  } else if (s.crew.some((c) => c.health <= 0)) {
    finish(s, 'evacuated', 'medical', day);
  } else if (s.dose > P.doseLimitMSv) {
    finish(s, 'evacuated', 'radiation', day);
  } else if (day >= P.missionDays) {
    finish(s, 'success', 'success', day);
  }

  if (s.status === 'running') {
    // Timed effects tick down, then the next day begins.
    fx.rationDays = Math.max(0, fx.rationDays - 1);
    if (fx.recyclerRepairIn > 0) {
      fx.recyclerRepairIn -= 1;
      if (fx.recyclerRepairIn === 0) s.systems.recycler.broken = false;
    }
    fx.leakDays = Math.max(0, fx.leakDays - 1);
    fx.moldCutDays = Math.max(0, fx.moldCutDays - 1);
    fx.airflowDays = Math.max(0, fx.airflowDays - 1);
    fx.powerSaveDays = Math.max(0, fx.powerSaveDays - 1);
    fx.restDay = false;
    fx.videoCall = false;
    fx.stormProtection = null;
    s.day += 1;
    startDay(s, cfg);
  }
  return entry;
}

function finish(
  s: MissionState,
  status: 'success' | 'evacuated',
  reason: MissionState['endReason'],
  day: number,
): void {
  s.status = status;
  s.endReason = reason;
  s.endDay = day;
  s.pending = null;
}

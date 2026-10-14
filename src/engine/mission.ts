import { CONFIG, configFor } from './config';
import { makeRng } from './rng';
import {
  SYSTEM_ORDER,
  type Cargo,
  type Config,
  type EventId,
  type MissionState,
  type Protection,
  type Schedule,
  type SystemId,
} from './types';

export const r3 = (x: number): number => Math.round(x * 1000) / 1000;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export const CREW_IDS = ['you', 'layan', 'omar', 'maya'];

export function sunFactor(day: number, cfg: Config = CONFIG): number {
  return cfg.params.sunZeroDays.includes(day) ? 0 : 1;
}

/** Cargo events are eligible only if the item they need is packed. */
export function eligibleRandomEvents(cargo: Cargo, cfg: Config = CONFIG): EventId[] {
  return Object.values(cfg.events)
    .filter((e) => e.kind === 'random' && e.requires.every((id) => (cargo[id] ?? 0) > 0))
    .map((e) => e.id);
}

/**
 * Decide everything random about a mission up front, from the seed alone, so a seed replays
 * exactly: the storm day and 4-6 situations on distinct days (never on consecutive days).
 */
export function buildSchedule(cargo: Cargo, seed: number, cfg: Config = CONFIG): Schedule {
  const p = cfg.params;
  const rng = makeRng(seed);
  const stormDay = rng.int(p.stormDayRange[0], p.stormDayRange[1]);
  const events: Record<number, EventId> = {};
  for (const d of p.darknessEventDays) events[d] = 'darkness';
  events[stormDay] = 'storm';

  const pool = rng.shuffle(eligibleRandomEvents(cargo, cfg));
  const want = Math.min(rng.int(p.randomEventCount[0], p.randomEventCount[1]), pool.length);
  const taken = (d: number) =>
    Object.keys(events).some((k) => Math.abs(Number(k) - d) < p.randomEventMinGap);
  let placed = 0;
  for (const id of pool) {
    if (placed >= want) break;
    for (let tries = 0; tries < 60; tries++) {
      const d = rng.int(p.randomEventDayRange[0], p.randomEventDayRange[1]);
      if (!taken(d)) {
        events[d] = id;
        placed++;
        break;
      }
    }
  }
  return { stormDay, events };
}

export function createMission(cargo: Cargo, seed: number, cfg: Config = CONFIG): MissionState {
  const { params: p, items: I } = cfg;
  const n = (id: keyof typeof I) => cargo[id] ?? 0;
  const systems = {} as MissionState['systems'];
  for (const id of SYSTEM_ORDER) {
    systems[id] = { present: n(id) > 0, on: n(id) > 0, broken: false, running: false };
  }
  const startShield = n('shield') > 0 ? (I.shield.shieldLevel ?? 2) : 0;
  const cap = n('battery') * (I.battery.capacity ?? 0);
  const s: MissionState = {
    seed,
    difficulty: cfg.difficulty,
    cargo: { ...cargo },
    day: 1,
    status: 'running',
    endReason: null,
    endDay: null,
    battery: cap,
    batteryCap: cap,
    oxygen: p.startOxygen + n('o2tank') * (I.o2tank.oxygen ?? 0),
    water: p.startWater + n('watertank') * (I.watertank.water ?? 0),
    food: p.startFood + n('food') * (I.food.food ?? 0),
    spares: n('spare'),
    crew: CREW_IDS.slice(0, p.crewSize).map((id) => ({ id, health: p.health.max })),
    dose: 0,
    shieldLevel: startShield,
    shieldProgress: 0,
    morale: p.startMorale,
    science: 0,
    systems,
    greenhouseGrowth: 0,
    harvestCooldown: 0,
    effects: {
      dust: false,
      meteoroid: false,
      rationDays: 0,
      recyclerRepairIn: 0,
      leakDays: 0,
      moldCutDays: 0,
      airflowDays: 0,
      powerSaveDays: 0,
      restDay: false,
      videoCall: false,
      stormProtection: null,
    },
    schedule: buildSchedule(cargo, seed, cfg),
    pending: null,
    decisions: [],
    alerts: [],
    log: [],
  };
  startDay(s, cfg);
  return s;
}

/** Called when a new day begins: raises today's situation (if any) and applies its immediate effect. */
export function startDay(s: MissionState, cfg: Config = configFor(s.difficulty)): void {
  const ev = s.schedule.events[s.day] ?? null;
  s.pending = ev;
  if (!ev) return;
  switch (ev) {
    case 'recycler_break':
      s.systems.recycler.broken = true;
      break;
    case 'meteoroid':
      s.effects.meteoroid = true;
      break;
    case 'dust':
      s.effects.dust = true;
      break;
    default:
      break;
  }
  void cfg;
}

/** Which choices are possible right now (e.g. "use a spare part" needs one in stock). */
export function availableChoices(s: MissionState, ev: EventId, cfg: Config = configFor(s.difficulty)): string[] {
  return cfg.events[ev].choices.filter((c) => !(c === 'spare' && s.spares < 1));
}

/**
 * Apply the player's choice for today's situation. Returns false (and changes nothing) if the
 * choice is not possible. The storm also accepts the internal choice 'late' = did not reach cover.
 */
export function resolveEvent(
  s: MissionState,
  ev: EventId,
  choice: string,
  cfg: Config = configFor(s.difficulty),
): boolean {
  if (s.pending !== ev || s.status !== 'running') return false;
  const known = cfg.events[ev].choices.includes(choice) || (ev === 'storm' && choice === 'late');
  if (!known) return false;
  if (!availableChoices(s, ev, cfg).includes(choice) && choice !== 'late') return false;
  const e = cfg.params.effects;
  const fx = s.effects;
  switch (`${ev}:${choice}`) {
    case 'darkness:save':
      fx.powerSaveDays = e.powerSaveDays;
      break;
    case 'storm:shelter': {
      const prot: Protection = (s.cargo.shelter ?? 0) > 0 ? 'shelter' : 'hide';
      fx.stormProtection = prot;
      break;
    }
    case 'storm:work':
      fx.stormProtection = 'none';
      s.science += 1;
      break;
    case 'storm:late':
      fx.stormProtection = 'none';
      break;
    case 'recycler_break:spare':
      s.spares -= 1;
      s.systems.recycler.broken = false;
      break;
    case 'recycler_break:ration':
      fx.rationDays = e.rationDays;
      fx.recyclerRepairIn = e.rationDays;
      break;
    case 'meteoroid:spare':
      s.spares -= 1;
      fx.meteoroid = false;
      break;
    case 'dust:clean':
      cleanDust(s, cfg);
      break;
    case 'leak:patch':
      s.morale = clamp(s.morale + e.patchMorale, 0, cfg.params.morale.max);
      break;
    case 'leak:ignore':
      fx.leakDays = e.leakDays;
      break;
    case 'mold:cut':
      fx.moldCutDays = e.moldDays;
      break;
    case 'mold:airflow':
      fx.airflowDays = e.moldDays;
      break;
    case 'rock:scan':
      s.science += 1;
      s.dose = r3(s.dose + e.rockEvaDoseMSv);
      break;
    case 'rock:ignore':
      s.morale = clamp(s.morale + e.rockIgnoreMorale, 0, cfg.params.morale.max);
      break;
    case 'home:call':
      fx.videoCall = true;
      s.morale = clamp(s.morale + e.videoCallMorale, 0, cfg.params.morale.max);
      break;
    case 'home:data':
      s.science += 1;
      break;
    case 'tired:rest':
      fx.restDay = true;
      break;
    case 'tired:work':
      s.morale = clamp(s.morale + e.workMorale, 0, cfg.params.morale.max);
      break;
    default:
      // darkness:keep and any no-cost default
      break;
  }
  s.decisions.push({ day: s.day, event: ev, choice });
  s.pending = null;
  return true;
}

/** Player switch for a packed system. Broken systems cannot be switched on. */
export function setSystem(s: MissionState, id: SystemId, on: boolean): boolean {
  const sys = s.systems[id];
  if (!sys.present) return false;
  if (on && sys.broken) return false;
  sys.on = on;
  return true;
}

export type RepairTarget = 'solar' | 'recycler';

/** Is there something a spare part could fix right now? */
export function canRepair(s: MissionState, target: RepairTarget): boolean {
  if (s.spares < 1) return false;
  return target === 'solar' ? s.effects.meteoroid : s.systems.recycler.broken;
}

/** Use one spare part on a damaged solar field or a broken recycler (any time, not only on the day it broke). */
export function useSpare(s: MissionState, target: RepairTarget): boolean {
  if (!canRepair(s, target)) return false;
  s.spares -= 1;
  if (target === 'solar') s.effects.meteoroid = false;
  else {
    s.systems.recycler.broken = false;
    s.effects.rationDays = 0;
    s.effects.recyclerRepairIn = 0;
  }
  return true;
}

/** Brush the dust off the solar panels (a chore: a little morale). */
export function cleanDust(s: MissionState, cfg: Config = configFor(s.difficulty)): boolean {
  if (!s.effects.dust) return false;
  s.effects.dust = false;
  s.morale = clamp(s.morale + cfg.params.effects.cleanMorale, 0, cfg.params.morale.max);
  return true;
}

/** Pick fresh salad: a small morale boost, once the plants are grown (3-day cooldown). */
export function harvest(s: MissionState, cfg: Config = configFor(s.difficulty)): boolean {
  const grown = s.greenhouseGrowth > (cfg.items.greenhouse.growDays ?? 0);
  if (!s.systems.greenhouse.present || !grown || s.harvestCooldown > 0) return false;
  s.harvestCooldown = 3;
  s.morale = clamp(s.morale + 3, 0, cfg.params.morale.max);
  return true;
}

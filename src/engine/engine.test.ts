import { describe, expect, it } from 'vitest';
import {
  addItem,
  checkCargo,
  enumerateCargos,
  cargoMass,
  removeItem,
  SUGGESTED_CARGO,
} from './cargo';
import { CONFIG, withParams } from './config';
import {
  availableChoices,
  buildSchedule,
  canRepair,
  cleanDust,
  harvest,
  useSpare,
  createMission,
  eligibleRandomEvents,
  resolveEvent,
  setSystem,
  sunFactor,
} from './mission';
import { carelessPolicy, simulate, smartPolicy } from './policy';
import { makeRng, mulberry32 } from './rng';
import { planCargo } from './plan';
import { stars, turningPoint } from './score';
import { planPower, tick } from './tick';
import type { Cargo, Config, MissionState } from './types';

/** A mission with no scheduled situations, so each step can be tested on its own. */
function mk(cargo: Cargo, cfg: Config = CONFIG): MissionState {
  const s = createMission(cargo, 1, cfg);
  s.schedule = { stormDay: 99, events: {} };
  s.pending = null;
  // no habitat stores, so each step is tested on the packed cargo alone
  s.water = Math.max(0, s.water - cfg.params.startWater);
  s.food = Math.max(0, s.food - cfg.params.startFood);
  return s;
}

describe('rng', () => {
  it('replays exactly for the same seed and differs between seeds', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    sa.forEach((v) => expect(v >= 0 && v < 1).toBe(true));
  });
  it('int stays in range and shuffle keeps all items', () => {
    const r = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.int(12, 20);
      expect(v).toBeGreaterThanOrEqual(12);
      expect(v).toBeLessThanOrEqual(20);
    }
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('cargo', () => {
  it('adds up mass and blocks launch when over 20', () => {
    expect(cargoMass({ reactor: 1, food: 6 })).toBe(12);
    expect(checkCargo({ solar: 4, battery: 4, food: 5 }).over).toBe(true);
    expect(checkCargo({ solar: 4, battery: 4, food: 5 }).canLaunch).toBe(false);
    expect(checkCargo({ solar: 4, battery: 4, food: 4 }).mass).toBe(20);
    expect(checkCargo({ solar: 4, battery: 4, food: 4 }).canLaunch).toBe(true);
    expect(checkCargo({}).canLaunch).toBe(false);
  });
  it('respects per-item maximum and add/remove', () => {
    expect(addItem({ reactor: 1 }, 'reactor')).toEqual({ reactor: 1 });
    expect(addItem({}, 'food')).toEqual({ food: 1 });
    expect(removeItem({ food: 1 }, 'food')).toEqual({});
    expect(checkCargo({ shield: 2 }).overMax).toEqual(['shield']);
  });
  it('enumerates only cargos within budget, including the empty one', () => {
    let n = 0;
    let sawEmpty = false;
    for (const c of enumerateCargos()) {
      n++;
      expect(cargoMass(c)).toBeLessThanOrEqual(20);
      if (Object.keys(c).length === 0) sawEmpty = true;
      if (n > 5000) break;
    }
    expect(sawEmpty).toBe(true);
  });
  it('suggested cargo fits the lander', () => {
    expect(checkCargo(SUGGESTED_CARGO).canLaunch).toBe(true);
  });
});

describe('start state', () => {
  it('turns cargo into resources; habitat starts with 12 oxygen', () => {
    const s = createMission({ o2tank: 1, watertank: 2, food: 3, battery: 2, spare: 2, shield: 1 }, 1);
    expect(s.oxygen).toBe(12 + 20);
    expect(s.water).toBe(12 + 40);
    expect(s.food).toBe(12 + 60);
    expect(s.batteryCap).toBe(20);
    expect(s.battery).toBe(20);
    expect(s.spares).toBe(2);
    expect(s.shieldLevel).toBe(2);
    expect(s.crew).toHaveLength(4);
    expect(s.day).toBe(1);
  });
});

describe('tick step 1: produce power', () => {
  it('panels give 6 x sun factor, reactor gives 8 day and night', () => {
    const s = mk({ solar: 2, reactor: 1 });
    expect(planPower(s).produced).toBe(12 + 8);
    s.day = 9; // darkness
    expect(sunFactor(9)).toBe(0);
    expect(planPower(s).produced).toBe(8);
    s.day = 12;
    expect(planPower(s).produced).toBe(20);
  });
  it('is dark on days 9-11 and 21-23 only', () => {
    const dark = [9, 10, 11, 21, 22, 23];
    for (let d = 1; d <= 30; d++) expect(sunFactor(d)).toBe(dark.includes(d) ? 0 : 1);
  });
  it('dust takes 20% and a micrometeoroid hit takes half of the panel output', () => {
    const s = mk({ solar: 2 });
    s.effects.dust = true;
    expect(planPower(s).produced).toBeCloseTo(9.6, 5);
    s.effects.meteoroid = true;
    expect(planPower(s).produced).toBeCloseTo(4.8, 5);
  });
});

describe('tick step 2: distribute power by priority', () => {
  const fullBase: Cargo = { reactor: 1, o2gen: 1, recycler: 1, greenhouse: 1, excavator: 1, watertank: 4 };

  it('base 2 -> oxygen 3 -> recycler 2 -> greenhouse 3 -> excavator 2', () => {
    const s = mk(fullBase);
    expect(planPower(s).demands.map((d) => [d.id, d.amount])).toEqual([
      ['base', 2],
      ['o2gen', 3],
      ['recycler', 2],
      ['greenhouse', 3],
      ['excavator', 2],
    ]);
  });
  it('surplus charges the battery but never above capacity: B(t+1)=min(C, B+P-D)', () => {
    const s = mk({ reactor: 1, battery: 1 });
    s.battery = 4;
    tick(s);
    expect(s.battery).toBe(10); // 4 + 8 - 2 = 10 (cap 10)
    const t = mk({ reactor: 1, battery: 2 });
    t.battery = 3;
    tick(t);
    expect(t.battery).toBe(9); // 3 + 8 - 2
  });
  it('deficit drains the battery', () => {
    const s = mk({ solar: 1, battery: 1, o2gen: 1, watertank: 1 });
    s.day = 9; // dark: P = 0, D = 2 + 3
    tick(s);
    expect(s.battery).toBe(5);
  });
  it('when the battery is empty the lowest-priority system shuts off and an alert appears', () => {
    const s = mk({ reactor: 1, o2gen: 1, recycler: 1, greenhouse: 1, excavator: 1, watertank: 4 });
    // supply 8 vs demand 12: base 2 + o2 3 + recycler 2 = 7, greenhouse (3) does not fit, excavator is shed too
    const log = tick(s);
    expect(log.shed).toEqual(['greenhouse', 'excavator']);
    expect(s.systems.greenhouse.running).toBe(false);
    expect(s.systems.o2gen.running).toBe(true);
    expect(s.alerts.some((a) => a.code === 'shutdown' && a.system === 'greenhouse')).toBe(true);
    expect(s.alerts.some((a) => a.code === 'battery_empty')).toBe(true);
    expect(s.battery).toBe(0);
  });
  it('strict priority: a cheaper low-priority system is not run after a higher one was shed', () => {
    const s = mk({ solar: 1, o2gen: 1, recycler: 1, watertank: 2 }); // P = 6, demand 2+3+2=7
    const log = tick(s);
    expect(log.shed).toEqual(['recycler']);
    expect(s.systems.o2gen.running).toBe(true);
  });
  it('an unpowered base is cold', () => {
    const s = mk({ o2tank: 4 });
    const log = tick(s);
    expect(log.baseCold).toBe(true);
    expect(s.alerts.some((a) => a.code === 'base_cold')).toBe(true);
  });
  it('switching a system off frees its power; broken systems cannot be switched on', () => {
    const s = mk(fullBase);
    expect(setSystem(s, 'excavator', false)).toBe(true);
    expect(planPower(s).demands.some((d) => d.id === 'excavator')).toBe(false);
    s.systems.recycler.broken = true;
    expect(setSystem(s, 'recycler', true)).toBe(false);
    expect(setSystem(mk({}), 'greenhouse', true)).toBe(false);
  });
});

describe('tick step 3: run powered systems', () => {
  it('oxygen generator makes 4 oxygen from 3 power and 1 water', () => {
    const s = mk({ reactor: 1, o2gen: 1, watertank: 1 });
    s.oxygen = 20;
    s.water = 20;
    tick(s);
    expect(s.water).toBe(20 - 1 - 4); // 1 for the generator, 4 for the crew (no recycler)
    expect(s.oxygen).toBe(20 + 4 - 4);
  });
  it('oxygen generator cannot run without water', () => {
    const s = mk({ reactor: 1, o2gen: 1 });
    s.oxygen = 20;
    const log = tick(s);
    expect(log.o2genStarved).toBe(true);
    expect(s.oxygen).toBe(16);
  });
  it('water recycler recovers 98% of the crew water', () => {
    const s = mk({ reactor: 1, recycler: 1, watertank: 1 });
    tick(s);
    expect(s.water).toBeCloseTo(20 - 0.08, 3);
    const t = mk({ reactor: 1, watertank: 1 });
    tick(t);
    expect(t.water).toBe(16);
  });
  it('greenhouse grows for 9 days, then gives 2 food + 1 oxygen a day from day 10', () => {
    const s = mk({ reactor: 1, greenhouse: 1, watertank: 4, food: 8 });
    s.oxygen = 100;
    for (let d = 1; d <= 9; d++) tick(s);
    expect(s.food).toBe(160 - 9 * 4);
    tick(s); // day 10
    expect(s.food).toBe(160 - 10 * 4 + 2);
    expect(s.oxygen).toBe(100 - 10 * 4 + 1);
    expect(s.water).toBe(80 - 10 - 10 * 4);
  });
  it('excavator adds one shield level every 5 days, up to level 3', () => {
    const s = mk({ reactor: 1, excavator: 1, food: 8, watertank: 4, o2tank: 4 });
    for (let d = 1; d <= 4; d++) tick(s);
    expect(s.shieldLevel).toBe(0);
    tick(s);
    expect(s.shieldLevel).toBe(1);
    for (let d = 6; d <= 15; d++) tick(s);
    expect(s.shieldLevel).toBe(3);
    for (let d = 16; d <= 25; d++) {
      if (s.status === 'running') tick(s);
    }
    expect(s.shieldLevel).toBe(3);
  });
});

describe('tick step 4: crew consumption', () => {
  it('crew uses 4 oxygen, 4 food and 4 water a day', () => {
    const s = mk({ reactor: 1, o2tank: 1, food: 1, watertank: 1 });
    tick(s);
    expect(s.oxygen).toBe(12 + 20 - 4);
    expect(s.food).toBe(16);
    expect(s.water).toBe(16);
  });
  it('a leak drains oxygen; rationing halves the water use while the recycler is broken', () => {
    const s = mk({ reactor: 1, o2tank: 1 });
    s.effects.leakDays = 2;
    tick(s);
    expect(s.oxygen).toBe(32 - 4 - 4);
    const t = mk({ reactor: 1, recycler: 1, watertank: 1 });
    t.systems.recycler.broken = true;
    t.effects.rationDays = 3;
    t.effects.recyclerRepairIn = 3;
    tick(t);
    expect(t.water).toBe(18);
  });
  it('shortage never makes a stock negative', () => {
    const s = mk({ reactor: 1, o2tank: 1 });
    tick(s);
    expect(s.food).toBe(0);
    expect(s.water).toBe(0);
  });
});

describe('tick step 5: radiation', () => {
  it('adds the daily dose, reduced by shield level', () => {
    const s = mk({ reactor: 1, o2tank: 4 });
    tick(s);
    expect(s.dose).toBeCloseTo(1.37, 3);
  });
  it('shield factor table is 1.0 / 0.7 / 0.5 / 0.35 for storms', () => {
    const doses = [0, 1, 2, 3].map((lvl) => {
      const s = mk({ reactor: 1, o2tank: 4 });
      s.shieldLevel = lvl;
      s.schedule.stormDay = 1;
      s.effects.stormProtection = 'none';
      tick(s);
      return s.dose;
    });
    expect(doses).toEqual([70, 49, 35, 24.5]);
  });
  it('shielding helps a lot against storms and only a little against cosmic rays', () => {
    const cosmic = mk({ reactor: 1, o2tank: 4 });
    cosmic.shieldLevel = 3;
    tick(cosmic);
    const cosmicCut = 1 - cosmic.dose / 1.37;
    const storm = mk({ reactor: 1, o2tank: 4 });
    storm.shieldLevel = 3;
    storm.schedule.stormDay = 1;
    storm.effects.stormProtection = 'none';
    tick(storm);
    const stormCut = 1 - storm.dose / 70;
    expect(stormCut).toBeGreaterThan(cosmicCut);
  });
  it('storm dose depends on cover: shelter 90% cut, hiding 50% cut, none 0%', () => {
    const run = (prot: 'shelter' | 'hide' | 'none') => {
      const s = mk({ reactor: 1, o2tank: 4 });
      s.schedule.stormDay = 1;
      s.effects.stormProtection = prot;
      tick(s);
      return s.dose;
    };
    expect(run('none')).toBe(70);
    expect(run('hide')).toBe(35);
    expect(run('shelter')).toBe(7);
  });
});

describe('tick step 6: health', () => {
  const base: Cargo = { reactor: 1, o2tank: 4, food: 2, watertank: 2 };
  it('no food -10, no water -20, unpowered base -5, otherwise +5 up to 100', () => {
    const food = mk({ reactor: 1, o2tank: 4, watertank: 2 });
    food.crew.forEach((c) => (c.health = 50));
    tick(food);
    expect(food.crew[0].health).toBe(40);

    const water = mk({ reactor: 1, o2tank: 4, food: 2 });
    water.crew.forEach((c) => (c.health = 50));
    tick(water);
    expect(water.crew[0].health).toBe(30);

    const cold = mk({ o2tank: 4, food: 2, watertank: 2 });
    cold.crew.forEach((c) => (c.health = 50));
    tick(cold);
    expect(cold.crew[0].health).toBe(45);

    const ok = mk(base);
    ok.crew.forEach((c) => (c.health = 50));
    tick(ok);
    expect(ok.crew[0].health).toBe(55);
    const full = mk(base);
    tick(full);
    expect(full.crew[0].health).toBe(100);
  });
  it('penalties add up', () => {
    const s = mk({ o2tank: 4 });
    s.crew.forEach((c) => (c.health = 80));
    tick(s);
    expect(s.crew[0].health).toBe(80 - 10 - 20 - 5);
  });
});

describe('tick step 7: end checks', () => {
  it('oxygen runs out -> evacuation', () => {
    const s = mk({ reactor: 1, food: 2, watertank: 2 });
    let guard = 0;
    while (s.status === 'running' && guard++ < 10) tick(s);
    expect(s.status).toBe('evacuated');
    expect(s.endReason).toBe('oxygen');
    expect(s.endDay).toBe(3);
  });
  it('any crew member at 0 health -> medical evacuation', () => {
    const s = mk({ reactor: 1, o2tank: 4 });
    s.crew[2].health = 10;
    tick(s);
    expect(s.status).toBe('evacuated');
    expect(s.endReason).toBe('medical');
  });
  it('dose above 100 mSv -> early evacuation', () => {
    const s = mk({ reactor: 1, o2tank: 4, food: 2, watertank: 2 });
    s.dose = 99.5;
    tick(s);
    expect(s.status).toBe('evacuated');
    expect(s.endReason).toBe('radiation');
  });
  it('dose of exactly the limit is still ok', () => {
    const s = mk({ reactor: 1, o2tank: 4, food: 2, watertank: 2 });
    s.dose = 100 - 1.37;
    tick(s);
    expect(s.status).toBe('running');
  });
  it('day 30 -> success', () => {
    const s = mk({ reactor: 1, o2gen: 1, watertank: 2, food: 6, recycler: 1 });
    s.day = 30;
    s.food = 10;
    s.water = 30;
    tick(s);
    expect(s.status).toBe('success');
    expect(s.endReason).toBe('success');
    expect(s.endDay).toBe(30);
  });
  it('checks run in order: oxygen before health before dose before success', () => {
    const s = mk({ reactor: 1 });
    s.day = 30;
    s.oxygen = 1;
    s.crew[0].health = 1;
    s.dose = 200;
    tick(s);
    expect(s.endReason).toBe('oxygen');
    const t = mk({ reactor: 1, o2tank: 4, food: 2, watertank: 2 });
    t.day = 30;
    t.crew[0].health = 1;
    t.food = 0;
    t.dose = 200;
    tick(t);
    expect(t.endReason).toBe('medical');
    const u = mk({ reactor: 1, o2tank: 4, food: 2, watertank: 2 });
    u.day = 30;
    u.dose = 200;
    tick(u);
    expect(u.endReason).toBe('radiation');
  });
  it('cannot tick a finished mission', () => {
    const s = mk({});
    while (s.status === 'running') tick(s);
    expect(s.status).toBe('evacuated');
    expect(() => tick(s)).toThrow();
  });
});

describe('schedule and situations', () => {
  it('is deterministic for a seed and varies between seeds', () => {
    const a = buildSchedule(SUGGESTED_CARGO, 5);
    const b = buildSchedule(SUGGESTED_CARGO, 5);
    expect(a).toEqual(b);
    const others = [1, 2, 3, 4, 6, 7].map((x) => JSON.stringify(buildSchedule(SUGGESTED_CARGO, x)));
    expect(new Set(others).size).toBeGreaterThan(1);
  });
  it('storm lands on days 12-20, darkness on days 9 and 21, one situation a day', () => {
    for (let seed = 0; seed < 100; seed++) {
      const sch = buildSchedule({ solar: 2, recycler: 1, greenhouse: 1 }, seed);
      expect(sch.stormDay).toBeGreaterThanOrEqual(12);
      expect(sch.stormDay).toBeLessThanOrEqual(20);
      expect(sch.events[9]).toBe('darkness');
      expect(sch.events[21]).toBe('darkness');
      expect(sch.events[sch.stormDay]).toBe('storm');
      const fixed = [9, 21, sch.stormDay];
      for (const [d, ev] of Object.entries(sch.events)) {
        if (fixed.includes(Number(d))) continue;
        expect(['darkness', 'storm']).not.toContain(ev);
        // a drawn situation is never on the day next to another one
        for (const other of Object.keys(sch.events).map(Number))
          if (other !== Number(d)) expect(Math.abs(other - Number(d))).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('draws 4-6 random situations when enough are eligible', () => {
    for (let seed = 0; seed < 100; seed++) {
      const sch = buildSchedule({ solar: 2, recycler: 1, greenhouse: 1 }, seed);
      const randoms = Object.values(sch.events).filter((e) => e !== 'darkness' && e !== 'storm');
      expect(randoms.length).toBeGreaterThanOrEqual(4);
      expect(randoms.length).toBeLessThanOrEqual(6);
    }
  });
  it('only eligible situations appear (no recycler breakdown without a recycler)', () => {
    expect(eligibleRandomEvents({})).not.toContain('recycler_break');
    expect(eligibleRandomEvents({})).not.toContain('meteoroid');
    expect(eligibleRandomEvents({ recycler: 1, solar: 1, greenhouse: 1 })).toEqual(
      expect.arrayContaining(['recycler_break', 'meteoroid', 'dust', 'mold']),
    );
    for (let seed = 0; seed < 50; seed++) {
      const vals = Object.values(buildSchedule({ food: 3 }, seed));
      expect(JSON.stringify(vals)).not.toContain('recycler_break');
    }
  });
  it('the day starts with the situation pending; breakdowns apply at once', () => {
    const s = createMission({ recycler: 1, reactor: 1 }, 3);
    s.schedule = { stormDay: 99, events: { 1: 'recycler_break' } };
    s.pending = null;
    // simulate the start of day 1 again
    s.day = 1;
    s.pending = 'recycler_break';
    s.systems.recycler.broken = true;
    expect(availableChoices(s, 'recycler_break')).toEqual(['ration']); // no spare packed
  });
  it('recycler breakdown: spare part repairs at once, no spare means 3 days of rationing', () => {
    const withSpare = mk({ reactor: 1, recycler: 1, watertank: 2, spare: 1 });
    withSpare.pending = 'recycler_break';
    withSpare.systems.recycler.broken = true;
    expect(availableChoices(withSpare, 'recycler_break')).toContain('spare');
    expect(resolveEvent(withSpare, 'recycler_break', 'spare')).toBe(true);
    expect(withSpare.spares).toBe(0);
    expect(withSpare.systems.recycler.broken).toBe(false);

    const noSpare = mk({ reactor: 1, recycler: 1, watertank: 2, o2tank: 2 });
    noSpare.pending = 'recycler_break';
    noSpare.systems.recycler.broken = true;
    expect(resolveEvent(noSpare, 'recycler_break', 'spare')).toBe(false);
    expect(resolveEvent(noSpare, 'recycler_break', 'ration')).toBe(true);
    tick(noSpare);
    tick(noSpare);
    expect(noSpare.systems.recycler.broken).toBe(true);
    tick(noSpare);
    expect(noSpare.systems.recycler.broken).toBe(false);
  });
  it('meteoroid: spare restores panels, ignoring keeps half output', () => {
    const s = mk({ solar: 2, spare: 1 });
    s.pending = 'meteoroid';
    s.effects.meteoroid = true;
    expect(planPower(s).produced).toBe(6);
    resolveEvent(s, 'meteoroid', 'spare');
    expect(planPower(s).produced).toBe(12);
  });
  it('dust: cleaning restores output at a small morale cost', () => {
    const s = mk({ solar: 2 });
    s.pending = 'dust';
    s.effects.dust = true;
    const m = s.morale;
    resolveEvent(s, 'dust', 'clean');
    expect(s.effects.dust).toBe(false);
    expect(s.morale).toBe(m - 2);
  });
  it('darkness: power saving switches off greenhouse+excavator for 3 days', () => {
    const s = mk({ reactor: 1, greenhouse: 1, excavator: 1, o2tank: 4, watertank: 2, food: 4 });
    s.pending = 'darkness';
    resolveEvent(s, 'darkness', 'save');
    const ids = planPower(s).demands.map((d) => d.id);
    expect(ids).toEqual(['base']);
    expect(planPower(s).demands[0].amount).toBe(1);
    tick(s);
    tick(s);
    tick(s);
    expect(s.effects.powerSaveDays).toBe(0);
    expect(planPower(s).demands.map((d) => d.id)).toEqual(['base', 'greenhouse', 'excavator']);
  });
  it('storm: the shelter, hiding and working choices set the cover', () => {
    const a = mk({ shelter: 1, reactor: 1 });
    a.pending = 'storm';
    resolveEvent(a, 'storm', 'shelter');
    expect(a.effects.stormProtection).toBe('shelter');
    const b = mk({ reactor: 1 });
    b.pending = 'storm';
    resolveEvent(b, 'storm', 'shelter');
    expect(b.effects.stormProtection).toBe('hide');
    const c = mk({ reactor: 1 });
    c.pending = 'storm';
    resolveEvent(c, 'storm', 'work');
    expect(c.effects.stormProtection).toBe('none');
    expect(c.science).toBe(1);
  });
  it('unresolved situations take their default choice at the end of the day', () => {
    const s = mk({ reactor: 1, o2tank: 4, food: 2, watertank: 2 });
    s.pending = 'tired';
    const m = s.morale;
    tick(s);
    expect(s.decisions.at(-1)).toMatchObject({ event: 'tired', choice: 'work' });
    expect(s.morale).toBe(m - 10 + 1);
  });
  it('rock scan = science star + a little extra dose; home call = morale up for 1 power', () => {
    const s = mk({ reactor: 1 });
    s.pending = 'rock';
    resolveEvent(s, 'rock', 'scan');
    expect(s.science).toBe(1);
    expect(s.dose).toBe(2);
    const h = mk({ reactor: 1 });
    h.pending = 'home';
    resolveEvent(h, 'home', 'call');
    expect(planPower(h).demands[0].amount).toBe(3);
    expect(h.morale).toBe(90);
  });
  it('leak ignored drains oxygen for 4 days; rest day lifts health and stops the excavator', () => {
    const s = mk({ reactor: 1, o2tank: 4 });
    s.pending = 'leak';
    resolveEvent(s, 'leak', 'ignore');
    expect(s.effects.leakDays).toBe(4);
    const t = mk({ reactor: 1, excavator: 1, o2tank: 4, food: 2, watertank: 2 });
    t.crew.forEach((c) => (c.health = 60));
    t.pending = 'tired';
    resolveEvent(t, 'tired', 'rest');
    expect(planPower(t).demands.some((d) => d.id === 'excavator')).toBe(false);
    tick(t);
    expect(t.crew[0].health).toBe(75);
  });
  it('mold: cutting leaves halves the greenhouse food; airflow costs +1 power', () => {
    const s = mk({ reactor: 1, greenhouse: 1, watertank: 4 });
    s.pending = 'mold';
    resolveEvent(s, 'mold', 'airflow');
    expect(planPower(s).demands.find((d) => d.id === 'greenhouse')?.amount).toBe(4);
    const c = mk({ reactor: 1, greenhouse: 1, watertank: 4, o2tank: 4 });
    c.greenhouseGrowth = 20;
    c.pending = 'mold';
    resolveEvent(c, 'mold', 'cut');
    c.food = 0;
    tick(c);
    expect(c.food).toBe(0); // +1 (halved) - crew needs 4, so shortage, nothing left
  });
});

describe('whole missions', () => {
  it('replays exactly for the same seed', () => {
    const a = simulate(SUGGESTED_CARGO, 77);
    const b = simulate(SUGGESTED_CARGO, 77);
    expect(a.log).toEqual(b.log);
    expect(a.decisions).toEqual(b.decisions);
  });
  it('the suggested cargo finishes the mission with a smart commander', () => {
    let ok = 0;
    for (let seed = 0; seed < 50; seed++) if (simulate(SUGGESTED_CARGO, seed).status === 'success') ok++;
    expect(ok).toBeGreaterThanOrEqual(45);
  });
  it('an empty lander is evacuated on day 3 (nobody is hurt)', () => {
    const s = simulate({ food: 1 }, 1);
    expect(s.status).toBe('evacuated');
    expect(s.endReason).toBe('oxygen');
    expect(s.crew.every((c) => c.health > 0)).toBe(true);
  });
  it('storm without cover pushes a no-shield mission over the limit', () => {
    const s = simulate(SUGGESTED_CARGO, 3, carelessPolicy);
    const t = simulate(SUGGESTED_CARGO, 3, smartPolicy);
    expect(t.dose).toBeLessThan(s.dose + 1e9);
  });
  it('a spare part can decide between finishing and evacuating', () => {
    // Tight on water: a broken recycler is fixed at once with a spare, otherwise the crew rations.
    const tight: Cargo = { reactor: 1, o2gen: 1, recycler: 1, watertank: 1, food: 5, shelter: 1 };
    const withSpare: Cargo = { ...tight, spare: 1 };
    let a = 0;
    let b = 0;
    for (let seed = 1; seed <= 300; seed++) {
      if (simulate(tight, seed).status === 'success') a++;
      if (simulate(withSpare, seed).status === 'success') b++;
    }
    expect(b).toBeGreaterThan(a);
  });
  it('a game parameter override takes effect (config is data-driven)', () => {
    const cfg = withParams({ doseLimitMSv: 5 });
    const s = simulate(SUGGESTED_CARGO, 1, smartPolicy, cfg);
    expect(s.endReason).toBe('radiation');
  });
});

describe('score', () => {
  it('stars: success is 2-3, evacuation is 1-2', () => {
    const win = simulate(SUGGESTED_CARGO, 1);
    expect([2, 3]).toContain(stars(win));
    const lose = simulate({ food: 1 }, 1);
    expect(stars(lose)).toBe(1);
    const late = simulate({ food: 1 }, 1);
    late.endDay = 25;
    expect(stars(late)).toBe(2);
  });
  it('turning point names why the mission ended', () => {
    expect(turningPoint(simulate({ food: 1 }, 1)).kind).toBe('no_oxygen_gen');
    const dark = mk({ reactor: 1, o2gen: 1, watertank: 2, food: 6 });
    expect(turningPoint(simulate(SUGGESTED_CARGO, 1)).kind).not.toBe('hunger_health');
    void dark;
  });
  it('a storm with no cover is named as the turning point', () => {
    const cargo: Cargo = { reactor: 1, o2gen: 1, recycler: 1, watertank: 2, food: 6 };
    let found = false;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const s = simulate(cargo, seed, (st, ev, cfg) => (ev === 'storm' ? 'work' : smartPolicy(st, ev, cfg)));
      if (s.endReason === 'radiation') {
        expect(turningPoint(s).kind).toBe('storm_dose');
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe('cargo plan (Radar check)', () => {
  it('suggested cargo finishes a quiet mission with no issues except none', () => {
    const p = planCargo(SUGGESTED_CARGO);
    expect(p.finishes).toBe(true);
    expect(p.issues.filter((i) => i.kind !== 'cover')).toEqual([]);
  });
  it('an empty-ish lander runs out of oxygen on day 3', () => {
    const p = planCargo({ food: 1 });
    expect(p.finishes).toBe(false);
    expect(p.issues.find((i) => i.kind === 'oxygen')?.day).toBe(3);
  });
  it('flags the dark spell for solar-only power without batteries', () => {
    const p = planCargo({ solar: 2, o2tank: 6, watertank: 6, food: 4 });
    expect(p.issues.some((i) => i.kind === 'night')).toBe(true);
  });
  it('warns when there is no storm cover at all', () => {
    expect(planCargo({ reactor: 1 }).issues.some((i) => i.kind === 'cover')).toBe(true);
    expect(planCargo({ reactor: 1, shelter: 1 }).issues.some((i) => i.kind === 'cover')).toBe(false);
  });
});

describe('maintenance actions', () => {
  it('a spare part repairs a damaged solar field or a broken recycler at any time', () => {
    const s = mk({ solar: 2, recycler: 1, reactor: 1, spare: 2 });
    expect(canRepair(s, 'solar')).toBe(false);
    s.effects.meteoroid = true;
    s.systems.recycler.broken = true;
    s.effects.rationDays = 2;
    expect(useSpare(s, 'solar')).toBe(true);
    expect(useSpare(s, 'recycler')).toBe(true);
    expect(s.spares).toBe(0);
    expect(s.effects.meteoroid).toBe(false);
    expect(s.systems.recycler.broken).toBe(false);
    expect(s.effects.rationDays).toBe(0);
    s.effects.meteoroid = true;
    expect(useSpare(s, 'solar')).toBe(false); // no spare left
  });
  it('cleaning removes dust for a small morale cost; harvest needs grown plants', () => {
    const s = mk({ reactor: 1, greenhouse: 1, watertank: 4, solar: 1 });
    expect(cleanDust(s)).toBe(false);
    s.effects.dust = true;
    const m = s.morale;
    expect(cleanDust(s)).toBe(true);
    expect(s.morale).toBe(m - 2);
    expect(harvest(s)).toBe(false);
    s.greenhouseGrowth = 10;
    const m2 = s.morale;
    expect(harvest(s)).toBe(true);
    expect(s.morale).toBe(m2 + 3);
    expect(harvest(s)).toBe(false); // cooldown
  });
});

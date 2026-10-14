import { CONFIG } from '../engine/config';
import {
  availableChoices,
  canRepair,
  cleanDust,
  harvest,
  resolveEvent,
  setSystem,
  sunFactor,
  useSpare,
} from '../engine/mission';
import { makeRng } from '../engine/rng';
import { stopGame } from './runtime';
import { stars } from '../engine/score';
import { tick } from '../engine/tick';
import type { EventId, MissionState, SystemId } from '../engine/types';
import {
  getState,
  isPaused,
  persist,
  pushToast,
  setState,
  touchMission,
  type ModuleId,
  type TaskInfo,
} from '../ui/store';
import {
  HIDE_SPOT,
  LEAK_SPOTS,
  ROCK_SPOTS,
  frontPoint,
  modulesFor,
  moduleById,
} from './layout';

/** Shared input state: keyboard, touch joystick and the action button all feed this. */
export const input = { joyX: 0, joyY: 0, actionHeld: false };

export interface TaskRuntime {
  event: EventId;
  choice: string;
  labelKey: string;
  x: number;
  y: number;
  r: number;
  holdSec: number;
  held: number;
  kind: 'module' | 'leak' | 'rock';
  module?: ModuleId;
}

export interface StormRuntime {
  remaining: number;
  total: number;
  x: number;
  y: number;
  r: number;
  shelter: boolean;
}

/** What the Phaser scene needs to draw. Updated in place every frame. */
export const view: {
  task: TaskRuntime | null;
  storm: StormRuntime | null;
  dark: boolean;
  stormHit: number;
} = { task: null, storm: null, dark: false, stormHit: 0 };

const HANDS: Partial<Record<EventId, Record<string, { hold: number; kind: TaskRuntime['kind']; module?: ModuleId; label: string }>>> = {
  recycler_break: { spare: { hold: 0.8, kind: 'module', module: 'recycler', label: 'task.repair' } },
  meteoroid: { spare: { hold: 0.8, kind: 'module', module: 'solar', label: 'task.repair' } },
  dust: { clean: { hold: 3, kind: 'module', module: 'solar', label: 'task.clean' } },
  leak: { patch: { hold: 1.5, kind: 'leak', label: 'task.patch' } },
  rock: { scan: { hold: 2, kind: 'rock', label: 'task.scan' } },
};

/** Dev-only hooks so tests and screenshots can move the player and zoom out. */
export const debug: { teleport?: (x: number, y: number) => void; overview?: () => void } = {};

const ANNOUNCE_AT = 2;

/** 1 mission day = 20 s by default. ?daysec=5 in the address makes days shorter (for testing). */
export function secondsPerDay(): number {
  try {
    const v = Number(new URLSearchParams(window.location.search).get('daysec'));
    if (v >= 1 && v <= 120) return v;
  } catch {
    /* ignore */
  }
  return CONFIG.params.secondsPerDay;
}
let dayTime = 0;
let announced = false;
let uiTimer = 0;
let pressTime = 0;
let player = { x: 0, y: 0 };
let endingTimer: ReturnType<typeof setTimeout> | null = null;

const mission = (): MissionState => getState().mission!;

export function resetController(): void {
  dayTime = 0;
  announced = false;
  view.task = null;
  view.storm = null;
  view.stormHit = 0;
  if (endingTimer) clearTimeout(endingTimer);
  endingTimer = null;
  onDayStart();
}

export function onLanded(): void {
  setState({ landing: false });
  const m = mission();
  setState({ radar: { key: 'radar.landed' } });
  void m;
}

function onDayStart(): void {
  const m = getState().mission;
  if (!m) return;
  dayTime = 0;
  announced = false;
  view.dark = sunFactor(m.day) === 0;
  const prevDark = m.day > 1 && sunFactor(m.day - 1) === 0;
  if (view.dark && !prevDark) {
    pushToast({ tone: 'warn', key: 'toast.sunset' });
    setState({ radar: { key: 'radar.dark' } });
  } else if (!view.dark && prevDark) {
    pushToast({ tone: 'good', key: 'toast.sunrise' });
  }
  setState({ dayProgress: 0 });
}

export function nearbyModule(px: number, py: number): ModuleId | null {
  const m = getState().mission;
  if (!m) return null;
  let best: ModuleId | null = null;
  let bestD = Infinity;
  for (const mod of modulesFor(m.cargo)) {
    const f = frontPoint(mod);
    const d = Math.hypot(px - f.x, py - f.y);
    if (d < mod.reach && d < bestD) {
      best = mod.id;
      bestD = d;
    }
  }
  return best;
}

/** Called by the scene every frame. dt in seconds. */
export function update(dt: number, px: number, py: number): void {
  const s = getState();
  const m = s.mission;
  if (!m || s.screen !== 'play') return;
  player = { x: px, y: py };
  dt = Math.min(dt, 0.1);

  const near = nearbyModule(px, py);
  if (near !== s.nearby) setState({ nearby: near });
  if (isPaused(s) || m.status !== 'running') return;

  const spd = secondsPerDay();

  // the day's situation is announced a moment after the day begins
  if (m.pending && !announced && dayTime >= Math.min(ANNOUNCE_AT, spd * 0.2) && !view.storm && !view.task) {
    announced = true;
    openCard(m.pending);
    return;
  }

  // storm countdown: the day clock waits while it runs
  if (view.storm) {
    const st = view.storm;
    st.remaining -= dt;
    if (Math.hypot(px - st.x, py - st.y) < st.r) {
      finishStorm(true);
    } else if (st.remaining <= 0) {
      finishStorm(false);
    }
    uiTimer += dt;
    if (uiTimer > 0.1) {
      uiTimer = 0;
      if (view.storm) setState({ storm: { remaining: Math.max(0, view.storm.remaining), total: view.storm.total } });
    }
    return;
  }

  // hands-on task: hold the action button near the target
  const t = view.task;
  if (t) {
    const d = Math.hypot(px - t.x, py - t.y);
    const closeEnough = d < t.r;
    if (input.actionHeld && closeEnough) t.held += dt;
    else t.held = Math.max(0, t.held - dt * 1.5);
    const hint: TaskInfo['hint'] = t.kind === 'leak' ? (d < 130 ? 'hot' : d < 320 ? 'warm' : 'cold') : undefined;
    uiTimer += dt;
    if (uiTimer > 0.06) {
      uiTimer = 0;
      setState({
        task: { event: t.event, choice: t.choice, labelKey: t.labelKey, progress: Math.min(1, t.held / t.holdSec), hint },
      });
    }
    if (t.held >= t.holdSec) {
      completeTask(t);
      return;
    }
  }

  dayTime += dt;
  uiTimer += dt;
  if (!t && uiTimer > 0.1) {
    uiTimer = 0;
    setState({ dayProgress: Math.min(1, dayTime / spd) });
  } else if (t) {
    setState({ dayProgress: Math.min(1, dayTime / spd) });
  }
  if (dayTime >= spd) endDay();
}

// --- cards and choices ---------------------------------------------------------------

function openCard(ev: EventId): void {
  setState({ overlay: { kind: 'card', event: ev, phase: 'ask' } });
}

export function closeCard(): void {
  setState({ overlay: null });
}

/** The kid picked an answer on the situation card. */
export function chooseCard(choice: string): void {
  const s = getState();
  const m = s.mission;
  const ov = s.overlay;
  if (!m || !ov || ov.kind !== 'card' || ov.phase !== 'ask') return;
  const ev = ov.event;
  if (!availableChoices(m, ev, CONFIG).includes(choice)) return;

  const hands = HANDS[ev]?.[choice];
  if (hands) {
    // walk to it first; the card comes back with the result when it is done
    const mod = hands.module ? moduleById(hands.module) : null;
    let x = 0;
    let y = 0;
    let r = 60;
    if (mod) {
      const f = frontPoint(mod);
      x = f.x;
      y = f.y;
      r = mod.reach * 0.75;
    } else if (hands.kind === 'leak') {
      const rng = makeRng(m.seed * 31 + m.day);
      const p = rng.pick(LEAK_SPOTS);
      x = p.x;
      y = p.y;
      r = 46;
    } else {
      const rng = makeRng(m.seed * 17 + m.day);
      const p = rng.pick(ROCK_SPOTS);
      x = p.x;
      y = p.y + 20;
      r = 70;
    }
    view.task = { event: ev, choice, labelKey: hands.label, x, y, r, holdSec: hands.hold, held: 0, kind: hands.kind, module: hands.module };
    setState({
      overlay: null,
      task: { event: ev, choice, labelKey: hands.label, progress: 0 },
      radar: { key: `radar.task.${ev}` },
    });
    return;
  }

  if (ev === 'storm' && choice === 'shelter') {
    startStorm();
    setState({ overlay: null });
    return;
  }
  resolveWithResult(ev, choice);
}

function startStorm(): void {
  const m = mission();
  const hasShelter = (m.cargo.shelter ?? 0) > 0;
  let x: number = HIDE_SPOT.x;
  let y: number = HIDE_SPOT.y;
  let r: number = HIDE_SPOT.r;
  if (hasShelter) {
    const mod = moduleById('shelter');
    const f = frontPoint(mod);
    x = f.x;
    y = f.y - 10;
    r = 90;
  }
  const total = CONFIG.params.stormCountdownSeconds;
  view.storm = { remaining: total, total, x, y, r, shelter: hasShelter };
  setState({ storm: { remaining: total, total }, radar: { key: hasShelter ? 'radar.storm.shelter' : 'radar.storm.hide' } });
}

function finishStorm(made: boolean): void {
  const st = view.storm;
  view.storm = null;
  view.stormHit = made ? 0 : 1;
  setState({ storm: null });
  resolveWithResult('storm', made ? 'shelter' : 'late');
  void st;
}

function completeTask(t: TaskRuntime): void {
  view.task = null;
  setState({ task: null });
  resolveWithResult(t.event, t.choice);
}

/** Apply the choice in the engine, then show what happened plus a "Did you know?" fact. */
function resolveWithResult(ev: EventId, choice: string): void {
  const m = mission();
  const ok = resolveEvent(m, ev, choice, CONFIG);
  touchMission();
  view.task = null;
  setState({
    task: null,
    overlay: { kind: 'card', event: ev, phase: 'result', choice: ok ? choice : 'ration' },
  });
}

// --- the day ---------------------------------------------------------------------------

export function canSkip(): boolean {
  const s = getState();
  const m = s.mission;
  return !!m && m.status === 'running' && !m.pending && !view.task && !view.storm && !isPaused(s);
}

export function skipDay(): void {
  if (canSkip()) endDay();
}

function endDay(): void {
  const m = mission();
  const wasPending = m.pending;
  const prevDay = m.day;
  view.task = null;
  setState({ task: null });
  const log = tick(m, CONFIG);
  touchMission();
  for (const code of log.alerts) {
    const sys = m.alerts.filter((a) => a.day === prevDay && a.code === code).map((a) => a.system);
    if (code === 'shutdown') {
      for (const sy of sys) if (sy) pushToast({ tone: 'warn', key: `alert.shutdown.${sy}` });
    } else if (code !== 'battery_empty') {
      pushToast({ tone: 'warn', key: `alert.${code}` });
    } else {
      setState({ radar: { key: 'radar.batteryEmpty' } });
    }
  }
  if (m.status !== 'running') {
    finishMission();
    return;
  }
  onDayStart();
  if (wasPending) {
    const d = [...m.decisions].reverse().find((x) => x.day === prevDay && x.event === wasPending);
    setState({
      overlay: { kind: 'card', event: wasPending, phase: 'result', choice: d?.choice ?? 'ignore', text: 'timeout' },
    });
  }
}

function finishMission(): void {
  const m = mission();
  const st = stars(m, CONFIG);
  const prev = getState().best;
  const result = { stars: st, success: m.status === 'success', day: m.endDay ?? m.day };
  if (!prev || result.stars > prev.stars || (result.stars === prev.stars && result.success && !prev.success)) {
    setState({ best: result });
    persist();
  }
  setState({ overlay: { kind: 'ending' }, task: null, storm: null });
}

export function showReport(): void {
  stopGame();
  setState({ overlay: null, screen: 'report' });
}

// --- module actions (from the panel) --------------------------------------------------------

export function openModule(id: ModuleId): void {
  setState({ overlay: { kind: 'module', id } });
}

export function toggleSystem(id: SystemId): void {
  const m = mission();
  const sys = m.systems[id];
  if (!sys.present) return;
  if (!sys.on && sys.broken) {
    pushToast({ tone: 'warn', key: 'toast.isBroken' });
    return;
  }
  setSystem(m, id, !sys.on);
  touchMission();
}

export function repairWithSpare(target: 'solar' | 'recycler'): void {
  const m = mission();
  if (!canRepair(m, target)) return;
  // if the situation is still open, answer it properly so the engine records the choice
  const ev: EventId = target === 'solar' ? 'meteoroid' : 'recycler_break';
  if (m.pending === ev) {
    view.task = null;
    resolveWithResult(ev, 'spare');
    return;
  }
  useSpare(m, target);
  touchMission();
  pushToast({ tone: 'good', key: 'toast.repaired' });
}

export function cleanPanels(): void {
  const m = mission();
  if (m.pending === 'dust') {
    resolveWithResult('dust', 'clean');
    return;
  }
  if (cleanDust(m, CONFIG)) {
    touchMission();
    pushToast({ tone: 'good', key: 'toast.cleaned' });
  }
}

export function harvestPlants(): void {
  const m = mission();
  if (harvest(m, CONFIG)) {
    touchMission();
    pushToast({ tone: 'good', key: 'toast.harvested' });
  }
}

// --- action button (keyboard E / Space or the on-screen button) ----------------------------------

export function actionDown(): void {
  input.actionHeld = true;
  pressTime = performance.now();
}

/** A quick tap opens the nearby module's panel; holding is for hands-on tasks. */
export function actionUp(): void {
  const wasHeld = input.actionHeld;
  input.actionHeld = false;
  if (!wasHeld) return;
  const s = getState();
  if (isPaused(s) || s.mission?.status !== 'running') return;
  const tapped = performance.now() - pressTime < 280;
  if (tapped && !view.storm) {
    const near = nearbyModule(player.x, player.y);
    if (near) openModule(near);
  }
}

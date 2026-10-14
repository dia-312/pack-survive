import { useSyncExternalStore } from 'react';
import { SUGGESTED_CARGO } from '../engine/cargo';
import type { Cargo, EventId, MissionState } from '../engine/types';
import type { Lang } from '../i18n';

export type Screen = 'start' | 'briefing' | 'pack' | 'play' | 'report';
export type ModuleId =
  | 'habitat'
  | 'solar'
  | 'battery'
  | 'reactor'
  | 'o2gen'
  | 'recycler'
  | 'greenhouse'
  | 'shelter'
  | 'excavator'
  | 'cargo';

export type Overlay =
  | { kind: 'module'; id: ModuleId }
  | { kind: 'card'; event: EventId; phase: 'ask' | 'result'; choice?: string; text?: string }
  | { kind: 'menu' };

export interface Toast {
  id: number;
  tone: 'info' | 'warn' | 'good';
  key: string;
  vars?: Record<string, string | number>;
}

export interface TaskInfo {
  event: EventId;
  choice: string;
  labelKey: string;
  /** 0..1 while the player holds the button */
  progress: number;
  /** leak search: how close the player is */
  hint?: 'hot' | 'warm' | 'cold';
}

export interface Best {
  stars: number;
  success: boolean;
  day: number;
}

export interface UIState {
  screen: Screen;
  lang: Lang;
  scientist: boolean;
  easy: boolean;
  cargo: Cargo;
  lastCargo: Cargo | null;
  seed: number;
  mission: MissionState | null;
  rev: number;
  overlay: Overlay | null;
  task: TaskInfo | null;
  storm: { remaining: number; total: number } | null;
  dayProgress: number;
  toasts: Toast[];
  nearby: ModuleId | null;
  landing: boolean;
  radar: { key: string; vars?: Record<string, string | number> } | null;
  best: Best | null;
  answers: [string, string, string];
}

const KEY = 'pack-survive:v1';

function loadPersisted(): Partial<UIState> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<UIState>) : {};
  } catch {
    return {};
  }
}

export function persist(): void {
  try {
    const { lang, scientist, easy, lastCargo, best } = state;
    localStorage.setItem(KEY, JSON.stringify({ lang, scientist, easy, lastCargo, best }));
  } catch {
    /* private window or blocked storage: the game still works */
  }
}

function initialLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

const saved = loadPersisted();
let state: UIState = {
  screen: 'start',
  lang: saved.lang ?? initialLang(),
  scientist: saved.scientist ?? false,
  easy: saved.easy ?? true,
  cargo: {},
  lastCargo: saved.lastCargo ?? null,
  seed: 1,
  mission: null,
  rev: 0,
  overlay: null,
  task: null,
  storm: null,
  dayProgress: 0,
  toasts: [],
  nearby: null,
  landing: false,
  radar: null,
  best: saved.best ?? null,
  answers: ['', '', ''],
};

const listeners = new Set<() => void>();
export const getState = (): UIState => state;
export function setState(patch: Partial<UIState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
/** The mission object is mutated in place by the engine; bump rev so React re-renders. */
export function touchMission(): void {
  setState({ rev: state.rev + 1 });
}
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function useStore<T>(selector: (s: UIState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export const isPaused = (s: UIState = state): boolean =>
  s.screen !== 'play' || s.overlay !== null || s.landing;

let toastId = 1;
export function pushToast(t: Omit<Toast, 'id'>): void {
  const id = toastId++;
  setState({ toasts: [...state.toasts.slice(-3), { ...t, id }] });
  setTimeout(() => setState({ toasts: state.toasts.filter((x) => x.id !== id) }), 5200);
}

export { SUGGESTED_CARGO };

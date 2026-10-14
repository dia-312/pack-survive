import paramsJson from '../data/params.json';
import itemsJson from '../data/items.json';
import eventsJson from '../data/events.json';
import type { Config, Difficulty, EventDef, EventId, ItemDef, ItemId, Params } from './types';

export function buildConfig(): Config {
  const items = {} as Record<ItemId, ItemDef>;
  for (const it of itemsJson.items) items[it.id as ItemId] = it as ItemDef;
  const events = {} as Record<EventId, EventDef>;
  for (const ev of eventsJson.events) events[ev.id as EventId] = ev as EventDef;
  return { difficulty: 'normal', params: paramsJson as unknown as Params, items, events };
}

/** The "normal" (challenge) rules exactly as in params.json. */
export const CONFIG: Config = buildConfig();

function deepMerge<T>(base: T, over: unknown): T {
  if (over === null || typeof over !== 'object' || Array.isArray(over)) return over as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

const cache: Partial<Record<Difficulty, Config>> = {};

/** Rules for a difficulty: params.json plus its "difficulty.<name>" overrides. */
export function configFor(d: Difficulty): Config {
  const hit = cache[d];
  if (hit) return hit;
  const overrides = (paramsJson as unknown as { difficulty?: Record<string, unknown> }).difficulty?.[d] ?? {};
  const cfg: Config = { ...CONFIG, difficulty: d, params: deepMerge(CONFIG.params, overrides) };
  cache[d] = cfg;
  return cfg;
}

/** Deep-ish copy of the config with parameter overrides (used by tests and tuning). */
export function withParams(overrides: Partial<Params>, base: Config = CONFIG): Config {
  return { ...base, params: { ...base.params, ...overrides } };
}

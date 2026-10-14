import paramsJson from '../data/params.json';
import itemsJson from '../data/items.json';
import eventsJson from '../data/events.json';
import type { Config, EventDef, EventId, ItemDef, ItemId, Params } from './types';

export function buildConfig(): Config {
  const items = {} as Record<ItemId, ItemDef>;
  for (const it of itemsJson.items) items[it.id as ItemId] = it as ItemDef;
  const events = {} as Record<EventId, EventDef>;
  for (const ev of eventsJson.events) events[ev.id as EventId] = ev as EventDef;
  return { params: paramsJson as unknown as Params, items, events };
}

export const CONFIG: Config = buildConfig();

/** Deep-ish copy of the config with parameter overrides (used by tests and tuning). */
export function withParams(overrides: Partial<Params>, base: Config = CONFIG): Config {
  return { ...base, params: { ...base.params, ...overrides } };
}

import { CONFIG } from '../engine/config';
import { sunFactor } from '../engine/mission';
import type { MissionState } from '../engine/types';
import type { StatusKind } from '../ui/icons';
import type { ModuleId } from '../ui/store';

export interface ModuleStatus {
  kind: StatusKind | null;
  /** i18n key explaining a warning, if any */
  why: string | null;
}

/** One place that decides what the status icon of a module is (map and panel agree). */
export function moduleStatus(id: ModuleId, m: MissionState): ModuleStatus {
  const first = m.log.length === 0;
  const system = (k: 'o2gen' | 'recycler' | 'greenhouse' | 'excavator'): ModuleStatus => {
    const x = m.systems[k];
    if (x.broken) {
      const patching = k === 'recycler' && m.effects.recyclerRepairIn > 0;
      return { kind: 'broken', why: patching ? 'why.patching' : 'why.broken' };
    }
    if (!x.on) return { kind: 'off', why: null };
    const forced = (k === 'greenhouse' || k === 'excavator') && m.effects.powerSaveDays > 0;
    if (forced || (k === 'excavator' && m.effects.restDay)) return { kind: 'off', why: 'why.paused' };
    if (x.running || first) return { kind: 'ok', why: null };
    const waterNeed = CONFIG.items[k].waterUse ?? 0;
    return { kind: 'warn', why: waterNeed > m.water ? 'why.noWater' : 'why.noPower' };
  };
  switch (id) {
    case 'solar':
      if (m.effects.meteoroid) return { kind: 'broken', why: 'why.cracked' };
      if (sunFactor(m.day, CONFIG) === 0) return { kind: 'off', why: 'why.dark' };
      return m.effects.dust ? { kind: 'warn', why: 'why.dust' } : { kind: 'ok', why: null };
    case 'battery':
      return m.batteryCap > 0 && m.battery < m.batteryCap * 0.2 ? { kind: 'warn', why: 'why.lowBattery' } : { kind: 'ok', why: null };
    case 'reactor':
      return { kind: 'ok', why: null };
    case 'o2gen':
    case 'recycler':
    case 'greenhouse':
    case 'excavator':
      return system(id);
    case 'habitat': {
      const last = m.log[m.log.length - 1];
      return last?.baseCold ? { kind: 'warn', why: 'why.noPower' } : { kind: 'ok', why: null };
    }
    default:
      return { kind: null, why: null };
  }
}

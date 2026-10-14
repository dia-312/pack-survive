import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ar from '../i18n/ar.json';
import en from '../i18n/en.json';
import { CONFIG } from './config';
import { ITEM_ORDER } from './cargo';
import { TURNING_LINKS } from './score';

function walk(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

describe('i18n', () => {
  const enKeys = Object.keys(en);
  const arKeys = Object.keys(ar);

  it('Arabic and English have exactly the same keys', () => {
    expect(arKeys.sort()).toEqual(enKeys.sort());
  });
  it('no empty translations; Arabic is really Arabic where it should be', () => {
    for (const k of enKeys) {
      expect((en as Record<string, string>)[k].trim(), k).not.toBe('');
      expect((ar as Record<string, string>)[k].trim(), k).not.toBe('');
    }
    const arabic = /[؀-ۿ]/;
    const exempt = new Set(['common.langName']);
    for (const k of arKeys) if (!exempt.has(k)) expect(arabic.test((ar as Record<string, string>)[k]), k).toBe(true);
  });
  it('every literal t("key") in the source exists', () => {
    const files = walk(path.join(__dirname, '..'));
    const missing: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (!(m[1] in en)) missing.push(`${path.basename(f)}: ${m[1]}`);
      }
      for (const m of src.matchAll(/(?:key|labelKey|why):\s*'((?:toast|alert|radar|task|why|hud|events)\.[a-zA-Z0-9_.]+)'/g)) {
        if (!(m[1] in en)) missing.push(`${path.basename(f)}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it('every item, module, situation and turning point has text', () => {
    for (const id of ITEM_ORDER) {
      expect(`item.${id}` in en, id).toBe(true);
      expect(`item.${id}.gives` in en, id).toBe(true);
    }
    for (const mod of ['habitat', 'solar', 'battery', 'reactor', 'o2gen', 'recycler', 'greenhouse', 'shelter', 'excavator', 'cargo']) {
      expect(`mod.${mod}.name` in en, mod).toBe(true);
      expect(`mod.${mod}.desc` in en, mod).toBe(true);
    }
    for (const ev of Object.values(CONFIG.events)) {
      expect(`events.${ev.id}.title` in en, ev.id).toBe(true);
      expect(`events.${ev.id}.body` in en, ev.id).toBe(true);
      for (const c of ev.choices) {
        expect(`events.${ev.id}.choice.${c}` in en, `${ev.id}.${c}`).toBe(true);
        expect(`events.${ev.id}.cost.${c}` in en, `${ev.id}.${c}`).toBe(true);
        expect(`events.${ev.id}.result.${c}` in en, `${ev.id}.${c}`).toBe(true);
      }
      expect(`events.${ev.id}.result.${ev.default}` in en, `${ev.id}.default`).toBe(true);
    }
    for (const [kind, link] of Object.entries(TURNING_LINKS)) {
      expect(`turning.${kind}` in en, kind).toBe(true);
      expect(`tip.${link.tip}` in en, link.tip).toBe(true);
    }
    for (const k of ['storm']) {
      expect(`events.${k}.choice.hide` in en).toBe(true);
      expect(`events.${k}.result.hide` in en).toBe(true);
      expect(`events.${k}.result.late` in en).toBe(true);
    }
  });
});

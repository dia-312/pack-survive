import { useMemo } from 'react';
import { ITEM_ORDER, SUGGESTED_CARGO, addItem, checkCargo, removeItem } from '../../engine/cargo';
import { CONFIG } from '../../engine/config';
import { planCargo } from '../../engine/plan';
import type { Cargo, ItemId } from '../../engine/types';
import { ItemIcon, ResourceIcon, StatusIcon } from '../icons';
import { Radar } from '../Radar';
import { persist, setState, useStore } from '../store';
import { useT } from '../useT';
import { startMission } from '../../game/session';
import { LangToggle } from './StartScreen';

function MassMeter({ used, max }: { used: number; max: number }) {
  const { t } = useT();
  const over = used > max;
  const cells = Math.max(max, used);
  return (
    <div className={`mass-meter${over ? ' over' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={used}>
      <div className="mass-head">
        <span className="mass-label">
          <ResourceIcon id="mass" size={24} /> {t('pack.mass', { used, max })}
        </span>
        <span className="mass-state">
          {over ? (
            <>
              <StatusIcon kind="broken" size={20} /> {t('pack.over', { n: used - max })}
            </>
          ) : (
            t('pack.left', { n: max - used })
          )}
        </span>
      </div>
      <div className="mass-cells" aria-hidden="true">
        {Array.from({ length: cells }, (_, i) => (
          <span key={i} className={`cell${i < used ? ' full' : ''}${i >= max ? ' extra' : ''}`} />
        ))}
      </div>
    </div>
  );
}

function ItemCard({ id, cargo }: { id: ItemId; cargo: Cargo }) {
  const { t } = useT();
  const n = cargo[id] ?? 0;
  const def = CONFIG.items[id];
  const name = t(`item.${id}`);
  const hasNeeds = id === 'o2gen' || id === 'recycler' || id === 'greenhouse' || id === 'excavator';
  const set = (c: Cargo) => setState({ cargo: c });
  return (
    <li className={`item-card${n > 0 ? ' has' : ''}`}>
      <div className="item-top">
        <ItemIcon id={id} size={52} />
        <span className="mass-badge" title={t('common.mass')}>
          <b>{def.mass}</b>
          <small>kg</small>
        </span>
      </div>
      <h3>{name}</h3>
      <p className="gives">
        <span className="tag give">{t('common.gives')}</span> {t(`item.${id}.gives`)}
      </p>
      {hasNeeds && (
        <p className="needs">
          <span className="tag need">{t('common.needs')}</span> {t(`item.${id}.needs`)}
        </p>
      )}
      <div className="stepper">
        <button
          className="step"
          onClick={() => set(removeItem(cargo, id))}
          disabled={n === 0}
          aria-label={t('pack.remove', { name })}
        >
          −
        </button>
        <span className="count" aria-live="polite">
          {n}
          <small>/ {def.max}</small>
        </span>
        <button
          className="step plus"
          onClick={() => set(addItem(cargo, id))}
          disabled={n >= def.max}
          aria-label={t('pack.add', { name })}
        >
          +
        </button>
      </div>
    </li>
  );
}

export function PackScreen() {
  const { t } = useT();
  const cargo = useStore((s) => s.cargo);
  const easy = useStore((s) => s.easy);
  const lastCargo = useStore((s) => s.lastCargo);
  const check = checkCargo(cargo);
  const plan = useMemo(() => (check.mass > 0 ? planCargo(cargo) : null), [cargo, check.mass]);
  const packed = ITEM_ORDER.filter((id) => (cargo[id] ?? 0) > 0);

  const lines: { key: string; vars?: Record<string, number>; tone: 'bad' | 'warn' }[] = [];
  if (plan) {
    for (const i of plan.issues) {
      if (i.kind === 'cover') lines.push({ key: 'pack.check.cover', tone: 'warn' });
      else lines.push({ key: `pack.check.${i.kind}`, vars: { n: i.day }, tone: 'bad' });
    }
    if (!(cargo.spare ?? 0)) lines.push({ key: 'pack.check.nospare', tone: 'warn' });
  }

  return (
    <main className="screen pack">
      <div className="top-row">
        <button className="btn ghost" onClick={() => setState({ screen: 'briefing' })}>
          <span className="arr">←</span> {t('common.back')}
        </button>
        <h2 className="pack-title">{t('pack.title')}</h2>
        <LangToggle />
      </div>
      <div className="pack-layout">
        <section className="pack-main">
          <p className="muted">{t('pack.subtitle')}</p>
          <p className="dark-hint">
            <ResourceIcon id="moon" size={22} /> {t('pack.hint.dark')}
          </p>
          <ul className="item-grid">
            {ITEM_ORDER.map((id) => (
              <ItemCard key={id} id={id} cargo={cargo} />
            ))}
          </ul>
        </section>
        <aside className="pack-side">
          <MassMeter used={check.mass} max={check.budget} />
          <div className="manifest">
            <h3>{t('pack.manifest')}</h3>
            {packed.length === 0 ? (
              <p className="muted">{t('pack.manifest.empty')}</p>
            ) : (
              <ul>
                {packed.map((id) => (
                  <li key={id}>
                    <ItemIcon id={id} size={26} />
                    <span>{t(`item.${id}`)}</span>
                    <b>×{cargo[id]}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="radar-check">
            <Radar size={64} mood={plan && plan.finishes && lines.length === 0 ? 'happy' : 'think'} float={false} />
            <div>
              <h3>{t('pack.check')}</h3>
              {!plan && <p className="muted">{t('pack.empty')}</p>}
              {plan && <p className="muted small">{t('pack.check.hint')}</p>}
              <ul className="issues">
                {plan && plan.finishes && lines.filter((l) => l.tone === 'bad').length === 0 && (
                  <li className="ok">
                    <StatusIcon kind="ok" size={18} /> {t('pack.check.good')}
                  </li>
                )}
                {lines.map((l, i) => (
                  <li key={i} className={l.tone}>
                    <StatusIcon kind={l.tone === 'bad' ? 'broken' : 'warn'} size={18} /> {t(l.key, l.vars)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pack-buttons">
            <button
              className={`btn ${easy ? 'accent' : 'ghost'}`}
              onClick={() => setState({ cargo: { ...SUGGESTED_CARGO } })}
            >
              ✨ {t('pack.suggest')}
            </button>
            {lastCargo && (
              <button className="btn ghost" onClick={() => setState({ cargo: { ...lastCargo } })}>
                ↺ {t('pack.repeat')}
              </button>
            )}
            <button className="btn ghost" onClick={() => setState({ cargo: {} })} disabled={check.mass === 0}>
              {t('pack.clear')}
            </button>
            <button
              className="btn primary big launch"
              disabled={!check.canLaunch}
              onClick={() => {
                setState({ lastCargo: { ...cargo } });
                persist();
                startMission(cargo);
              }}
            >
              🚀 {t('pack.launch')}
            </button>
            {!check.canLaunch && (
              <p className="blocked" role="status">
                {check.over ? t('pack.launchBlocked') : t('pack.empty')}
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { configFor } from '../../engine/config';
import { availableChoices, canRepair, sunFactor } from '../../engine/mission';
import { planPower } from '../../engine/tick';
import type { EventId, SystemId } from '../../engine/types';
import {
  chooseCard,
  cleanPanels,
  closeCard,
  harvestPlants,
  repairWithSpare,
  showReport,
  toggleSystem,
} from '../../game/controller';
import { stopGame } from '../../game/runtime';
import { moduleById } from '../../game/layout';
import { moduleStatus } from '../../game/status';
import { getFact } from '../../i18n';
import { CREW_COLORS, Face, faceFor, ModuleIcon, ResourceIcon, StatusIcon } from '../icons';
import { Radar } from '../Radar';
import { persist, setState, useStore, type ModuleId } from '../store';
import { useT } from '../useT';
import { fmt, useMission } from './derived';

export function Modal({ children, onClose, label, tone }: { children: ReactNode; onClose?: () => void; label: string; tone?: 'alert' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} tabIndex={-1} className={`modal${tone ? ` ${tone}` : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function FactBox({ id }: { id: string }) {
  const { t, lang } = useT();
  const scientist = useStore((s) => s.scientist);
  const f = getFact(id);
  if (!f) return null;
  return (
    <aside className="fact">
      <strong>💡 {t('common.didYouKnow')}</strong>
      <p>{f.kid[lang]}</p>
      {scientist && (
        <div className="fact-sci">
          <p>🔬 {f.scientist[lang]}</p>
          <a href={f.source.url} target="_blank" rel="noopener noreferrer">
            {t('common.source')}: {f.source.title} {f.source.secondary ? t('common.secondary') : ''} ↗
          </a>
        </div>
      )}
    </aside>
  );
}

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  const { t } = useT();
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' on' : ''}`} disabled={disabled} onClick={onChange}>
      <span className="knob" aria-hidden="true">
        {on ? '✓' : '⏻'}
      </span>
      <span className="switch-text">{on ? t('common.on') : t('common.off')}</span>
    </button>
  );
}

/** Hold for `seconds` to finish (used for cleaning dust off the panels). */
function HoldButton({ seconds, label, holding, onDone }: { seconds: number; label: string; holding: string; onDone: () => void }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);
  const stop = () => {
    cancelAnimationFrame(raf.current);
    setP(0);
  };
  const begin = () => {
    start.current = performance.now();
    const loop = () => {
      const k = (performance.now() - start.current) / (seconds * 1000);
      if (k >= 1) {
        stop();
        onDone();
        return;
      }
      setP(k);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <button
      className="btn primary hold"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        begin();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) begin();
      }}
      onKeyUp={stop}
    >
      <span className="hold-fill" style={{ width: `${p * 100}%` }} />
      <span className="hold-text">{p > 0 ? holding : label}</span>
    </button>
  );
}

// ---- module panel ---------------------------------------------------------------------------

function ModulePanel({ id }: { id: ModuleId }) {
  const { t, lang } = useT();
  const m = useMission();
  const CONFIG = configFor(m.difficulty);
  const scientist = useStore((s) => s.scientist);
  const P = CONFIG.params;
  const st = moduleStatus(id, m);
  const layout = moduleById(id);
  const close = () => setState({ overlay: null });
  const plan = planPower(m, CONFIG);
  const sys = (['o2gen', 'recycler', 'greenhouse', 'excavator'] as SystemId[]).includes(id as SystemId) ? (id as SystemId) : null;
  const dark = sunFactor(m.day, CONFIG) === 0;
  const solarNow = (m.cargo.solar ?? 0) * 6 * (dark ? 0 : 1) * (m.effects.dust ? P.effects.dustOutputFactor : 1) * (m.effects.meteoroid ? P.effects.meteoroidOutputFactor : 1);
  const storm = useStore((s) => s.storm);

  let body: ReactNode = null;
  let sci: ReactNode = null;
  const gives = (key: string, vars?: Record<string, string | number>) => (
    <p className="line give">
      <span className="tag give">{t('common.gives')}</span> {t(key, vars)}
    </p>
  );
  const needs = (key: string) => (
    <p className="line need">
      <span className="tag need">{t('common.needs')}</span> {t(key)}
    </p>
  );
  const bar = (v: number, max: number) => (
    <div className="bar big">
      <span style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
    </div>
  );

  switch (id) {
    case 'habitat': {
      const cold = m.log[m.log.length - 1]?.baseCold;
      body = (
        <>
          {needs('mod.habitat.needs')}
          <p className="line">{cold ? t('panel.cold') : t('panel.warm')}</p>
          <ul className="crew-health">
            {m.crew.map((c) => (
              <li key={c.id}>
                <Face kind={faceFor(c.health)} ring={CREW_COLORS[c.id]} size={38} />
                <span className="crew-name">{t(`crew.${c.id}`)}</span>
                <span className="grow">{bar(c.health, 100)}</span>
                <b>{c.health}</b>
                <span className="face-label">{t(`face.${faceFor(c.health)}`)}</span>
              </li>
            ))}
          </ul>
          <p className="line">
            <ResourceIcon id="morale" size={20} /> {t('panel.moraleLine', { n: m.morale })}
          </p>
          <p className="line">
            <ResourceIcon id="radiation" size={20} /> {t('panel.doseLine', { n: fmt(m.dose), max: P.doseLimitMSv })}
          </p>
        </>
      );
      sci = <p>{t('sci.habitat')}</p>;
      break;
    }
    case 'solar':
      body = (
        <>
          {gives('panel.output', { n: fmt(solarNow) })}
          {m.effects.dust && (
            <HoldButton seconds={3} label={t('panel.clean')} holding={t('panel.cleaning')} onDone={cleanPanels} />
          )}
          {m.effects.meteoroid && (
            <button className="btn primary" disabled={!canRepair(m, 'solar')} onClick={() => repairWithSpare('solar')}>
              <ResourceIcon id="spare" size={22} /> {canRepair(m, 'solar') ? t('panel.repair') : t('panel.noSpare')}
            </button>
          )}
          {!m.effects.dust && !m.effects.meteoroid && !dark && <p className="line ok-line">{t('panel.fine')}</p>}
        </>
      );
      sci = (
        <>
          <p>
            {t('sci.solar', {
              n: m.cargo.solar ?? 0,
              each: 6,
              sun: dark ? 0 : 1,
              dust: m.effects.dust ? P.effects.dustOutputFactor : 1,
              dmg: m.effects.meteoroid ? P.effects.meteoroidOutputFactor : 1,
              total: fmt(solarNow),
            })}
          </p>
        </>
      );
      break;
    case 'battery':
      body = (
        <>
          <p className="line">{t('panel.charge', { b: fmt(m.battery), c: m.batteryCap })}</p>
          {bar(m.battery, Math.max(1, m.batteryCap))}
          <p className="line">{t('hud.power', { p: fmt(plan.produced), d: fmt(plan.demands.reduce((a, d) => a + d.amount, 0)) })}</p>
        </>
      );
      sci = (
        <>
          <p>{t('sci.battery', { cap: m.batteryCap })}</p>
          <p>{t('sci.priority')}</p>
        </>
      );
      break;
    case 'reactor':
      body = gives('item.reactor.gives');
      sci = <p>{t('sci.reactor')}</p>;
      break;
    case 'o2gen':
      body = (
        <>
          {gives('item.o2gen.gives')}
          {needs('item.o2gen.needs')}
        </>
      );
      sci = <p>{t('sci.o2gen')}</p>;
      break;
    case 'recycler':
      body = (
        <>
          {gives('item.recycler.gives')}
          {needs('item.recycler.needs')}
          {m.systems.recycler.broken && (
            <button className="btn primary" disabled={!canRepair(m, 'recycler')} onClick={() => repairWithSpare('recycler')}>
              <ResourceIcon id="spare" size={22} /> {canRepair(m, 'recycler') ? t('panel.repair') : t('panel.noSpare')}
            </button>
          )}
        </>
      );
      sci = <p>{t('sci.recycler')}</p>;
      break;
    case 'greenhouse': {
      const growDays = CONFIG.items.greenhouse.growDays ?? 9;
      const grown = m.greenhouseGrowth > growDays;
      body = (
        <>
          {gives('item.greenhouse.gives')}
          {needs('item.greenhouse.needs')}
          <p className="line">{grown ? t('panel.producing') : t('panel.growth', { n: Math.min(m.greenhouseGrowth, growDays + 1), max: growDays + 1 })}</p>
          {bar(Math.min(m.greenhouseGrowth, growDays + 1), growDays + 1)}
          <button className="btn accent" disabled={!grown || m.harvestCooldown > 0} onClick={harvestPlants}>
            🥗 {grown && m.harvestCooldown === 0 ? t('panel.harvest') : t('panel.harvestWait')}
          </button>
        </>
      );
      sci = <p>{t('sci.greenhouse')}</p>;
      break;
    }
    case 'excavator':
      body = (
        <>
          {gives('item.excavator.gives')}
          {needs('item.excavator.needs')}
          <p className="line">
            <ResourceIcon id="shield" size={20} /> {t('panel.shieldLevel', { n: m.shieldLevel, max: P.maxShieldLevel })}
          </p>
          {m.shieldLevel < P.maxShieldLevel && (
            <>
              {bar(m.shieldProgress, CONFIG.items.excavator.daysPerLevel ?? 5)}
              <p className="line small">{t('panel.shieldNext', { n: (CONFIG.items.excavator.daysPerLevel ?? 5) - m.shieldProgress })}</p>
            </>
          )}
        </>
      );
      sci = <p>{t('sci.excavator')}</p>;
      break;
    case 'shelter':
      body = (
        <>
          {gives('item.shelter.gives')}
          <p className="line">{storm ? t('panel.stormRun') : t('panel.fine')}</p>
        </>
      );
      sci = (
        <>
          <p>{t('sci.shelter')}</p>
          <p>{t('sci.shield', { f: P.shieldFactors[Math.min(m.shieldLevel, 3)] })}</p>
          <p>{t('sci.dose', { max: P.doseLimitMSv })}</p>
        </>
      );
      break;
    case 'cargo':
      body = (
        <ul className="stock">
          <li>
            <ResourceIcon id="oxygen" size={26} /> {t('hud.oxygen')} <b>{fmt(m.oxygen)}</b>
          </li>
          <li>
            <ResourceIcon id="water" size={26} /> {t('hud.water')} <b>{fmt(m.water)}</b>
          </li>
          <li>
            <ResourceIcon id="food" size={26} /> {t('hud.food')} <b>{fmt(m.food)}</b>
          </li>
          <li>
            <ResourceIcon id="spare" size={26} /> {t('hud.spares')} <b>{m.spares}</b>
          </li>
        </ul>
      );
      sci = <p>{t('sci.cargo')}</p>;
      break;
  }

  const statusKind = st.kind;
  return (
    <Modal onClose={close} label={t(`mod.${id}.name`)}>
      <header className="modal-head">
        <ModuleIcon id={id} size={56} />
        <div>
          <h2>{t(`mod.${id}.name`)}</h2>
          <p className="muted">{t(`mod.${id}.desc`)}</p>
        </div>
        <button className="icon-btn dark" onClick={close} aria-label={t('common.close')}>
          ✕
        </button>
      </header>
      {statusKind && (
        <div className={`status-line ${statusKind}`}>
          <StatusIcon kind={statusKind} size={26} />
          <strong>{t(statusKind === 'off' && st.why === 'why.dark' ? 'status.dark' : `status.${statusKind}`)}</strong>
          {st.why && <span>· {t(st.why)}</span>}
          {sys && (
            <span className="switch-wrap">
              <Switch on={m.systems[sys].on} disabled={m.systems[sys].broken} onChange={() => toggleSystem(sys)} label={`${t('panel.switch')}: ${t(`mod.${id}.name`)}`} />
            </span>
          )}
        </div>
      )}
      <div className="modal-body">{body}</div>
      <FactBox id={layout.fact} />
      {scientist && sci && (
        <aside className="sci-box">
          <strong>🔬 {t('panel.sciTitle')}</strong>
          {sci}
        </aside>
      )}
      <div className="modal-foot">
        <button className="btn big" onClick={close}>
          {t('common.close')}
        </button>
      </div>
      <span hidden>{lang}</span>
    </Modal>
  );
}

// ---- situation card --------------------------------------------------------------------------

function SituationCard({ ev, phase, choice, timeout }: { ev: EventId; phase: 'ask' | 'result'; choice?: string; timeout: boolean }) {
  const { t } = useT();
  const m = useMission();
  const CONFIG = configFor(m.difficulty);
  const def = CONFIG.events[ev];
  const hasShelter = (m.cargo.shelter ?? 0) > 0;

  if (phase === 'ask') {
    const avail = availableChoices(m, ev, CONFIG);
    return (
      <Modal label={t(`events.${ev}.title`)} tone={ev === 'storm' ? 'alert' : undefined}>
        <header className="modal-head">
          <Radar size={72} mood={ev === 'storm' ? 'alert' : 'think'} float={false} />
          <div>
            <h2>{t(`events.${ev}.title`)}</h2>
            <p>{t(`events.${ev}.body`)}</p>
          </div>
        </header>
        <div className="choices">
          {def.choices.map((c) => {
            const key = ev === 'storm' && c === 'shelter' && !hasShelter ? 'hide' : c;
            const ok = avail.includes(c);
            return (
              <button key={c} className="choice" disabled={!ok} onClick={() => chooseCard(c)}>
                <strong>{t(`events.${ev}.choice.${key}`)}</strong>
                <span className="cost">
                  <b>{t('events.cost')}:</b> {t(`events.${ev}.cost.${key}`)}
                </span>
                {!ok && (
                  <span className="cost warn">
                    <StatusIcon kind="warn" size={16} /> {t('events.noSpare')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Modal>
    );
  }

  const c = choice ?? def.default;
  const rkey = ev === 'storm' && c === 'shelter' && !hasShelter ? 'hide' : c;
  const bad = ev === 'storm' && (c === 'late' || c === 'work');
  return (
    <Modal label={t(`events.${ev}.title`)} onClose={closeCard}>
      <header className="modal-head">
        <Radar size={72} mood={bad ? 'sad' : 'happy'} float={false} />
        <div>
          <h2>{t(`events.${ev}.title`)}</h2>
          {timeout && <p className="muted">{t('events.timeout')}</p>}
          <p className="result">
            <StatusIcon kind={bad ? 'warn' : 'ok'} size={22} /> {t(`events.${ev}.result.${rkey}`)}
          </p>
        </div>
      </header>
      <FactBox id={def.fact} />
      <div className="modal-foot">
        <button className="btn primary big" onClick={closeCard}>
          {t('events.continue')}
        </button>
      </div>
    </Modal>
  );
}

// ---- menu and ending --------------------------------------------------------------------------

function MenuOverlay() {
  const { t, lang } = useT();
  const scientist = useStore((s) => s.scientist);
  const [sure, setSure] = useState(false);
  const close = () => setState({ overlay: null });
  return (
    <Modal onClose={close} label={t('menu.title')}>
      <header className="modal-head">
        <Radar size={64} float={false} />
        <h2>{t('menu.title')}</h2>
      </header>
      <div className="menu-grid">
        <button className="btn primary big" onClick={close}>
          ▶ {t('menu.resume')}
        </button>
        <button
          className="btn"
          onClick={() => {
            setState({ lang: lang === 'ar' ? 'en' : 'ar' });
            persist();
          }}
        >
          🌐 {t('common.langName')}
        </button>
        <label className="toggle light">
          <input
            type="checkbox"
            checked={scientist}
            onChange={(e) => {
              setState({ scientist: e.target.checked });
              persist();
            }}
          />
          <span className="box" aria-hidden="true" />
          <span>
            <strong>{t('common.scientist')}</strong>
            <small>{t('common.scientistHint')}</small>
          </span>
        </label>
      </div>
      <h3>{t('menu.help')}</h3>
      <ul className="help">
        <li>{t('menu.help1')}</li>
        <li>{t('menu.help2')}</li>
        <li>{t('menu.help3')}</li>
        <li>{t('menu.help4')}</li>
      </ul>
      <FactBox id="moon_gravity" />
      <div className="modal-foot">
        {!sure ? (
          <button className="btn ghost dark" onClick={() => setSure(true)}>
            {t('menu.quit')}
          </button>
        ) : (
          <>
            <span>{t('menu.quitSure')}</span>
            <button className="btn" onClick={() => {
                stopGame();
                setState({ overlay: null, screen: 'start', mission: null, task: null, storm: null });
              }}>
              {t('common.yes')}
            </button>
            <button className="btn primary" onClick={() => setSure(false)}>
              {t('common.no')}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function EndingOverlay() {
  const { t } = useT();
  const m = useMission();
  const ok = m.status === 'success';
  return (
    <Modal label={t(ok ? 'ending.success' : 'ending.evac')}>
      <div className="ending">
        <Radar size={120} mood={ok ? 'happy' : 'think'} />
        <h2>{t(ok ? 'ending.success' : 'ending.evac')}</h2>
        <p>{t(ok ? 'ending.successBody' : 'ending.evacBody')}</p>
        <button className="btn primary big" onClick={showReport}>
          {t('ending.report')} <span className="arr">→</span>
        </button>
      </div>
    </Modal>
  );
}

export function Overlays() {
  const overlay = useStore((s) => s.overlay);
  if (!overlay) return null;
  switch (overlay.kind) {
    case 'module':
      return <ModulePanel id={overlay.id} />;
    case 'card':
      return <SituationCard ev={overlay.event} phase={overlay.phase} choice={overlay.choice} timeout={overlay.text === 'timeout'} />;
    case 'menu':
      return <MenuOverlay />;
    case 'ending':
      return <EndingOverlay />;
  }
}

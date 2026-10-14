import { useEffect } from 'react';
import { CONFIG } from '../../engine/config';
import { planPower } from '../../engine/tick';
import { canSkip, skipDay } from '../../game/controller';
import { CREW_COLORS, Face, faceFor, ResourceIcon, StatusIcon, type ResIcon, type StatusKind } from '../icons';
import { Radar } from '../Radar';
import { setState, useStore } from '../store';
import { useT } from '../useT';
import { daysLevel, fmt, supplyDays, useMission, type Level } from './derived';
import { useTouch } from './Controls';

function Meter({
  icon,
  label,
  value,
  max,
  level,
  sub,
  text,
}: {
  icon: ResIcon;
  label: string;
  value: number;
  max: number;
  level: Level;
  sub?: string;
  text?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const kind: StatusKind | null = level === 'bad' ? 'broken' : level === 'warn' ? 'warn' : null;
  return (
    <div className={`meter ${level}`} title={label} role="group" aria-label={`${label}: ${text ?? fmt(value)}${sub ? `, ${sub}` : ''}`}>
      <div className="meter-icon">
        <ResourceIcon id={icon} size={26} />
      </div>
      <div className="meter-body">
        <div className="meter-row">
          <span className="meter-label">{label}</span>
          <span className="meter-val">
            {text ?? fmt(value)}
            {kind && <StatusIcon kind={kind} size={16} />}
          </span>
        </div>
        <div className="bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        {sub && <div className="meter-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Hud() {
  const { t } = useT();
  const m = useMission();
  const dayProgress = useStore((s) => s.dayProgress);
  const task = useStore((s) => s.task);
  const storm = useStore((s) => s.storm);
  const overlay = useStore((s) => s.overlay);
  const P = CONFIG.params;
  const dark = P.sunZeroDays.includes(m.day);
  const days = supplyDays(m);
  const left = P.missionDays - m.day;
  const plan = planPower(m, CONFIG);
  const demand = plan.demands.reduce((a, d) => a + d.amount, 0);
  const lastsText = (d: number) => {
    if (d === Infinity) return t('hud.lastsOver');
    const n = Math.max(0, Math.floor(d));
    return n === 0 ? t('hud.lasts0') : n === 1 ? t('hud.lasts1') : n === 2 ? t('hud.lasts2') : t('hud.lasts', { n });
  };
  const batLevel: Level =
    m.batteryCap === 0 ? 'ok' : m.battery <= m.batteryCap * 0.1 ? 'bad' : m.battery <= m.batteryCap * 0.3 ? 'warn' : 'ok';
  const doseLevel: Level = m.dose >= P.doseLimitMSv * 0.85 ? 'bad' : m.dose >= P.doseLimitMSv * 0.6 ? 'warn' : 'ok';
  const skip = canSkip() && !overlay;

  return (
    <div className="hud" dir="inherit">
      <div className="hud-top">
        <div className="day-block">
          <div className="day-row">
            <ResourceIcon id={dark ? 'moon' : 'sun'} size={30} />
            <strong>{t('hud.day', { n: m.day, max: P.missionDays })}</strong>
            <span className={`sun-tag ${dark ? 'dark' : ''}`}>{dark ? t('hud.dark') : t('hud.sunny')}</span>
          </div>
          <div className="bar day-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(dayProgress * 100)}>
            <span style={{ width: `${dayProgress * 100}%` }} />
          </div>
        </div>

        <div className="meters">
          <Meter
            icon="power"
            label={t('hud.battery')}
            value={m.battery}
            max={Math.max(1, m.batteryCap)}
            level={batLevel}
            text={m.batteryCap > 0 ? `${fmt(m.battery)}/${m.batteryCap}` : '0'}
            sub={t('hud.power', { p: fmt(plan.produced), d: fmt(demand) })}
          />
          <Meter icon="oxygen" label={t('hud.oxygen')} value={m.oxygen} max={Math.max(40, m.oxygen)} level={daysLevel(days.oxygen, left)} sub={lastsText(days.oxygen)} />
          <Meter icon="water" label={t('hud.water')} value={m.water} max={Math.max(40, m.water)} level={daysLevel(days.water, left)} sub={lastsText(days.water)} />
          <Meter icon="food" label={t('hud.food')} value={m.food} max={Math.max(40, m.food)} level={daysLevel(days.food, left)} sub={lastsText(days.food)} />
          <Meter
            icon="radiation"
            label={t('hud.dose')}
            value={m.dose}
            max={P.doseLimitMSv}
            level={doseLevel}
            text={`${fmt(m.dose)}/${P.doseLimitMSv}`}
            sub={`${t('hud.shield')}: ${t('hud.shieldLevel', { n: m.shieldLevel })}`}
          />
        </div>

        <div className="hud-right">
          <div className="chips">
            <span className="chip-stat" title={t('hud.morale')}>
              <ResourceIcon id="morale" size={22} /> {m.morale}
            </span>
            <span className="chip-stat" title={t('hud.science')}>
              <ResourceIcon id="science" size={22} /> {m.science}
            </span>
            <span className="chip-stat" title={t('hud.spares')}>
              <ResourceIcon id="spare" size={22} /> {m.spares}
            </span>
          </div>
          <ul className="crew-faces" aria-label={t('hud.crew')}>
            {m.crew.map((c) => {
              const kind = faceFor(c.health);
              return (
                <li key={c.id} title={`${t(`crew.${c.id}`)} · ${t(`face.${kind}`)}`} aria-label={t('hud.crewHealth', { name: t(`crew.${c.id}`), n: c.health })}>
                  <Face kind={kind} ring={CREW_COLORS[c.id]} size={34} />
                  <span className="crew-hp">{c.health}</span>
                </li>
              );
            })}
          </ul>
          <button className="icon-btn" onClick={() => setState({ overlay: { kind: 'menu' } })} aria-label={t('hud.menu')}>
            <span aria-hidden="true">☰</span>
          </button>
        </div>
      </div>

      {storm && <StormBanner remaining={storm.remaining} total={storm.total} />}
      <Toasts />
      <RadarSay />
      <BottomBar skip={skip} />
      {task && !storm && <TaskBar />}
    </div>
  );
}

function StormBanner({ remaining, total }: { remaining: number; total: number }) {
  const { t } = useT();
  const m = useMission();
  const hasShelter = (m.cargo.shelter ?? 0) > 0;
  return (
    <div className="storm-banner" role="alert">
      <StatusIcon kind="broken" size={34} />
      <div>
        <strong>{t('hud.stormBanner', { where: hasShelter ? t('hud.stormShelter') : t('hud.stormHide') })}</strong>
        <div className="bar storm-bar">
          <span style={{ width: `${(remaining / total) * 100}%` }} />
        </div>
      </div>
      <span className="storm-count">{Math.ceil(remaining)}</span>
    </div>
  );
}

function Toasts() {
  const { t } = useT();
  const toasts = useStore((s) => s.toasts);
  return (
    <ul className="toasts" aria-live="polite">
      {toasts.map((x) => (
        <li key={x.id} className={`toast ${x.tone}`}>
          <StatusIcon kind={x.tone === 'good' ? 'ok' : 'warn'} size={22} />
          <span>{t(x.key, x.vars)}</span>
        </li>
      ))}
    </ul>
  );
}

function RadarSay() {
  const { t } = useT();
  const radar = useStore((s) => s.radar);
  useEffect(() => {
    if (!radar) return;
    const id = setTimeout(() => setState({ radar: null }), 9000);
    return () => clearTimeout(id);
  }, [radar]);
  if (!radar) return null;
  return (
    <button className="radar-say" onClick={() => setState({ radar: null })}>
      <Radar size={54} float={false} mood="think" />
      <span className="bubble small">{t(radar.key, radar.vars)}</span>
    </button>
  );
}

function BottomBar({ skip }: { skip: boolean }) {
  const { t } = useT();
  const nearby = useStore((s) => s.nearby);
  const overlay = useStore((s) => s.overlay);
  const touch = useTouch();
  return (
    <div className="bottom-bar">
      {nearby && !overlay && (
        <div className="prompt" role="status">
          <kbd>{touch ? '●' : 'E'}</kbd>
          {touch ? t('hud.tapHint', { name: t(`mod.${nearby}.name`) }) : t('hud.press', { name: t(`mod.${nearby}.name`) })}
        </div>
      )}
      {skip && (
        <button className="btn accent skip" onClick={skipDay} title={t('hud.skipHint')}>
          ⏭ {t('hud.skip')}
        </button>
      )}
    </div>
  );
}

function TaskBar() {
  const { t } = useT();
  const task = useStore((s) => s.task)!;
  return (
    <div className="task-bar" role="status">
      <strong>{t(`events.${task.event}.title`)}</strong>
      {task.hint && (
        <span className={`hint ${task.hint}`}>
          <ResourceIcon id={task.hint === 'cold' ? 'moon' : task.hint === 'warm' ? 'sun' : 'radiation'} size={22} /> {t(`task.hint.${task.hint}`)}
        </span>
      )}
      <div className="bar">
        <span style={{ width: `${task.progress * 100}%` }} />
      </div>
      <small>{t(task.labelKey)}</small>
    </div>
  );
}

import { useState } from 'react';
import type { DayLog } from '../../engine/types';
import { useT } from '../useT';

/**
 * Small multiples: one tiny line chart per measure, each on its own scale (never a dual axis).
 * Colors are the first five slots of the validated categorical palette, in fixed order.
 */
const SERIES = [
  { key: 'battery', label: 'hud.battery', color: '#2a78d6', get: (l: DayLog) => l.battery },
  { key: 'oxygen', label: 'hud.oxygen', color: '#eb6834', get: (l: DayLog) => l.oxygen },
  { key: 'water', label: 'hud.water', color: '#1baf7a', get: (l: DayLog) => l.water },
  { key: 'food', label: 'hud.food', color: '#eda100', get: (l: DayLog) => l.food },
  { key: 'dose', label: 'hud.dose', color: '#e87ba4', get: (l: DayLog) => l.dose },
] as const;

const W = 300;
const H = 120;
const PAD = { l: 34, r: 12, t: 12, b: 22 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

function Mini({ s, log, total, stormDay }: { s: (typeof SERIES)[number]; log: DayLog[]; total: number; stormDay: number | null }) {
  const { t } = useT();
  const [hover, setHover] = useState<number | null>(null);
  const vals = log.map(s.get);
  const top = niceMax(Math.max(...vals, s.key === 'dose' ? 1 : 1));
  const x = (day: number) => PAD.l + ((day - 1) / Math.max(1, total - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const d = log.map((l, i) => `${i ? 'L' : 'M'}${x(l.day).toFixed(1)} ${y(vals[i]).toFixed(1)}`).join(' ');
  const last = log[log.length - 1];
  const darkRuns: [number, number][] = [];
  for (const l of log) {
    if (l.sun === 0) {
      const lastRun = darkRuns[darkRuns.length - 1];
      if (lastRun && lastRun[1] === l.day - 1) lastRun[1] = l.day;
      else darkRuns.push([l.day, l.day]);
    }
  }
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const day = Math.round(1 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (total - 1));
    setHover(Math.max(1, Math.min(log.length, day)));
  };
  const h = hover ? log[hover - 1] : null;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return (
    <figure className="mini">
      <figcaption>
        <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
        <strong>{t(s.label)}</strong>
        <span className="mini-val">{fmt(last ? s.get(last) : 0)}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${t(s.label)}: ${vals.map(fmt).join(', ')}`}
        onPointerMove={pick}
        onPointerLeave={() => setHover(null)}
        onPointerDown={pick}
      >
        {darkRuns.map(([a, b]) => (
          <rect key={a} x={x(a) - 4} y={PAD.t} width={x(b) - x(a) + 8} height={H - PAD.t - PAD.b} className="dark-band" />
        ))}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(top * f)} y2={y(top * f)} className="grid" />
            <text x={PAD.l - 5} y={y(top * f) + 4} textAnchor="end" className="axis">
              {fmt(top * f)}
            </text>
          </g>
        ))}
        {[1, 10, 20, 30].filter((dd) => dd <= total).map((dd) => (
          <text key={dd} x={x(dd)} y={H - 6} textAnchor="middle" className="axis">
            {dd}
          </text>
        ))}
        {s.key === 'dose' && (
          <text x={W - PAD.r} y={PAD.t - 2} textAnchor="end" className="axis" />
        )}
        {stormDay && stormDay <= log.length && (
          <path d={`M${x(stormDay)} ${H - PAD.b - 2} l-5 -9 h10 z`} className="storm-mark" />
        )}
        <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={x(last.day)} cy={y(s.get(last))} r="4.5" fill={s.color} className="end-dot" />}
        {h && (
          <g>
            <line x1={x(h.day)} x2={x(h.day)} y1={PAD.t} y2={H - PAD.b} className="cross" />
            <circle cx={x(h.day)} cy={y(s.get(h))} r="4.5" fill={s.color} className="end-dot" />
            <g transform={`translate(${Math.min(W - 92, Math.max(PAD.l, x(h.day) - 40))} ${PAD.t - 2})`}>
              <rect width="84" height="20" rx="6" className="tip" />
              <text x="42" y="14" textAnchor="middle" className="tip-text">
                {t('common.day', { n: h.day })}: {fmt(s.get(h))}
              </text>
            </g>
          </g>
        )}
      </svg>
    </figure>
  );
}

export function ResourceChart({ log, stormDay, total }: { log: DayLog[]; stormDay: number | null; total: number }) {
  const { t } = useT();
  return (
    <div className="chart-root">
      <ul className="chart-key">
        <li>
          <span className="key-band" aria-hidden="true" /> {t('report.dark')}
        </li>
        <li>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 1 L13 12 H1 Z" className="storm-mark" />
          </svg>{' '}
          {t('report.stormMark')}
        </li>
      </ul>
      <div className="minis">
        {SERIES.map((s) => (
          <Mini key={s.key} s={s} log={log} total={total} stormDay={stormDay} />
        ))}
      </div>
      <details className="table-view">
        <summary>{t('report.table')}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('report.col.day')}</th>
                {SERIES.map((s) => (
                  <th key={s.key}>{t(s.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.day}>
                  <td>{l.day}</td>
                  {SERIES.map((s) => (
                    <td key={s.key}>{Number.isInteger(s.get(l)) ? s.get(l) : s.get(l).toFixed(1)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

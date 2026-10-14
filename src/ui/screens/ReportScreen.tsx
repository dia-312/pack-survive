import { CONFIG } from '../../engine/config';
import { ITEM_ORDER } from '../../engine/cargo';
import { averageHealth, stars, TURNING_LINKS, turningPoint } from '../../engine/score';
import { startMission } from '../../game/session';
import { getFact, getStory } from '../../i18n';
import { ResourceChart } from '../hud/ResourceChart';
import { ItemIcon, ResourceIcon, StatusIcon } from '../icons';
import { Radar } from '../Radar';
import { setState, useStore } from '../store';
import { useT } from '../useT';
import { Stars } from './StartScreen';

export default function ReportScreen() {
  const { t, lang } = useT();
  const m = useStore((s) => s.mission)!;
  const best = useStore((s) => s.best);
  const answers = useStore((s) => s.answers);
  const scientist = useStore((s) => s.scientist);
  const ok = m.status === 'success';
  const n = stars(m, CONFIG);
  const tp = turningPoint(m, CONFIG);
  const link = TURNING_LINKS[tp.kind];
  const story = getStory(link.story);
  const fact = story ? null : getFact(link.story);
  const source = story?.source ?? fact?.source;
  const storyTitle = story ? story.title[lang] : t('story.fact');
  const storyText = story ? story.text[lang] : fact ? (scientist ? fact.scientist[lang] : fact.kid[lang]) : '';
  const day = m.endDay ?? m.day;
  const packed = ITEM_ORDER.filter((id) => (m.cargo[id] ?? 0) > 0);
  const stormDay = m.log.some((l) => l.storm) ? m.schedule.stormDay : null;

  return (
    <main className="screen report">
      <div className="starfield" aria-hidden="true" />
      <article className="panel-card report-card">
        <header className="report-head">
          <Radar size={96} mood={ok ? 'happy' : 'think'} />
          <div>
            <p className="eyebrow">{t('report.title')}</p>
            <h1>{ok ? t('report.success') : t('report.evac', { n: day })}</h1>
            <p>{ok ? t('report.successSub', { n: CONFIG.params.missionDays }) : t('report.evacSub')}</p>
            <div className="report-stars">
              <Stars n={n} size={40} />
              <span className="muted">{t('report.stars', { n })}</span>
            </div>
          </div>
        </header>

        <section className="turning" aria-labelledby="tp">
          <h2 id="tp">
            <StatusIcon kind={ok ? 'ok' : 'warn'} size={24} /> {t('report.turning')}
          </h2>
          <p className="big-sentence">{t(`turning.${tp.kind}`, { day: tp.day })}</p>
          <div className="story">
            <h3>🚀 {t('report.story')}: {storyTitle}</h3>
            <p>{storyText}</p>
            {source && (
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {t('common.source')}: {source.title} ↗
              </a>
            )}
          </div>
          <p className="tip">
            <strong>💡 {t('report.tip')}:</strong> {t(`tip.${link.tip}`)}
          </p>
        </section>

        <section>
          <h2>{t('report.chart')}</h2>
          <ResourceChart log={m.log} stormDay={stormDay} total={CONFIG.params.missionDays} />
        </section>

        <section>
          <h2>{t('report.stats')}</h2>
          <ul className="stat-tiles">
            <li>
              <ResourceIcon id="day" size={30} />
              <b>{day}/{CONFIG.params.missionDays}</b>
              <span>{t('report.stat.days')}</span>
            </li>
            <li>
              <ResourceIcon id="radiation" size={30} />
              <b>{Math.round(m.dose * 10) / 10}</b>
              <span>{t('report.stat.dose')}</span>
            </li>
            <li>
              <ResourceIcon id="morale" size={30} />
              <b>{averageHealth(m)}</b>
              <span>{t('report.stat.health')}</span>
            </li>
            <li>
              <ResourceIcon id="morale" size={30} />
              <b>{m.morale}</b>
              <span>{t('report.stat.morale')}</span>
            </li>
            <li>
              <ResourceIcon id="science" size={30} />
              <b>{m.science}</b>
              <span>{t('report.stat.science')}</span>
            </li>
            <li>
              <ResourceIcon id="spare" size={30} />
              <b>{m.spares}</b>
              <span>{t('report.stat.spares')}</span>
            </li>
          </ul>
          <p className="cargo-line">
            <strong>{t('report.cargo')}:</strong>
            {packed.map((id) => (
              <span key={id} className="cargo-chip">
                <ItemIcon id={id} size={22} /> {t(`item.${id}`)} ×{m.cargo[id]}
              </span>
            ))}
          </p>
        </section>

        <section className="think">
          <h2>🤔 {t('report.think')}</h2>
          {(['report.q1', 'report.q2', 'report.q3'] as const).map((q, i) => (
            <label key={q} className="question">
              <span>{i + 1}. {t(q)}</span>
              <textarea
                rows={2}
                value={answers[i]}
                placeholder={t('report.placeholder')}
                onChange={(e) => {
                  const next = [...answers] as [string, string, string];
                  next[i] = e.target.value;
                  setState({ answers: next });
                }}
              />
            </label>
          ))}
        </section>

        <footer className="report-actions">
          <button
            className="btn primary big"
            onClick={() => setState({ screen: 'pack', cargo: { ...m.cargo }, mission: null, overlay: null })}
          >
            ↺ {t('report.retry')}
          </button>
          <button className="btn accent" onClick={() => startMission(m.cargo, m.seed)}>
            ▶ {t('report.replay')}
          </button>
          <button className="btn ghost" onClick={() => setState({ screen: 'start', mission: null, overlay: null })}>
            {t('report.home')}
          </button>
          <span className="muted code">
            {t('report.code', { n: m.seed })}
            {best ? ` · ${t('report.best', { n: best.stars })}` : ''}
          </span>
        </footer>
      </article>
    </main>
  );
}

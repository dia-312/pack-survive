import { Radar } from '../Radar';
import { ResourceIcon } from '../icons';
import { persist, setState, useStore } from '../store';
import { useT } from '../useT';

export function Stars({ n, total = 3, size = 28 }: { n: number; total?: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${n}/${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < n ? 'star on' : 'star off'}>
          <ResourceIcon id="science" size={size} />
        </span>
      ))}
    </span>
  );
}

export function LangToggle() {
  const { t, lang } = useT();
  return (
    <button
      className="chip"
      onClick={() => {
        setState({ lang: lang === 'ar' ? 'en' : 'ar' });
        persist();
      }}
      aria-label={t('common.language')}
    >
      🌐 {t('common.langName')}
    </button>
  );
}

export function StartScreen() {
  const { t } = useT();
  const best = useStore((s) => s.best);
  const easy = useStore((s) => s.easy);
  const scientist = useStore((s) => s.scientist);

  return (
    <main className="screen start">
      <div className="starfield" aria-hidden="true" />
      <div className="start-top">
        <LangToggle />
      </div>
      <div className="start-center">
        <div className="start-earth" aria-hidden="true">
          <ResourceIcon id="earth" size={72} />
        </div>
        <h1 className="logo">{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
        <div className="start-radar">
          <Radar size={132} />
          <div className="bubble">{t('radar.hello')}</div>
        </div>
        <button
          className="btn primary huge"
          onClick={() => {
            setState({ screen: 'briefing', cargo: {} });
          }}
        >
          {t('start.play')}
        </button>
        <div className="toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={easy}
              onChange={(e) => {
                setState({ easy: e.target.checked });
                persist();
              }}
            />
            <span className="box" aria-hidden="true" />
            <span>
              <strong>{t('start.easy')}</strong>
              <small>{t('start.easyHint')}</small>
            </span>
          </label>
          <label className="toggle">
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
        {best && (
          <div className="best">
            <Stars n={best.stars} size={22} />
            <span>
              {t('start.best', {
                stars: best.stars,
                result: best.success ? t('start.bestSuccess') : t('start.bestEvac', { n: best.day }),
              })}
            </span>
          </div>
        )}
        <p className="safe-note">{t('start.nobody')}</p>
      </div>
      <div className="moon-ground" aria-hidden="true" />
    </main>
  );
}

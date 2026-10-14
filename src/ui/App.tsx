import { lazy, Suspense, useEffect } from 'react';
import { Briefing } from './screens/Briefing';
import { PackScreen } from './screens/PackScreen';
import { StartScreen } from './screens/StartScreen';
import { useStore } from './store';
import { useT } from './useT';

// Phaser is big: load it only when the kid actually lands on the Moon.
const PlayScreen = lazy(() => import('./screens/PlayScreen'));
const ReportScreen = lazy(() => import('./screens/ReportScreen'));

export function App() {
  const screen = useStore((s) => s.screen);
  const { t, lang, dir } = useT();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = t('app.title');
  }, [lang, dir, t]);

  return (
    <div className={`app lang-${lang}`} dir={dir}>
      {screen === 'start' && <StartScreen />}
      {screen === 'briefing' && <Briefing />}
      {screen === 'pack' && <PackScreen />}
      <Suspense fallback={<div className="loading">{t('app.loading')}</div>}>
        {screen === 'play' && <PlayScreen />}
        {screen === 'report' && <ReportScreen />}
      </Suspense>
    </div>
  );
}

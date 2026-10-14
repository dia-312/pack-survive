import { CONFIG } from '../../engine/config';
import { Face, ResourceIcon, CREW_COLORS } from '../icons';
import { Radar } from '../Radar';
import { setState } from '../store';
import { useT } from '../useT';
import { LangToggle } from './StartScreen';

const CREW = ['you', 'layan', 'omar', 'maya'] as const;
const LEARN: { id: string; icon: 'mass' | 'power' | 'spare' | 'radiation' }[] = [
  { id: 'l1', icon: 'mass' },
  { id: 'l2', icon: 'power' },
  { id: 'l3', icon: 'spare' },
  { id: 'l4', icon: 'radiation' },
];

export function Briefing() {
  const { t } = useT();
  return (
    <main className="screen briefing">
      <div className="starfield" aria-hidden="true" />
      <div className="top-row">
        <button className="btn ghost" onClick={() => setState({ screen: 'start' })}>
          <span className="arr">←</span> {t('common.back')}
        </button>
        <LangToggle />
      </div>
      <div className="panel-card wide">
        <div className="briefing-head">
          <Radar size={88} />
          <div>
            <h2>{t('briefing.title')}</h2>
            <p>{t('briefing.intro', { mass: CONFIG.params.massBudget })}</p>
          </div>
        </div>
        <h3>{t('briefing.crew')}</h3>
        <ul className="crew-list">
          {CREW.map((id) => (
            <li key={id}>
              <Face kind="happy" ring={CREW_COLORS[id]} size={52} />
              <span>{t(`briefing.role.${id}`)}</span>
            </li>
          ))}
        </ul>
        <p className="muted">{t('briefing.kenji')}</p>
        <h3>{t('briefing.learn')}</h3>
        <ul className="learn-list">
          {LEARN.map((l) => (
            <li key={l.id}>
              <ResourceIcon id={l.icon} size={36} />
              <div>
                <strong>{t(`briefing.${l.id}.t`)}</strong>
                <span>{t(`briefing.${l.id}.d`)}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn primary big" onClick={() => setState({ screen: 'pack' })}>
            {t('briefing.go')} <span className="arr">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}

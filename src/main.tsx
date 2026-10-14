import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import * as controller from './game/controller';
import { startMission } from './game/session';
import { getState, setState } from './ui/store';
import './ui/styles.css';

if (import.meta.env.DEV) {
  // handy for tests and screenshots (dev server only)
  (window as unknown as Record<string, unknown>).__pack = { getState, setState, controller, startMission };
}

createRoot(document.getElementById('root')!).render(<App />);

import { useEffect, useRef } from 'react';
import * as controller from '../../game/controller';
import { skipCutscene } from '../../game/runtime';
import { World } from '../../game/world/World';
import { ActionButton, Joystick, JumpRunButtons, LookPad, useTouch } from '../hud/Controls';
import { Hud } from '../hud/Hud';
import { Overlays } from '../hud/Overlays';
import { useStore } from '../store';
import { useT } from '../useT';

/** Arrow at the top of the screen pointing to the current goal (task ring or storm cover). */
function GoalPointer() {
  const ref = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const { t } = useT();
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = controller.view.pointer;
      const el = ref.current;
      if (el) {
        el.style.display = p.active ? 'flex' : 'none';
        if (p.active) {
          el.style.setProperty('--angle', `${p.angle}rad`);
          if (label.current) label.current.textContent = t('hud.meters', { n: Math.round(p.dist) });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [t]);
  return (
    <div ref={ref} className="goal-pointer" aria-hidden="true">
      <span className="goal-arrow">▲</span>
      <span ref={label} className="goal-dist" />
    </div>
  );
}

function CutsceneOverlay() {
  const { t } = useT();
  const key = useStore((s) => s.cutscene);
  return (
    <div className="cutscene">
      <div className="letterbox top" />
      <div className="letterbox bottom" />
      {key && (
        <p key={key} className="subtitle">
          {t(key)}
        </p>
      )}
      <button className="btn ghost skip-cut" onClick={skipCutscene}>
        {t('cut.skip')} ⏭
      </button>
    </div>
  );
}

export default function PlayScreen() {
  const host = useRef<HTMLDivElement>(null);
  const touch = useTouch();
  const landing = useStore((s) => s.landing);
  const locked = useStore((s) => s.locked);
  const overlay = useStore((s) => s.overlay);
  const { t } = useT();

  useEffect(() => {
    controller.resetController();
    const world = new World(host.current!, { lowPower: touch || window.innerWidth < 700 });
    return () => {
      world.dispose();
      Object.assign(controller.input, { joyX: 0, joyY: 0, actionHeld: false, lookDX: 0, lookDY: 0, jump: false, run: false });
    };
    // the world is created once per mission
  }, []);

  return (
    <div className="play">
      <div ref={host} className="game-host" />
      {landing ? (
        <CutsceneOverlay />
      ) : (
        <>
          <div className="visor" aria-hidden="true" />
          <div className="crosshair" aria-hidden="true" />
          <GoalPointer />
          <Hud />
          {!touch && !locked && !overlay && <div className="click-look">🖱️ {t('hud.clickLook')}</div>}
          {touch && (
            <>
              <LookPad />
              <Joystick />
              <JumpRunButtons />
              <ActionButton />
            </>
          )}
          <Overlays />
        </>
      )}
    </div>
  );
}

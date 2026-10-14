import { useEffect, useRef, useState } from 'react';
import { actionDown, actionUp, input } from '../../game/controller';
import { ItemIcon } from '../icons';
import { useStore } from '../store';
import { useT } from '../useT';

/** True on phones/tablets: the joystick and the big action button are shown. */
export function useTouch(): boolean {
  const [touch, setTouch] = useState(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const onTouch = () => setTouch(true);
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);
  return touch;
}

const R = 56;

export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);

  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !base.current) return;
    const rect = base.current.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    input.joyX = dx / R;
    input.joyY = dy / R;
  };
  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    setKnob({ x: 0, y: 0 });
    input.joyX = 0;
    input.joyY = 0;
  };
  useEffect(
    () => () => {
      input.joyX = 0;
      input.joyY = 0;
    },
    [],
  );

  return (
    <div
      ref={base}
      className="joystick"
      role="application"
      aria-label="joystick"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joy-arrows" aria-hidden="true">
        <span>▲</span>
        <span>◀</span>
        <span>▶</span>
        <span>▼</span>
      </div>
      <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export function ActionButton() {
  const { t } = useT();
  const nearby = useStore((s) => s.nearby);
  const task = useStore((s) => s.task);
  const label = task ? t(task.labelKey) : nearby ? t('hud.open') : t('hud.action');
  const progress = task?.progress ?? 0;
  return (
    <button
      className={`action-btn${nearby || task ? ' ready' : ''}`}
      aria-label={label}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        actionDown(e.timeStamp);
      }}
      onPointerUp={(e) => actionUp(e.timeStamp)}
      onPointerCancel={(e) => actionUp(e.timeStamp)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 100 100" className="action-ring" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(20,33,61,0.25)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="#4caf6a"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${progress * 276} 276`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="action-icon">
        <ItemIcon id="spare" size={34} />
      </span>
      <span className="action-label">{label}</span>
    </button>
  );
}

/** Phones: drag anywhere on the right part of the screen to look around. */
export function LookPad() {
  const last = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div
      className="lookpad"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const l = last.current;
        if (!l || l.id !== e.pointerId) return;
        input.lookDX += e.clientX - l.x;
        input.lookDY += e.clientY - l.y;
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}

export function JumpRunButtons() {
  const { t } = useT();
  const [run, setRun] = useState(false);
  return (
    <>
      <button
        className="round-btn jump-btn"
        aria-label={t('hud.jump')}
        onPointerDown={(e) => {
          e.preventDefault();
          input.jump = true;
        }}
      >
        <span aria-hidden="true">⤒</span>
        <small>{t('hud.jump')}</small>
      </button>
      <button
        className={`round-btn run-btn${run ? ' on' : ''}`}
        aria-pressed={run}
        aria-label={t('hud.run')}
        onPointerDown={(e) => {
          e.preventDefault();
          const next = !run;
          setRun(next);
          input.run = next;
        }}
      >
        <span aria-hidden="true">»</span>
        <small>{t('hud.run')}</small>
      </button>
    </>
  );
}

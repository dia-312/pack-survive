import { C } from './icons';

export type RadarMood = 'happy' | 'think' | 'alert' | 'sad';

/** Radar: our original little robot mascot (a rounded body, dish antenna and one big eye). */
export function Radar({ size = 96, mood = 'happy', float = true }: { size?: number; mood?: RadarMood; float?: boolean }) {
  const eye = { happy: '#8FD3F0', think: '#8FD3F0', alert: '#F2C94C', sad: '#8FD3F0' }[mood];
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={float ? 'radar-float' : undefined}
      role="img"
      aria-label="Radar"
    >
      <ellipse cx="48" cy="90" rx="22" ry="4" fill={C.navy} opacity="0.25" />
      <path d="M48 20 V10" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />
      <path d="M36 8 a12 12 0 0 1 24 0 Z" fill={C.orange} stroke={C.navy} strokeWidth="3" strokeLinejoin="round" transform="rotate(-18 48 8)" />
      <circle cx="48" cy="9" r="3" fill={C.cream} stroke={C.navy} strokeWidth="2" />
      <rect x="18" y="20" width="60" height="52" rx="22" fill={C.cream} stroke={C.navy} strokeWidth="4" />
      <rect x="26" y="30" width="44" height="28" rx="14" fill={C.navy} />
      <circle cx="48" cy="44" r="10" fill={eye} stroke={C.cream} strokeWidth="2.5" />
      <circle cx="48" cy="44" r="4.5" fill={C.navy} />
      <circle cx="51" cy="41" r="1.8" fill={C.cream} />
      {mood === 'happy' && <path d="M40 66 Q48 72 56 66" stroke={C.navy} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {mood === 'sad' && <path d="M40 69 Q48 63 56 69" stroke={C.navy} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {mood === 'think' && <path d="M41 67 H55" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />}
      {mood === 'alert' && <ellipse cx="48" cy="67" rx="4" ry="3" fill={C.navy} />}
      <rect x="10" y="38" width="10" height="16" rx="5" fill={C.orange} stroke={C.navy} strokeWidth="3" />
      <rect x="76" y="38" width="10" height="16" rx="5" fill={C.orange} stroke={C.navy} strokeWidth="3" />
      <rect x="32" y="72" width="12" height="12" rx="5" fill={C.blue} stroke={C.navy} strokeWidth="3" />
      <rect x="52" y="72" width="12" height="12" rx="5" fill={C.blue} stroke={C.navy} strokeWidth="3" />
    </svg>
  );
}

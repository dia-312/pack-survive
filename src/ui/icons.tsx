import type { ReactNode } from 'react';
import type { ItemId } from '../engine/types';

/** All art is inline SVG drawn in code. Palette: navy, cream, orange, blue, light blue, Moon gray. */
export const C = {
  navy: '#14213D',
  cream: '#F6F3EC',
  orange: '#F28C28',
  blue: '#3FA7D6',
  lblue: '#8FD3F0',
  moon: '#C9C2B3',
  moonDark: '#A39B8A',
  green: '#4CAF6A',
  red: '#E5484D',
  yellow: '#F2C94C',
  white: '#FFFFFF',
};

function Svg({ children, size = 48, label }: { children: ReactNode; size?: number; label?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ItemIcon({ id, size = 48 }: { id: ItemId; size?: number }) {
  switch (id) {
    case 'solar':
      return (
        <Svg size={size}>
          <path d="M8 30 L14 12 H42 L36 30 Z" fill={C.blue} stroke={C.navy} strokeWidth="2" strokeLinejoin="round" />
          <path d="M16.5 12 L10.5 30 M25 12 L19.5 30 M33.5 12 L28 30 M11.3 21 H39 " stroke={C.lblue} strokeWidth="1.6" />
          <path d="M23 30 V40 M15 40 H31" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
        </Svg>
      );
    case 'battery':
      return (
        <Svg size={size}>
          <rect x="6" y="14" width="32" height="22" rx="5" fill={C.green} stroke={C.navy} strokeWidth="2" />
          <rect x="38" y="21" width="5" height="8" rx="2" fill={C.navy} />
          <path d="M24 17 L17 27 H23 L21 34 L30 23 H24 Z" fill={C.cream} stroke={C.navy} strokeWidth="1.5" strokeLinejoin="round" />
        </Svg>
      );
    case 'reactor':
      return (
        <Svg size={size}>
          <path d="M12 42 V22 Q12 8 24 8 Q36 8 36 22 V42 Z" fill={C.moon} stroke={C.navy} strokeWidth="2" />
          <circle cx="24" cy="25" r="8" fill={C.orange} stroke={C.navy} strokeWidth="2" />
          <path d="M24 25 m0 -5 a5 5 0 0 1 4.3 2.5 L24 25 Z M24 25 m4.3 2.5 a5 5 0 0 1 -8.6 0 L24 25 Z M24 25 m-4.3 2.5 a5 5 0 0 1 0 -5 L24 25Z" fill={C.navy} />
          <rect x="10" y="40" width="28" height="4" rx="2" fill={C.navy} />
        </Svg>
      );
    case 'o2gen':
      return (
        <Svg size={size}>
          <rect x="7" y="14" width="34" height="26" rx="5" fill={C.lblue} stroke={C.navy} strokeWidth="2" />
          <rect x="12" y="8" width="8" height="8" rx="2" fill={C.moon} stroke={C.navy} strokeWidth="2" />
          <text x="24" y="33" textAnchor="middle" fontSize="15" fontWeight="800" fill={C.navy} fontFamily="Fredoka, sans-serif">O₂</text>
          <circle cx="35" cy="20" r="2.5" fill={C.green} />
        </Svg>
      );
    case 'o2tank':
      return (
        <Svg size={size}>
          <rect x="14" y="7" width="20" height="36" rx="10" fill={C.lblue} stroke={C.navy} strokeWidth="2" />
          <rect x="20" y="3" width="8" height="6" rx="2" fill={C.navy} />
          <text x="24" y="31" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.navy} fontFamily="Fredoka, sans-serif">O₂</text>
        </Svg>
      );
    case 'recycler':
      return (
        <Svg size={size}>
          <rect x="7" y="12" width="34" height="28" rx="5" fill={C.cream} stroke={C.navy} strokeWidth="2" />
          <path d="M24 17 C24 17 17 25 17 29 a7 7 0 0 0 14 0 C31 25 24 17 24 17 Z" fill={C.blue} stroke={C.navy} strokeWidth="2" strokeLinejoin="round" />
          <path d="M10 12 a14 8 0 0 1 28 0" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 8 l3 4 l-5 0 Z" fill={C.green} />
        </Svg>
      );
    case 'watertank':
      return (
        <Svg size={size}>
          <rect x="14" y="7" width="20" height="36" rx="10" fill={C.blue} stroke={C.navy} strokeWidth="2" />
          <rect x="20" y="3" width="8" height="6" rx="2" fill={C.navy} />
          <path d="M24 19 C24 19 18 26 18 30 a6 6 0 0 0 12 0 C30 26 24 19 24 19 Z" fill={C.cream} stroke={C.navy} strokeWidth="1.5" />
        </Svg>
      );
    case 'food':
      return (
        <Svg size={size}>
          <rect x="6" y="14" width="36" height="26" rx="4" fill={C.orange} stroke={C.navy} strokeWidth="2" />
          <path d="M6 22 H42" stroke={C.navy} strokeWidth="2" />
          <circle cx="24" cy="31" r="5.5" fill={C.red} stroke={C.navy} strokeWidth="1.5" />
          <path d="M24 25 q1 -4 4 -4" stroke={C.green} strokeWidth="2" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'greenhouse':
      return (
        <Svg size={size}>
          <path d="M6 40 V26 Q6 8 24 8 Q42 8 42 26 V40 Z" fill={C.lblue} fillOpacity="0.55" stroke={C.navy} strokeWidth="2" />
          <path d="M24 40 V26 M24 32 q-8 -2 -9 -9 q8 0 9 9 M24 30 q8 -2 9 -9 q-8 0 -9 9" fill={C.green} stroke={C.navy} strokeWidth="1.6" strokeLinejoin="round" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg size={size}>
          <path d="M24 5 L40 11 V24 Q40 36 24 43 Q8 36 8 24 V11 Z" fill={C.blue} stroke={C.navy} strokeWidth="2" strokeLinejoin="round" />
          <path d="M24 5 V43 M8 20 H40" stroke={C.lblue} strokeWidth="2" />
          <path d="M24 14 l2.5 5 l5.5 0.8 l-4 3.9 l1 5.5 l-5 -2.7 l-5 2.7 l1 -5.5 l-4 -3.9 l5.5 -0.8 Z" fill={C.cream} stroke={C.navy} strokeWidth="1" strokeLinejoin="round" transform="translate(0 2) scale(0.9) translate(2.6 0)" />
        </Svg>
      );
    case 'excavator':
      return (
        <Svg size={size}>
          <rect x="6" y="26" width="26" height="10" rx="3" fill={C.orange} stroke={C.navy} strokeWidth="2" />
          <circle cx="12" cy="38" r="5" fill={C.navy} />
          <circle cx="27" cy="38" r="5" fill={C.navy} />
          <path d="M28 28 L40 14 L44 20 L36 30" fill="none" stroke={C.navy} strokeWidth="3" strokeLinejoin="round" />
          <path d="M40 14 L46 22 L40 24 Z" fill={C.moon} stroke={C.navy} strokeWidth="2" strokeLinejoin="round" />
          <rect x="9" y="20" width="12" height="8" rx="2" fill={C.lblue} stroke={C.navy} strokeWidth="2" />
        </Svg>
      );
    case 'shelter':
      return (
        <Svg size={size}>
          <path d="M5 40 V26 Q5 12 24 12 Q43 12 43 26 V40 Z" fill={C.moon} stroke={C.navy} strokeWidth="2" />
          <rect x="18" y="26" width="12" height="14" rx="2" fill={C.navy} />
          <path d="M5 22 H43" stroke={C.yellow} strokeWidth="3" strokeDasharray="5 4" />
          <path d="M21 33 h6 m-2.5 -2.5 l2.5 2.5 l-2.5 2.5" stroke={C.yellow} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'spare':
      return (
        <Svg size={size}>
          <circle cx="20" cy="26" r="11" fill={C.moon} stroke={C.navy} strokeWidth="2" />
          <circle cx="20" cy="26" r="4" fill={C.cream} stroke={C.navy} strokeWidth="2" />
          <path d="M20 12 v-4 M20 44 v-4 M6 26 h-4 M38 26 h-4" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />
          <path d="M30 14 L42 6 M38 4 l6 6" stroke={C.orange} strokeWidth="4" strokeLinecap="round" />
        </Svg>
      );
  }
}

export type ResIcon =
  | 'power'
  | 'oxygen'
  | 'water'
  | 'food'
  | 'radiation'
  | 'shield'
  | 'morale'
  | 'science'
  | 'sun'
  | 'moon'
  | 'earth'
  | 'mass'
  | 'day'
  | 'clock'
  | 'spare';

export function ResourceIcon({ id, size = 28 }: { id: ResIcon; size?: number }) {
  switch (id) {
    case 'power':
      return (
        <Svg size={size}>
          <path d="M27 4 L10 28 H22 L19 44 L38 18 H26 Z" fill={C.yellow} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
        </Svg>
      );
    case 'oxygen':
      return (
        <Svg size={size}>
          <circle cx="24" cy="24" r="19" fill={C.lblue} stroke={C.navy} strokeWidth="2.5" />
          <text x="24" y="30" textAnchor="middle" fontSize="17" fontWeight="800" fill={C.navy} fontFamily="Fredoka, sans-serif">O₂</text>
        </Svg>
      );
    case 'water':
      return (
        <Svg size={size}>
          <path d="M24 5 C24 5 10 22 10 31 a14 14 0 0 0 28 0 C38 22 24 5 24 5 Z" fill={C.blue} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M17 30 a7 7 0 0 0 5 7" stroke={C.cream} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'food':
      return (
        <Svg size={size}>
          <path d="M24 14 C14 8 6 16 8 27 C10 38 18 44 24 41 C30 44 38 38 40 27 C42 16 34 8 24 14 Z" fill={C.orange} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M24 14 q0 -7 7 -9" stroke={C.green} strokeWidth="3" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'radiation':
      return (
        <Svg size={size}>
          <circle cx="24" cy="24" r="20" fill={C.yellow} stroke={C.navy} strokeWidth="2.5" />
          <path d="M24 24 L24 8 A16 16 0 0 1 37.9 16 Z M24 24 L37.9 32 A16 16 0 0 1 10.1 32 L10.1 32 Z M24 24 L10.1 16 A16 16 0 0 1 24 8 Z" fill={C.navy} />
          <circle cx="24" cy="24" r="4" fill={C.yellow} stroke={C.navy} strokeWidth="2" />
        </Svg>
      );
    case 'shield':
      return <ItemIcon id="shield" size={size} />;
    case 'morale':
      return (
        <Svg size={size}>
          <circle cx="24" cy="24" r="20" fill={C.yellow} stroke={C.navy} strokeWidth="2.5" />
          <circle cx="17" cy="20" r="2.6" fill={C.navy} />
          <circle cx="31" cy="20" r="2.6" fill={C.navy} />
          <path d="M14 29 Q24 40 34 29" stroke={C.navy} strokeWidth="3" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'science':
      return (
        <Svg size={size}>
          <path d="M24 3 L30 17 L45 18 L33.5 28 L37 43 L24 35 L11 43 L14.5 28 L3 18 L18 17 Z" fill={C.yellow} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
        </Svg>
      );
    case 'sun':
      return (
        <Svg size={size}>
          <circle cx="24" cy="24" r="10" fill={C.yellow} stroke={C.navy} strokeWidth="2.5" />
          <path d="M24 3 v7 M24 38 v7 M3 24 h7 M38 24 h7 M9 9 l5 5 M34 34 l5 5 M39 9 l-5 5 M14 34 l-5 5" stroke={C.orange} strokeWidth="3.5" strokeLinecap="round" />
        </Svg>
      );
    case 'moon':
      return (
        <Svg size={size}>
          <path d="M33 6 A19 19 0 1 0 42 33 A15 15 0 0 1 33 6 Z" fill={C.moon} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
        </Svg>
      );
    case 'earth':
      return (
        <Svg size={size}>
          <circle cx="24" cy="24" r="20" fill={C.blue} stroke={C.navy} strokeWidth="2.5" />
          <path d="M14 12 q8 -2 10 4 q-4 4 -2 8 q-6 2 -9 -4 Z M28 28 q8 -4 10 2 q-2 8 -8 10 q-4 -4 -2 -12 Z" fill={C.green} />
        </Svg>
      );
    case 'mass':
      return (
        <Svg size={size}>
          <path d="M14 14 H34 L40 40 H8 Z" fill={C.moon} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="24" cy="13" r="5.5" fill="none" stroke={C.navy} strokeWidth="2.5" />
          <text x="24" y="35" textAnchor="middle" fontSize="13" fontWeight="800" fill={C.navy} fontFamily="Fredoka, sans-serif">kg</text>
        </Svg>
      );
    case 'day':
      return (
        <Svg size={size}>
          <rect x="6" y="9" width="36" height="32" rx="5" fill={C.cream} stroke={C.navy} strokeWidth="2.5" />
          <rect x="6" y="9" width="36" height="9" rx="4" fill={C.orange} stroke={C.navy} strokeWidth="2.5" />
          <path d="M15 5 v8 M33 5 v8" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg size={size}>
          <circle cx="24" cy="24" r="19" fill={C.cream} stroke={C.navy} strokeWidth="2.5" />
          <path d="M24 12 V25 L33 30" stroke={C.navy} strokeWidth="3" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'spare':
      return <ItemIcon id="spare" size={size} />;
  }
}

export type StatusKind = 'ok' | 'warn' | 'broken' | 'off';

/** Status = icon + color + SHAPE, never color alone. */
export function StatusIcon({ kind, size = 24 }: { kind: StatusKind; size?: number }) {
  switch (kind) {
    case 'ok':
      return (
        <Svg size={size}>
          <circle cx="24" cy="24" r="20" fill={C.green} stroke={C.navy} strokeWidth="3" />
          <path d="M14 25 L21 32 L34 17" stroke={C.white} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'warn':
      return (
        <Svg size={size}>
          <path d="M24 4 L45 41 H3 Z" fill={C.yellow} stroke={C.navy} strokeWidth="3" strokeLinejoin="round" />
          <path d="M24 17 V28" stroke={C.navy} strokeWidth="5" strokeLinecap="round" />
          <circle cx="24" cy="34" r="2.8" fill={C.navy} />
        </Svg>
      );
    case 'broken':
      return (
        <Svg size={size}>
          <path d="M16 3 H32 L45 16 V32 L32 45 H16 L3 32 V16 Z" fill={C.red} stroke={C.navy} strokeWidth="3" strokeLinejoin="round" />
          <path d="M16 16 L32 32 M32 16 L16 32" stroke={C.white} strokeWidth="5" strokeLinecap="round" />
        </Svg>
      );
    case 'off':
      return (
        <Svg size={size}>
          <rect x="5" y="5" width="38" height="38" rx="6" fill={C.moon} stroke={C.navy} strokeWidth="3" />
          <path d="M24 12 V24 M16 17 a11 11 0 1 0 16 0" stroke={C.navy} strokeWidth="4" fill="none" strokeLinecap="round" />
        </Svg>
      );
  }
}

export type FaceKind = 'happy' | 'tired' | 'sick' | 'critical';

export function faceFor(health: number): FaceKind {
  if (health >= 70) return 'happy';
  if (health >= 40) return 'tired';
  if (health >= 20) return 'sick';
  return 'critical';
}

/** Round face with a suit-colored ring; the mouth/eyes shape changes with health. */
export function Face({ kind, ring = C.blue, size = 36 }: { kind: FaceKind; ring?: string; size?: number }) {
  const fill = { happy: C.yellow, tired: '#F6D88A', sick: '#B9D9A6', critical: '#F2A1A1' }[kind];
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="21" fill={ring} stroke={C.navy} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="15" fill={fill} stroke={C.navy} strokeWidth="2" />
      {kind === 'happy' && (
        <>
          <circle cx="19" cy="21" r="2" fill={C.navy} />
          <circle cx="29" cy="21" r="2" fill={C.navy} />
          <path d="M17 28 Q24 35 31 28" stroke={C.navy} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === 'tired' && (
        <>
          <path d="M16.5 21 h5 M26.5 21 h5" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M18 30 H30" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {kind === 'sick' && (
        <>
          <path d="M16.5 19 l5 4 m0 -4 l-5 4 M26.5 19 l5 4 m0 -4 l-5 4" stroke={C.navy} strokeWidth="2" strokeLinecap="round" />
          <path d="M17 31 q2 -3 4 0 q2 3 4 0 q2 -3 4 0" stroke={C.navy} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === 'critical' && (
        <>
          <circle cx="19" cy="21" r="2.6" fill={C.navy} />
          <circle cx="29" cy="21" r="2.6" fill={C.navy} />
          <path d="M17 33 Q24 26 31 33" stroke={C.navy} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M38 8 v6 M35 11 h6" stroke={C.red} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

export const CREW_COLORS: Record<string, string> = {
  you: C.orange,
  layan: C.blue,
  omar: C.green,
  maya: '#B58BD9',
};

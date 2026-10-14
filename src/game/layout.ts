import { makeRng } from '../engine/rng';
import type { Cargo, ItemId } from '../engine/types';
import type { ModuleId } from '../ui/store';

/**
 * The base on the ground plane, in METRES. (x, y) here is (x, z) in the 3D world:
 * x = east, y = south. The habitat sits at the origin.
 */
export const WORLD_RADIUS = 70;

export interface ModuleLayout {
  id: ModuleId;
  /** packed item(s) that put this module on the map ('always' = always there) */
  needs: ItemId[] | 'always';
  x: number;
  y: number;
  /** which way the module faces (radians, 0 = towards +y / south) */
  face: number;
  /** walk-blocking radius */
  radius: number;
  /** how close (m) the player must be to the interaction point */
  reach: number;
  /** distance of the interaction point in front of the module */
  front: number;
  /** height of the status icon */
  iconY: number;
  fact: string;
}

const toward = (x: number, y: number) => Math.atan2(-x, -y); // face the habitat

export const MODULES: ModuleLayout[] = [
  { id: 'habitat', needs: 'always', x: 0, y: 0, face: 0, radius: 6.6, reach: 4, front: 8.6, iconY: 8.4, fact: 'lunar_radiation' },
  { id: 'cargo', needs: ['o2tank', 'watertank', 'food', 'spare'], x: -11, y: 12, face: toward(-11, 12), radius: 2.6, reach: 4, front: 3.6, iconY: 3.5, fact: 'oxygen_per_day' },
  { id: 'solar', needs: ['solar'], x: -27, y: -4, face: toward(-27, -4), radius: 6, reach: 5, front: 6.5, iconY: 5, fact: 'lunar_dust' },
  { id: 'battery', needs: ['battery'], x: -19, y: 8, face: toward(-19, 8), radius: 2.2, reach: 3.6, front: 3.2, iconY: 3.6, fact: 'lunar_night' },
  { id: 'recycler', needs: ['recycler'], x: -11, y: -12, face: toward(-11, -12), radius: 2.2, reach: 3.6, front: 3.2, iconY: 3.8, fact: 'iss_water' },
  { id: 'o2gen', needs: ['o2gen'], x: 11, y: 11, face: toward(11, 11), radius: 2.2, reach: 3.6, front: 3.2, iconY: 3.8, fact: 'oxygen_per_day' },
  { id: 'greenhouse', needs: ['greenhouse'], x: 18, y: -7, face: toward(18, -7), radius: 4.8, reach: 4, front: 6, iconY: 6, fact: 'veggie' },
  { id: 'shelter', needs: ['shelter'], x: 24, y: 15, face: toward(24, 15), radius: 4, reach: 4, front: 5, iconY: 4.6, fact: 'career_limit' },
  { id: 'reactor', needs: ['reactor'], x: 40, y: -24, face: toward(40, -24), radius: 3.2, reach: 4, front: 4.4, iconY: 8.6, fact: 'lunar_night' },
  { id: 'excavator', needs: ['excavator'], x: 33, y: 2, face: toward(33, 2), radius: 2.8, reach: 4.2, front: 3.8, iconY: 4, fact: 'lunar_radiation' },
];

/** Where the lander touches down and where the commander steps out. */
export const LANDER = { x: -9, y: 23, radius: 3 };
export const PLAYER_START = { x: -3, y: 24, yaw: Math.atan2(-3, 24) };

/** Behind the habitat: where the crew hides from a storm when no shelter was packed. */
export const HIDE_SPOT = { x: 0, y: -9.5, r: 3.6 };

export const TASK_RADIUS = { leak: 1.6, rock: 2.6 };
export const HINT_DIST = { hot: 4, warm: 11 };
export const STORM_SHELTER_R = 3.6;

export function present(m: ModuleLayout, cargo: Cargo): boolean {
  return m.needs === 'always' || m.needs.some((id) => (cargo[id] ?? 0) > 0);
}

export function modulesFor(cargo: Cargo): ModuleLayout[] {
  return MODULES.filter((m) => present(m, cargo));
}

export function moduleById(id: ModuleId): ModuleLayout {
  return MODULES.find((m) => m.id === id)!;
}

/** The spot in front of a module where the player stands to use it. */
export function frontPoint(m: ModuleLayout): { x: number; y: number } {
  return { x: m.x + Math.sin(m.face) * m.front, y: m.y + Math.cos(m.face) * m.front };
}

/** Where a strange rock can turn up (always away from the buildings). */
export const ROCK_SPOTS = [
  { x: -42, y: 26 },
  { x: -36, y: -30 },
  { x: 16, y: -38 },
  { x: 46, y: 26 },
  { x: -8, y: 42 },
  { x: 52, y: -4 },
];

/** Places around the habitat where an air leak can be hiding. */
export const LEAK_SPOTS = [0.6, 1.4, 2.3, 3.4, 4.2, 5.0, 5.8].map((a) => ({
  x: Math.sin(a) * 7.6,
  y: Math.cos(a) * 7.6,
}));

export function rockSpot(seed: number, day: number): { x: number; y: number } {
  return makeRng(seed * 17 + day).pick(ROCK_SPOTS);
}

export function leakSpot(seed: number, day: number): { x: number; y: number } {
  return makeRng(seed * 31 + day).pick(LEAK_SPOTS);
}

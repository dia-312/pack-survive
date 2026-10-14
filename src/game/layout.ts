import type { Cargo, ItemId } from '../engine/types';
import type { ModuleId } from '../ui/store';

export const WORLD_W = 3400;
export const WORLD_H = 1180;
export const HORIZON_Y = 250;
export const WALK_MIN_Y = 300;

export interface ModuleLayout {
  id: ModuleId;
  /** packed item(s) that put this module on the map ('always' = always there) */
  needs: ItemId[] | 'always';
  /** feet position (bottom centre of the sprite) */
  x: number;
  y: number;
  /** sprite size */
  w: number;
  h: number;
  /** walk-blocking footprint around the feet */
  footW: number;
  footH: number;
  /** how close (px) the player must be to the interaction point */
  reach: number;
  /** where the player stands to use it, relative to feet */
  frontDy: number;
  fact: string;
}

export const MODULES: ModuleLayout[] = [
  { id: 'habitat', needs: 'always', x: 1700, y: 640, w: 320, h: 220, footW: 270, footH: 70, reach: 150, frontDy: 40, fact: 'lunar_radiation' },
  { id: 'cargo', needs: ['o2tank', 'watertank', 'food', 'spare'], x: 1350, y: 900, w: 220, h: 130, footW: 190, footH: 50, reach: 130, frontDy: 36, fact: 'oxygen_per_day' },
  { id: 'solar', needs: ['solar'], x: 640, y: 600, w: 380, h: 170, footW: 340, footH: 50, reach: 200, frontDy: 40, fact: 'lunar_dust' },
  { id: 'battery', needs: ['battery'], x: 1000, y: 760, w: 160, h: 110, footW: 130, footH: 40, reach: 120, frontDy: 36, fact: 'lunar_night' },
  { id: 'recycler', needs: ['recycler'], x: 1320, y: 470, w: 160, h: 130, footW: 130, footH: 40, reach: 125, frontDy: 36, fact: 'iss_water' },
  { id: 'o2gen', needs: ['o2gen'], x: 2040, y: 880, w: 170, h: 130, footW: 140, footH: 40, reach: 125, frontDy: 36, fact: 'oxygen_per_day' },
  { id: 'greenhouse', needs: ['greenhouse'], x: 2260, y: 600, w: 240, h: 190, footW: 210, footH: 55, reach: 150, frontDy: 40, fact: 'veggie' },
  { id: 'shelter', needs: ['shelter'], x: 2640, y: 900, w: 210, h: 130, footW: 180, footH: 45, reach: 130, frontDy: 36, fact: 'career_limit' },
  { id: 'reactor', needs: ['reactor'], x: 3040, y: 470, w: 170, h: 210, footW: 130, footH: 45, reach: 130, frontDy: 36, fact: 'lunar_night' },
  { id: 'excavator', needs: ['excavator'], x: 2900, y: 760, w: 190, h: 130, footW: 150, footH: 40, reach: 130, frontDy: 36, fact: 'lunar_radiation' },
];

export const LANDER = { x: 1560, y: 960, w: 150, h: 190 };
export const PLAYER_START = { x: 1560, y: 1000 };

/** Spot behind the habitat where the crew hides from a storm when no shelter was packed. */
export const HIDE_SPOT = { x: 1700, y: 515, r: 95 };

export function present(m: ModuleLayout, cargo: Cargo): boolean {
  return m.needs === 'always' || m.needs.some((id) => (cargo[id] ?? 0) > 0);
}

export function modulesFor(cargo: Cargo): ModuleLayout[] {
  return MODULES.filter((m) => present(m, cargo));
}

export function moduleById(id: ModuleId): ModuleLayout {
  return MODULES.find((m) => m.id === id)!;
}

export function frontPoint(m: ModuleLayout): { x: number; y: number } {
  return { x: m.x, y: m.y + m.frontDy };
}

/** Where a strange rock can turn up (always far from the buildings). */
export const ROCK_SPOTS = [
  { x: 300, y: 900 },
  { x: 420, y: 380 },
  { x: 2450, y: 380 },
  { x: 3200, y: 960 },
  { x: 1100, y: 1060 },
  { x: 2000, y: 400 },
];

/** Places around the habitat where an air leak can be hiding. */
export const LEAK_SPOTS = [
  { x: 1450, y: 720 },
  { x: 1960, y: 720 },
  { x: 1700, y: 790 },
  { x: 1520, y: 560 },
  { x: 1890, y: 560 },
  { x: 1280, y: 640 },
  { x: 2130, y: 700 },
];

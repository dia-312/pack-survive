import * as THREE from 'three';
import { hazardTexture, hullTexture, regolithTexture, solarTexture } from './textures';

/** Low-poly models built from primitives (no model files). Sizes are in metres. */

const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });

export const MAT = {
  white: std(0xeeeae0, { roughness: 0.55 }),
  hull: std(0xffffff, { map: hullTexture(), roughness: 0.6 }),
  gold: std(0xd9a93a, { metalness: 1, roughness: 0.28 }),
  navy: std(0x14213d, { roughness: 0.5 }),
  orange: std(0xf28c28, { roughness: 0.45 }),
  blue: std(0x3fa7d6, { roughness: 0.45 }),
  lblue: std(0x8fd3f0, { roughness: 0.4 }),
  gray: std(0x8e887c, { roughness: 0.85 }),
  metal: std(0x5a606e, { metalness: 0.7, roughness: 0.35 }),
  dark: std(0x23262e, { roughness: 0.7 }),
  green: std(0x4caf6a, { roughness: 0.5 }),
  leaf: std(0x3f9a4a, { roughness: 0.8 }),
  soil: std(0x5b4130, { roughness: 1 }),
  red: std(0xe5484d, { roughness: 0.5 }),
  regolith: std(0xa7a091, { map: regolithTexture(), roughness: 1 }),
  hazard: std(0xffffff, { map: hazardTexture(), roughness: 0.6 }),
  window: new THREE.MeshStandardMaterial({ color: 0xffe3a0, emissive: 0xffc35a, emissiveIntensity: 0.6, roughness: 0.2 }),
  led: new THREE.MeshStandardMaterial({ color: 0x9cf5b0, emissive: 0x4cff7a, emissiveIntensity: 2 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false }),
  visor: std(0xc8962c, { metalness: 1, roughness: 0.12 }),
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface ModuleModel {
  group: THREE.Group;
  /** materials/objects the world animates or recolours */
  parts: Record<string, THREE.Object3D | THREE.Material | THREE.Object3D[]>;
}

export function habitat(): ModuleModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(6.2, 6.5, 0.9, 48), MAT.gray, 0, 0.45, 0));
  const dome = mesh(new THREE.SphereGeometry(6, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), MAT.hull, 0, 0.9, 0);
  g.add(dome);
  const band = mesh(new THREE.TorusGeometry(6.02, 0.14, 8, 64), MAT.orange, 0, 1.1, 0);
  band.rotation.x = Math.PI / 2;
  g.add(band);
  const windows: THREE.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const el = 0.55;
    const w = mesh(new THREE.SphereGeometry(0.62, 16, 10), MAT.window);
    w.scale.set(1, 1, 0.35);
    const r = 6;
    w.position.set(Math.sin(a) * Math.cos(el) * r, 0.9 + Math.sin(el) * r, Math.cos(a) * Math.cos(el) * r);
    w.lookAt(w.position.clone().multiplyScalar(2));
    w.castShadow = false;
    g.add(w);
    windows.push(w);
  }
  // airlock tunnel and door (facing +z)
  const tunnel = mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 24), MAT.white, 0, 1.7, 6.6);
  tunnel.rotation.x = Math.PI / 2;
  g.add(tunnel);
  const ring = mesh(new THREE.TorusGeometry(1.5, 0.12, 8, 32), MAT.navy, 0, 1.7, 8.2);
  g.add(ring);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3b4a6b, emissive: 0xffc35a, emissiveIntensity: 0.15, roughness: 0.4, metalness: 0.3 });
  const door = mesh(new THREE.CircleGeometry(1.25, 32), doorMat, 0, 1.7, 8.22);
  g.add(door);
  const hatch = mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 24), MAT.orange, 0, 1.7, 8.25);
  g.add(hatch);
  // antenna and dish
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), MAT.metal, 0, 7.9, 0));
  const dish = mesh(new THREE.SphereGeometry(0.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), MAT.gold, 0, 9.3, 0);
  dish.rotation.x = Math.PI * 0.75;
  g.add(dish);
  // side pods
  for (const s of [-1, 1]) {
    const pod = mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.8, 20), MAT.white, s * 6.6, 1.2, -1.5);
    pod.rotation.z = Math.PI / 2;
    g.add(pod);
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.5, 1.2), s < 0 ? MAT.orange : MAT.blue, s * 8.05, 1.2, -1.5));
  }
  return { group: g, parts: { windows } };
}

export function solarField(): ModuleModel {
  const g = new THREE.Group();
  const panelMat = new THREE.MeshStandardMaterial({ map: solarTexture(), roughness: 0.25, metalness: 0.4, color: 0xffffff });
  const panels: THREE.Object3D[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x = (col - 1) * 3.3;
      const z = (row - 0.5) * 3.2;
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 8), MAT.metal, x, 0.7, z));
      const p = mesh(new THREE.BoxGeometry(3, 0.07, 2), panelMat, x, 1.45, z);
      p.rotation.x = -0.55;
      g.add(p);
      panels.push(p);
    }
  }
  // crack marks (shown after a micrometeoroid hit)
  const crack = new THREE.Group();
  const crackMat = new THREE.MeshStandardMaterial({ color: 0xff5555, emissive: 0xff2222, emissiveIntensity: 1.5 });
  for (const [x, z, rot, len] of [
    [-3.3, -1.6, 0.4, 1.2],
    [-3.1, -1.4, -0.7, 0.8],
    [0.2, 1.5, 1.1, 1],
  ] as const) {
    const c = mesh(new THREE.BoxGeometry(len, 0.02, 0.06), crackMat, x, 1.52, z);
    c.rotation.set(-0.55, rot, 0);
    crack.add(c);
  }
  crack.visible = false;
  g.add(crack);
  return { group: g, parts: { panelMat, crack, panels } };
}

export function batteryBank(): ModuleModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(4.2, 0.3, 2), MAT.gray, 0, 0.15, 0));
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.3;
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.7, 20), MAT.green, x, 1.15, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.18, 20), MAT.white, x, 1.4, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 12), MAT.metal, x, 2.1, 0));
    g.add(mesh(new THREE.SphereGeometry(0.07, 8, 8), MAT.led, x, 1.0, 0.5));
  }
  return { group: g, parts: {} };
}

export function reactor(): ModuleModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(4.6, 0.6, 4.6), MAT.gray, 0, 0.3, 0));
  const stripe = mesh(new THREE.BoxGeometry(4.7, 0.25, 4.7), MAT.hazard, 0, 0.55, 0);
  g.add(stripe);
  g.add(mesh(new THREE.CylinderGeometry(1.3, 1.5, 4.5, 28), MAT.white, 0, 2.85, 0));
  g.add(mesh(new THREE.ConeGeometry(1.3, 1.4, 28), MAT.white, 0, 5.8, 0));
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0xf28c28, emissiveIntensity: 2.2 });
  const glow = mesh(new THREE.TorusGeometry(1.42, 0.12, 10, 40), glowMat, 0, 3.4, 0);
  glow.rotation.x = Math.PI / 2;
  g.add(glow);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const fin = mesh(new THREE.BoxGeometry(0.1, 3.6, 2.4), MAT.blue, Math.sin(a) * 2.4, 3, Math.cos(a) * 2.4);
    fin.rotation.y = a;
    g.add(fin);
  }
  return { group: g, parts: { glowMat } };
}

export function oxygenGenerator(): ModuleModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2.6, 1.6, 1.7), MAT.lblue, 0, 0.8, 0));
  g.add(mesh(new THREE.BoxGeometry(2.7, 0.15, 1.8), MAT.navy, 0, 1.65, 0));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.2, 18), MAT.white, s * 1.75, 1.1, 0));
    g.add(mesh(new THREE.SphereGeometry(0.38, 18, 10), MAT.white, s * 1.75, 2.2, 0));
  }
  const pipe = mesh(new THREE.TorusGeometry(1.75, 0.07, 6, 30, Math.PI), MAT.metal, 0, 2.2, 0);
  g.add(pipe);
  g.add(mesh(new THREE.SphereGeometry(0.09, 8, 8), MAT.led, 0.9, 1.3, 0.86));
  // "bubbles" emblem
  for (const [x, y, r] of [[-0.4, 0.9, 0.22], [0, 1.15, 0.3], [0.35, 0.8, 0.16]] as const) {
    g.add(mesh(new THREE.SphereGeometry(r, 14, 10), MAT.white, x, y, 0.86));
  }
  return { group: g, parts: {} };
}

export function waterRecycler(): ModuleModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2.6, 1.6, 1.7), MAT.white, 0, 0.8, 0));
  g.add(mesh(new THREE.BoxGeometry(2.7, 0.15, 1.8), MAT.navy, 0, 1.65, 0));
  const drop = new THREE.Group();
  drop.add(mesh(new THREE.SphereGeometry(0.38, 18, 12), MAT.blue, 0, 0, 0));
  const tip = mesh(new THREE.ConeGeometry(0.33, 0.55, 18), MAT.blue, 0, 0.42, 0);
  drop.add(tip);
  drop.position.set(0, 0.85, 0.9);
  g.add(drop);
  const arrows = mesh(new THREE.TorusGeometry(0.7, 0.06, 6, 30, Math.PI * 1.6), MAT.green, 0, 0.9, 0.88);
  g.add(arrows);
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 14), MAT.metal, s * 0.9, 2.05, 0));
  return { group: g, parts: { arrows } };
}

export function greenhouse(): ModuleModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(4.3, 4.4, 0.5, 40), MAT.gray, 0, 0.25, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glass);
  dome.position.y = 0.5;
  dome.renderOrder = 2;
  g.add(dome);
  for (let i = 0; i < 4; i++) {
    const rib = mesh(new THREE.TorusGeometry(4.22, 0.05, 6, 40, Math.PI), MAT.white, 0, 0.5, 0);
    rib.rotation.y = (i / 4) * Math.PI;
    g.add(rib);
  }
  const plants: THREE.Object3D[] = [];
  for (const [x, z] of [[-1.8, -1], [0, -1.2], [1.8, -1], [-1.8, 1.2], [0, 1.2], [1.8, 1.2]] as const) {
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.5, 1.2), MAT.soil, x, 0.75, z));
    const p = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      p.add(mesh(new THREE.SphereGeometry(0.32, 10, 8), MAT.leaf, (k - 1) * 0.4, 1.2, 0));
    }
    p.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), MAT.red, 0.2, 1.4, 0.2));
    p.position.set(x, 0, z);
    g.add(p);
    plants.push(p);
  }
  const growMat = new THREE.MeshStandardMaterial({ color: 0xff8fd8, emissive: 0xd94bb0, emissiveIntensity: 1.6 });
  const lamp = mesh(new THREE.BoxGeometry(4.6, 0.08, 0.25), growMat, 0, 3, 0);
  g.add(lamp);
  return { group: g, parts: { plants, growMat } };
}

export function stormShelter(): ModuleModel {
  const g = new THREE.Group();
  const mound = mesh(new THREE.SphereGeometry(3.8, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), MAT.regolith, 0, 0, 0);
  mound.scale.y = 0.7;
  g.add(mound);
  const frame = mesh(new THREE.BoxGeometry(2.4, 2.4, 1.6), MAT.hazard, 0, 1.2, 3.1);
  g.add(frame);
  g.add(mesh(new THREE.BoxGeometry(1.7, 1.9, 0.1), MAT.dark, 0, 1.05, 3.92));
  const signMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xf2c94c, emissiveIntensity: 1.2 });
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 0.05), signMat, 0, 2.2, 3.95));
  return { group: g, parts: { signMat } };
}

export function excavator(): ModuleModel {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh(new THREE.BoxGeometry(1.6, 0.8, 2.4), MAT.orange, 0, 0.9, 0));
  body.add(mesh(new THREE.BoxGeometry(1.3, 0.8, 1), MAT.lblue, 0, 1.6, -0.5));
  for (const sx of [-1, 1])
    for (const sz of [-0.8, 0.8]) {
      const w = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16), MAT.navy, sx * 0.95, 0.45, sz);
      w.rotation.z = Math.PI / 2;
      body.add(w);
    }
  const arm = new THREE.Group();
  arm.position.set(0, 1.3, 1);
  const a1 = mesh(new THREE.BoxGeometry(0.25, 0.25, 1.8), MAT.navy, 0, 0.35, 0.8);
  a1.rotation.x = -0.4;
  arm.add(a1);
  const bucket = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), MAT.metal, 0, 0.6, 1.75);
  arm.add(bucket);
  body.add(arm);
  g.add(body);
  return { group: g, parts: { body, arm } };
}

export function cargoPile(): ModuleModel {
  const g = new THREE.Group();
  for (const [x, z, s] of [[-1.2, 0.3, 1], [0, 0.6, 0.85], [-0.6, -0.8, 0.9]] as const) {
    const c = mesh(new THREE.BoxGeometry(1.1 * s, 0.9 * s, 0.9 * s), MAT.orange, x, 0.45 * s, z);
    c.rotation.y = x;
    g.add(c);
  }
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), MAT.orange, -0.9, 1.25, 0.2));
  for (const [x, z, m] of [[1.2, -0.4, MAT.lblue], [1.7, 0.4, MAT.blue], [1, 0.9, MAT.lblue]] as const) {
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 16), m, x, 0.75, z));
  }
  const spare = mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), MAT.gray, 0.3, 0.25, -1.1);
  g.add(spare);
  const gear = mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 10), MAT.metal, 0.3, 0.3, -0.79);
  g.add(gear);
  return { group: g, parts: {} };
}

export function lander(): THREE.Group {
  const g = new THREE.Group();
  const descent = mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.3, 8), MAT.gold, 0, 1.6, 0);
  g.add(descent);
  const ascent = mesh(new THREE.CylinderGeometry(1.2, 1.4, 1.7, 16), MAT.white, 0, 3.1, 0);
  g.add(ascent);
  g.add(mesh(new THREE.ConeGeometry(1.2, 0.9, 16), MAT.white, 0, 4.4, 0));
  const win = mesh(new THREE.CircleGeometry(0.35, 16), MAT.window, 0, 3.3, 1.3);
  g.add(win);
  g.add(mesh(new THREE.BoxGeometry(0.9, 1.2, 0.1), MAT.navy, 0, 1.6, 1.62));
  g.add(mesh(new THREE.ConeGeometry(0.6, 0.8, 16, 1, true), MAT.dark, 0, 0.75, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), MAT.metal, Math.sin(a) * 2.1, 0.95, Math.cos(a) * 2.1);
    leg.rotation.set(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
    g.add(leg);
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.1, 12), MAT.metal, Math.sin(a) * 2.55, 0.05, Math.cos(a) * 2.55));
  }
  return g;
}

export interface Astronaut {
  group: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
}

/** An original, friendly astronaut: white suit, gold visor, coloured stripe. */
export function astronaut(accent: number): Astronaut {
  const g = new THREE.Group();
  const accentMat = std(accent, { roughness: 0.5 });
  const leg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.85, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 10), MAT.white, 0, -0.4, 0));
    pivot.add(mesh(new THREE.BoxGeometry(0.22, 0.14, 0.32), MAT.dark, 0, -0.78, 0.05));
    g.add(pivot);
    return pivot;
  };
  const legL = leg(-0.15);
  const legR = leg(0.15);
  g.add(mesh(new THREE.CapsuleGeometry(0.3, 0.4, 4, 14), MAT.white, 0, 1.2, 0));
  const stripe = mesh(new THREE.TorusGeometry(0.31, 0.05, 6, 20), accentMat, 0, 1.12, 0);
  stripe.rotation.x = Math.PI / 2;
  g.add(stripe);
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.6, 0.25), MAT.gray, 0, 1.25, -0.3));
  const arm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.45, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.09, 0.45, 4, 8), MAT.white, 0, -0.3, 0));
    g.add(pivot);
    return pivot;
  };
  const armL = arm(-0.38);
  const armR = arm(0.38);
  g.add(mesh(new THREE.SphereGeometry(0.27, 20, 14), MAT.white, 0, 1.78, 0));
  const visor = mesh(new THREE.SphereGeometry(0.22, 18, 12, -Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.3, Math.PI * 0.4), MAT.visor, 0, 1.79, 0.08);
  g.add(visor);
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), accentMat, 0, 2.08, 0));
  return { group: g, legL, legR, armL, armR };
}

/** Radar, the original helper robot: a hovering ball with one big eye. */
export function radarBot(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.28, 20, 14), MAT.white));
  const band = mesh(new THREE.SphereGeometry(0.285, 20, 8, 0, Math.PI * 2, Math.PI * 0.38, Math.PI * 0.24), MAT.navy);
  g.add(band);
  const eye = mesh(
    new THREE.CircleGeometry(0.09, 16),
    new THREE.MeshStandardMaterial({ color: 0x8fd3f0, emissive: 0x3fa7d6, emissiveIntensity: 2 }),
    0,
    0,
    0.286,
  );
  g.add(eye);
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), MAT.metal, 0, 0.36, 0));
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 8), MAT.orange, 0, 0.5, 0));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.18, 0.12), MAT.orange, s * 0.31, 0, 0));
  return g;
}

/** The glowing strange rock (a made-up mineral, it is a game). */
export function strangeRock(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.DodecahedronGeometry(0.9, 0), std(0x5d5fa8, { roughness: 0.7, flatShading: true }), 0, 0.5, 0));
  const crystal = new THREE.MeshStandardMaterial({ color: 0xb6f3ff, emissive: 0x3fd0ff, emissiveIntensity: 2.2, roughness: 0.2 });
  for (const [x, y, z, s] of [[0.4, 1.1, 0.2, 0.35], [-0.3, 1.0, 0.4, 0.25], [0.1, 1.25, -0.3, 0.3]] as const) {
    g.add(mesh(new THREE.OctahedronGeometry(s, 0), crystal, x, y, z));
  }
  return g;
}

export function rock(size: number, seedish: number): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(size, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.75 + (((i * 7919 + seedish * 31) % 100) / 100) * 0.45;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = mesh(geo, std(0x8a8477, { roughness: 1, flatShading: true }));
  return m;
}

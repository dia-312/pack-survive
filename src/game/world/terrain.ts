import * as THREE from 'three';
import { makeRng } from '../../engine/rng';
import { LANDER, MODULES, ROCK_SPOTS } from '../layout';
import { regolithTexture } from './textures';

/** Deterministic value noise, so the Moon looks the same in every mission. */
function hash(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, z: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = smooth(x - i);
  const fz = smooth(z - j);
  const a = hash(i, j);
  const b = hash(i + 1, j);
  const c = hash(i, j + 1);
  const d = hash(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function fbm(x: number, z: number, oct = 4): number {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < oct; o++) {
    v += (noise(x * f, z * f) - 0.5) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return v;
}
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Crater {
  x: number;
  z: number;
  r: number;
  depth: number;
}

/** Craters: a few big ones far out, many small ones nearby, none under a building. */
const CRATERS: Crater[] = (() => {
  const rng = makeRng(42);
  const list: Crater[] = [];
  const blocked = (x: number, z: number, r: number) => {
    for (const m of MODULES) if (Math.hypot(x - m.x, z - m.y) < m.radius + r + 6) return true;
    for (const p of ROCK_SPOTS) if (Math.hypot(x - p.x, z - p.y) < r + 3) return true;
    return Math.hypot(x - LANDER.x, z - LANDER.y) < r + 10;
  };
  for (let i = 0; i < 260 && list.length < 70; i++) {
    const big = i < 30;
    const a = rng.next() * Math.PI * 2;
    const dist = big ? 75 + rng.next() * 110 : 12 + rng.next() * 100;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const r = big ? 10 + rng.next() * 22 : 1.5 + rng.next() * rng.next() * 7;
    if (blocked(x, z, r)) continue;
    list.push({ x, z, r, depth: r * (big ? 0.18 : 0.22) });
  }
  return list;
})();

/** Ground height in metres at (x, z). Flat-ish around the base, rougher further out, hills on the horizon. */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const rough = smoothstep(40, 90, r);
  let h = fbm(x * 0.018, z * 0.018) * 7 * rough + fbm(x * 0.09, z * 0.09, 3) * (0.35 + rough * 1.2);
  h += smoothstep(115, 200, r) * (18 + fbm(x * 0.01 + 7, z * 0.01) * 30);
  for (const c of CRATERS) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d2 = (dx * dx + dz * dz) / (c.r * c.r);
    if (d2 > 2.2) continue;
    const d = Math.sqrt(d2);
    if (d < 1) h -= c.depth * (1 - d2);
    h += c.depth * 0.35 * Math.exp(-((d - 1) * (d - 1)) / 0.03);
  }
  return h;
}

export const TERRAIN_SIZE = 440;

export function buildTerrain(segments: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    // lighter rims, darker maria patches
    const tone = 0.95 + fbm(x * 0.03 + 3, z * 0.03, 3) * 0.5 + Math.max(-0.08, Math.min(0.1, y * 0.02));
    colors[i * 3] = tone;
    colors[i * 3 + 1] = tone * 0.985;
    colors[i * 3 + 2] = tone * 0.95;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: regolithTexture(),
    vertexColors: true,
    roughness: 0.97,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

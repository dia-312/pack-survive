import * as THREE from 'three';
import { makeRng } from '../../engine/rng';

/** Every texture in the game is painted here on a canvas (no image files). */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTexture(c: HTMLCanvasElement, repeat = 1, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached<T extends THREE.Texture>(key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const t = make();
  cache.set(key, t);
  return t;
}

/** Fine regolith speckle for the ground (tiles many times). */
export function regolithTexture(): THREE.CanvasTexture {
  return cached('regolith', () => {
    const [c, g] = canvas(512, 512);
    const rng = makeRng(11);
    g.fillStyle = '#9d978a';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const v = 120 + Math.floor(rng.next() * 90);
      g.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.25 + rng.next() * 0.5})`;
      const r = rng.next() * 2.2;
      g.beginPath();
      g.arc(rng.next() * 512, rng.next() * 512, r, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 120; i++) {
      const x = rng.next() * 512;
      const y = rng.next() * 512;
      const r = 6 + rng.next() * 26;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = rng.next() < 0.5;
      grd.addColorStop(0, dark ? 'rgba(80,76,68,0.16)' : 'rgba(210,205,192,0.16)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return toTexture(c, 70);
  });
}

/** Solar cell grid. */
export function solarTexture(): THREE.CanvasTexture {
  return cached('solar', () => {
    const [c, g] = canvas(256, 256);
    const grd = g.createLinearGradient(0, 0, 256, 256);
    grd.addColorStop(0, '#1d4fa0');
    grd.addColorStop(1, '#0d2a63');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#8fd3f0';
    g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo(i * 32, 0);
      g.lineTo(i * 32, 256);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * 32);
      g.lineTo(256, i * 32);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(140, 0);
    g.lineTo(0, 140);
    g.fill();
    return toTexture(c);
  });
}

/** Hexagon-ish white hull panels for the habitat dome. */
export function hullTexture(): THREE.CanvasTexture {
  return cached('hull', () => {
    const [c, g] = canvas(512, 256);
    g.fillStyle = '#eeeae0';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = 'rgba(80,88,110,0.35)';
    g.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      for (let x = (y / 32) % 2 ? 0 : 32; x < 512; x += 64) {
        g.strokeRect(x, y, 64, 32);
      }
    }
    const rng = makeRng(3);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(120,110,90,${rng.next() * 0.12})`;
      g.fillRect(rng.next() * 512, rng.next() * 256, 30, 12);
    }
    return toTexture(c);
  });
}

/** Yellow/black hazard stripes. */
export function hazardTexture(): THREE.CanvasTexture {
  return cached('hazard', () => {
    const [c, g] = canvas(128, 32);
    g.fillStyle = '#f2c94c';
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#14213d';
    for (let x = -32; x < 160; x += 32) {
      g.beginPath();
      g.moveTo(x, 32);
      g.lineTo(x + 16, 32);
      g.lineTo(x + 32, 0);
      g.lineTo(x + 16, 0);
      g.fill();
    }
    const t = toTexture(c);
    t.repeat.set(4, 1);
    return t;
  });
}

/** Earth seen from the Moon: oceans, continents and clouds (made-up shapes). */
export function earthTexture(): THREE.CanvasTexture {
  return cached('earth', () => {
    const [c, g] = canvas(1024, 512);
    g.fillStyle = '#1e5fa8';
    g.fillRect(0, 0, 1024, 512);
    const rng = makeRng(5);
    const blob = (x: number, y: number, r: number, color: string) => {
      g.fillStyle = color;
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.3) {
        const rr = r * (0.7 + rng.next() * 0.5);
        g.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr);
      }
      g.fill();
    };
    for (let i = 0; i < 9; i++) {
      const x = rng.next() * 1024;
      const y = 110 + rng.next() * 290;
      for (let k = 0; k < 5; k++) blob(x + rng.next() * 80, y + rng.next() * 50, 18 + rng.next() * 34, k === 4 ? '#b9a571' : k % 2 ? '#3f8f4f' : '#4f9a52');
    }
    g.fillStyle = '#f4f8ff';
    g.fillRect(0, 0, 1024, 40);
    g.fillRect(0, 480, 1024, 32);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,255,${0.35 + rng.next() * 0.5})`;
      g.beginPath();
      g.ellipse(rng.next() * 1024, rng.next() * 512, 30 + rng.next() * 80, 6 + rng.next() * 12, rng.next() * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    return toTexture(c);
  });
}

/** Grey Moon with craters (seen from space in the cut-scene). */
export function moonTexture(): THREE.CanvasTexture {
  return cached('moon', () => {
    const [c, g] = canvas(1024, 512);
    g.fillStyle = '#b9b3a6';
    g.fillRect(0, 0, 1024, 512);
    const rng = makeRng(8);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = 'rgba(90,88,84,0.45)';
      g.beginPath();
      g.ellipse(rng.next() * 1024, 80 + rng.next() * 350, 40 + rng.next() * 120, 20 + rng.next() * 60, 0, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 400; i++) {
      const r = 2 + rng.next() * rng.next() * 26;
      const x = rng.next() * 1024;
      const y = rng.next() * 512;
      g.fillStyle = 'rgba(70,68,62,0.5)';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(235,230,220,0.6)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.7);
      g.stroke();
    }
    return toTexture(c);
  });
}

/** Soft round glow for lights, the Sun and dust puffs. */
export function glowTexture(): THREE.CanvasTexture {
  return cached('glow', () => {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return toTexture(c, 1);
  });
}

export function smokeTexture(): THREE.CanvasTexture {
  return cached('smoke', () => {
    const [c, g] = canvas(128, 128);
    const rng = makeRng(2);
    for (let i = 0; i < 18; i++) {
      const x = 64 + (rng.next() - 0.5) * 50;
      const y = 64 + (rng.next() - 0.5) * 50;
      const grd = g.createRadialGradient(x, y, 0, x, y, 30 + rng.next() * 20);
      grd.addColorStop(0, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
    }
    return toTexture(c, 1);
  });
}

/** Status badges floating above modules: shape + colour + symbol, never colour alone. */
export function statusTexture(kind: 'ok' | 'warn' | 'broken' | 'off'): THREE.CanvasTexture {
  return cached(`status_${kind}`, () => {
    const [c, g] = canvas(128, 128);
    g.lineWidth = 8;
    g.strokeStyle = '#14213d';
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (kind === 'ok') {
      g.fillStyle = '#4caf6a';
      g.beginPath();
      g.arc(64, 64, 54, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.strokeStyle = '#fff';
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(36, 66);
      g.lineTo(56, 86);
      g.lineTo(94, 42);
      g.stroke();
    } else if (kind === 'warn') {
      g.fillStyle = '#f2c94c';
      g.beginPath();
      g.moveTo(64, 8);
      g.lineTo(122, 116);
      g.lineTo(6, 116);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#14213d';
      g.fillRect(57, 42, 14, 42);
      g.beginPath();
      g.arc(64, 100, 8, 0, Math.PI * 2);
      g.fill();
    } else if (kind === 'broken') {
      g.fillStyle = '#e5484d';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i * Math.PI) / 4;
        g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
      }
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = '#fff';
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(42, 42);
      g.lineTo(86, 86);
      g.moveTo(86, 42);
      g.lineTo(42, 86);
      g.stroke();
    } else {
      g.fillStyle = '#c9c2b3';
      g.beginPath();
      g.roundRect(10, 10, 108, 108, 18);
      g.fill();
      g.stroke();
      g.strokeStyle = '#14213d';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(64, 70, 28, -Math.PI * 0.3, Math.PI * 1.3);
      g.stroke();
      g.beginPath();
      g.moveTo(64, 30);
      g.lineTo(64, 66);
      g.stroke();
    }
    return toTexture(c, 1);
  });
}

/** Big orange "here" arrow over the module you can open. */
export function arrowTexture(): THREE.CanvasTexture {
  return cached('arrow', () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#f28c28';
    g.strokeStyle = '#14213d';
    g.lineWidth = 8;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(40, 8);
    g.lineTo(88, 8);
    g.lineTo(88, 60);
    g.lineTo(116, 60);
    g.lineTo(64, 120);
    g.lineTo(12, 60);
    g.lineTo(40, 60);
    g.closePath();
    g.fill();
    g.stroke();
    return toTexture(c, 1);
  });
}

/** Little emote bubbles above tired / sick crew. */
export function emoteTexture(kind: 'tired' | 'sick' | 'critical'): THREE.CanvasTexture {
  return cached(`emote_${kind}`, () => {
    const [c, g] = canvas(128, 128);
    const fill = { tired: '#8fd3f0', sick: '#b9d9a6', critical: '#f2a1a1' }[kind];
    g.fillStyle = fill;
    g.strokeStyle = '#14213d';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.font = 'bold 64px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = kind === 'critical' ? '#e5484d' : '#14213d';
    g.fillText(kind === 'tired' ? 'z' : kind === 'sick' ? '~' : '+', 64, 68);
    return toTexture(c, 1);
  });
}

/** Sky gradient for the Earth launch scene. */
export function earthSkyTexture(): THREE.CanvasTexture {
  return cached('earthsky', () => {
    const [c, g] = canvas(16, 512);
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0b1d48');
    grd.addColorStop(0.45, '#3f7fc9');
    grd.addColorStop(0.75, '#9fd2f2');
    grd.addColorStop(1, '#f7d9b0');
    g.fillStyle = grd;
    g.fillRect(0, 0, 16, 512);
    const t = toTexture(c, 1);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

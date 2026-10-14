import Phaser from 'phaser';
import { makeRng } from '../engine/rng';

/** Every picture in the game is drawn here with code (no image files). */
const NAVY = 0x14213d;
const CREAM = 0xf6f3ec;
const ORANGE = 0xf28c28;
const BLUE = 0x3fa7d6;
const LBLUE = 0x8fd3f0;
const MOON = 0xc9c2b3;
const MOOND = 0xa39b8a;
const GREEN = 0x4caf6a;
const RED = 0xe5484d;
const YELLOW = 0xf2c94c;
const WHITE = 0xffffff;

type G = Phaser.GameObjects.Graphics;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false) as G;
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function box(g: G, x: number, y: number, w: number, h: number, fill: number, r = 8, lw = 3): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(lw, NAVY, 1);
  g.strokeRoundedRect(x, y, w, h, r);
}
function circ(g: G, x: number, y: number, r: number, fill: number, lw = 3): void {
  g.fillStyle(fill, 1);
  g.fillCircle(x, y, r);
  if (lw) {
    g.lineStyle(lw, NAVY, 1);
    g.strokeCircle(x, y, r);
  }
}
function poly(g: G, pts: number[][], fill: number, lw = 3): void {
  g.fillStyle(fill, 1);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.closePath();
  g.fillPath();
  if (lw) {
    g.lineStyle(lw, NAVY, 1);
    g.strokePath();
  }
}
function shadow(g: G, cx: number, cy: number, w: number, h: number): void {
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(cx, cy, w, h);
}

function astronaut(scene: Phaser.Scene, key: string, accent: number, commander: boolean): void {
  tex(scene, key, 48, 64, (g) => {
    // legs
    box(g, 12, 42, 10, 18, CREAM, 4, 2.5);
    box(g, 26, 42, 10, 18, CREAM, 4, 2.5);
    g.fillStyle(accent, 1);
    g.fillRoundedRect(12, 54, 10, 6, 3);
    g.fillRoundedRect(26, 54, 10, 6, 3);
    // backpack
    box(g, 8, 20, 32, 28, MOON, 8, 2.5);
    // body
    box(g, 11, 22, 26, 26, CREAM, 8, 3);
    g.fillStyle(accent, 1);
    g.fillRoundedRect(15, 36, 18, 6, 3);
    if (commander) {
      g.fillStyle(YELLOW, 1);
      g.fillCircle(31, 29, 3);
    }
    // arms
    box(g, 3, 24, 9, 18, CREAM, 4, 2.5);
    box(g, 36, 24, 9, 18, CREAM, 4, 2.5);
    // helmet
    circ(g, 24, 15, 14, CREAM, 3);
    g.fillStyle(NAVY, 1);
    g.fillRoundedRect(12, 8, 24, 15, 7);
    g.fillStyle(LBLUE, 1);
    g.fillRoundedRect(14, 10, 20, 11, 5);
    g.fillStyle(WHITE, 0.8);
    g.fillRoundedRect(17, 11.5, 7, 3, 1.5);
    g.fillStyle(accent, 1);
    g.fillRect(22, 0, 4, 4);
  });
}

function moduleTextures(scene: Phaser.Scene): void {
  // habitat dome ------------------------------------------------------------------
  tex(scene, 'mod_habitat', 320, 220, (g) => {
    shadow(g, 160, 205, 300, 26);
    box(g, 8, 150, 52, 50, MOON, 10);
    box(g, 260, 150, 52, 50, MOON, 10);
    box(g, 30, 140, 260, 62, CREAM, 14);
    g.fillStyle(CREAM, 1);
    g.beginPath();
    g.arc(160, 145, 125, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(4, NAVY, 1);
    g.beginPath();
    g.arc(160, 145, 125, Math.PI, 0, false);
    g.strokePath();
    g.lineStyle(3, MOON, 1);
    for (const r of [60, 95]) {
      g.beginPath();
      g.arc(160, 145, r, Math.PI, 0, false);
      g.strokePath();
    }
    for (const [x, y] of [[90, 100], [160, 78], [230, 100]]) {
      circ(g, x, y, 15, LBLUE, 3);
      g.fillStyle(WHITE, 0.7);
      g.fillCircle(x - 5, y - 5, 4);
    }
    box(g, 130, 150, 60, 52, NAVY, 12, 3);
    g.fillStyle(YELLOW, 0.9);
    g.fillRoundedRect(138, 160, 44, 40, 8);
    g.lineStyle(3, NAVY, 1);
    g.lineBetween(160, 160, 160, 200);
    g.lineStyle(4, NAVY, 1);
    g.lineBetween(160, 22, 160, 4);
    circ(g, 160, 6, 5, ORANGE, 2.5);
    box(g, 46, 168, 50, 14, ORANGE, 4, 2.5);
    box(g, 224, 168, 50, 14, BLUE, 4, 2.5);
  });
  tex(scene, 'glow', 96, 96, (g) => {
    for (let i = 12; i > 0; i--) {
      g.fillStyle(0xffe08a, 0.05 + (12 - i) * 0.012);
      g.fillCircle(48, 48, i * 4);
    }
  });
  // solar field --------------------------------------------------------------------
  tex(scene, 'mod_solar', 380, 170, (g) => {
    shadow(g, 190, 150, 360, 24);
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < 3; c++) {
        const x = 12 + c * 122;
        const y = 10 + row * 66;
        g.lineStyle(4, NAVY, 1);
        g.lineBetween(x + 55, y + 50, x + 55, y + 64);
        poly(g, [[x + 14, y + 4], [x + 104, y + 4], [x + 112, y + 50], [x + 4, y + 50]], BLUE, 3);
        g.lineStyle(2, LBLUE, 1);
        for (let i = 1; i < 4; i++) g.lineBetween(x + 14 - i * 2.5 + i * 22, y + 4, x + 4 + i * 27, y + 50);
        g.lineBetween(x + 9, y + 27, x + 108, y + 27);
        g.fillStyle(WHITE, 0.25);
        g.fillTriangle(x + 14, y + 4, x + 60, y + 4, x + 8, y + 40);
      }
    }
  });
  tex(scene, 'dust_film', 380, 170, (g) => {
    g.fillStyle(0xb6a58a, 0.55);
    for (let row = 0; row < 2; row++)
      for (let c = 0; c < 3; c++) {
        const x = 12 + c * 122;
        const y = 10 + row * 66;
        g.fillRoundedRect(x + 6, y + 6, 100, 42, 8);
      }
  });
  tex(scene, 'crack', 380, 170, (g) => {
    g.lineStyle(3, RED, 1);
    g.lineBetween(138, 18, 150, 38);
    g.lineBetween(150, 38, 142, 52);
    g.lineBetween(150, 38, 166, 46);
    g.lineBetween(260, 84, 270, 100);
    g.lineBetween(270, 100, 262, 112);
    g.lineStyle(3, NAVY, 1);
    g.lineBetween(120, 80, 128, 96);
  });
  // battery bank -------------------------------------------------------------------
  tex(scene, 'mod_battery', 160, 110, (g) => {
    shadow(g, 80, 98, 150, 20);
    box(g, 6, 82, 148, 18, MOON, 6);
    for (let i = 0; i < 3; i++) {
      const x = 14 + i * 46;
      box(g, x, 22, 38, 64, GREEN, 8);
      box(g, x + 11, 14, 16, 10, MOON, 3, 2.5);
      g.fillStyle(CREAM, 1);
      g.fillTriangle(x + 22, 34, x + 12, 56, x + 21, 56);
      g.fillTriangle(x + 17, 76, x + 27, 52, x + 18, 52);
      circ(g, x + 19, 90 - 2, 0, GREEN, 0);
    }
  });
  // reactor ------------------------------------------------------------------------
  tex(scene, 'mod_reactor', 170, 210, (g) => {
    shadow(g, 85, 198, 160, 22);
    box(g, 10, 170, 150, 28, MOON, 6);
    poly(g, [[40, 170], [130, 170], [118, 40], [52, 40]], CREAM, 4);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? YELLOW : NAVY, 1);
      g.fillRect(44 + i * 20, 160, 10, 10);
    }
    box(g, 44, 28, 82, 20, MOON, 6);
    circ(g, 85, 104, 22, ORANGE, 4);
    g.fillStyle(NAVY, 1);
    g.fillTriangle(85, 104, 85, 86, 100, 95);
    g.fillTriangle(85, 104, 100, 112, 85, 122);
    g.fillTriangle(85, 104, 70, 112, 70, 95);
    g.fillStyle(WHITE, 1);
    g.fillCircle(85, 104, 4);
    for (const s of [-1, 1]) {
      const x = s < 0 ? 4 : 130;
      box(g, x, 70, 36, 90, BLUE, 6, 3);
      g.lineStyle(2, LBLUE, 1);
      for (let i = 1; i < 5; i++) g.lineBetween(x + 4, 70 + i * 18, x + 32, 70 + i * 18);
    }
  });
  // oxygen generator --------------------------------------------------------------
  tex(scene, 'mod_o2gen', 170, 130, (g) => {
    shadow(g, 85, 118, 160, 20);
    box(g, 14, 50, 100, 66, LBLUE, 10);
    box(g, 118, 34, 38, 82, CREAM, 14);
    box(g, 124, 26, 26, 12, MOON, 4, 2.5);
    for (const [x, y, r] of [[40, 82, 8], [64, 74, 11], [90, 88, 7], [134, 60, 5], [136, 84, 6]]) {
      g.fillStyle(WHITE, 0.9);
      g.fillCircle(x, y, r);
      g.lineStyle(2, NAVY, 1);
      g.strokeCircle(x, y, r);
    }
    box(g, 30, 20, 20, 32, MOON, 4, 2.5);
    g.lineStyle(4, NAVY, 1);
    g.lineBetween(40, 20, 40, 10);
    g.lineBetween(40, 10, 124, 10);
    g.lineBetween(124, 10, 124, 26);
    circ(g, 100, 60, 4, GREEN, 2);
  });
  // water recycler -----------------------------------------------------------------
  tex(scene, 'mod_recycler', 160, 130, (g) => {
    shadow(g, 80, 118, 150, 20);
    box(g, 14, 38, 132, 78, CREAM, 12);
    box(g, 26, 22, 36, 20, MOON, 5, 2.5);
    box(g, 98, 22, 36, 20, MOON, 5, 2.5);
    g.fillStyle(BLUE, 1);
    g.fillCircle(80, 82, 22);
    g.fillTriangle(80, 38, 62, 74, 98, 74);
    g.lineStyle(3, NAVY, 1);
    g.strokeCircle(80, 82, 22);
    g.lineStyle(5, GREEN, 1);
    g.beginPath();
    g.arc(80, 82, 33, 3.6, 5.5, false);
    g.strokePath();
    g.beginPath();
    g.arc(80, 82, 33, 0.4, 2.3, false);
    g.strokePath();
    g.fillStyle(GREEN, 1);
    g.fillTriangle(110, 56, 124, 62, 114, 70);
    g.fillTriangle(50, 108, 36, 102, 46, 94);
  });
  // greenhouse ---------------------------------------------------------------------
  tex(scene, 'mod_greenhouse', 240, 190, (g) => {
    shadow(g, 120, 178, 230, 22);
    box(g, 12, 130, 216, 40, MOON, 8);
    g.fillStyle(LBLUE, 0.5);
    g.beginPath();
    g.arc(120, 140, 106, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(4, NAVY, 1);
    g.beginPath();
    g.arc(120, 140, 106, Math.PI, 0, false);
    g.strokePath();
    g.lineStyle(3, NAVY, 0.8);
    for (const r of [35, 70]) {
      g.beginPath();
      g.arc(120, 140, r, Math.PI, 0, false);
      g.strokePath();
    }
    g.lineBetween(120, 34, 120, 140);
    for (const x of [58, 100, 142, 184]) {
      g.fillStyle(GREEN, 1);
      g.fillEllipse(x - 8, 118, 22, 12);
      g.fillEllipse(x + 8, 108, 22, 12);
      g.fillEllipse(x, 130, 26, 12);
      g.lineStyle(2, NAVY, 1);
      g.lineBetween(x, 132, x, 150);
    }
    g.fillStyle(RED, 1);
    g.fillCircle(80, 128, 5);
    g.fillCircle(166, 120, 5);
  });
  // storm shelter ------------------------------------------------------------------
  tex(scene, 'mod_shelter', 210, 130, (g) => {
    shadow(g, 105, 118, 200, 20);
    g.fillStyle(MOON, 1);
    g.beginPath();
    g.arc(105, 112, 92, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(4, NAVY, 1);
    g.beginPath();
    g.arc(105, 112, 92, Math.PI, 0, false);
    g.strokePath();
    g.fillStyle(MOOND, 1);
    g.fillRect(20, 96, 170, 16);
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 ? NAVY : YELLOW, 1);
      g.fillRect(24 + i * 20, 98, 10, 12);
    }
    g.fillStyle(NAVY, 1);
    g.fillRoundedRect(75, 52, 60, 60, { tl: 30, tr: 30, bl: 0, br: 0 });
    g.fillStyle(YELLOW, 1);
    g.fillTriangle(95, 88, 115, 88, 105, 70);
    g.fillRect(100, 88, 10, 14);
    box(g, 14, 108, 182, 8, MOOND, 3, 2);
  });
  // excavator ----------------------------------------------------------------------
  tex(scene, 'mod_excavator', 190, 130, (g) => {
    shadow(g, 90, 118, 170, 18);
    box(g, 16, 66, 108, 36, ORANGE, 10);
    box(g, 22, 40, 52, 34, LBLUE, 8);
    g.fillStyle(WHITE, 0.6);
    g.fillRoundedRect(28, 45, 20, 9, 4);
    box(g, 8, 96, 128, 20, NAVY, 10, 2);
    for (const x of [26, 56, 86, 116]) circ(g, x, 106, 8, MOON, 2.5);
    g.lineStyle(9, NAVY, 1);
    g.lineBetween(110, 66, 150, 30);
    g.lineBetween(150, 30, 176, 54);
    g.lineStyle(5, ORANGE, 1);
    g.lineBetween(110, 66, 150, 30);
    g.lineBetween(150, 30, 176, 54);
    poly(g, [[170, 46], [190, 66], [186, 84], [166, 70]], MOON, 3);
  });
  // cargo pile ---------------------------------------------------------------------
  tex(scene, 'mod_cargo', 220, 130, (g) => {
    shadow(g, 110, 118, 210, 20);
    box(g, 12, 70, 64, 48, ORANGE, 6);
    g.lineStyle(3, NAVY, 1);
    g.lineBetween(12, 88, 76, 88);
    circ(g, 44, 104, 7, RED, 2);
    box(g, 82, 78, 52, 40, ORANGE, 6);
    g.lineStyle(3, NAVY, 1);
    g.lineBetween(82, 92, 134, 92);
    box(g, 24, 22, 56, 52, CREAM, 6);
    circ(g, 52, 50, 11, MOON, 3);
    g.lineStyle(3, NAVY, 1);
    g.lineBetween(52, 50, 60, 42);
    box(g, 142, 36, 26, 82, LBLUE, 12);
    box(g, 172, 48, 26, 70, BLUE, 12);
    box(g, 148, 26, 14, 12, NAVY, 3, 2);
    box(g, 178, 38, 14, 12, NAVY, 3, 2);
    box(g, 96, 44, 36, 34, MOON, 6);
    g.lineStyle(3, NAVY, 1);
    g.strokeCircle(114, 61, 8);
  });
  // lander + flame -----------------------------------------------------------------
  tex(scene, 'lander', 150, 190, (g) => {
    shadow(g, 75, 178, 120, 16);
    g.lineStyle(6, NAVY, 1);
    g.lineBetween(40, 120, 12, 176);
    g.lineBetween(110, 120, 138, 176);
    g.lineBetween(75, 130, 75, 176);
    for (const x of [6, 69, 132]) box(g, x, 172, 14, 8, MOON, 3, 2.5);
    poly(g, [[44, 40], [106, 40], [118, 128], [32, 128]], CREAM, 4);
    g.fillStyle(MOON, 1);
    g.fillRect(34, 112, 82, 12);
    box(g, 34, 118, 82, 14, ORANGE, 4);
    circ(g, 75, 78, 15, LBLUE, 4);
    g.fillStyle(WHITE, 0.7);
    g.fillCircle(70, 73, 4);
    poly(g, [[56, 40], [94, 40], [86, 14], [64, 14]], MOON, 3.5);
    g.lineStyle(4, NAVY, 1);
    g.lineBetween(75, 14, 75, 2);
    poly(g, [[58, 132], [92, 132], [84, 146], [66, 146]], NAVY, 2);
  });
  tex(scene, 'flame', 50, 80, (g) => {
    g.fillStyle(ORANGE, 0.95);
    g.fillTriangle(5, 4, 45, 4, 25, 78);
    g.fillStyle(YELLOW, 1);
    g.fillTriangle(14, 4, 36, 4, 25, 52);
    g.fillStyle(WHITE, 1);
    g.fillTriangle(20, 4, 30, 4, 25, 28);
  });
  tex(scene, 'puff', 32, 32, (g) => {
    for (let i = 8; i > 0; i--) {
      g.fillStyle(0xe8e2d2, 0.12);
      g.fillCircle(16, 16, i * 2);
    }
  });
}

function propTextures(scene: Phaser.Scene): void {
  const rng = makeRng(99);
  // ground tile ----------------------------------------------------------------------
  tex(scene, 'ground', 256, 256, (g) => {
    g.fillStyle(MOON, 1);
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      const x = rng.int(0, 255);
      const y = rng.int(0, 255);
      const r = rng.int(1, 3);
      g.fillStyle(rng.next() > 0.5 ? 0xbab3a2 : 0xd6cfbf, 0.7);
      g.fillCircle(x, y, r);
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0xb4ad9c, 0.35);
      g.fillEllipse(rng.int(0, 255), rng.int(0, 255), rng.int(30, 60), rng.int(14, 26));
    }
  });
  for (const [key, w, h] of [['crater_s', 90, 46], ['crater_m', 170, 80], ['crater_l', 300, 130]] as const) {
    tex(scene, key, w, h, (g) => {
      g.fillStyle(MOOND, 0.9);
      g.fillEllipse(w / 2, h / 2, w - 4, h - 4);
      g.fillStyle(0x9b937f, 1);
      g.fillEllipse(w / 2, h / 2 + 3, w - 22, h - 16);
      g.fillStyle(0xdad4c5, 0.9);
      g.fillEllipse(w / 2, h / 2 - 5, w - 36, h - 28);
      g.lineStyle(2.5, 0x8a826f, 0.9);
      g.strokeEllipse(w / 2, h / 2, w - 4, h - 4);
    });
  }
  for (const [key, w, h] of [['rock_a', 46, 34], ['rock_b', 30, 24], ['rock_c', 62, 44]] as const) {
    tex(scene, key, w, h, (g) => {
      shadow(g, w / 2, h - 4, w - 2, 8);
      poly(g, [[4, h - 6], [8, h * 0.4], [w * 0.4, 4], [w * 0.8, h * 0.3], [w - 4, h - 6]], MOOND, 2.5);
      g.fillStyle(0xd6cfbf, 0.8);
      g.fillTriangle(10, h * 0.4, w * 0.4, 6, w * 0.45, h * 0.5);
    });
  }
  // the strange rock -------------------------------------------------------------------
  tex(scene, 'rock_strange', 70, 60, (g) => {
    shadow(g, 35, 54, 64, 10);
    poly(g, [[6, 50], [10, 22], [30, 6], [54, 14], [64, 50]], 0x5d6bb5, 3);
    g.fillStyle(LBLUE, 1);
    g.fillTriangle(16, 24, 30, 10, 36, 26);
    g.fillStyle(YELLOW, 1);
    g.fillCircle(42, 28, 4);
    g.fillCircle(24, 38, 3);
  });
  // sky ---------------------------------------------------------------------------------
  tex(scene, 'earth', 200, 200, (g) => {
    for (let i = 10; i > 0; i--) {
      g.fillStyle(LBLUE, 0.04);
      g.fillCircle(100, 100, 60 + i * 4);
    }
    g.fillStyle(BLUE, 1);
    g.fillCircle(100, 100, 62);
    g.fillStyle(GREEN, 1);
    g.fillEllipse(78, 82, 36, 26);
    g.fillEllipse(124, 112, 40, 46);
    g.fillEllipse(92, 130, 20, 14);
    g.fillStyle(WHITE, 0.75);
    g.fillEllipse(110, 70, 40, 10);
    g.fillEllipse(70, 112, 30, 8);
    g.fillEllipse(128, 140, 30, 8);
    g.fillStyle(NAVY, 0.28);
    g.beginPath();
    g.arc(100, 100, 62, -1.2, 2.0, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, NAVY, 1);
    g.strokeCircle(100, 100, 62);
  });
  tex(scene, 'star', 8, 8, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillCircle(4, 4, 2);
  });
  tex(scene, 'star_big', 16, 16, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRect(7, 1, 2, 14);
    g.fillRect(1, 7, 14, 2);
  });
  tex(scene, 'mountain', 400, 110, (g) => {
    g.fillStyle(0x6f6a5d, 1);
    g.fillTriangle(0, 110, 100, 20, 210, 110);
    g.fillTriangle(140, 110, 270, 10, 400, 110);
    g.fillStyle(0x8d8776, 1);
    g.fillTriangle(100, 20, 130, 110, 60, 110);
    g.fillTriangle(270, 10, 300, 110, 230, 110);
  });
  // markers --------------------------------------------------------------------------------
  tex(scene, 'arrow_down', 36, 36, (g) => {
    poly(g, [[8, 4], [28, 4], [28, 16], [34, 16], [18, 32], [2, 16], [8, 16]], ORANGE, 3);
  });
  tex(scene, 'arrow_dir', 44, 36, (g) => {
    poly(g, [[2, 11], [24, 11], [24, 2], [42, 18], [24, 34], [24, 25], [2, 25]], YELLOW, 3);
  });
  tex(scene, 'ring', 160, 160, (g) => {
    g.lineStyle(6, YELLOW, 1);
    g.strokeCircle(80, 80, 72);
    g.lineStyle(3, NAVY, 0.7);
    g.strokeCircle(80, 80, 66);
  });
  tex(scene, 'shadow', 54, 18, (g) => shadow(g, 27, 9, 50, 14));
  for (const [key, kind] of [['status_ok', 0], ['status_warn', 1], ['status_broken', 2], ['status_off', 3]] as const) {
    tex(scene, key, 40, 40, (g) => {
      if (kind === 0) {
        circ(g, 20, 20, 16, GREEN, 3);
        g.lineStyle(5, WHITE, 1);
        g.beginPath();
        g.moveTo(11, 21);
        g.lineTo(18, 28);
        g.lineTo(30, 13);
        g.strokePath();
      } else if (kind === 1) {
        poly(g, [[20, 3], [38, 35], [2, 35]], YELLOW, 3);
        g.fillStyle(NAVY, 1);
        g.fillRect(18, 14, 4, 11);
        g.fillCircle(20, 30, 2.5);
      } else if (kind === 2) {
        poly(g, [[13, 3], [27, 3], [37, 13], [37, 27], [27, 37], [13, 37], [3, 27], [3, 13]], RED, 3);
        g.lineStyle(5, WHITE, 1);
        g.lineBetween(13, 13, 27, 27);
        g.lineBetween(27, 13, 13, 27);
      } else {
        box(g, 4, 4, 32, 32, MOON, 6, 3);
        g.lineStyle(4, NAVY, 1);
        g.lineBetween(20, 10, 20, 20);
        g.beginPath();
        g.arc(20, 22, 8, -2.2, 0.6 - Math.PI * 1.0 + 3.14, false);
        g.strokePath();
      }
    });
  }
}

export function makeTextures(scene: Phaser.Scene): void {
  astronaut(scene, 'astro_you', ORANGE, true);
  astronaut(scene, 'astro_layan', BLUE, false);
  astronaut(scene, 'astro_omar', GREEN, false);
  astronaut(scene, 'astro_maya', 0xb58bd9, false);
  // Radar, the helper robot, floats next to the player
  tex(scene, 'radar_bot', 44, 44, (g) => {
    g.lineStyle(3, NAVY, 1);
    g.lineBetween(22, 10, 22, 3);
    circ(g, 22, 3, 3, ORANGE, 2);
    box(g, 6, 9, 32, 26, CREAM, 11, 3);
    g.fillStyle(NAVY, 1);
    g.fillRoundedRect(10, 14, 24, 14, 7);
    circ(g, 22, 21, 5.5, LBLUE, 2);
    g.fillStyle(NAVY, 1);
    g.fillCircle(22, 21, 2.2);
    box(g, 1, 18, 6, 10, ORANGE, 3, 2);
    box(g, 37, 18, 6, 10, ORANGE, 3, 2);
  });
  for (const [key, fill] of [['emote_tired', LBLUE], ['emote_sick', 0xb9d9a6], ['emote_critical', 0xf2a1a1]] as const) {
    tex(scene, key, 34, 34, (g) => {
      circ(g, 17, 17, 14, fill, 2.5);
      g.lineStyle(3, NAVY, 1);
      if (key === 'emote_tired') {
        g.lineBetween(9, 12, 17, 12);
        g.lineBetween(17, 12, 9, 20);
        g.lineBetween(9, 20, 17, 20);
        g.lineBetween(19, 17, 25, 17);
        g.lineBetween(25, 17, 19, 23);
        g.lineBetween(19, 23, 25, 23);
      } else if (key === 'emote_sick') {
        g.beginPath();
        g.moveTo(8, 18);
        g.lineTo(13, 13);
        g.lineTo(18, 21);
        g.lineTo(23, 13);
        g.lineTo(27, 18);
        g.strokePath();
      } else {
        g.lineStyle(5, RED, 1);
        g.lineBetween(17, 7, 17, 27);
        g.lineBetween(7, 17, 27, 17);
      }
    });
  }
  moduleTextures(scene);
  propTextures(scene);
}

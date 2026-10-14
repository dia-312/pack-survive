import * as THREE from 'three';
import { setState } from '../../ui/store';
import { LANDER } from '../layout';
import { MAT } from './models';
import type { MoonBase } from './MoonBase';
import { heightAt } from './terrain';
import { earthSkyTexture, earthTexture, glowTexture, moonTexture, smokeTexture } from './textures';

/**
 * Launch-to-landing cut-scene (about 21 s, skippable):
 *  1. countdown and lift-off from a launch pad on Earth
 *  2. cruising through space: Earth shrinks, the Moon grows
 *  3. the lander comes down over the Moon base and touches down
 */
const T_LIFTOFF = 3.4;
const T_SPACE = 8;
const T_MOON = 14;
const T_END = 21.5;

function rocket(): { group: THREE.Group; upper: THREE.Group; boosters: THREE.Group } {
  const g = new THREE.Group();
  const boosters = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 22, 32), MAT.white);
  core.position.y = 11;
  boosters.add(core);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 1.2, 32), MAT.orange);
  band.position.y = 6;
  boosters.add(band);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 16, 20), MAT.white);
    b.position.set(s * 2.4, 8, 0);
    boosters.add(b);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 20), MAT.orange);
    nose.position.set(s * 2.4, 17, 0);
    boosters.add(nose);
  }
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 2.2), MAT.navy);
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.sin(a) * 1.9, 1.6, Math.cos(a) * 1.9);
    fin.rotation.y = a;
    boosters.add(fin);
  }
  const bell = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 20, 1, true), MAT.dark);
  bell.position.y = -0.6;
  boosters.add(bell);
  g.add(boosters);
  const upper = new THREE.Group();
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 32), MAT.white);
  stage.position.y = 24.5;
  upper.add(stage);
  const capsule = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 32), MAT.blue);
  capsule.position.y = 28.6;
  upper.add(capsule);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), MAT.metal);
  tower.position.y = 31.6;
  upper.add(tower);
  g.add(upper);
  return { group: g, upper, boosters };
}

function flame(scale: number): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(1.1 * scale, 7 * scale, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  outer.rotation.x = Math.PI;
  outer.position.y = -3.5 * scale;
  g.add(outer);
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.6 * scale, 4 * scale, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  inner.rotation.x = Math.PI;
  inner.position.y = -2 * scale;
  g.add(inner);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.scale.set(9 * scale, 9 * scale, 1);
  glow.position.y = -1.5 * scale;
  g.add(glow);
  return g;
}

interface Smoke {
  s: THREE.Sprite;
  life: number;
  vx: number;
  vy: number;
  vz: number;
}

export class Cutscene {
  done = false;
  private t = 0;
  private earthScene = new THREE.Scene();
  private spaceScene = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private fade: THREE.Mesh;
  private rk = rocket();
  private rkFlame = flame(1.4);
  private smoke: Smoke[] = [];
  private pad = new THREE.Group();
  private craft = new THREE.Group();
  private craftFlame = flame(0.5);
  private spentStage = new THREE.Group();
  private earth!: THREE.Mesh;
  private moon!: THREE.Mesh;
  private landerFlame = flame(0.55);
  private key = '';
  private touched = false;

  constructor(
    aspect: number,
    private base: MoonBase,
  ) {
    this.cam = new THREE.PerspectiveCamera(55, aspect, 0.1, 5000);
    this.fade = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1, depthTest: false, depthWrite: false }),
    );
    this.fade.position.z = -0.5;
    this.fade.renderOrder = 999;
    this.cam.add(this.fade);
    this.buildEarth();
    this.buildSpace();
    this.base.landerGroup.add(this.landerFlame);
    this.landerFlame.position.y = 0.3;
  }

  get camera(): THREE.PerspectiveCamera {
    return this.cam;
  }

  private buildEarth(): void {
    const sc = this.earthScene;
    sc.background = earthSkyTexture();
    sc.fog = new THREE.Fog(0xbfd9ee, 120, 900);
    sc.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b6a4a, 1.2));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.set(-60, 80, 40);
    sc.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1200, 48), new THREE.MeshStandardMaterial({ color: 0x9fb07a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    sc.add(ground);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshStandardMaterial({ color: 0x3f7fc9, roughness: 0.25, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.05, -1100);
    sc.add(sea);
    const concrete = new THREE.MeshStandardMaterial({ color: 0xc8c4bc, roughness: 0.9 });
    const padBase = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 2, 40), concrete);
    padBase.position.y = 1;
    this.pad.add(padBase);
    const red = new THREE.MeshStandardMaterial({ color: 0xc8463c, roughness: 0.6 });
    // service tower: a lattice of beams
    for (let y = 0; y < 34; y += 3) {
      for (const [x, z] of [[-5, -2], [-5, 2], [-9, -2], [-9, 2]] as const) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), red);
        beam.position.set(x, y + 3.5, z);
        this.pad.add(beam);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 0.3), red);
      cross.position.set(-7, y + 3.5, 2);
      this.pad.add(cross);
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 1), red);
    arm.position.set(-3.4, 27, 0);
    this.pad.add(arm);
    sc.add(this.pad);
    this.rk.group.position.y = 2.6;
    sc.add(this.rk.group);
    this.rk.group.add(this.rkFlame);
    this.rkFlame.visible = false;
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: 0xf2efe8, transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false;
      sc.add(s);
      this.smoke.push({ s, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    // distant hills and trees
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(60 + (i % 5) * 18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7c9a63, roughness: 1 }));
      hill.position.set(Math.cos(a) * 520, -10, Math.sin(a) * 520);
      hill.scale.y = 0.35;
      sc.add(hill);
    }
  }

  private buildSpace(): void {
    const sc = this.spaceScene;
    sc.background = new THREE.Color(0x000000);
    const n = 3000;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(t) * s * 2000, u * 2000, Math.sin(t) * s * 2000], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sc.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
    const sunLight = new THREE.DirectionalLight(0xffffff, 3);
    sunLight.position.set(200, 60, 120);
    sc.add(sunLight, new THREE.AmbientLight(0x334466, 0.6));
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(60, 64, 40), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.7 }));
    sc.add(this.earth);
    const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6fb6ff, opacity: 0.6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    atmo.scale.set(175, 175, 1);
    this.earth.add(atmo);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(16, 48, 32), new THREE.MeshStandardMaterial({ map: moonTexture(), roughness: 1 }));
    sc.add(this.moon);
    // the spacecraft: service module + capsule + solar wings
    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 24), MAT.white);
    sm.rotation.z = Math.PI / 2;
    this.craft.add(sm);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 24), MAT.blue);
    cap.rotation.z = -Math.PI / 2;
    cap.position.x = 2;
    this.craft.add(cap);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 3.2), new THREE.MeshStandardMaterial({ color: 0x1d4fa0, metalness: 0.4, roughness: 0.3 }));
      wing.position.set(-0.3, 0, s * 2.6);
      this.craft.add(wing);
    }
    this.craftFlame.rotation.z = -Math.PI / 2;
    this.craftFlame.position.x = -1.3;
    this.craft.add(this.craftFlame);
    sc.add(this.craft);
    const spent = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 24), MAT.white);
    spent.rotation.z = Math.PI / 2;
    this.spentStage.add(spent);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.5, 24), MAT.orange);
    ring.rotation.z = Math.PI / 2;
    this.spentStage.add(ring);
    sc.add(this.spentStage);
  }

  skip(): void {
    this.t = T_END;
  }

  /** dev only: jump to a moment of the film */
  seek(t: number): void {
    this.t = t;
  }

  private say(key: string): void {
    if (key !== this.key) {
      this.key = key;
      setState({ cutscene: key });
    }
  }

  private puffSmoke(n: number, spread: number, up: number): void {
    let made = 0;
    for (const p of this.smoke) {
      if (made >= n) break;
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      p.life = 1;
      p.vx = Math.cos(a) * spread * (0.5 + Math.random());
      p.vz = Math.sin(a) * spread * (0.5 + Math.random());
      p.vy = up * Math.random();
      p.s.position.set(this.rk.group.position.x, Math.max(1, this.rk.group.position.y - 1), 0);
      p.s.scale.set(4, 4, 1);
      p.s.visible = true;
      made++;
    }
  }

  private attach(scene: THREE.Scene): void {
    if (this.cam.parent !== scene) scene.add(this.cam);
  }

  /** Advance the film. Returns what to draw this frame. */
  update(dt: number): { scene: THREE.Scene; camera: THREE.Camera } {
    this.t += dt;
    const t = this.t;
    const fadeMat = this.fade.material as THREE.MeshBasicMaterial;
    const fadeIn = (start: number, len = 0.8) => Math.max(0, 1 - (t - start) / len);
    const fadeOut = (end: number, len = 0.7) => Math.max(0, 1 - (end - t) / len);

    if (t < T_SPACE) {
      // ---- 1. Earth launch -------------------------------------------------------------------
      this.attach(this.earthScene);
      const rk = this.rk.group;
      fadeMat.opacity = Math.max(fadeIn(0, 1.2), fadeOut(T_SPACE));
      if (t < T_LIFTOFF) {
        this.say(t < 1.1 ? 'cut.t3' : t < 2.2 ? 'cut.t2' : 'cut.t1');
        if (Math.random() < 0.3) this.puffSmoke(1, 3, 1);
        this.cam.position.set(38, 6, 46);
        this.cam.lookAt(0, 16 + t * 0.6, 0);
      } else {
        this.say('cut.liftoff');
        const k = t - T_LIFTOFF;
        rk.position.y = 2.6 + 2.2 * k * k;
        this.rkFlame.visible = true;
        this.rkFlame.scale.setScalar(1 + Math.random() * 0.15);
        if (k < 2.5) this.puffSmoke(4, 14, 4);
        const shake = Math.max(0, 0.6 - k * 0.12);
        this.cam.position.set(38 + (Math.random() - 0.5) * shake, 6 + k * 3 + (Math.random() - 0.5) * shake, 46);
        this.cam.lookAt(0, rk.position.y + 14, 0);
      }
      for (const p of this.smoke) {
        if (p.life <= 0) continue;
        p.life -= dt * 0.35;
        p.s.position.x += p.vx * dt;
        p.s.position.y += p.vy * dt;
        p.s.position.z += p.vz * dt;
        const sc = 4 + (1 - p.life) * 22;
        p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = Math.max(0, p.life) * 0.85;
        if (p.life <= 0) p.s.visible = false;
      }
      return { scene: this.earthScene, camera: this.cam };
    }

    if (t < T_MOON) {
      // ---- 2. through space ---------------------------------------------------------------------
      this.attach(this.spaceScene);
      const k = (t - T_SPACE) / (T_MOON - T_SPACE);
      fadeMat.opacity = Math.max(fadeIn(T_SPACE), fadeOut(T_MOON));
      this.say(k < 0.5 ? 'cut.space' : 'cut.cruise');
      // the craft flies along +x; Earth falls behind, the Moon comes closer
      this.craft.position.set(k * 40, 0, 0);
      this.craftFlame.visible = k < 0.3;
      this.craftFlame.scale.setScalar(0.9 + Math.random() * 0.2);
      this.spentStage.position.set(-3.2 - k * 12, -k * 4, k * 3);
      this.spentStage.rotation.set(k * 2, 0, k * 1.4);
      this.earth.position.set(-110, -18, -30);
      this.earth.rotation.y += dt * 0.08;
      this.moon.scale.setScalar(1);
      this.moon.position.set(300 - k * 180, 18, -40);
      if (k < 0.5) {
        // look back: the craft with Earth behind it
        this.cam.position.set(this.craft.position.x + 12, 2.5, 9);
        this.cam.lookAt(this.craft.position.x - 6, 0, -4);
      } else {
        // look ahead: the Moon getting bigger
        this.cam.position.set(this.craft.position.x - 9, 2.2, 5);
        this.cam.lookAt(this.craft.position.x + 20, 3, -8);
      }
      return { scene: this.spaceScene, camera: this.cam };
    }

    // ---- 3. landing at the Moon base --------------------------------------------------------------
    const k = Math.min(1, (t - T_MOON) / (T_END - 1.6 - T_MOON));
    fadeMat.opacity = Math.max(fadeIn(T_MOON), fadeOut(T_END, 0.9));
    this.attach(this.base.scene);
    const ground = heightAt(LANDER.x, LANDER.y);
    const ease = 1 - Math.pow(1 - k, 2.4);
    const lg = this.base.landerGroup;
    lg.position.set(LANDER.x, ground + 46 * (1 - ease), LANDER.y);
    const burning = k < 1;
    this.landerFlame.visible = burning;
    this.landerFlame.scale.setScalar(0.8 + Math.random() * 0.3);
    this.say(k < 0.55 ? 'cut.descent' : 'cut.touchdown');
    if (k > 0.75 && burning && Math.random() < 0.6) this.base.spawnPuffs(LANDER.x + (Math.random() - 0.5) * 6, LANDER.y + (Math.random() - 0.5) * 6, 2);
    if (k >= 1 && !this.touched) {
      this.touched = true;
      this.base.spawnPuffs(LANDER.x, LANDER.y, 14);
    }
    this.base.updatePuffs(dt);
    const orbit = 0.9 - k * 0.6;
    this.cam.position.set(LANDER.x + Math.sin(orbit) * 26, ground + 9 + (1 - k) * 18, LANDER.y + Math.cos(orbit) * 26);
    this.cam.lookAt(LANDER.x * 0.5, lg.position.y + 1.5 - (1 - k) * 4, LANDER.y * 0.6);
    if (t >= T_END) {
      this.done = true;
      this.landerFlame.visible = false;
      lg.position.y = ground;
      this.base.scene.remove(this.cam);
      setState({ cutscene: null });
    }
    return { scene: this.base.scene, camera: this.cam };
  }

  resize(aspect: number): void {
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();
  }
}

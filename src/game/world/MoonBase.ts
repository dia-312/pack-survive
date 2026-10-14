import * as THREE from 'three';
import { configFor } from '../../engine/config';
import { sunFactor } from '../../engine/mission';
import { makeRng } from '../../engine/rng';
import type { MissionState } from '../../engine/types';
import { getState, isPaused, setState, type ModuleId } from '../../ui/store';
import { actionCancel, actionDown, actionUp, debug, input, update as updateController, view } from '../controller';
import { LANDER, PLAYER_START, WORLD_RADIUS, modulesFor, rockSpot, leakSpot, type ModuleLayout } from '../layout';
import { moduleStatus } from '../status';
import {
  astronaut,
  batteryBank,
  cargoPile,
  excavator,
  greenhouse,
  habitat,
  lander,
  oxygenGenerator,
  radarBot,
  reactor,
  rock,
  solarField,
  stormShelter,
  strangeRock,
  waterRecycler,
  type Astronaut,
  type ModuleModel,
} from './models';
import { buildTerrain, heightAt } from './terrain';
import { arrowTexture, earthTexture, emoteTexture, glowTexture, smokeTexture, statusTexture } from './textures';

/** Moon gravity is about 1/6 of Earth's (1.62 m/s²), so jumps are slow and high. */
export const MOON_GRAVITY = 1.62;
const EYE = 1.65;
const WALK = 4.6;
const RUN = 8.5;
const JUMP_SPEED = 2.5;
const PLAYER_R = 0.45;

interface PlacedModule {
  layout: ModuleLayout;
  model: ModuleModel;
  sprite: THREE.Sprite;
  baseY: number;
  status: string | null;
}

interface Npc {
  id: string;
  body: Astronaut;
  emote: THREE.Sprite;
  x: number;
  z: number;
  tx: number;
  tz: number;
  wait: number;
  phase: number;
  moving: boolean;
}

const MAKERS: Record<ModuleId, () => ModuleModel> = {
  habitat,
  solar: solarField,
  battery: batteryBank,
  reactor,
  o2gen: oxygenGenerator,
  recycler: waterRecycler,
  greenhouse,
  shelter: stormShelter,
  excavator,
  cargo: cargoPile,
};

export class MoonBase {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private sun = new THREE.DirectionalLight(0xfff3df, 3.8);
  private hemi = new THREE.HemisphereLight(0x9fb2d6, 0x5a554b, 0.6);
  private flashlight = new THREE.SpotLight(0xfff2d6, 0, 34, 0.55, 0.6, 1.4);
  private stars!: THREE.Points;
  private sunSprite!: THREE.Sprite;
  private modules = new Map<ModuleId, PlacedModule>();
  private colliders: { x: number; z: number; r: number }[] = [];
  private npcs: Npc[] = [];
  private radar = radarBot();
  private marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: arrowTexture(), depthTest: false }));
  private ring: THREE.Mesh;
  private beam: THREE.Mesh;
  private rockModel = strangeRock();
  private puffs: { s: THREE.Sprite; life: number; vx: number; vz: number }[] = [];
  private stormDust!: THREE.Points;
  /** the lander, animated by the cut-scene */
  landerGroup!: THREE.Group;

  // player
  x = PLAYER_START.x;
  z = PLAYER_START.y;
  y = 0;
  private vy = 0;
  yaw = PLAYER_START.yaw;
  pitch = -0.05;
  private onGround = true;
  private bob = 0;
  private keys = new Set<string>();
  private night = 0;
  private shake = 0;
  private statusTimer = 0;
  private lastRev = -1;
  private hvx = 0;
  private hvz = 0;
  private jumpedOnce = false;
  private freeCam = false;

  constructor(
    aspect: number,
    private quality: { terrain: number; shadows: number },
  ) {
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.1, 2000);
    this.camera.rotation.order = 'YXZ';
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.06, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.9 }),
    );
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
  }

  build(m: MissionState): void {
    const sc = this.scene;
    sc.background = new THREE.Color(0x000000);
    sc.fog = new THREE.Fog(0x04060c, 160, 330);
    this.buildSky();
    sc.add(this.hemi);
    // low sun near the south pole: long shadows
    this.sun.position.set(70, 22, 55);
    this.sun.castShadow = this.quality.shadows > 0;
    if (this.quality.shadows > 0) {
      this.sun.shadow.mapSize.set(this.quality.shadows, this.quality.shadows);
      const c = this.sun.shadow.camera;
      c.left = -60;
      c.right = 60;
      c.top = 60;
      c.bottom = -60;
      c.near = 1;
      c.far = 220;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.04;
    }
    sc.add(this.sun, this.sun.target);
    sc.add(this.camera);
    this.camera.add(this.flashlight);
    this.flashlight.position.set(0.2, -0.2, 0);
    this.flashlight.target.position.set(0, -0.6, -6);
    this.camera.add(this.flashlight.target);

    sc.add(buildTerrain(this.quality.terrain));
    this.scatterRocks();

    for (const layout of modulesFor(m.cargo)) {
      const model = MAKERS[layout.id]();
      const baseY = heightAt(layout.x, layout.y);
      model.group.position.set(layout.x, baseY, layout.y);
      model.group.rotation.y = layout.face;
      sc.add(model.group);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: statusTexture('ok'), depthTest: true }));
      sprite.scale.set(1.3, 1.3, 1);
      sprite.position.set(layout.x, baseY + layout.iconY, layout.y);
      sprite.visible = false;
      sc.add(sprite);
      this.modules.set(layout.id, { layout, model, sprite, baseY, status: null });
      if (layout.id !== 'excavator') this.colliders.push({ x: layout.x, z: layout.y, r: layout.radius });
      if (layout.id === 'habitat') this.colliders.push({ x: 0, z: 7, r: 1.7 }, { x: -6.6, z: -1.5, r: 1.6 }, { x: 6.6, z: -1.5, r: 1.6 });
    }
    const lan = lander();
    lan.position.set(LANDER.x, heightAt(LANDER.x, LANDER.y), LANDER.y);
    lan.rotation.y = Math.PI;
    sc.add(lan);
    this.landerGroup = lan;
    this.colliders.push({ x: LANDER.x, z: LANDER.y, r: LANDER.radius });

    // crew
    const colors: Record<string, number> = { layan: 0x3fa7d6, omar: 0x4caf6a, maya: 0xb58bd9 };
    ['layan', 'omar', 'maya'].forEach((id, i) => {
      const body = astronaut(colors[id]);
      const x = -2 + i * 2;
      const z = 10;
      body.group.position.set(x, heightAt(x, z), z);
      sc.add(body.group);
      const emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTexture('tired') }));
      emote.scale.set(0.6, 0.6, 1);
      emote.visible = false;
      sc.add(emote);
      this.npcs.push({ id, body, emote, x, z, tx: x, tz: z, wait: 1 + i, phase: i, moving: false });
    });

    this.radar.scale.setScalar(0.55);
    sc.add(this.radar);
    this.marker.scale.set(1.1, 1.1, 1);
    this.marker.visible = false;
    this.marker.renderOrder = 10;
    sc.add(this.marker);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    this.beam.visible = false;
    sc.add(this.ring, this.beam, this.rockModel);
    this.rockModel.visible = false;
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, opacity: 0, depthWrite: false, color: 0xd8d2c4 }));
      s.visible = false;
      sc.add(s);
      this.puffs.push({ s, life: 0, vx: 0, vz: 0 });
    }
    this.buildStormDust();

    this.y = heightAt(this.x, this.z);
    this.bindKeys();
    if (import.meta.env.DEV) {
      debug.teleport = (x, y) => {
        this.freeCam = false;
        this.x = x;
        this.z = y;
        this.y = heightAt(x, y);
      };
      debug.overview = () => {
        this.freeCam = true;
        this.x = 0;
        this.z = 62;
        this.y = 34;
        this.pitch = -0.5;
        this.yaw = 0;
      };
    }
  }

  private buildSky(): void {
    const rng = makeRng(77);
    const n = 3500;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rng.next() * 2 - 1;
      const t = rng.next() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(t) * s * 900, Math.abs(u) * 900 - 60, Math.sin(t) * s * 900], i * 3);
      const b = 0.5 + rng.next() * 0.5;
      const tint = rng.next();
      col.set([b * (tint > 0.85 ? 1 : 0.85), b * 0.9, b * (tint < 0.15 ? 0.7 : 1)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, fog: false }),
    );
    this.scene.add(this.stars);

    // Earth hangs low over the northern horizon, seen from the south pole
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(34, 48, 32),
      new THREE.MeshStandardMaterial({ map: earthTexture(), emissive: 0xffffff, emissiveMap: earthTexture(), emissiveIntensity: 0.35, roughness: 0.8, fog: false }),
    );
    earth.position.set(-120, 150, -720);
    earth.rotation.z = 0.4;
    this.scene.add(earth);
    const atmo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6fb6ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    atmo.scale.set(120, 120, 1);
    atmo.position.copy(earth.position);
    this.scene.add(atmo);

    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff1d0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.sunSprite.scale.set(150, 150, 1);
    this.sunSprite.position.set(70, 22, 55).normalize().multiplyScalar(850);
    this.scene.add(this.sunSprite);
  }

  private scatterRocks(): void {
    const rng = makeRng(21);
    const geos = [0, 1, 2].map((k) => rock(0.5, k).geometry);
    const mat = (rock(0.5, 0).material as THREE.Material).clone();
    for (const geo of geos) {
      const count = 70;
      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let placed = 0;
      for (let tries = 0; tries < 400 && placed < count; tries++) {
        const a = rng.next() * Math.PI * 2;
        const d = 9 + rng.next() * 120;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        if ([...modulesFor({ solar: 1, battery: 1, reactor: 1, o2gen: 1, recycler: 1, greenhouse: 1, shelter: 1, excavator: 1, food: 1 })].some((md) => Math.hypot(md.x - x, md.y - z) < md.radius + 4)) continue;
        if (Math.hypot(x - LANDER.x, z - LANDER.y) < 7) continue;
        const s = 0.25 + rng.next() * rng.next() * (d > 40 ? 3 : 1.2);
        q.setFromEuler(new THREE.Euler(rng.next(), rng.next() * 6, rng.next()));
        m4.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.1, z), q, new THREE.Vector3(s, s, s));
        inst.setMatrixAt(placed++, m4);
      }
      inst.count = placed;
      this.scene.add(inst);
    }
  }

  private buildStormDust(): void {
    const n = 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 40, Math.random() * 20, (Math.random() - 0.5) * 40], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stormDust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffb08a, size: 0.12, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.stormDust.visible = false;
    this.scene.add(this.stormDust);
  }

  // ---- input ------------------------------------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.('textarea, input')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'Enter') actionDown(e.timeStamp);
    if (e.code === 'Space') input.jump = true;
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'KeyE' || e.code === 'Enter') actionUp(e.timeStamp);
  };
  private onBlur = () => {
    this.keys.clear();
    actionCancel();
  };
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement && !isPaused()) {
      this.yaw -= e.movementX * 0.0024;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - e.movementY * 0.0024));
    }
  };

  private bindKeys(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    debug.teleport = undefined;
    debug.overview = undefined;
  }

  // ---- per frame ----------------------------------------------------------------------------------

  update(dt: number, time: number): void {
    const s = getState();
    const m = s.mission;
    if (!m) return;
    const paused = isPaused(s);
    if (!paused && !this.freeCam) this.movePlayer(dt);
    else input.jump = false;
    input.lookDX = 0;
    input.lookDY = 0;
    updateController(dt, this.x, this.z);

    this.updateNpcs(dt, paused, m, time);
    this.statusTimer -= dt;
    if (this.statusTimer <= 0 || s.rev !== this.lastRev) {
      this.statusTimer = 0.2;
      this.lastRev = s.rev;
      this.updateStatuses(m, time);
    }
    this.updateMarker(s.nearby, paused, time);
    this.updateTask(m, time);
    this.updateNight(m, dt);
    this.updateStorm(dt, time);
    this.animateModules(m, time, dt);
    this.updatePuffs(dt);
    this.placeCamera(time);
    this.updateRadar(time, dt);
  }

  private movePlayer(dt: number): void {
    const k = this.keys;
    let f = 0;
    let r = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD')) r += 1;
    if (k.has('KeyA')) r -= 1;
    // arrow keys turn, so kids can play without a mouse
    if (k.has('ArrowLeft')) this.yaw += 2.1 * dt;
    if (k.has('ArrowRight')) this.yaw -= 2.1 * dt;
    f += -input.joyY;
    r += input.joyX;
    this.yaw -= input.lookDX * 0.0055;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - input.lookDY * 0.0045));

    const len = Math.hypot(f, r);
    if (len > 1) {
      f /= len;
      r /= len;
    }
    const running = k.has('ShiftLeft') || k.has('ShiftRight') || input.run;
    const speed = running ? RUN : WALK;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wantX = (-sin * f + cos * r) * speed;
    const wantZ = (-cos * f - sin * r) * speed;
    // low gravity: little grip in the air
    const grip = this.onGround ? 12 : 1.5;
    this.hvx += (wantX - this.hvx) * Math.min(1, grip * dt);
    this.hvz += (wantZ - this.hvz) * Math.min(1, grip * dt);
    let nx = this.x + this.hvx * dt;
    let nz = this.z + this.hvz * dt;
    for (const c of this.colliders) {
      const dx = nx - c.x;
      const dz = nz - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + PLAYER_R;
      if (d < min && d > 0.0001) {
        nx = c.x + (dx / d) * min;
        nz = c.z + (dz / d) * min;
      }
    }
    const dc = Math.hypot(nx, nz);
    if (dc > WORLD_RADIUS) {
      nx *= WORLD_RADIUS / dc;
      nz *= WORLD_RADIUS / dc;
    }
    this.x = nx;
    this.z = nz;

    if (input.jump && this.onGround) {
      this.vy = JUMP_SPEED;
      this.onGround = false;
      if (!this.jumpedOnce) {
        this.jumpedOnce = true;
        setState({ radar: { key: 'radar.jump' } });
      }
    }
    input.jump = false;
    const ground = heightAt(this.x, this.z);
    if (!this.onGround) {
      this.vy -= MOON_GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) {
        this.y = ground;
        this.vy = 0;
        this.onGround = true;
        this.spawnPuffs(this.x, this.z, 5);
      }
    } else {
      this.y = ground;
    }
    const moving = Math.hypot(this.hvx, this.hvz) > 0.5 && this.onGround;
    if (moving) this.bob += dt * (running ? 11 : 7.5);
    const targetFov = running && moving ? 80 : 72;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();
  }

  private placeCamera(time: number): void {
    const bobY = this.onGround ? Math.sin(this.bob) * 0.05 : 0;
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake * 0.3;
      sy = (Math.random() - 0.5) * this.shake * 0.3;
    }
    this.camera.position.set(this.x + sx, this.y + EYE + bobY + sy, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    void time;

    // where is the goal, compared with where we look?
    const st = view.storm;
    const t = view.task;
    const tx = st ? st.x : t ? t.x : null;
    const tz = st ? st.y : t ? t.y : null;
    const tr = st ? st.r : t ? t.r : 0;
    const there = tx !== null && tz !== null && Math.hypot(tx - this.x, tz - this.z) < tr;
    if (tx !== null && tz !== null && !there && !(t && t.kind === 'leak' && !st)) {
      const dx = tx - this.x;
      const dz = tz - this.z;
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw);
      const rz = -Math.sin(this.yaw);
      view.pointer.active = true;
      view.pointer.angle = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
      view.pointer.dist = Math.hypot(dx, dz);
    } else view.pointer.active = false;
  }

  private updateRadar(time: number, dt: number): void {
    // Radar floats just ahead and to the right of the commander
    const local = new THREE.Vector3(1.55, -0.4 + Math.sin(time * 2.2) * 0.05, -3);
    const world = local.applyQuaternion(this.camera.quaternion).add(this.camera.position);
    this.radar.position.lerp(world, Math.min(1, dt * 6));
    this.radar.lookAt(this.camera.position);
  }

  spawnPuffs(x: number, z: number, n: number): void {
    let made = 0;
    for (const p of this.puffs) {
      if (made >= n) break;
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      p.life = 1;
      p.vx = Math.cos(a) * 0.9;
      p.vz = Math.sin(a) * 0.9;
      p.s.position.set(x + Math.cos(a) * 0.3, heightAt(x, z) + 0.15, z + Math.sin(a) * 0.3);
      p.s.scale.set(0.4, 0.4, 1);
      p.s.visible = true;
      made++;
    }
  }

  updatePuffs(dt: number): void {
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt * 0.9;
      p.s.position.x += p.vx * dt;
      p.s.position.z += p.vz * dt;
      p.s.position.y += dt * 0.15;
      const sc = 0.4 + (1 - p.life) * 1.2;
      p.s.scale.set(sc, sc, 1);
      (p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, p.life) * 0.7;
      if (p.life <= 0) p.s.visible = false;
    }
  }

  private npcTarget(n: Npc, m: MissionState): void {
    const mods = modulesFor(m.cargo);
    const pick = mods[Math.floor(Math.random() * mods.length)];
    const a = pick.face + (Math.random() - 0.5) * 1.4;
    const d = pick.radius + 1.5 + Math.random() * 2;
    n.tx = pick.x + Math.sin(a) * d;
    n.tz = pick.y + Math.cos(a) * d;
  }

  private updateNpcs(dt: number, paused: boolean, m: MissionState, time: number): void {
    const storm = view.storm;
    this.npcs.forEach((n, i) => {
      if (!paused) {
        let speed = 1.5;
        if (storm) {
          n.tx = storm.x + (i - 1) * 1.1;
          n.tz = storm.y + (i % 2) * 0.8;
          speed = 3.6;
          n.wait = 0;
        }
        if (n.wait > 0) {
          n.wait -= dt;
          n.moving = false;
          if (n.wait <= 0 && !storm) this.npcTarget(n, m);
        } else {
          const dx = n.tx - n.x;
          const dz = n.tz - n.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.3) {
            n.moving = false;
            if (!storm) n.wait = 2 + Math.random() * 4;
          } else {
            n.moving = true;
            n.x += (dx / d) * speed * dt;
            n.z += (dz / d) * speed * dt;
            for (const c of this.colliders) {
              const ex = n.x - c.x;
              const ez = n.z - c.z;
              const e = Math.hypot(ex, ez);
              if (e < c.r + 0.4 && e > 0.001) {
                n.x = c.x + (ex / e) * (c.r + 0.4);
                n.z = c.z + (ez / e) * (c.r + 0.4);
              }
            }
            n.body.group.rotation.y = Math.atan2(dx, dz);
            n.phase += dt * (storm ? 10 : 6);
          }
        }
      }
      // step aside for the commander
      const px = n.x - this.x;
      const pz = n.z - this.z;
      const pd = Math.hypot(px, pz);
      if (pd < 1.4 && pd > 0.001) {
        n.x = this.x + (px / pd) * 1.4;
        n.z = this.z + (pz / pd) * 1.4;
      }
      const g = n.body.group;
      const hop = n.moving ? Math.abs(Math.sin(n.phase)) * 0.12 : 0;
      g.position.set(n.x, heightAt(n.x, n.z) + hop, n.z);
      const swing = n.moving ? Math.sin(n.phase) * 0.6 : Math.sin(time + i) * 0.03;
      n.body.legL.rotation.x = swing;
      n.body.legR.rotation.x = -swing;
      n.body.armL.rotation.x = -swing * 0.7;
      n.body.armR.rotation.x = swing * 0.7;
      const h = m.crew.find((c) => c.id === n.id)?.health ?? 100;
      const kind = h >= 70 ? null : h >= 40 ? 'tired' : h >= 20 ? 'sick' : 'critical';
      if (kind) {
        n.emote.material.map = emoteTexture(kind);
        n.emote.visible = true;
        n.emote.position.set(n.x, g.position.y + 2.5 + Math.sin(time * 3 + i) * 0.05, n.z);
      } else n.emote.visible = false;
    });
  }

  private updateStatuses(m: MissionState, time: number): void {
    for (const e of this.modules.values()) {
      const st = moduleStatus(e.layout.id, m).kind;
      if (!st) {
        e.sprite.visible = false;
        continue;
      }
      if (st !== e.status) {
        e.sprite.material.map = statusTexture(st);
        e.sprite.material.needsUpdate = true;
      }
      e.status = st;
      e.sprite.visible = st === 'broken' ? Math.floor(time * 3) % 2 === 0 : true;
    }
    const solar = this.modules.get('solar');
    if (solar) {
      const mat = solar.model.parts.panelMat as THREE.MeshStandardMaterial;
      mat.color.set(m.effects.dust ? 0xc4b394 : 0xffffff);
      (solar.model.parts.crack as THREE.Object3D).visible = m.effects.meteoroid;
    }
  }

  private updateMarker(nearby: ModuleId | null, paused: boolean, time: number): void {
    const e = nearby ? this.modules.get(nearby) : undefined;
    if (!e || paused) {
      this.marker.visible = false;
      return;
    }
    this.marker.visible = true;
    this.marker.position.set(e.layout.x, e.baseY + e.layout.iconY + 1.5 + Math.sin(time * 5) * 0.15, e.layout.y);
  }

  private updateTask(m: MissionState, time: number): void {
    const t = view.task;
    const st = view.storm;
    const rockOn = m.pending === 'rock' || t?.kind === 'rock';
    if (rockOn) {
      const p = rockSpot(m.seed, m.day);
      this.rockModel.visible = true;
      this.rockModel.position.set(p.x, heightAt(p.x, p.y), p.y);
      this.rockModel.rotation.y = time * 0.4;
    } else this.rockModel.visible = false;

    let goal: { x: number; y: number; r: number } | null = null;
    if (st) goal = { x: st.x, y: st.y, r: st.r };
    else if (t && t.kind !== 'leak') goal = { x: t.x, y: t.y, r: t.r };
    if (goal) {
      const gy = heightAt(goal.x, goal.y);
      this.ring.visible = true;
      this.beam.visible = true;
      this.ring.position.set(goal.x, gy + 0.08, goal.y);
      const pulse = 1 + Math.sin(time * 4) * 0.06;
      this.ring.scale.set(goal.r * pulse, goal.r * pulse, 1);
      (this.ring.material as THREE.MeshBasicMaterial).color.set(st ? 0xff6b5a : 0xf2c94c);
      (this.beam.material as THREE.MeshBasicMaterial).color.set(st ? 0xff6b5a : 0xf2c94c);
      this.beam.position.set(goal.x, gy + 20, goal.y);
    } else {
      this.ring.visible = false;
      this.beam.visible = false;
    }
    // the leak hisses: little puffs when you are close
    if (t && t.kind === 'leak') {
      const p = leakSpot(m.seed, m.day);
      const d = Math.hypot(this.x - p.x, this.z - p.y);
      if (d < 4 && Math.random() < 0.25) {
        for (const puff of this.puffs) {
          if (puff.life > 0) continue;
          puff.life = 0.8;
          puff.vx = (Math.random() - 0.5) * 0.6;
          puff.vz = (Math.random() - 0.5) * 0.6;
          puff.s.position.set(p.x, heightAt(p.x, p.y) + 1 + Math.random() * 1.5, p.y);
          puff.s.visible = true;
          break;
        }
      }
    }
  }

  private updateNight(m: MissionState, dt: number): void {
    const cfg = configFor(m.difficulty);
    const target = sunFactor(m.day, cfg) === 0 ? 1 : 0;
    this.night += (target - this.night) * Math.min(1, dt * 1.2);
    const k = this.night;
    this.sun.intensity = 3.8 * (1 - k) + 0.05;
    this.hemi.intensity = 0.6 - 0.42 * k;
    this.flashlight.intensity = 22 * k;
    this.sunSprite.visible = k < 0.5;
    (this.stars.material as THREE.PointsMaterial).opacity = 0.75 + 0.25 * k;
    const hab = this.modules.get('habitat');
    if (hab) {
      const wins = hab.model.parts.windows as THREE.Object3D[];
      const mat = (wins[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + 2.4 * k;
    }
  }

  private updateStorm(dt: number, time: number): void {
    const on = !!view.storm;
    this.stormDust.visible = on;
    if (on) {
      this.stormDust.position.set(this.x, this.y, this.z);
      const pos = this.stormDust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 9;
        let x = pos.getX(i) + dt * 4;
        if (y < 0) {
          y += 20;
          x = (Math.random() - 0.5) * 40;
        }
        pos.setXY(i, x > 20 ? x - 40 : x, y);
      }
      pos.needsUpdate = true;
      this.sun.color.setRGB(1, 0.62 + Math.sin(time * 6) * 0.05, 0.5);
    } else this.sun.color.setHex(0xfff3df);
    if (view.stormHit === 1) {
      view.stormHit = 0;
      this.shake = 1;
    }
    this.shake = Math.max(0, this.shake - dt * 1.2);
  }

  private animateModules(m: MissionState, time: number, dt: number): void {
    const ex = this.modules.get('excavator');
    if (ex) {
      const body = ex.model.parts.body as THREE.Object3D;
      const arm = ex.model.parts.arm as THREE.Object3D;
      if (m.systems.excavator.running) {
        body.position.z = Math.sin(time * 0.35) * 2.5;
        arm.rotation.x = Math.sin(time * 1.6) * 0.35;
      }
    }
    const re = this.modules.get('reactor');
    if (re) (re.model.parts.glowMat as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(time * 2) * 0.5;
    const rc = this.modules.get('recycler');
    if (rc && m.systems.recycler.running) (rc.model.parts.arrows as THREE.Object3D).rotation.z -= dt * 1.2;
    const gh = this.modules.get('greenhouse');
    if (gh) {
      const grown = Math.min(1, 0.3 + m.greenhouseGrowth / 10);
      for (const p of gh.model.parts.plants as THREE.Object3D[]) p.scale.setScalar(grown);
      (gh.model.parts.growMat as THREE.MeshStandardMaterial).emissiveIntensity = m.systems.greenhouse.on ? 1.6 : 0.1;
    }
  }

  /** Called once the cut-scene is over: stand next to the lander looking at the base. */
  placeAtStart(): void {
    this.x = PLAYER_START.x;
    this.z = PLAYER_START.y;
    this.y = heightAt(this.x, this.z);
    this.yaw = PLAYER_START.yaw;
    this.pitch = -0.04;
    setState({ locked: false });
  }
}

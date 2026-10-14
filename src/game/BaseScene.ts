import Phaser from 'phaser';
import { sunFactor } from '../engine/mission';
import { moduleStatus } from './status';
import { makeRng } from '../engine/rng';
import type { MissionState } from '../engine/types';
import { getState, isPaused, type ModuleId } from '../ui/store';
import { makeTextures } from './art';
import { actionDown, actionUp, debug, input, nearbyModule, onLanded, openModule, update as updateController, view } from './controller';
import {
  HORIZON_Y,
  LANDER,
  PLAYER_START,
  ROCK_SPOTS,
  WALK_MIN_Y,
  WORLD_H,
  WORLD_W,
  frontPoint,
  modulesFor,
  type ModuleLayout,
} from './layout';

type Status = 'ok' | 'warn' | 'broken' | 'off' | null;

interface Npc {
  id: string;
  body: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  emote: Phaser.GameObjects.Image;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  phase: number;
  moving: boolean;
}

const PLAYER_SPEED = 270;
const NPC_SPEED = 95;

export function rockSpot(m: MissionState): { x: number; y: number } {
  const p = makeRng(m.seed * 17 + m.day).pick(ROCK_SPOTS);
  return { x: p.x, y: p.y + 20 };
}

export class BaseScene extends Phaser.Scene {
  private px = PLAYER_START.x;
  private py = PLAYER_START.y;
  private facing = 1;
  private walkT = 0;
  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.GameObjects.Image;
  private radar!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private modules = new Map<ModuleId, { layout: ModuleLayout; sprite: Phaser.GameObjects.Image; icon?: Phaser.GameObjects.Image; status: Status }>();
  private colliders: { l: number; r: number; t: number; b: number }[] = [];
  private npcs: Npc[] = [];
  private darkRect!: Phaser.GameObjects.Rectangle;
  private stormRect!: Phaser.GameObjects.Rectangle;
  private glows: Phaser.GameObjects.Image[] = [];
  private marker!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private pointer!: Phaser.GameObjects.Image;
  private rock!: Phaser.GameObjects.Image;
  private wisp!: Phaser.GameObjects.Image;
  private dust?: Phaser.GameObjects.Image;
  private crack?: Phaser.GameObjects.Image;
  private lander!: Phaser.GameObjects.Image;
  private lastStatusUpdate = 0;
  private lastRev = -1;
  private landed = false;
  private excavatorBase?: number;

  constructor() {
    super('Base');
  }

  create(): void {
    makeTextures(this);
    const m = getState().mission!;
    this.buildWorld();
    this.buildModules(m);
    this.buildActors(m);
    this.buildOverlays();
    this.setupInput();
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor(0x0c1529);
    this.playLanding();
    if (import.meta.env.DEV) {
      debug.teleport = (x, y) => {
        this.px = x;
        this.py = y;
        this.player.setPosition(x, y);
      };
      debug.overview = () => {
        const cam = this.cameras.main;
        cam.stopFollow();
        cam.setZoom(Math.min(this.scale.width / WORLD_W, this.scale.height / WORLD_H));
        cam.centerOn(WORLD_W / 2, WORLD_H / 2);
      };
    }
  }

  // ---- world ------------------------------------------------------------------------------

  private buildWorld(): void {
    const rng = makeRng(7);
    // sky and horizon
    this.add.rectangle(0, 0, WORLD_W, HORIZON_Y + 4, 0x0a1128).setOrigin(0).setDepth(0);
    for (let i = 0; i < 160; i++) {
      const big = i % 17 === 0;
      this.add
        .image(rng.int(10, WORLD_W - 10), rng.int(6, HORIZON_Y - 40), big ? 'star_big' : 'star')
        .setAlpha(0.35 + rng.next() * 0.65)
        .setDepth(1);
    }
    this.add.image(2150, 118, 'earth').setScale(0.95).setDepth(1);
    for (let x = -60; x < WORLD_W + 200; x += 330) {
      this.add.image(x + rng.int(0, 70), HORIZON_Y + 6, 'mountain').setOrigin(0, 1).setDepth(2).setAlpha(0.92);
    }
    this.add.tileSprite(0, HORIZON_Y, WORLD_W, WORLD_H - HORIZON_Y, 'ground').setOrigin(0).setDepth(3);
    const haze = this.add.graphics().setDepth(4);
    haze.fillGradientStyle(0x0c1529, 0x0c1529, 0xc9c2b3, 0xc9c2b3, 0.55, 0.55, 0, 0);
    haze.fillRect(0, HORIZON_Y, WORLD_W, 90);
    // craters and rocks (decoration; the same moon every mission)
    const keep = (x: number, y: number) => {
      for (const mod of modulesFor({})) if (Math.abs(x - mod.x) < 260 && Math.abs(y - mod.y) < 160) return false;
      return !(Math.abs(x - LANDER.x) < 300 && Math.abs(y - LANDER.y) < 200);
    };
    for (let i = 0; i < 34; i++) {
      const kind = rng.pick(['crater_s', 'crater_s', 'crater_m', 'crater_m', 'crater_l']);
      const x = rng.int(80, WORLD_W - 80);
      const y = rng.int(HORIZON_Y + 80, WORLD_H - 40);
      if (!keep(x, y)) continue;
      this.add.image(x, y, kind).setDepth(5).setAlpha(0.95);
    }
    for (let i = 0; i < 46; i++) {
      const kind = rng.pick(['rock_a', 'rock_b', 'rock_c', 'rock_b']);
      const x = rng.int(60, WORLD_W - 60);
      const y = rng.int(HORIZON_Y + 60, WORLD_H - 30);
      if (!keep(x, y)) continue;
      this.add.image(x, y, kind).setOrigin(0.5, 1).setDepth(y);
    }
  }

  private buildModules(m: MissionState): void {
    this.lander = this.add.image(LANDER.x, LANDER.y, 'lander').setOrigin(0.5, 1).setDepth(LANDER.y);
    this.colliders.push({ l: LANDER.x - 45, r: LANDER.x + 45, t: LANDER.y - 24, b: LANDER.y });
    for (const layout of modulesFor(m.cargo)) {
      const sprite = this.add.image(layout.x, layout.y, `mod_${layout.id}`).setOrigin(0.5, 1).setDepth(layout.y);
      sprite.setInteractive({ useHandCursor: true, pixelPerfect: false });
      sprite.on('pointerup', () => {
        const near = nearbyModule(this.px, this.py);
        if (near === layout.id && !isPaused()) openModule(layout.id);
      });
      this.colliders.push({
        l: layout.x - layout.footW / 2,
        r: layout.x + layout.footW / 2,
        t: layout.y - layout.footH,
        b: layout.y,
      });
      const entry: { layout: ModuleLayout; sprite: Phaser.GameObjects.Image; icon?: Phaser.GameObjects.Image; status: Status } = {
        layout,
        sprite,
        status: null,
      };
      if (layout.id !== 'cargo' && layout.id !== 'shelter') {
        entry.icon = this.add.image(layout.x, layout.y - layout.h - 14, 'status_ok').setDepth(9000).setScale(0.95);
        entry.icon.setVisible(false);
      }
      this.modules.set(layout.id, entry);
      if (layout.id === 'solar') {
        this.dust = this.add.image(layout.x, layout.y, 'dust_film').setOrigin(0.5, 1).setDepth(layout.y + 1).setVisible(false);
        this.crack = this.add.image(layout.x, layout.y, 'crack').setOrigin(0.5, 1).setDepth(layout.y + 2).setVisible(false);
      }
      if (layout.id === 'excavator') this.excavatorBase = layout.x;
    }
    // window glow at night
    const hab = this.modules.get('habitat')!.layout;
    for (const [dx, dy] of [[-70, -125], [0, -147], [70, -125], [0, -30]]) {
      const g = this.add.image(hab.x + dx, hab.y + dy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(100010).setAlpha(0);
      this.glows.push(g);
    }
    const reactor = this.modules.get('reactor');
    if (reactor) {
      const g = this.add.image(reactor.layout.x, reactor.layout.y - 106, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(100010).setAlpha(0).setTint(0xf28c28);
      this.glows.push(g);
    }
  }

  private buildActors(m: MissionState): void {
    const shadow = this.add.image(0, 0, 'shadow');
    this.playerBody = this.add.image(0, 0, 'astro_you').setOrigin(0.5, 1);
    this.player = this.add.container(this.px, this.py, [shadow, this.playerBody]).setDepth(this.py).setVisible(false);
    this.radar = this.add.image(this.px, this.py - 80, 'radar_bot').setDepth(9500).setVisible(false);

    const habitat = this.modules.get('habitat')!.layout;
    const ids = ['layan', 'omar', 'maya'];
    ids.forEach((id, i) => {
      const x = habitat.x - 80 + i * 80;
      const y = habitat.y + 70;
      const shadowI = this.add.image(x, y, 'shadow');
      const body = this.add.image(x, y, `astro_${id}`).setOrigin(0.5, 1);
      const emote = this.add.image(x, y - 80, 'emote_tired').setDepth(9100).setVisible(false);
      this.npcs.push({ id, body, shadow: shadowI, emote, x, y, tx: x, ty: y, wait: 1 + i * 1.3, phase: i * 2, moving: false });
    });
    void m;
    this.marker = this.add.image(0, 0, 'arrow_down').setDepth(9500).setVisible(false);
    this.ring = this.add.image(0, 0, 'ring').setDepth(6).setVisible(false).setAlpha(0.85);
    this.ring.setScale(1, 0.55);
    this.pointer = this.add.image(0, 0, 'arrow_dir').setDepth(9600).setVisible(false);
    this.rock = this.add.image(0, 0, 'rock_strange').setOrigin(0.5, 1).setVisible(false);
    this.wisp = this.add.image(0, 0, 'puff').setScale(1.6).setDepth(9000).setVisible(false).setTint(0xcfefff);
    this.tweens.add({ targets: this.marker, y: '-=10', duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.ring, scaleX: 1.12, scaleY: 0.62, duration: 700, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.radar, scale: 1.08, duration: 900, yoyo: true, repeat: -1 });
  }

  private buildOverlays(): void {
    this.darkRect = this.add.rectangle(0, 0, 8000, 8000, 0x050b24, 0).setScrollFactor(0).setDepth(100000);
    this.stormRect = this.add.rectangle(0, 0, 8000, 8000, 0xe5484d, 0).setScrollFactor(0).setDepth(100020);
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys('W,A,S,D') as typeof this.wasd;
    this.keyE = kb.addKey('E');
    this.keySpace = kb.addKey('SPACE');
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    const down = () => actionDown();
    const up = () => actionUp();
    this.keyE.on('down', down);
    this.keyE.on('up', up);
    this.keySpace.on('down', down);
    this.keySpace.on('up', up);
    this.game.events.on(Phaser.Core.Events.BLUR, up);
  }

  private applyZoom(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const z = Phaser.Math.Clamp(Math.min(w / 820, h / 520), 0.55, 1.4);
    this.cameras.main.setZoom(z);
    this.darkRect.setPosition(w / 2, h / 2);
    this.stormRect.setPosition(w / 2, h / 2);
  }

  // ---- landing -------------------------------------------------------------------------------

  private playLanding(): void {
    const cam = this.cameras.main;
    cam.centerOn(LANDER.x, LANDER.y - 120);
    this.lander.setY(-240);
    const flame = this.add.image(LANDER.x, -240 + 8, 'flame').setOrigin(0.5, 0).setDepth(LANDER.y + 1);
    this.tweens.add({ targets: flame, scaleY: { from: 0.8, to: 1.25 }, duration: 90, yoyo: true, repeat: -1 });
    this.tweens.add({
      targets: [this.lander],
      y: LANDER.y,
      duration: 2600,
      ease: 'Sine.easeOut',
      onUpdate: () => flame.setY(this.lander.y - 52),
      onComplete: () => {
        flame.destroy();
        cam.shake(180, 0.004);
        for (let i = 0; i < 12; i++) {
          const p = this.add
            .image(LANDER.x + Phaser.Math.Between(-30, 30), LANDER.y - 8, 'puff')
            .setDepth(LANDER.y + 2)
            .setScale(0.8)
            .setAlpha(0.9);
          this.tweens.add({
            targets: p,
            x: p.x + Phaser.Math.Between(-170, 170),
            y: p.y + Phaser.Math.Between(-20, 20),
            scale: Phaser.Math.FloatBetween(2, 3.4),
            alpha: 0,
            duration: 1300,
            onComplete: () => p.destroy(),
          });
        }
        this.time.delayedCall(450, () => {
          this.player.setVisible(true).setAlpha(0);
          this.radar.setVisible(true);
          this.tweens.add({ targets: this.player, alpha: 1, duration: 500 });
          cam.startFollow(this.player, true, 0.12, 0.12);
          this.landed = true;
          onLanded();
        });
      },
    });
  }

  // ---- per frame ------------------------------------------------------------------------------

  update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    const s = getState();
    const m = s.mission;
    if (!m) return;
    const paused = isPaused(s);

    if (this.landed) {
      if (!paused) this.movePlayer(dt);
      updateController(dt, this.px, this.py);
    }
    this.updateNpcs(dt, paused, m);
    this.updateRadar(time);
    this.updateTaskVisuals(time, m);
    if (time - this.lastStatusUpdate > 220 || s.rev !== this.lastRev) {
      this.lastStatusUpdate = time;
      this.lastRev = s.rev;
      this.updateStatuses(m, time);
    }
    this.updateDark(m, dt);
    this.updateStormFx(time);
    this.updateExcavator(time, m);
    this.updateMarker(s.nearby);
  }

  private movePlayer(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;
    dx += input.joyX;
    dy += input.joyY;
    const len = Math.hypot(dx, dy);
    const moving = len > 0.08;
    if (moving) {
      const k = Math.min(1, len) / len;
      let nx = this.px + dx * k * PLAYER_SPEED * dt;
      let ny = this.py + dy * k * PLAYER_SPEED * dt;
      nx = Phaser.Math.Clamp(nx, 50, WORLD_W - 50);
      ny = Phaser.Math.Clamp(ny, WALK_MIN_Y, WORLD_H - 30);
      const fixed = this.collide(nx, ny, 16);
      this.px = fixed.x;
      this.py = fixed.y;
      if (Math.abs(dx) > 0.2) this.facing = dx < 0 ? -1 : 1;
      this.walkT += dt * 14;
    } else {
      this.walkT = 0;
    }
    const bob = moving ? Math.abs(Math.sin(this.walkT)) * 5 : 0;
    this.player.setPosition(this.px, this.py).setDepth(this.py);
    this.playerBody.setY(-bob).setFlipX(this.facing < 0);
    this.playerBody.setScale(1, moving ? 1 - Math.abs(Math.sin(this.walkT)) * 0.04 : 1);
  }

  private collide(x: number, y: number, r: number): { x: number; y: number } {
    for (const c of this.colliders) {
      const cx = Phaser.Math.Clamp(x, c.l, c.r);
      const cy = Phaser.Math.Clamp(y, c.t, c.b);
      const ddx = x - cx;
      const ddy = y - cy;
      const d = Math.hypot(ddx, ddy);
      if (d < r) {
        if (d > 0.001) {
          x = cx + (ddx / d) * r;
          y = cy + (ddy / d) * r;
        } else {
          y = c.b + r;
        }
      }
    }
    return { x, y };
  }

  private updateRadar(time: number): void {
    if (!this.radar.visible) return;
    const tx = this.px - this.facing * 46;
    const ty = this.py - 96 + Math.sin(time / 380) * 5;
    this.radar.x += (tx - this.radar.x) * 0.08;
    this.radar.y += (ty - this.radar.y) * 0.08;
  }

  private npcTarget(n: Npc, m: MissionState): void {
    const mods = modulesFor(m.cargo);
    const pick = Phaser.Utils.Array.GetRandom(mods) as ModuleLayout;
    const f = frontPoint(pick);
    n.tx = f.x + Phaser.Math.Between(-70, 70);
    n.ty = f.y + Phaser.Math.Between(14, 50);
    n.tx = Phaser.Math.Clamp(n.tx, 60, WORLD_W - 60);
    n.ty = Phaser.Math.Clamp(n.ty, WALK_MIN_Y + 20, WORLD_H - 40);
  }

  private updateNpcs(dt: number, paused: boolean, m: MissionState): void {
    const storm = view.storm;
    for (const [i, n] of this.npcs.entries()) {
      if (!paused) {
        let speed = NPC_SPEED;
        if (storm) {
          n.tx = storm.x + (i - 1) * 40;
          n.ty = storm.y + 20 + (i % 2) * 14;
          speed = 170;
          n.wait = 0;
        }
        if (n.wait > 0) {
          n.wait -= dt;
          n.moving = false;
          if (n.wait <= 0 && !storm) this.npcTarget(n, m);
        } else {
          const dx = n.tx - n.x;
          const dy = n.ty - n.y;
          const d = Math.hypot(dx, dy);
          if (d < 6) {
            n.moving = false;
            if (!storm) n.wait = Phaser.Math.FloatBetween(1.5, 4.5);
          } else {
            n.moving = true;
            n.x += (dx / d) * speed * dt;
            n.y += (dy / d) * speed * dt;
            n.body.setFlipX(dx < 0);
            n.phase += dt * 12;
          }
        }
      }
      const bob = n.moving ? Math.abs(Math.sin(n.phase)) * 4 : Math.sin(this.time.now / 700 + i) * 0.8;
      n.body.setPosition(n.x, n.y - bob).setDepth(n.y);
      n.shadow.setPosition(n.x, n.y).setDepth(n.y - 1);
      const h = m.crew.find((c) => c.id === n.id)?.health ?? 100;
      const emote = h >= 70 ? null : h >= 40 ? 'emote_tired' : h >= 20 ? 'emote_sick' : 'emote_critical';
      if (emote) n.emote.setTexture(emote).setVisible(true).setPosition(n.x, n.y - 78).setDepth(9100);
      else n.emote.setVisible(false);
    }
  }

  private updateStatuses(m: MissionState, time: number): void {
    for (const e of this.modules.values()) {
      const st: Status = moduleStatus(e.layout.id, m).kind;
      if (e.icon && st) {
        e.icon.setVisible(true);
        if (st !== e.status) e.icon.setTexture(`status_${st}`);
        e.icon.setAlpha(st === 'broken' ? (Math.floor(time / 350) % 2 ? 0.35 : 1) : 1);
      }
      e.status = st;
      if (e.layout.id === 'solar') {
        this.dust?.setVisible(m.effects.dust);
        this.crack?.setVisible(m.effects.meteoroid);
      }
      // a broken module flashes red so a kid can spot it from afar
      if (st === 'broken') e.sprite.setTint(Math.floor(time / 350) % 2 ? 0xff8f8f : 0xffffff);
      else e.sprite.clearTint();
    }
  }

  private updateTaskVisuals(time: number, m: MissionState): void {
    const t = view.task;
    const st = view.storm;
    // the strange rock is there as soon as it "appears" and until it is dealt with
    const rockOn = m.pending === 'rock' || t?.kind === 'rock';
    if (rockOn) {
      const p = rockSpot(m);
      this.rock.setVisible(true).setPosition(p.x, p.y).setDepth(p.y);
    } else this.rock.setVisible(false);

    let tx: number | null = null;
    let ty: number | null = null;
    if (st) {
      tx = st.x;
      ty = st.y;
    } else if (t && t.kind !== 'leak') {
      tx = t.x;
      ty = t.y;
    } else if (t && t.kind === 'leak') {
      const d = Math.hypot(this.px - t.x, this.py - t.y);
      this.wisp.setVisible(d < 110).setPosition(t.x, t.y - 14 - Math.sin(time / 120) * 6).setAlpha(0.5 + Math.sin(time / 90) * 0.3);
    }
    if (!t || t.kind !== 'leak') this.wisp.setVisible(false);

    if (tx !== null && ty !== null) {
      this.ring.setVisible(true).setPosition(tx, ty);
      const r = st ? st.r : t!.r;
      this.ring.setDisplaySize(Math.max(100, r * 2.1), Math.max(56, r * 1.15));
      const dist = Math.hypot(this.px - tx, this.py - ty);
      if (dist > 220) {
        const a = Math.atan2(ty - this.py, tx - this.px);
        this.pointer.setVisible(true).setPosition(this.px + Math.cos(a) * 90, this.py - 50 + Math.sin(a) * 60).setRotation(a).setAlpha(0.95);
      } else this.pointer.setVisible(false);
    } else {
      this.ring.setVisible(false);
      this.pointer.setVisible(false);
    }
    void time;
  }

  private updateMarker(nearby: ModuleId | null): void {
    if (!nearby || isPaused()) {
      this.marker.setVisible(false);
      return;
    }
    const e = this.modules.get(nearby);
    if (!e) return;
    const base = e.layout.y - e.layout.h - (e.icon ? 56 : 24);
    this.marker.setVisible(true).setX(e.layout.x);
    this.marker.y = base + (Math.sin(this.time.now / 240) * 7 - 0);
  }

  private darkNow = 0;
  private updateDark(m: MissionState, dt: number): void {
    const target = sunFactor(m.day) === 0 ? 0.55 : 0;
    this.darkNow += (target - this.darkNow) * Math.min(1, dt * 1.6);
    this.darkRect.setAlpha(this.darkNow);
    const glow = Math.min(1, this.darkNow / 0.4);
    for (const g of this.glows) g.setAlpha(glow * 0.75);
  }

  private updateStormFx(time: number): void {
    if (view.storm) {
      this.stormRect.setAlpha(0.1 + (Math.sin(time / 160) + 1) * 0.07);
    } else {
      this.stormRect.setAlpha(Math.max(0, this.stormRect.alpha - 0.02));
    }
    if (view.stormHit === 1) {
      view.stormHit = 0;
      this.cameras.main.shake(700, 0.012);
      this.cameras.main.flash(400, 229, 72, 77);
    }
  }

  private updateExcavator(time: number, m: MissionState): void {
    const e = this.modules.get('excavator');
    if (!e || this.excavatorBase === undefined) return;
    if (m.systems.excavator.running) {
      e.sprite.setX(this.excavatorBase + Math.sin(time / 1500) * 55);
      e.sprite.setAngle(Math.sin(time / 130) * 0.7);
      e.sprite.setFlipX(Math.cos(time / 1500) < 0);
    }
  }
}

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { getState, isPaused, setState } from '../../ui/store';
import { debug, onLanded } from '../controller';
import { setSkipper, setStopper } from '../runtime';
import { Cutscene } from './Cutscene';
import { MoonBase } from './MoonBase';

export interface WorldOptions {
  /** phones and small tablets: fewer pixels, smaller shadows, no bloom */
  lowPower: boolean;
}

/** Owns the WebGL renderer and the frame loop; shows the cut-scene, then the Moon base. */
export class World {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private base: MoonBase;
  private cutscene: Cutscene | null = null;
  private raf = 0;
  private last = 0;
  private running = true;
  private ro: ResizeObserver;

  constructor(
    private host: HTMLElement,
    opts: WorldOptions,
  ) {
    const r = new THREE.WebGLRenderer({ antialias: !opts.lowPower, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1.25 : 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'world-canvas';
    host.appendChild(r.domElement);
    this.renderer = r;

    const { w, h } = this.size();
    this.base = new MoonBase(w / h, opts.lowPower ? { terrain: 140, shadows: 1024 } : { terrain: 220, shadows: 2048 });
    this.base.build(getState().mission!);
    if (getState().landing) this.cutscene = new Cutscene(w / h, this.base);

    if (!opts.lowPower) {
      this.composer = new EffectComposer(r);
      this.renderPass = new RenderPass(this.base.scene, this.base.camera);
      this.composer.addPass(this.renderPass);
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.45, 0.82));
      this.composer.addPass(new OutputPass());
    }
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);

    r.domElement.addEventListener('click', this.lock);
    document.addEventListener('pointerlockchange', this.onLockChange);
    setStopper(() => this.stop());
    setSkipper(() => this.cutscene?.skip());
    if (import.meta.env.DEV) debug.seekCutscene = (t) => this.cutscene?.seek(t);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private size(): { w: number; h: number } {
    return { w: Math.max(1, this.host.clientWidth), h: Math.max(1, this.host.clientHeight) };
  }

  private resize = () => {
    const { w, h } = this.size();
    if (w < 2 || h < 2) return;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.base.camera.aspect = w / h;
    this.base.camera.updateProjectionMatrix();
    this.cutscene?.resize(w / h);
  };

  /** Desktop: click the view to capture the mouse for looking around. */
  private lock = () => {
    if (this.cutscene || isPaused() || matchMedia('(pointer: coarse)').matches) return;
    this.renderer.domElement.requestPointerLock?.();
  };
  private onLockChange = () => {
    setState({ locked: document.pointerLockElement === this.renderer.domElement });
  };

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const time = now / 1000;
    let scene: THREE.Scene = this.base.scene;
    let camera: THREE.Camera = this.base.camera;
    if (this.cutscene) {
      const shot = this.cutscene.update(dt);
      scene = shot.scene;
      camera = shot.camera;
      if (this.cutscene.done) {
        this.cutscene = null;
        this.base.placeAtStart();
        onLanded();
      }
    } else {
      // leave mouse-look when a panel or card opens, so the mouse can click it
      if (isPaused() && document.pointerLockElement) document.exitPointerLock();
      this.base.update(dt, time);
    }
    if (this.composer && this.renderPass) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      this.composer.render(dt);
    } else {
      this.renderer.render(scene, camera);
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('click', this.lock);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    if (document.pointerLockElement) document.exitPointerLock();
    this.base.dispose();
    setStopper(null);
    setSkipper(null);
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

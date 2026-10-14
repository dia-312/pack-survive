/** Lets the UI stop the 3D world right before its canvas leaves the page (no three.js import here). */
let stopper: (() => void) | null = null;

export function setStopper(fn: (() => void) | null): void {
  stopper = fn;
}

export function stopGame(): void {
  try {
    stopper?.();
  } catch {
    /* already gone */
  }
}

let skipper: (() => void) | null = null;
export function setSkipper(fn: (() => void) | null): void {
  skipper = fn;
}
/** Skip the launch / landing cut-scene. */
export function skipCutscene(): void {
  skipper?.();
}

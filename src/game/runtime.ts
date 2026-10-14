/** Lets the UI pause the Phaser game right before its canvas leaves the page (no Phaser import here). */
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

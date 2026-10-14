import Phaser from 'phaser';
import { BaseScene } from './BaseScene';

import { setStopper } from './runtime';

let current: Phaser.Game | null = null;

export function createGame(parent: HTMLElement): Phaser.Game {
  current = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0c1529',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [BaseScene],
    input: { keyboard: { target: window }, touch: true },
    render: { antialias: true, powerPreference: 'default' },
    fps: { target: 60 },
    disableContextMenu: true,
    audio: { noAudio: true },
  });
  const game = current;
  setStopper(() => {
    game.loop.sleep();
    game.scale.stopListeners();
  });
  return game;
}

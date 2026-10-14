import { useEffect, useRef } from 'react';
import { createGame } from '../../game';
import * as controller from '../../game/controller';
import { ActionButton, Joystick, useTouch } from '../hud/Controls';
import { Hud } from '../hud/Hud';
import { Overlays } from '../hud/Overlays';

export default function PlayScreen() {
  const host = useRef<HTMLDivElement>(null);
  const touch = useTouch();

  useEffect(() => {
    controller.resetController();
    const game = createGame(host.current!);
    return () => {
      // stop resize listeners first: a 0x0 parent during teardown makes WebGL log a harmless-but-noisy error
      game.scale.stopListeners();
      game.destroy(true);
      controller.input.joyX = 0;
      controller.input.joyY = 0;
      controller.input.actionHeld = false;
    };
  }, []);

  return (
    <div className="play">
      <div ref={host} className="game-host" />
      <Hud />
      {touch && (
        <>
          <Joystick />
          <ActionButton />
        </>
      )}
      <Overlays />
    </div>
  );
}

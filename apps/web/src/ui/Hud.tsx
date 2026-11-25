import type { GameView } from '../game/GameController';
import { PlayerCard } from './PlayerCard';

interface Props {
  view: GameView;
  onNewGame(): void;
}

export function Hud({ view, onNewGame }: Props) {
  return (
    <header className="hud">
      <PlayerCard player={0} view={view} />
      <div className="hud-center">
        <div className="brand">
          SINUCA <b>8</b>
        </div>
        <div className="hud-buttons">
          <button type="button" onClick={onNewGame}>
            Nova partida
          </button>
        </div>
      </div>
      <PlayerCard player={1} view={view} />
    </header>
  );
}

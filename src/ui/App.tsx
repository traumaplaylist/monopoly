import { useGame } from '../game/store';
import { GameScreen } from './GameScreen';
import { SetupScreen } from './SetupScreen';

export function App() {
  const hasGame = useGame((s) => s.state !== null);
  return hasGame ? <GameScreen /> : <SetupScreen />;
}

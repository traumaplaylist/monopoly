import { useStore } from '../state/store';
import { Home } from './Home';
import { Lobby } from './Lobby';
import { MatchScreen } from './match/MatchScreen';
import { ConnBanner, Toast } from './match/Overlays';

export function App() {
  const room = useStore((s) => s.room);
  const match = useStore((s) => s.match);
  const screen = room && match && room.status !== 'lobby' ? <MatchScreen /> : room ? <Lobby /> : <Home />;
  return (
    <>
      {screen}
      <ConnBanner />
      <Toast />
    </>
  );
}

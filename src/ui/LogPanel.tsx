import { eventText } from './format';
import { useGameState } from './hooks';

export function LogPanel() {
  const state = useGameState();
  const lines = state.log
    .map((e) => ({ seq: e.seq, text: eventText(state, e), turn: e.t === 'turnStart' }))
    .filter((l) => l.text)
    .slice(-60)
    .reverse();
  return (
    <div className="log" data-testid="log">
      {lines.map((l) => (
        <div key={l.seq} className={l.turn ? 'turn' : ''}>
          {l.text}
        </div>
      ))}
    </div>
  );
}

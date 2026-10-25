import { getActor, netWorth } from '../engine';
import { useGame } from '../game/store';
import { money } from './format';
import { useGameState } from './hooks';

const TOKEN_NAMES = ['Ракета', 'Спутник', 'Кристалл', 'Дрон', 'Модуль', 'Комета'];

export function PlayersPanel() {
  const state = useGameState();
  const me = useGame((s) => s.localPlayerId);
  const actor = getActor(state);
  const current = state.players[state.current]!.id;
  return (
    <div className="players">
      {state.players.map((p) => (
        <div
          key={p.id}
          className={`player ${p.id === current ? 'current' : ''} ${p.bankrupt ? 'bankrupt' : ''} ${p.id === actor ? 'acting' : ''}`}
          title={`${TOKEN_NAMES[p.token]} · капитал ${money(netWorth(state, p.id))}`}
          data-testid={`player-${p.id}`}
        >
          <span className="dot" style={{ background: p.color }} />
          <span className="pname">
            {p.name}
            {p.id === me && <small> (вы)</small>}
          </span>
          <span className="badges">
            {p.inJail && <span title="В карантине">⛔</span>}
            {p.jailCards.length > 0 && (
              <span title="Карта выхода из карантина">🎫{p.jailCards.length > 1 ? p.jailCards.length : ''}</span>
            )}
          </span>
          <span className="cash">{p.bankrupt ? 'банкрот' : money(p.cash)}</span>
        </div>
      ))}
    </div>
  );
}

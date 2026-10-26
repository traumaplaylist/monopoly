import { GROUPS, GROUP_ORDER, getActor, netWorth } from '../engine';
import { useGame } from '../game/store';
import { Avatar } from './Avatar';
import { useGameState } from './hooks';

export function PlayerCards() {
  const state = useGameState();
  const me = useGame((s) => s.localPlayerId);
  const actor = getActor(state);
  const current = state.players[state.current]!.id;
  return (
    <div className="pcards">
      {state.players.map((p) => {
        const groups = GROUP_ORDER.filter((g) => GROUPS[g].tiles.some((t) => state.ownership[t]?.owner === p.id));
        return (
          <div
            key={p.id}
            className={`pcard ${p.id === current ? 'current' : ''} ${p.id === actor ? 'acting' : ''} ${p.bankrupt ? 'out' : ''}`}
            style={{ ['--pc' as string]: p.color }}
            title={p.bankrupt ? '' : `Капитал: ${netWorth(state, p.id)}`}
            data-testid={`player-${p.id}`}
          >
            <Avatar player={p} size={56} />
            <div className="pinfo">
              <div className="pname">
                {p.id === me ? 'Ты' : p.name}
                {p.inJail && <span title="В карантине"> ⛔</span>}
                {p.jailCards.length > 0 && <span title="Карта выхода из карантина"> 🎫</span>}
              </div>
              {p.bankrupt ? (
                <div className="pghost">ПРИЗРАК</div>
              ) : (
                <div className="pcash">
                  <i className="coin" />
                  {p.cash.toLocaleString('ru-RU')}
                </div>
              )}
              <div className="pbars">
                {groups.map((g) => (
                  <span key={g} style={{ background: GROUPS[g].color }} title={GROUPS[g].name} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

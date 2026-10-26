import { GROUPS, GROUP_ORDER, groupTiles, MEGAPOLIS, RULESET } from '@pb/content';
import { useStore } from '../../state/store';
import { money } from '../format';
import { acting, currentSeat, useMatch } from '../hooks';
import { Portrait } from '../Portrait';

export function PlayerCards() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const room = useStore((s) => s.room);
  const cur = currentSeat(m);
  const act = acting(m);
  return (
    <div className="pcards" data-testid="players">
      {m.order.map((seat) => {
        const p = m.players.find((x) => x.seat === seat)!;
        const online = room?.seats.find((s) => s.seat === seat)?.connected ?? false;
        const groups = GROUP_ORDER.filter((g) => groupTiles(MEGAPOLIS, g).some((t) => m.tiles[t]?.owner === seat));
        return (
          <div
            key={seat}
            className={`pcard ${seat === cur && p.role === 'alive' ? 'current' : ''} ${act.includes(seat) ? 'acting' : ''} ${p.role}`}
            style={{ ['--pc' as string]: p.color }}
            data-testid={`player-${seat}`}
          >
            <Portrait avatar={p.avatar} color={p.color} ghost={p.role === 'ghost'} size={52} />
            <div className="pinfo">
              <div className="pname">
                {seat === me ? 'Ты' : p.name}
                {!online && p.role !== 'left' && (
                  <span className="offline" title="Нет связи — решения примет таймер">
                    {' '}
                    ⚠
                  </span>
                )}
              </div>
              {p.role === 'alive' && (
                <div className="pcash">
                  <i className="coin" />
                  <span className="cash-full">{money(p.cash)}</span>
                  <span className="cash-compact">{p.cash}</span>
                </div>
              )}
              {p.role === 'ghost' && (
                <div className="pghost">
                  ПРИЗРАК{' '}
                  <span title="Энергия призрака">
                    {'⚡'.repeat(p.ghostEnergy)}
                    {'·'.repeat(Math.max(0, RULESET.ghostEnergyMax - p.ghostEnergy))}
                  </span>
                </div>
              )}
              {p.role === 'left' && <div className="pghost">вышел</div>}
              {p.role === 'alive' && (
                <div className="pbars">
                  {groups.map((g) => (
                    <span key={g} style={{ background: GROUPS[g].color }} title={GROUPS[g].name} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

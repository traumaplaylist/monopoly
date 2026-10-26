import { anchorRef } from '../../render/BoardAnchor';
import { useStore } from '../../state/store';
import { secondsLeft, seatName } from '../format';
import { acting, currentSeat, useMatch, useNow } from '../hooks';

const PHASE_TEXT: Record<string, string> = {
  PURCHASE: 'решает о покупке',
  AUCTION: 'Аукцион',
  RENT_CHOICE: 'платит аренду',
  DEBT: 'ищет деньги',
  TRADE: 'Сделка',
  DUEL_OFFER: 'Вызов на дуэль',
  DUEL: 'Дуэль',
  MINIGAME: 'Мини-игра',
  FINISHED: 'Партия окончена',
};

/** Calm centre of the board: whose turn, what is happening, time left. */
export function Banner() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const now = useNow();
  const cur = currentSeat(m);
  const myTurn = cur === me && (m.phase === 'PRE_ROLL' || m.phase === 'POST_ROLL');
  const waitingMe = acting(m).includes(me ?? '');
  let title: string;
  if (m.phase === 'PRE_ROLL' || m.phase === 'POST_ROLL') title = myTurn ? 'ТВОЙ ХОД' : `ХОДИТ ${seatName(m, cur).toUpperCase()}`;
  else if (['AUCTION', 'TRADE', 'DUEL_OFFER', 'DUEL', 'MINIGAME', 'FINISHED'].includes(m.phase)) title = PHASE_TEXT[m.phase]!.toUpperCase();
  else title = cur === me ? 'ТВОЙ ХОД' : `${seatName(m, cur)} ${PHASE_TEXT[m.phase]}`.toUpperCase();
  const deadline = m.phase === 'AUCTION' ? m.auction!.deadline : m.deadline;
  const left = secondsLeft(deadline, now);
  return (
    <div className="anchor" ref={anchorRef('banner')}>
      <div className={`banner ${waitingMe ? 'mine' : ''}`} data-testid="banner">
        <div className="banner-title">{title}</div>
        {left !== null && m.phase !== 'MINIGAME' && m.phase !== 'DUEL' && (
          <div className={`timer ${left <= 5 ? 'low' : ''}`} title="Осталось секунд">
            ⏱ {left}
          </div>
        )}
      </div>
    </div>
  );
}

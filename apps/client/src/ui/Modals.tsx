import { useEffect, useState } from 'react';
import { CARDS, DECK_NAMES, getActor, netWorth, tile } from '../engine';
import { useGame } from '../game/store';
import { errorText, money, playerName, sideText } from './format';
import { canDo, useGameState, useMe, useMyTurnReady } from './hooks';

export function AuctionModal() {
  const state = useGameState();
  const me = useMe();
  const ready = useMyTurnReady();
  const dispatch = useGame((s) => s.dispatch);
  const au = state.auction;
  const [custom, setCustom] = useState('');
  if (state.phase !== 'auction' || !au) return null;
  const t = tile(au.tile);
  const myTurn = ready && au.turn === me.id;
  const inAuction = au.participants.includes(me.id);
  const bid = (amount: number) => dispatch({ type: 'BID', player: me.id, amount });
  const quick = [1, 10, 50, 100].map((d) => au.highBid + d);
  return (
    <div className="modal-layer passive">
      <div className="modal auction" data-testid="auction">
        <h3>Аукцион: «{t.name}»</h3>
        <p className="muted">Цена по номиналу {money(t.price!)}</p>
        <div className="bid-now">
          {au.highBidder ? (
            <>
              Ставка: <b>{money(au.highBid)}</b> — {playerName(state, au.highBidder)}
            </>
          ) : (
            'Ставок пока нет'
          )}
        </div>
        <div className="participants">
          {state.players
            .filter((p) => !p.bankrupt)
            .map((p) => (
              <span
                key={p.id}
                className={`chip ${au.participants.includes(p.id) ? '' : 'out'} ${au.turn === p.id ? 'turn' : ''}`}
              >
                {p.name}
              </span>
            ))}
        </div>
        {myTurn ? (
          <>
            <div className="row wrap">
              {quick.map((v) => (
                <button
                  key={v}
                  className="btn"
                  disabled={!canDo(state, { type: 'BID', player: me.id, amount: v })}
                  onClick={() => bid(v)}
                >
                  {money(v)}
                </button>
              ))}
            </div>
            <div className="row">
              <input
                className="grow"
                inputMode="numeric"
                placeholder="Своя ставка"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
              />
              <button
                className="btn primary"
                disabled={!canDo(state, { type: 'BID', player: me.id, amount: Number(custom) || 0 })}
                onClick={() => {
                  bid(Number(custom));
                  setCustom('');
                }}
              >
                Ставка
              </button>
              <button
                className="btn"
                onClick={() => dispatch({ type: 'PASS_AUCTION', player: me.id })}
                data-testid="auction-pass"
              >
                Пас
              </button>
            </div>
            <p className="hint">Наличные: {money(me.cash)}</p>
          </>
        ) : (
          <p className="status">
            {inAuction
              ? `Ход ставки: ${playerName(state, au.turn)}…`
              : `Вы вышли из торгов. Ставит ${playerName(state, au.turn)}…`}
          </p>
        )}
      </div>
    </div>
  );
}

export function IncomingTradeModal() {
  const state = useGameState();
  const me = useMe();
  const ready = useMyTurnReady();
  const dispatch = useGame((s) => s.dispatch);
  const tr = state.trade;
  if (!tr || tr.to !== me.id) return null;
  return (
    <div className="modal-layer">
      <div className="modal" data-testid="incoming-trade">
        <h3>{playerName(state, tr.from)} предлагает сделку</h3>
        <div className="trade-summary">
          <div>
            <div className="muted">Вы получаете</div>
            <b>{sideText(tr.give)}</b>
          </div>
          <div className="arrow">⇄</div>
          <div>
            <div className="muted">Вы отдаёте</div>
            <b>{sideText(tr.get)}</b>
          </div>
        </div>
        <div className="row">
          <button className="btn primary" disabled={!ready} onClick={() => dispatch({ type: 'ACCEPT_TRADE', player: me.id })}>
            Принять
          </button>
          <button className="btn" disabled={!ready} onClick={() => dispatch({ type: 'REJECT_TRADE', player: me.id })}>
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
}

export function CardPopup() {
  const shown = useGame((s) => s.shownCard);
  const dismiss = useGame((s) => s.dismissCard);
  const state = useGameState();
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
  }, [shown, dismiss]);
  if (!shown) return null;
  const c = CARDS[shown.deck][shown.card]!;
  return (
    <div className={`card-popup ${shown.deck}`} onClick={dismiss} data-testid="card-popup">
      <div className="deck">
        {DECK_NAMES[shown.deck]} · {playerName(state, shown.player)}
      </div>
      <div className="title">{c.title}</div>
      <div className="text">{c.text}</div>
    </div>
  );
}

export function GameOverModal() {
  const state = useGameState();
  const quit = useGame((s) => s.quitToMenu);
  if (state.phase !== 'gameOver') return null;
  const ranking = [...state.players].sort(
    (a, b) => Number(a.bankrupt) - Number(b.bankrupt) || netWorth(state, b.id) - netWorth(state, a.id),
  );
  return (
    <div className="modal-layer">
      <div className="modal" data-testid="game-over">
        <h2>🏆 {playerName(state, state.winner)} побеждает!</h2>
        <ol className="ranking">
          {ranking.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} /> {p.name} —{' '}
              {p.bankrupt ? 'банкрот' : money(netWorth(state, p.id))}
            </li>
          ))}
        </ol>
        <button className="btn primary wide" onClick={quit}>
          В меню
        </button>
      </div>
    </div>
  );
}

export function ErrorToast() {
  const error = useGame((s) => s.error);
  const clear = useGame((s) => s.clearError);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clear, 2500);
    return () => clearTimeout(t);
  }, [error, clear]);
  if (!error) return null;
  return <div className="toast">{errorText(error)}</div>;
}

export function useActorName(): string {
  const state = useGameState();
  return playerName(state, getActor(state));
}

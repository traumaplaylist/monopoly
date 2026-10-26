import { useState } from 'react';
import { RULESET } from '@pb/content';
import { available, raisableCash, rentFor } from '@pb/game-core';
import type { MatchState, PublicMatch } from '@pb/game-core';
import { send } from '../../net/connection';
import { anchorRef } from '../../render/BoardAnchor';
import { set, useStore } from '../../state/store';
import { money, secondsLeft, seatName, sideText, tileName } from '../format';
import { currentSeat, tileDef, useMatch, useNow } from '../hooks';

const asState = (m: PublicMatch) => m as unknown as MatchState;

function Coins({ n }: { n: number }) {
  return (
    <b className="coins">
      <i className="coin" />
      {money(n)}
    </b>
  );
}

function Auction() {
  const m = useMatch();
  const me = useStore((s) => s.seat)!;
  const now = useNow();
  const au = m.auction!;
  const t = tileDef(au.tile);
  const mePlayer = m.players.find((p) => p.seat === me);
  const alive = mePlayer?.role === 'alive';
  const free = alive ? available(asState(m), me) : 0;
  const min = Math.max(RULESET.auction.minBid, au.highBid + RULESET.auction.step);
  const [custom, setCustom] = useState('');
  const canBid = alive && au.leader !== me && !au.passed.includes(me);
  const bid = (amount: number) => send({ type: 'BID', amount });
  return (
    <div className="prompt auction" data-testid="auction">
      <div className="prompt-title">
        Аукцион: «{t.name}» <span className="muted">цена {money(t.price!)}</span>
      </div>
      <div className="auction-now">
        {au.leader ? (
          <>
            Ставка <Coins n={au.highBid} /> — {seatName(m, au.leader, me)}
          </>
        ) : (
          'Ставок нет'
        )}
        <span className={`timer ${(secondsLeft(au.deadline, now) ?? 0) <= 3 ? 'low' : ''}`}>⏱ {secondsLeft(au.deadline, now)}</span>
      </div>
      {canBid ? (
        <>
          <div className="row wrap">
            {[min, min + 40, min + 90].map((v) => (
              <button key={v} className="btn" disabled={v > free} onClick={() => bid(v)} data-testid={v === min ? 'bid-min' : undefined}>
                {money(v)}
              </button>
            ))}
            <button className="btn ghost-btn" onClick={() => send({ type: 'PASS_AUCTION' })} data-testid="auction-pass">
              Пас
            </button>
          </div>
          <div className="row">
            <input className="grow" inputMode="numeric" placeholder={`от ${min}, шаг 10`} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} />
            <button className="btn primary" disabled={!custom || Number(custom) < min || Number(custom) > free} onClick={() => bid(Number(custom))}>
              Ставка
            </button>
          </div>
          <div className="hint">Свободно: {money(free)}. Ставка лидера резервируется до конца торгов.</div>
        </>
      ) : (
        <div className="hint">{!alive ? 'Призраки не участвуют в торгах.' : au.leader === me ? 'Ваша ставка лидирует.' : 'Вы вышли из торгов.'}</div>
      )}
    </div>
  );
}

export function Prompt() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const placing = useStore((s) => s.placing);
  const now = useNow();
  const cur = currentSeat(m);
  const mine = cur === me;
  let body: React.ReactNode = null;

  if (placing) {
    body = (
      <div className="prompt slim">
        <div className="prompt-title">{placing === 'ghostBlock' ? 'Выберите чужой объект, который нельзя будет улучшить' : 'Выберите обычную клетку для ловушки'}</div>
        <button className="btn" onClick={() => set({ placing: null })}>
          Отмена
        </button>
      </div>
    );
  } else if (m.phase === 'AUCTION' && m.auction) {
    body = <Auction />;
  } else if (m.phase === 'PURCHASE' && mine && m.purchaseTile !== null) {
    const t = tileDef(m.purchaseTile);
    const free = available(asState(m), me!);
    body = (
      <div className="prompt">
        <div className="prompt-title">«{t.name}» свободна</div>
        <div className="muted">
          Цена <Coins n={t.price!} />, аренда {money(t.baseRent!)} (комплект ×2)
        </div>
        <div className="row">
          <button className="btn primary" disabled={free < t.price!} onClick={() => send({ type: 'BUY' })} data-testid="buy">
            Купить
          </button>
          <button className="btn" onClick={() => send({ type: 'DECLINE_BUY' })} data-testid="decline">
            На аукцион
          </button>
        </div>
        {free < t.price! && <div className="hint warn">Не хватает денег — можно заложить объекты или отправить на аукцион.</div>}
        <div className="hint">Решение через {secondsLeft(m.deadline, now)} с, иначе — аукцион.</div>
      </div>
    );
  } else if (m.phase === 'RENT_CHOICE' && mine) {
    const o = m.pending[0]!;
    body = (
      <div className="prompt">
        <div className="prompt-title">
          Аренда <Coins n={o.amount} /> → {seatName(m, o.payee, me)}
        </div>
        <div className="muted">Есть «Скидка»: заплатить вдвое меньше?</div>
        <div className="row">
          <button className="btn primary" onClick={() => send({ type: 'USE_DISCOUNT' })} data-testid="use-discount">
            Скидка −50%
          </button>
          <button className="btn" onClick={() => send({ type: 'PAY_FULL' })}>
            Заплатить всё
          </button>
        </div>
        <div className="hint">Через {secondsLeft(m.deadline, now)} с — оплата полностью.</div>
      </div>
    );
  } else if (m.phase === 'DEBT' && m.debt?.payer === me) {
    const d = m.debt;
    const cash = m.players.find((p) => p.seat === me)!.cash;
    const raisable = raisableCash(asState(m), me);
    body = (
      <div className="prompt danger" data-testid="debt">
        <div className="prompt-title">
          Нужно заплатить <Coins n={d.amount} />
        </div>
        <div className="muted">
          Наличные {money(cash)}. Можно получить, продав и заложив всё: {money(raisable)}.
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => set({ sheet: { kind: 'assets' } })}>
            Продать / заложить
          </button>
          <button className="btn primary" disabled={cash < d.amount} onClick={() => send({ type: 'PAY_DEBT' })}>
            Оплатить
          </button>
        </div>
        <button className="btn danger" onClick={() => send({ type: 'DECLARE_BANKRUPTCY' })}>
          {raisable >= d.amount ? 'Продать автоматически и оплатить' : 'Не хватает — объявить банкротство'}
        </button>
        <div className="hint">Через {secondsLeft(m.deadline, now)} с сервер продаст и заложит всё сам.</div>
      </div>
    );
  } else if (m.phase === 'TRADE' && m.trade) {
    const tr = m.trade;
    if (tr.to === me) {
      body = (
        <div className="prompt" data-testid="incoming-trade">
          <div className="prompt-title">{seatName(m, tr.from)} предлагает сделку</div>
          <div className="trade-lines">
            <div>
              Вы получаете: <b>{sideText(tr.give)}</b>
            </div>
            <div>
              Вы отдаёте: <b>{sideText(tr.get)}</b>
            </div>
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => send({ type: 'ACCEPT_TRADE', offerId: tr.id })} data-testid="accept-trade">
              Принять
            </button>
            <button className="btn" onClick={() => send({ type: 'REJECT_TRADE', offerId: tr.id })}>
              Отказать
            </button>
          </div>
          <div className="hint">Осталось {secondsLeft(tr.deadline, now)} с</div>
        </div>
      );
    } else if (tr.from === me) {
      body = (
        <div className="prompt slim">
          <div>Ждём ответа {seatName(m, tr.to)}… {secondsLeft(tr.deadline, now)} с</div>
          <button className="btn" onClick={() => send({ type: 'CANCEL_TRADE' })}>
            Отозвать
          </button>
        </div>
      );
    }
  } else if (m.phase === 'DUEL_OFFER' && m.duelOffer) {
    const d = m.duelOffer;
    if (d.seller === me) {
      body = (
        <div className="prompt" data-testid="incoming-duel">
          <div className="prompt-title">
            ⚔ {seatName(m, d.buyer)} вызывает на дуэль за «{tileName(d.tile)}»
          </div>
          <div className="trade-lines">
            <div>
              Если победит {seatName(m, d.buyer)}: он платит вам <Coins n={d.priceIfBuyerWins} />
            </div>
            <div>
              Если победите вы: он платит <Coins n={d.priceIfSellerWins} />
            </div>
            <div className="hint">В обоих случаях объект переходит к нему. Ничья — сделки нет. Кто не сыграл — проигрывает.</div>
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => send({ type: 'ACCEPT_DUEL', offerId: d.id })} data-testid="accept-duel">
              Принять
            </button>
            <button className="btn" onClick={() => send({ type: 'DECLINE_DUEL', offerId: d.id })}>
              Отказаться
            </button>
          </div>
          <div className="hint">Осталось {secondsLeft(d.deadline, now)} с</div>
        </div>
      );
    } else if (d.buyer === me) {
      body = (
        <div className="prompt slim">
          <div>Ждём ответа {seatName(m, d.seller)} на вызов… {secondsLeft(d.deadline, now)} с</div>
          <button className="btn" onClick={() => send({ type: 'CANCEL_DUEL' })}>
            Отозвать
          </button>
        </div>
      );
    }
  } else if (m.phase === 'POST_ROLL' && mine && m.turn.duelHint) {
    body = (
      <div className="prompt slim">
        <div>Клетка «Дуэль»: можно вызвать соперника за его объект.</div>
        <button className="btn" onClick={() => set({ sheet: { kind: 'duel' } })}>
          Вызвать
        </button>
      </div>
    );
  }
  void rentFor;
  return (
    <div className="anchor" ref={anchorRef('prompt')}>
      {body}
    </div>
  );
}

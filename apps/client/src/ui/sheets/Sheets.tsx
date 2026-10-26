import { useEffect, useMemo, useState } from 'react';
import { GROUPS, MEGAPOLIS, RULESET, groupTiles } from '@pb/content';
import { available, isTradeableTile, mortgageValue, ownedTiles, rentFor, unmortgageCost, upgradeCost } from '@pb/game-core';
import type { Command, MatchState, PublicMatch, TradeSide } from '@pb/game-core';
import { api, send } from '../../net/connection';
import { get, set, setPrefs, useStore } from '../../state/store';
import { closeSheet } from '../actions';
import { eventText, money, seatName, tileName } from '../format';
import { currentSeat, useMatch, useMe } from '../hooks';
import { MINIGAME_INFO } from '@pb/game-core';
import { VISUAL_ICONS } from '../../render/tileArt';

const S = (m: PublicMatch) => m as unknown as MatchState;

function Sheet({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="sheet-layer" onClick={closeSheet}>
      <div className="sheet panel" onClick={(e) => e.stopPropagation()} data-testid={testId} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="close" onClick={closeSheet} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

function Coins({ n }: { n: number }) {
  return (
    <span className="coins">
      <i className="coin" />
      {money(n)}
    </span>
  );
}

/** Buttons that send a command; disabled with an explanation when not allowed. */
function Act({ cmd, label, reason, primary }: { cmd: Command; label: string; reason?: string | null; primary?: boolean }) {
  return (
    <button className={`btn ${primary ? 'primary' : ''}`} disabled={!!reason} title={reason ?? ''} onClick={() => send(cmd)}>
      {label}
    </button>
  );
}

function manageReason(m: PublicMatch, seat: string | null, raising: boolean): string | null {
  if (!seat) return 'Нет места';
  if (raising && m.phase === 'DEBT' && m.debt?.payer === seat) return null;
  if (currentSeat(m) !== seat) return 'Только в свой ход';
  if (m.phase !== 'PRE_ROLL' && m.phase !== 'POST_ROLL') return 'Сейчас нельзя — дождитесь спокойного окна хода';
  return null;
}

function TileSheet({ tile }: { tile: number }) {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const t = MEGAPOLIS.tiles[tile]!;
  const o = m.tiles[tile];
  const g = t.group ? GROUPS[t.group] : null;
  const mine = !!o && o.owner === me;
  const group = t.group ? groupTiles(MEGAPOLIS, t.group) : [];
  const trap = m.traps.find((x) => x.tile === tile);
  const blocked = m.upgradeBlocks.some((b) => b.tile === tile);
  const why = manageReason(m, me, false);
  const whyRaise = manageReason(m, me, true);
  return (
    <Sheet title={t.name} testId="tile-sheet">
      <div className="tile-head" style={{ background: g?.color ?? '#5b4c86' }}>
        <span className="big-icon">{VISUAL_ICONS[t.visual]}</span>
        <span>{g ? g.name : t.shortLabel}</span>
      </div>
      <p className="muted">{t.description}</p>
      {t.kind === 'property' && o && (
        <>
          <div className="kv">
            <span>Цена</span>
            <Coins n={t.price!} />
          </div>
          <div className="kv">
            <span>Владелец</span>
            <b>{o.owner ? seatName(m, o.owner, me) : 'банк — свободно'}</b>
          </div>
          <div className="kv">
            <span>Комплект</span>
            <b>
              {group.filter((i) => m.tiles[i]?.owner && m.tiles[i]!.owner === o.owner).length} / {group.length}
            </b>
          </div>
          <table className="rent">
            <tbody>
              {[
                ['Базовая аренда', t.baseRent!],
                ['Полный комплект', t.baseRent! * RULESET.fullSetMultiplier],
                ['Уровень 1', t.baseRent! * RULESET.upgradeMultipliers[1]],
                ['Уровень 2', t.baseRent! * RULESET.upgradeMultipliers[2]],
                ['Уровень 3', t.baseRent! * RULESET.upgradeMultipliers[3]],
              ].map(([label, v], k) => (
                <tr key={k} className={(k >= 2 && o.level === k - 1) || (k < 2 && o.owner && rentFor(S(m), tile) === v && o.level === 0) ? 'on' : ''}>
                  <td>{label}</td>
                  <td>
                    <Coins n={v as number} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="kv">
            <span>Улучшение / залог / выкуп</span>
            <b>
              {money(upgradeCost(tile))} / {money(mortgageValue(tile))} / {money(unmortgageCost(tile))}
            </b>
          </div>
          {o.mortgaged && <div className="tag">Заложено — аренды нет</div>}
          {blocked && <div className="tag">👻 Призрак запретил улучшение на следующий ход владельца</div>}
        </>
      )}
      {trap && <div className="tag">🚧 Ловушка: следующий соперник платит {RULESET.trapFine} банку</div>}
      {mine && o && (
        <div className="row wrap">
          <Act cmd={{ type: 'UPGRADE', tile }} label={`Улучшить (${money(upgradeCost(tile))})`} reason={why} primary />
          {o.level > 0 && <Act cmd={{ type: 'SELL_UPGRADE', tile }} label="Продать улучшение" reason={whyRaise} />}
          {!o.mortgaged && <Act cmd={{ type: 'MORTGAGE', tile }} label={`Заложить +${money(mortgageValue(tile))}`} reason={whyRaise} />}
          {o.mortgaged && <Act cmd={{ type: 'UNMORTGAGE', tile }} label={`Выкупить −${money(unmortgageCost(tile))}`} reason={why} />}
        </div>
      )}
      {o?.owner && o.owner !== me && m.players.find((p) => p.seat === me)?.role === 'alive' && (
        <button className="btn" onClick={() => set({ sheet: { kind: 'duel', tile } })}>
          ⚔ Вызвать на дуэль за этот объект
        </button>
      )}
    </Sheet>
  );
}

function AssetsSheet() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const tiles = me ? ownedTiles(S(m), me) : [];
  return (
    <Sheet title="Мои объекты" testId="assets-sheet">
      {tiles.length === 0 && <p className="muted">У вас пока нет собственности.</p>}
      <div className="asset-list">
        {tiles.map((i) => {
          const t = MEGAPOLIS.tiles[i]!;
          const o = m.tiles[i]!;
          return (
            <button key={i} className={`asset ${o.mortgaged ? 'mortgaged' : ''}`} onClick={() => set({ selectedTile: i, sheet: { kind: 'tile', tile: i } })}>
              <span className="swatch" style={{ background: GROUPS[t.group!].color }} />
              <span>{t.name}</span>
              <span className="lvl">{o.mortgaged ? 'залог' : '★'.repeat(o.level) || '—'}</span>
            </button>
          );
        })}
      </div>
      <p className="hint">Улучшать можно только полный незаложенный комплект, равномерно (уровни 0–3).</p>
    </Sheet>
  );
}

function TileChecklist({ m, owner, picked, toggle }: { m: PublicMatch; owner: string; picked: number[]; toggle: (t: number) => void }) {
  const tiles = ownedTiles(S(m), owner);
  if (!tiles.length) return <p className="muted">Нет объектов</p>;
  return (
    <div className="checklist">
      {tiles.map((i) => {
        const ok = isTradeableTile(S(m), owner, i);
        return (
          <label key={i} className={ok ? '' : 'disabled'} title={ok ? '' : 'В группе есть улучшения'}>
            <input type="checkbox" disabled={!ok} checked={picked.includes(i)} onChange={() => toggle(i)} />
            <span className="swatch" style={{ background: GROUPS[MEGAPOLIS.tiles[i]!.group!].color }} />
            {tileName(i)}
            {m.tiles[i]!.mortgaged && <small> (залог)</small>}
          </label>
        );
      })}
    </div>
  );
}

function TradeSheet() {
  const m = useMatch();
  const me = useStore((s) => s.seat)!;
  const others = m.players.filter((p) => p.role === 'alive' && p.seat !== me);
  const [to, setTo] = useState(others[0]?.seat ?? '');
  const [give, setGive] = useState<TradeSide>({ cash: 0, tiles: [] });
  const [getSide, setGet] = useState<TradeSide>({ cash: 0, tiles: [] });
  const partner = m.players.find((p) => p.seat === to);
  const myFree = available(S(m), me);
  const toggle = (side: TradeSide, setSide: (s: TradeSide) => void) => (t: number) =>
    setSide({ ...side, tiles: side.tiles.includes(t) ? side.tiles.filter((x) => x !== t) : [...side.tiles, t] });
  const empty = give.cash + give.tiles.length + getSide.cash + getSide.tiles.length === 0;
  const reason = empty ? 'Добавьте что-нибудь в сделку' : give.cash > myFree ? 'Не хватает денег' : partner && getSide.cash > partner.cash ? 'У партнёра нет такой суммы' : null;
  if (!partner) return <Sheet title="Сделка">Нет партнёров для сделки.</Sheet>;
  return (
    <Sheet title="Предложить сделку" testId="trade-sheet">
      <div className="seg">
        {others.map((p) => (
          <button key={p.seat} className={to === p.seat ? 'on' : ''} onClick={() => (setTo(p.seat), setGet({ cash: 0, tiles: [] }))}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="trade-cols">
        <div>
          <h4>Вы отдаёте</h4>
          <TileChecklist m={m} owner={me} picked={give.tiles} toggle={toggle(give, setGive)} />
          <label className="field">
            <span>Монеты (свободно {money(myFree)})</span>
            <input type="number" min={0} step={10} value={give.cash} onChange={(e) => setGive({ ...give, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
          </label>
        </div>
        <div>
          <h4>Вы получаете от {partner.name}</h4>
          <TileChecklist m={m} owner={to} picked={getSide.tiles} toggle={toggle(getSide, setGet)} />
          <label className="field">
            <span>Монеты (у него {money(partner.cash)})</span>
            <input type="number" min={0} step={10} value={getSide.cash} onChange={(e) => setGet({ ...getSide, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
          </label>
        </div>
      </div>
      <p className="hint">У партнёра будет {RULESET.tradeResponseMs / 1000} секунд на ответ. Предложение нельзя изменить — только отозвать.</p>
      <button
        className="btn primary big"
        disabled={!!reason}
        title={reason ?? ''}
        onClick={async () => {
          if (await send({ type: 'PROPOSE_TRADE', to, give, get: getSide })) closeSheet();
        }}
        data-testid="send-trade"
      >
        {reason ?? 'Отправить предложение'}
      </button>
    </Sheet>
  );
}

function DuelSheet({ tile: preset }: { tile?: number }) {
  const m = useMatch();
  const me = useMe()!;
  const eligible = useMemo(
    () =>
      MEGAPOLIS.tiles
        .filter((t) => {
          const o = m.tiles[t.index];
          return o?.owner && o.owner !== me.seat && !o.mortgaged && !groupTiles(MEGAPOLIS, t.group!).some((i) => (m.tiles[i]?.level ?? 0) > 0);
        })
        .map((t) => t.index),
    [m, me.seat],
  );
  const [tile, setTile] = useState<number | null>(preset !== undefined && eligible.includes(preset) ? preset : (eligible[0] ?? null));
  // If the list arrives later or the tile changes, pick a tile and suggest prices from its price.
  useEffect(() => {
    if (tile === null && eligible.length) setTile(eligible[0]!);
  }, [eligible, tile]);
  const base = tile !== null ? MEGAPOLIS.tiles[tile]!.price! : 0;
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(0);
  useEffect(() => {
    setLow(Math.round((base * 1.2) / 10) * 10);
    setHigh(Math.round((base * 1.8) / 10) * 10);
  }, [base]);
  const free = available(S(m), me.seat);
  const owner = tile !== null ? m.tiles[tile]!.owner! : null;
  const paired = owner ? m.duelPairsThisRound.includes([me.seat, owner].sort().join('|')) : false;
  const calm = currentSeat(m) === me.seat && (m.phase === 'PRE_ROLL' || m.phase === 'POST_ROLL');
  const reason = !calm
    ? 'Вызов — только в спокойное окно своего хода'
    : me.duelTokens === 0
      ? 'Жетоны закончились'
      : tile === null
        ? 'Нет подходящих объектов у соперников'
        : low < 10 || high < low
          ? 'Цена при победе продавца не меньше цены при вашей победе, минимум 10'
          : high > free
            ? `Нужно иметь свободными ${money(high)} (максимум)`
            : paired
              ? 'С этим игроком уже была дуэль в этом раунде'
              : null;
  return (
    <Sheet title="Вызов на дуэль" testId="duel-sheet">
      <p className="muted">
        Предложите две цены. Победит вызывающий — платит меньшую, победит владелец — большую. Владелец может отказаться. Жетон тратится только после согласия (осталось {me.duelTokens} из{' '}
        {RULESET.duelTokens}). Мини-игру выберет сервер.
      </p>
      <label className="field">
        <span>Объект</span>
        <select value={tile ?? ''} onChange={(e) => setTile(Number(e.target.value))}>
          {eligible.map((i) => (
            <option key={i} value={i}>
              {tileName(i)} — {seatName(m, m.tiles[i]!.owner)} (цена {MEGAPOLIS.tiles[i]!.price})
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <label className="field grow">
          <span>Если победите вы</span>
          <input type="number" min={10} step={10} value={low} onChange={(e) => setLow(Math.floor(Number(e.target.value) || 0))} />
        </label>
        <label className="field grow">
          <span>Если победит владелец</span>
          <input type="number" min={10} step={10} value={high} onChange={(e) => setHigh(Math.floor(Number(e.target.value) || 0))} />
        </label>
      </div>
      <p className="hint">Не сыгравший дуэль проигрывает технически; оба не сыграли — ничья, жетон возвращается. Максимальная сумма будет зарезервирована.</p>
      <button
        className="btn primary big"
        disabled={!!reason}
        title={reason ?? ''}
        onClick={async () => {
          if (tile !== null && (await send({ type: 'PROPOSE_DUEL', tile, priceIfBuyerWins: low, priceIfSellerWins: high }))) closeSheet();
        }}
        data-testid="send-duel"
      >
        {reason ?? 'Бросить вызов'}
      </button>
    </Sheet>
  );
}

function MenuSheet() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const prefs = useStore((s) => s.prefs);
  const [tab, setTab] = useState<'log' | 'settings' | 'rules'>('log');
  const lines = m.log
    .map((e) => ({ seq: e.seq, text: eventText(m, e, me), turn: e.t === 'turnStart' }))
    .filter((l) => l.text)
    .slice(-80)
    .reverse();
  return (
    <Sheet title="Меню" testId="menu-sheet">
      <div className="seg">
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
          Журнал
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          Настройки
        </button>
        <button className={tab === 'rules' ? 'on' : ''} onClick={() => setTab('rules')}>
          Правила
        </button>
      </div>
      {tab === 'log' && (
        <div className="log" data-testid="log">
          {lines.map((l) => (
            <div key={l.seq} className={l.turn ? 'turn' : ''}>
              {l.text}
            </div>
          ))}
        </div>
      )}
      {tab === 'settings' && (
        <div className="form">
          <label className="check">
            <input type="checkbox" checked={!prefs.muted} onChange={(e) => setPrefs({ muted: !e.target.checked })} />
            <span>Звук</span>
          </label>
          <label className="field">
            <span>Громкость</span>
            <input type="range" min={0} max={1} step={0.1} value={prefs.volume} onChange={(e) => setPrefs({ volume: Number(e.target.value) })} />
          </label>
          <label className="check">
            <input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => setPrefs({ reduceMotion: e.target.checked })} />
            <span>Меньше анимации</span>
          </label>
          {useStore.getState().room?.devMode && (
            <div className="dev-tools">
              <div className="muted">Отладка (только режим разработки)</div>
              <div className="row wrap">
                {[
                  ['cash', '+2000'],
                  ['set', 'Дать комплект'],
                  ['minigame', 'Мини-игра в конце раунда'],
                  ['skip', 'Пропустить ожидание'],
                  ['endSoon', 'Закончить после раунда'],
                  ['ghost', 'Стать призраком'],
                ].map(([op, label]) => (
                  <button key={op} className="btn" onClick={() => api.devCheat(op!)} data-testid={`dev-${op}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm('Выйти из партии? Ваша собственность вернётся банку, место освободится.')) {
                closeSheet();
                void api.leave();
              }
            }}
          >
            Покинуть партию
          </button>
        </div>
      )}
      {tab === 'rules' && (
        <div className="rules">
          <p>
            <b>Цель:</b> через {m.settings.maxRounds} раундов иметь наибольшую стоимость (деньги + половина цены незаложенных объектов и улучшений). Последний не обанкротившийся побеждает сразу.
          </p>
          <p>
            <b>Ход:</b> бросок двух кубиков, покупка свободного объекта или аукцион, аренда владельцу. Полный комплект удваивает аренду, улучшения ×3/×6/×10.
          </p>
          <p>
            <b>Дуэль:</b> до {RULESET.duelTokens} вызовов за партию. Две цены заранее, владелец соглашается или отказывается.
          </p>
          <p>
            <b>Предметы:</b> щит отражает ловушку или проделку; скидка — −50% аренды; конус — ловушка на {RULESET.trapFine} монет.
          </p>
          <p>
            <b>Призрак:</b> банкрот остаётся за столом: играет в мини-игры и делает одну проделку за раунд.
          </p>
          <p>
            <b>Мини-игры:</b> «{MINIGAME_INFO.reaction.title}» и «{MINIGAME_INFO.memory.title}». Призы живым: {RULESET.minigamePrizes.join(' / ')}.
          </p>
        </div>
      )}
    </Sheet>
  );
}

export function Sheets() {
  const sheet = useStore((s) => s.sheet);
  if (!sheet) return null;
  switch (sheet.kind) {
    case 'tile':
      return <TileSheet tile={sheet.tile} />;
    case 'assets':
      return <AssetsSheet />;
    case 'trade':
      return <TradeSheet />;
    case 'duel':
      return <DuelSheet tile={sheet.tile} />;
    case 'menu':
    case 'log':
      return <MenuSheet />;
    default:
      void get;
      return null;
  }
}

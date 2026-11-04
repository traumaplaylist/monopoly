// Reactions: a strip of 8 emoji under the player cards. Sending is rate-limited by the server;
// everyone in the room sees the bubble over the sender's card and figure.
import { useEffect, useState } from 'react';
import { EMOTES, EMOTE_COOLDOWN_MS, EMOTE_LABELS } from '@pb/content';
import type { Emote } from '@pb/content';
import type { SeatId } from '@pb/game-core';
import { api } from '../../net/connection';
import { useStore } from '../../state/store';

export const emoteUrl = (e: Emote) => `icons/fluent/emote-${e}.png`;
/** How long a bubble stays up. */
export const EMOTE_LIFE = 2400;

export function EmoteBar() {
  const [cool, setCool] = useState(false);
  function send(e: Emote) {
    if (cool) return;
    setCool(true);
    setTimeout(() => setCool(false), EMOTE_COOLDOWN_MS);
    void api.emote(e);
  }
  // Keys 1..8 send a reaction (not while typing in a field).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = Number(ev.key);
      const e = EMOTES[k - 1];
      if (e) send(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className={`emote-bar ${cool ? 'cool' : ''}`} data-testid="emote-bar">
      {EMOTES.map((e, i) => (
        <button key={e} onClick={() => send(e)} title={`${EMOTE_LABELS[e]} (клавиша ${i + 1})`} data-testid={`emote-${e}`}>
          <img src={emoteUrl(e)} alt={EMOTE_LABELS[e]} />
        </button>
      ))}
    </div>
  );
}

/** Live bubble for a seat (re-renders itself away when it expires). */
export function EmoteBubble({ seat }: { seat: SeatId }) {
  const fx = useStore((s) => s.emotes.findLast((x) => x.seat === seat) ?? null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!fx) return;
    const left = EMOTE_LIFE - (performance.now() - fx.start);
    if (left <= 0) return;
    const t = setTimeout(() => tick((n) => n + 1), left);
    return () => clearTimeout(t);
  }, [fx]);
  if (!fx || performance.now() - fx.start > EMOTE_LIFE) return null;
  return <img key={fx.id} className="emote-bubble" src={emoteUrl(fx.emote)} alt="" data-testid={`emote-bubble-${seat}`} />;
}

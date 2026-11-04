// Quick reactions during the match (party feel while others move). Pure chat: no game effect.
// Pictures: Fluent Emoji 3D (MIT) in apps/client/public/icons/fluent/emote-<id>.png.
export const EMOTES = ['laugh', 'angry', 'money', 'scream', 'clap', 'clown', 'cry', 'fire'] as const;
export type Emote = (typeof EMOTES)[number];
export const EMOTE_LABELS: Record<Emote, string> = {
  laugh: 'Ха-ха', angry: 'Злюсь', money: 'Деньги!', scream: 'Ой-ой', clap: 'Браво', clown: 'Клоун', cry: 'Плачу', fire: 'Огонь',
};
/** One reaction per player per this many ms (server-enforced). */
export const EMOTE_COOLDOWN_MS = 1200;

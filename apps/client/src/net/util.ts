/** RFC4122 v4 id that also works on plain-http LAN pages (crypto.randomUUID needs a secure context). */
export function uuid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Where the game server lives. */
export function serverUrl(): string {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  const { protocol, hostname, port } = window.location;
  // Vite dev/preview servers: the game server runs next to them on port 3001.
  if (port === '5173' || port === '4173') return `${protocol}//${hostname}:3001`;
  return window.location.origin;
}

const TOKEN_KEY = 'pb:session';
const NAME_KEY = 'pb:name';
const PREFS_KEY = 'pb:prefs';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: session lives only in memory */
  }
}

/** The resume secret is kept only in local storage — never in URLs or logs. */
export const storage = {
  token: () => safeGet(TOKEN_KEY) ?? undefined,
  setToken: (t: string) => safeSet(TOKEN_KEY, t),
  name: () => safeGet(NAME_KEY) ?? '',
  setName: (n: string) => safeSet(NAME_KEY, n),
  prefs: (): Prefs => {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(safeGet(PREFS_KEY) ?? '{}') };
    } catch {
      return DEFAULT_PREFS;
    }
  },
  setPrefs: (p: Prefs) => safeSet(PREFS_KEY, JSON.stringify(p)),
};

export interface Prefs {
  volume: number;
  muted: boolean;
  reduceMotion: boolean;
}
export const DEFAULT_PREFS: Prefs = { volume: 0.6, muted: false, reduceMotion: false };

import path from 'node:path';

export interface ServerConfig {
  port: number;
  host: string;
  dbPath: string;
  /** Dev mode enables debug rooms with bots. Never enable in production. */
  devMode: boolean;
  /** Allowed browser origins (production). In dev mode every origin is allowed. */
  allowedOrigins: string[];
  /** Optional: serve the built client from this directory. */
  staticDir: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const devMode = env.PB_DEV === '1' || env.NODE_ENV === 'development';
  return {
    port: Number(env.PORT ?? 3001),
    host: env.HOST ?? (devMode ? '0.0.0.0' : '127.0.0.1'),
    dbPath: env.DB_PATH ?? path.resolve(process.cwd(), 'data', 'party-board.sqlite'),
    devMode,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'capacitor://localhost,https://localhost,http://localhost')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    staticDir: env.STATIC_DIR ? path.resolve(env.STATIC_DIR) : null,
  };
}

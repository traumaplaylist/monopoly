import { realClock } from './clock';
import { loadConfig } from './config';
import { createGameServer } from './net';

const config = loadConfig();
const server = createGameServer(config, realClock);
const port = await server.listen();
console.log(`[party-board] server on http://${config.host}:${port}  dev=${config.devMode}  db=${config.dbPath}`);
if (config.staticDir) console.log(`[party-board] serving client from ${config.staticDir}`);

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`[party-board] ${signal}: shutting down`);
  await server.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

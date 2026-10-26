// One command for local development: game server (dev mode) + Vite client.
// Works in PowerShell, cmd and Unix shells. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import os from 'node:os';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function run(name, args, env) {
  const child = spawn(npm, args, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    console.log(`[dev] ${name} exited (${code ?? 'signal'})`);
    shutdown();
  });
  children.push(child);
}

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (!c.killed) c.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

run('server', ['run', 'dev', '-w', '@pb/server'], { PB_DEV: '1', PORT: process.env.PORT ?? '3001' });
run('client', ['run', 'dev', '-w', '@pb/client'], {});

const lan = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === 'IPv4' && !a.internal)
  .map((a) => a.address);
setTimeout(() => {
  console.log('\n[dev] Игра на этом компьютере:  http://localhost:5173');
  for (const ip of lan) console.log(`[dev] С телефона в той же Wi-Fi: http://${ip}:5173  (сервер: ${ip}:3001)`);
  console.log('[dev] Остановить: Ctrl+C\n');
}, 2500);

// Balance probe: plays N matches with debug bots and prints aggregated numbers.
// Usage: npm run balance [-- 40]
import { balanceStats } from '../packages/game-core/src/sim';

const n = Number(process.argv[2] ?? 30);
const t = Date.now();
console.log(JSON.stringify(balanceStats(n), null, 2));
console.log(`(${((Date.now() - t) / 1000).toFixed(1)} s)`);

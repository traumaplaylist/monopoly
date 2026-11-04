// Balance probe: plays N matches with debug bots and prints aggregated numbers.
// Usage: npm run balance [-- 40] [quick]
import { RULESET } from '../packages/content/src/ruleset';
import { balanceStats } from '../packages/game-core/src/sim';

const n = Number(process.argv[2] ?? 30);
const quick = process.argv.includes('quick');
const t = Date.now();
console.log(quick ? `quick: ${RULESET.quick.maxRounds} rounds, start ${RULESET.quick.startCash}` : 'normal');
console.log(JSON.stringify(balanceStats(n, quick ? { maxRounds: RULESET.quick.maxRounds, startCash: RULESET.quick.startCash, dealTiles: RULESET.quick.dealTiles } : {}), null, 2));
console.log(`(${((Date.now() - t) / 1000).toFixed(1)} s)`);

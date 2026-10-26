// Ruleset V1: all tunable numbers in one place. Values are working assumptions (see docs/RULES_V1.md).

export const RULES_VERSION = 'v1.0';

export const RULESET = {
  version: RULES_VERSION,
  seats: 4,
  startCash: 1500,
  maxRounds: 12,
  startSalary: 200,

  // Upgrades: levels 0..3, rent multipliers replace the full-set x2.
  maxUpgradeLevel: 3,
  fullSetMultiplier: 2,
  upgradeMultipliers: [1, 3, 6, 10] as const,
  upgradeSellRefund: 0.5,

  mortgageRate: 0.5,
  unmortgageRate: 0.55,

  // Timers (ms)
  turnDecisionMs: 25_000,
  purchaseMs: 25_000,
  rentChoiceMs: 10_000,
  debtMs: 30_000,
  tradeResponseMs: 20_000,
  duelOfferMs: 20_000,
  auction: { baseMs: 12_000, extendToMs: 2_000, maxMs: 25_000, minBid: 10, step: 10 },
  maxTradeOffersPerTurn: 2,

  // Mini-games
  minigameEveryRoundsOptions: [1, 2, 3] as const,
  minigameEveryRoundsDefault: 2,
  minigamePrizes: [120, 80, 40, 20] as const,
  minigameIntroMs: 10_000,
  minigameResultsMs: 6_000,

  // Duels
  duelTokens: 3,

  // Items
  inventorySlots: 3,
  trapFine: 30,
  maxActiveTraps: 4,
  discountRate: 0.5,

  // Ghost
  ghostEnergyStart: 1,
  ghostEnergyMax: 2,

  // Room / connection policy (server)
  absenceTimeoutMs: 5 * 60_000,
} as const;

export type Ruleset = typeof RULESET;

/** Integer rounding used for every percentage in the rules: round half down to whole coins. */
export function pct(amount: number, rate: number): number {
  return Math.floor(amount * rate);
}

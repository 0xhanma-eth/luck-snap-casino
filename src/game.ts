// src/game.ts
// ──────────────────────────────────────────────────────────────────────────────
// Pure game logic.  No I/O, no state — all deterministic given a seed roll.
// Swap reward payouts here for DONUT/LUCK token logic without touching the snap.
// ──────────────────────────────────────────────────────────────────────────────

export type Symbol = "🍒" | "💎" | "7️⃣" | "🍩" | "⭐" | "🔥";
export type OutcomeKind = "jackpot" | "bigwin" | "smallwin" | "loss";

export interface SpinResult {
  reels: [Symbol, Symbol, Symbol];
  kind: OutcomeKind;
  multiplier: number;
  payout: number;   // raw credits returned (NOT including deducted bet)
  net: number;      // net change to balance (payout - bet)
  message: string;
  shareText: string;
}

export const SYMBOLS: Symbol[] = ["🍒", "💎", "7️⃣", "🍩", "⭐", "🔥"];

/** Symbol weights for reel generation — skewed to look exciting */
const SYMBOL_WEIGHTS = [30, 10, 8, 25, 18, 9]; // must sum to 100
const SYMBOL_CUMULATIVE = SYMBOL_WEIGHTS.reduce<number[]>((acc, w, i) => {
  acc.push((acc[i - 1] ?? 0) + w);
  return acc;
}, []);

function pickSymbol(): Symbol {
  const r = Math.random() * 100;
  const idx = SYMBOL_CUMULATIVE.findIndex((c) => r < c);
  return SYMBOLS[idx >= 0 ? idx : SYMBOLS.length - 1];
}

function spinReels(): [Symbol, Symbol, Symbol] {
  return [pickSymbol(), pickSymbol(), pickSymbol()];
}

/** Outcome probabilities */
const OUTCOME_THRESHOLDS = {
  jackpot: 0.01,
  bigwin: 0.10,   // cumulative 10%
  smallwin: 0.40, // cumulative 40%
  // loss: everything else
};

/** Multipliers — swap these for token-denominated values later */
const MULTIPLIERS: Record<OutcomeKind, number> = {
  jackpot: 50,
  bigwin: 5,
  smallwin: 1.2, // expressed in credits (floor applied)
  loss: 0,
};

const LOSS_MESSAGES = [
  "rugged by cherries 🍒😭",
  "the house ate well tonight 🏦",
  "this is fine 🔥... it's fine",
  "statistically speaking, next one's a jackpot 📊",
  "skill issue detected 🫵",
  "wen moon? not today ser 🌑",
  "ngmi fr fr 😔",
  "LARP lost, degen confirmed",
  "the cherries mocked you 🍒",
  "fading with conviction 💪",
];

const WIN_MESSAGES: Record<Exclude<OutcomeKind, "loss">, string[]> = {
  jackpot: [
    "GIGA JACKPOT 💎🔥 WE ARE SO BACK",
    "50x ABSOLUTE SENDING 🚀",
    "THE MACHINE FEARED YOU 💎",
  ],
  bigwin: [
    "BANGER WIN, 5x let's go 🎰",
    "printing money rn 🖨️💵",
    "big brain degens only 🧠",
  ],
  smallwin: [
    "small W, take the crumbs 🍞",
    "tiny pump detected 📈",
    "still better than -100% 🌿",
  ],
};

function pickMessage(kind: OutcomeKind): string {
  if (kind === "loss") {
    return LOSS_MESSAGES[Math.floor(Math.random() * LOSS_MESSAGES.length)];
  }
  const arr = WIN_MESSAGES[kind];
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildShareText(kind: OutcomeKind, multiplier: number, reels: [Symbol, Symbol, Symbol]): string {
  const reelStr = reels.join(" ");
  if (kind === "jackpot") return `JUST HIT ${multiplier}x ON LUCK SNAP CASINO 🎰🔥\n${reelStr}\ncome rekt me → luck-snap.host.neynar.app`;
  if (kind === "bigwin") return `${multiplier}x giga hit 💎🔥 ${reelStr}\nLUCK SNAP CASINO slaps`;
  if (kind === "smallwin") return `small W at LUCK SNAP CASINO ${reelStr} 🎰`;
  return `rugged by ${reelStr} 😭 LUCK SNAP CASINO`;
}

// Force jackpot reels to all 💎 for max hype
function jackpotReels(): [Symbol, Symbol, Symbol] { return ["💎", "💎", "💎"]; }
function bigwinReels(): [Symbol, Symbol, Symbol] {
  const s = pickSymbol();
  return [s, s, s]; // triple match
}

export function spin(bet: number, maxBet = false): SpinResult {
  const r = Math.random();
  let kind: OutcomeKind;
  let reels: [Symbol, Symbol, Symbol];

  // Max bet boosts jackpot chance slightly (2%) and bigwin to 20%
  const jp = maxBet ? 0.02 : OUTCOME_THRESHOLDS.jackpot;
  const bw = maxBet ? 0.22 : OUTCOME_THRESHOLDS.bigwin;
  const sw = maxBet ? 0.50 : OUTCOME_THRESHOLDS.smallwin;

  if (r < jp) {
    kind = "jackpot";
    reels = jackpotReels();
  } else if (r < bw) {
    kind = "bigwin";
    reels = bigwinReels();
  } else if (r < sw) {
    kind = "smallwin";
    reels = spinReels();
  } else {
    kind = "loss";
    reels = spinReels();
  }

  const multiplier = MULTIPLIERS[kind];
  const payout = Math.floor(bet * multiplier);
  const net = payout - bet;
  const message = pickMessage(kind);
  const shareText = buildShareText(kind, multiplier, reels);

  return { reels, kind, multiplier, payout, net, message, shareText };
}

// ── Token sink hooks (stub — replace with onchain calls) ────────────────────

/** Future: burn DONUT tokens to buy credits */
export async function burnDonutForCredits(_fid: number, _amount: number): Promise<number> {
  // TODO: call DONUT contract burn function
  // return credits granted
  return _amount * 10;
}

/** Future: mint LUCK tokens on jackpot */
export async function mintLuckReward(_fid: number, _credits: number): Promise<void> {
  // TODO: call LUCK token mint or distribute from treasury
}

/** Future: contribute to onchain jackpot pool */
export async function contributeToJackpotPool(_amount: number): Promise<void> {
  // TODO: send % of bet to jackpot pool contract
}

/** Future: buyback hook — triggered when jackpot drains */
export async function triggerBuyback(): Promise<void> {
  // TODO: initiate buyback from protocol fee wallet
}

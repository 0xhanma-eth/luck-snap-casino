// src/state.ts
// ──────────────────────────────────────────────────────────────────────────────
// Per-user persistent state helpers.
// Uses @farcaster/snap-turso key-value store (Turso in prod, in-memory locally).
// ──────────────────────────────────────────────────────────────────────────────

import { createTursoDataStore } from "@farcaster/snap-turso";

export const data = createTursoDataStore();

// ── Constants ─────────────────────────────────────────────────────────────────

export const STARTING_BALANCE = 50;
export const DAILY_SPIN_CREDITS = 10;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const JACKPOT_POOL_SEED = 1000;
export const BET_AMOUNT = 1;
export const MAX_BET_AMOUNT = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserState {
  balance: number;
  streak: number;
  lastSpinTime: number;        // unix ms
  lastDailyClaimTime: number;  // unix ms
  totalSpins: number;
  totalWon: number;
  totalLost: number;
  lastReels: [string, string, string] | null;
  lastOutcome: string | null;
  lastMessage: string | null;
  highScore: number;
}

export interface GlobalState {
  jackpotPool: number;
  topWinners: Array<{ fid: number; amount: number; ts: number }>;
  recentWins: Array<{ fid: number; amount: number; kind: string; ts: number }>;
}

// ── User state ────────────────────────────────────────────────────────────────

function userKey(fid: number): string {
  return `user:${fid}`;
}

export async function getUserState(fid: number): Promise<UserState> {
  const raw = await data.get(userKey(fid)) as UserState | null;
  if (raw) return raw;
  return {
    balance: STARTING_BALANCE,
    streak: 0,
    lastSpinTime: 0,
    lastDailyClaimTime: 0,
    totalSpins: 0,
    totalWon: 0,
    totalLost: 0,
    lastReels: null,
    lastOutcome: null,
    lastMessage: null,
    highScore: 0,
  };
}

export async function saveUserState(fid: number, state: UserState): Promise<void> {
  await data.set(userKey(fid), state);
}

export async function applySpinResult(
  fid: number,
  bet: number,
  result: import("./game.js").SpinResult
): Promise<UserState> {
  const state = await getUserState(fid);

  state.balance = Math.max(0, state.balance - bet);
  state.balance += result.payout;
  state.totalSpins += 1;
  state.lastSpinTime = Date.now();
  state.lastReels = result.reels;
  state.lastOutcome = result.kind;
  state.lastMessage = result.message;

  if (result.net > 0) {
    state.totalWon += result.payout;
    state.streak = (state.streak ?? 0) + 1;
    if (result.payout > state.highScore) state.highScore = result.payout;
  } else {
    state.totalLost += bet;
    state.streak = 0;
  }

  await saveUserState(fid, state);
  return state;
}

// ── Daily claim ───────────────────────────────────────────────────────────────

export async function claimDaily(fid: number): Promise<{ ok: boolean; state: UserState; message: string }> {
  const state = await getUserState(fid);
  const now = Date.now();
  const elapsed = now - (state.lastDailyClaimTime ?? 0);

  if (elapsed < DAILY_COOLDOWN_MS) {
    const remaining = DAILY_COOLDOWN_MS - elapsed;
    const hrs = Math.floor(remaining / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    return { ok: false, state, message: `⏳ come back in ${hrs}h ${mins}m` };
  }

  state.balance += DAILY_SPIN_CREDITS;
  state.lastDailyClaimTime = now;
  // Increment streak only on consecutive days (within 48h)
  if (elapsed < DAILY_COOLDOWN_MS * 2) {
    state.streak = (state.streak ?? 0) + 1;
  } else {
    state.streak = 1;
  }

  await saveUserState(fid, state);
  return { ok: true, state, message: `+${DAILY_SPIN_CREDITS} credits claimed 🎁 streak: ${state.streak}` };
}

export function isDailyAvailable(state: UserState): boolean {
  return Date.now() - (state.lastDailyClaimTime ?? 0) >= DAILY_COOLDOWN_MS;
}

// ── Global / jackpot state ────────────────────────────────────────────────────

const GLOBAL_KEY = "global";

export async function getGlobalState(): Promise<GlobalState> {
  const raw = await data.get(GLOBAL_KEY) as GlobalState | null;
  if (raw) return raw;
  return {
    jackpotPool: JACKPOT_POOL_SEED,
    topWinners: [],
    recentWins: [],
  };
}

export async function saveGlobalState(g: GlobalState): Promise<void> {
  await data.set(GLOBAL_KEY, g);
}

export async function addWin(
  fid: number,
  amount: number,
  kind: string
): Promise<GlobalState> {
  const g = await getGlobalState();

  // Contribute 10% of each bet to jackpot pool
  if (kind !== "jackpot") {
    g.jackpotPool = Math.floor(g.jackpotPool + BET_AMOUNT * 0.1);
  } else {
    // Jackpot winner drains pool (stub — real payout from pool in future)
    g.jackpotPool = JACKPOT_POOL_SEED; // reset after jackpot
  }

  // Recent wins ticker (keep last 5)
  g.recentWins.unshift({ fid, amount, kind, ts: Date.now() });
  g.recentWins = g.recentWins.slice(0, 5);

  // Top 5 winners
  const existing = g.topWinners.findIndex((w) => w.fid === fid);
  if (existing >= 0) {
    if (amount > g.topWinners[existing].amount) {
      g.topWinners[existing] = { fid, amount, ts: Date.now() };
    }
  } else {
    g.topWinners.push({ fid, amount, ts: Date.now() });
  }
  g.topWinners.sort((a, b) => b.amount - a.amount);
  g.topWinners = g.topWinners.slice(0, 5);

  await saveGlobalState(g);
  return g;
}

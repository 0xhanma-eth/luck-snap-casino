// src/index.ts
// ──────────────────────────────────────────────────────────────────────────────
// LUCK Snap Casino — main snap handler
// Follows @farcaster/snap-hono conventions exactly.
// ──────────────────────────────────────────────────────────────────────────────

import { registerSnapHandler } from "@farcaster/snap-hono";
import { spin, BET_AMOUNT, MAX_BET_AMOUNT } from "./game.js";
import {
  getUserState,
  getGlobalState,
  applySpinResult,
  claimDaily,
  addWin,
  isDailyAvailable,
} from "./state.js";
import { buildSnapUI, jackpotEffects } from "./ui.js";

const BASE_URL =
  process.env.SNAP_PUBLIC_BASE_URL ?? "http://localhost:3000";

export default registerSnapHandler({
  title: "LUCK Snap Casino",
  description: "A viral slot machine in your feed. Spin. Chase the jackpot.",
  theme: { accent: "amber" },

  handler: async (ctx) => {
    const fid = ctx.user?.fid ?? 0;

    // ── Parse action from button params ──────────────────────────────────────
    const action = ctx.inputs?.action ?? "view";
    const betStr = ctx.inputs?.bet ?? "1";
    const bet = parseInt(betStr, 10) || BET_AMOUNT;
    const isMaxBet = bet >= MAX_BET_AMOUNT;

    // ── Load state ───────────────────────────────────────────────────────────
    const [user, global] = await Promise.all([
      getUserState(fid),
      getGlobalState(),
    ]);

    let result = null;
    let feedbackMessage: string | undefined;

    // ── Handle actions ───────────────────────────────────────────────────────

    if (action === "spin") {
      if (user.balance < bet) {
        feedbackMessage = "🚫 not enough credits — claim daily or grind later";
      } else {
        result = spin(bet, isMaxBet);
        const updatedUser = await applySpinResult(fid, bet, result);
        Object.assign(user, updatedUser);

        if (result.payout > 0) {
          await addWin(fid, result.payout, result.kind);
        }

        // Re-fetch global after win update
        Object.assign(global, await getGlobalState());
      }
    }

    if (action === "daily") {
      const claim = await claimDaily(fid);
      feedbackMessage = claim.message;
      Object.assign(user, claim.state);
    }

    // ── Build UI ─────────────────────────────────────────────────────────────
    const ui = buildSnapUI({
      user,
      global,
      result,
      baseUrl: BASE_URL,
      fid,
      feedbackMessage,
    });

    // ── Snap response ─────────────────────────────────────────────────────────
    const response: Record<string, unknown> = {
      version: "1.0",
      title: "🎰 LUCK SNAP CASINO",
      ui,
    };

    // Confetti on jackpot
    if (result?.kind === "jackpot") {
      response.effects = jackpotEffects();
    }

    return response;
  },
});

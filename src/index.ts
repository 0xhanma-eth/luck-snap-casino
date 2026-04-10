import { Hono } from "hono";
import { registerSnapHandler } from "@farcaster/snap-hono";
import { spin, BET_AMOUNT, MAX_BET_AMOUNT } from "./game.js";
import {
  getUserState,
  getGlobalState,
  applySpinResult,
  claimDaily,
  addWin,
} from "./state.js";
import { buildSnapUI, jackpotEffects } from "./ui.js";

const BASE_URL =
  (typeof process !== "undefined" && process.env.SNAP_PUBLIC_BASE_URL) 
    ? process.env.SNAP_PUBLIC_BASE_URL 
    : "http://localhost:3000";

const app = new Hono();

registerSnapHandler(app, {
  title: "LUCK Snap Casino",
  description: "A viral slot machine in your feed. Spin. Chase the jackpot.",
  theme: { accent: "amber" },
  handler: async (ctx) => {
    const fid = ctx.user?.fid ?? 0;
    const action = ctx.inputs?.action ?? "view";
    const betStr = ctx.inputs?.bet ?? "1";
    const bet = parseInt(betStr, 10) || BET_AMOUNT;
    const isMaxBet = bet >= MAX_BET_AMOUNT;

    const [user, global] = await Promise.all([
      getUserState(fid),
      getGlobalState(),
    ]);

    let result = null;
    let feedbackMessage: string | undefined;

    if (action === "spin") {
      if (user.balance < bet) {
        feedbackMessage = "🚫 not enough credits — claim daily!";
      } else {
        result = spin(bet, isMaxBet);
        const updatedUser = await applySpinResult(fid, bet, result);
        Object.assign(user, updatedUser);
        if (result.payout > 0) {
          await addWin(fid, result.payout, result.kind);
        }
        Object.assign(global, await getGlobalState());
      }
    }

    if (action === "daily") {
      const claim = await claimDaily(fid);
      feedbackMessage = claim.message;
      Object.assign(user, claim.state);
    }

    const ui = buildSnapUI({
      user,
      global,
      result,
      baseUrl: BASE_URL,
      fid,
      feedbackMessage,
    });

    const response: Record<string, unknown> = {
      version: "1.0",
      title: "🎰 LUCK SNAP CASINO",
      ui,
    };

    if (result?.kind === "jackpot") {
      response.effects = jackpotEffects();
    }

    return response;
  },
});

export default app;
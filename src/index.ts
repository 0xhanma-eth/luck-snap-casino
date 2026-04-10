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

const BASE_URL = "https://luck-snap-casino.vercel.app";

const app = new Hono();

registerSnapHandler(app, async (ctx) => {
  const action_type = ctx.action.type;
  const fid = action_type === "post" ? ctx.action.fid : 0;
  const inputs = action_type === "post" ? ctx.action.inputs : {};

  const action = (inputs?.action as string) ?? "view";
  const betStr = (inputs?.bet as string) ?? "1";
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

  const response = {
    version: "1.0" as const,
    theme: { accent: "amber" as const },
    ui,
    ...(result?.kind === "jackpot" ? { effects: ["confetti"] as const } : {}),
  };

  return response;
});

export default app;
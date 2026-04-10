// src/ui.ts
// ──────────────────────────────────────────────────────────────────────────────
// Snap UI payload builders.
// Returns the `ui` object that goes into the snap response (version: "1.0").
// All element IDs are stable strings — buttons reference them via on.press.
// ──────────────────────────────────────────────────────────────────────────────

import type { UserState, GlobalState } from "./state.js";
import type { SpinResult } from "./game.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function streakLabel(n: number): string {
  if (n === 0) return "no streak";
  if (n < 3) return `🔥 ${n} win streak`;
  if (n < 7) return `🔥🔥 ${n} win streak`;
  return `🔥🔥🔥 ${n} WIN STREAK`;
}

function balanceColor(bal: number): "green" | "amber" | "red" {
  if (bal >= 20) return "green";
  if (bal >= 5) return "amber";
  return "red";
}

function reelDisplay(reels: [string, string, string] | null): string {
  if (!reels) return "❓  ❓  ❓";
  return reels.join("  ");
}

function outcomeHeader(kind: string | null): string {
  switch (kind) {
    case "jackpot": return "💎  JACKPOT  💎";
    case "bigwin":  return "🔥  BIG WIN  🔥";
    case "smallwin": return "⭐  SMALL WIN";
    case "loss":    return "😭  NO LUCK";
    default:        return "🎰  SPIN TO PLAY";
  }
}

function poolProgress(pool: number): number {
  // Progress towards a milestone (every 500 credits)
  const milestone = Math.ceil(pool / 500) * 500;
  return Math.round((pool / milestone) * 100);
}

// ── Slot reel cell grid ───────────────────────────────────────────────────────
// 3 cols × 1 row — displays the current reel result as a cell_grid

function reelGrid(reels: [string, string, string] | null): object {
  const symbols = reels ?? ["❓", "❓", "❓"];
  return {
    type: "cell_grid",
    props: {
      columns: 3,
      aspectRatio: "1:1",
    },
    children: symbols.map((s, i) => ({
      type: "cell",
      props: {
        label: s,
        value: String(i),
      },
    })),
  };
}

// ── Main snap UI ──────────────────────────────────────────────────────────────

export function buildSnapUI(opts: {
  user: UserState;
  global: GlobalState;
  result: SpinResult | null;
  baseUrl: string;
  fid: number;
  feedbackMessage?: string;
}): object {
  const { user, global: g, result, baseUrl, fid, feedbackMessage } = opts;
  const dailyAvailable = Date.now() - (user.lastDailyClaimTime ?? 0) >= 86_400_000;
  const isJackpot = result?.kind === "jackpot";
  const reels = user.lastReels;
  const pool = g.jackpotPool;

  // ── Elements map ─────────────────────────────────────────────────────────

  const elements: Record<string, object> = {};

  // Header ─────────────────────────────────────────────────────────────────
  elements["title"] = {
    type: "text",
    props: { label: "🎰 LUCK SNAP CASINO", weight: "bold", size: "lg" },
  };
  elements["subtitle"] = {
    type: "text",
    props: { label: "tap spin. chase jackpot.", size: "sm" },
  };
  elements["divider1"] = {
    type: "separator",
    props: {},
  };

  // Stats row ──────────────────────────────────────────────────────────────
  elements["balance"] = {
    type: "text",
    props: {
      label: `💰 Balance: ${user.balance} credits`,
      weight: "bold",
      color: balanceColor(user.balance),
    },
  };
  elements["jackpot_pool"] = {
    type: "text",
    props: { label: `💎 Jackpot Pool: ${pool} credits`, size: "sm" },
  };
  elements["pool_bar"] = {
    type: "progress_bar",
    props: { value: poolProgress(pool), color: "amber" },
  };
  elements["streak"] = {
    type: "text",
    props: { label: streakLabel(user.streak ?? 0), size: "sm" },
  };
  elements["daily_status"] = {
    type: "text",
    props: {
      label: dailyAvailable ? "🎁 Daily spin: READY" : "⏳ Daily spin: claimed",
      size: "sm",
      color: dailyAvailable ? "green" : "gray",
    },
  };
  elements["divider2"] = { type: "separator", props: {} };

  // Outcome header ─────────────────────────────────────────────────────────
  elements["outcome_header"] = {
    type: "text",
    props: {
      label: outcomeHeader(user.lastOutcome ?? null),
      weight: "bold",
      size: "lg",
      align: "center",
    },
  };

  // Reel display ───────────────────────────────────────────────────────────
  elements["reels"] = {
    type: "text",
    props: {
      label: reelDisplay(reels),
      size: "xl",
      align: "center",
      weight: "bold",
    },
  };

  // Last message / flavor text ─────────────────────────────────────────────
  if (user.lastMessage || feedbackMessage) {
    elements["flavor"] = {
      type: "text",
      props: {
        label: feedbackMessage ?? user.lastMessage ?? "",
        size: "sm",
        align: "center",
        color: isJackpot ? "amber" : "secondary",
      },
    };
  }
  elements["divider3"] = { type: "separator", props: {} };

  // Action buttons ─────────────────────────────────────────────────────────
  elements["btn_spin"] = {
    type: "button",
    props: { label: "🎰 SPIN  (−1 credit)", variant: "primary" },
    on: {
      press: {
        action: "submit",
        params: { action: "spin", bet: "1" },
        target: baseUrl,
      },
    },
  };
  elements["btn_max_bet"] = {
    type: "button",
    props: { label: "💣 MAX BET  (−10 credits)", variant: "secondary" },
    on: {
      press: {
        action: "submit",
        params: { action: "spin", bet: "10" },
        target: baseUrl,
      },
    },
  };

  const shareText = result?.shareText
    ?? `playing LUCK SNAP CASINO 🎰 — come join me!\n${baseUrl}`;

  elements["btn_share"] = {
    type: "button",
    props: { label: "📣 SHARE WIN", variant: "secondary" },
    on: {
      press: {
        action: "compose_cast",
        params: { text: shareText },
      },
    },
  };
  elements["btn_daily"] = {
    type: "button",
    props: {
      label: dailyAvailable ? "🎁 CLAIM DAILY (+10 credits)" : "🔒 DAILY (claimed)",
      variant: dailyAvailable ? "primary" : "secondary",
    },
    on: {
      press: {
        action: "submit",
        params: { action: "daily" },
        target: baseUrl,
      },
    },
  };
  elements["divider4"] = { type: "separator", props: {} };

  // Leaderboard ────────────────────────────────────────────────────────────
  elements["lb_title"] = {
    type: "text",
    props: { label: "🏆 Top Winners", weight: "bold", size: "sm" },
  };

  if (g.topWinners.length > 0) {
    elements["leaderboard"] = {
      type: "bar_chart",
      props: {
        items: g.topWinners.slice(0, 5).map((w, i) => ({
          label: `fid:${w.fid}`,
          value: w.amount,
          caption: `#${i + 1} — ${w.amount} credits`,
        })),
      },
    };
  } else {
    elements["lb_empty"] = {
      type: "text",
      props: { label: "no winners yet — be first 👑", size: "sm", color: "secondary" },
    };
  }

  // Recent wins ticker ─────────────────────────────────────────────────────
  if (g.recentWins.length > 0) {
    elements["ticker_title"] = {
      type: "text",
      props: { label: "📡 Recent Wins", size: "sm", weight: "bold" },
    };
    elements["ticker"] = {
      type: "text",
      props: {
        label: g.recentWins
          .map((w) => `fid:${w.fid} +${w.amount} (${w.kind})`)
          .join("  ·  "),
        size: "sm",
        color: "secondary",
      },
    };
  }

  // ── Root layout ──────────────────────────────────────────────────────────

  const rootChildren = [
    "title",
    "subtitle",
    "divider1",
    "balance",
    "jackpot_pool",
    "pool_bar",
    "streak",
    "daily_status",
    "divider2",
    "outcome_header",
    "reels",
    ...(elements["flavor"] ? ["flavor"] : []),
    "divider3",
    "btn_spin",
    "btn_max_bet",
    "btn_share",
    "btn_daily",
    "divider4",
    "lb_title",
    ...(elements["leaderboard"] ? ["leaderboard"] : ["lb_empty"]),
    ...(elements["ticker_title"] ? ["ticker_title", "ticker"] : []),
  ];

  return {
    root: {
      type: "box",
      props: { direction: "vertical", gap: "sm" },
      children: rootChildren,
    },
    elements,
  };
}

// ── Jackpot celebration overlay ───────────────────────────────────────────────
// Returns extra effects array for jackpot hits

export function jackpotEffects(): object[] {
  return [
    { type: "confetti" },
  ];
}

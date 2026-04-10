# 🎰 LUCK Snap Casino

A viral Farcaster Snap slot machine — embedded directly inside a cast.

## File structure

```
luck-snap-casino/
├── src/
│   ├── index.ts        ← snap handler (Edge-compatible entry point)
│   ├── server.ts       ← local dev server (excluded from deploy)
│   ├── game.ts         ← pure game logic + token sink stubs
│   ├── state.ts        ← per-user KV state helpers (Turso)
│   └── ui.ts           ← snap UI payload builder
├── sample-response.json ← reference JSON for a jackpot spin
├── package.json
├── tsconfig.json
└── vercel.json
```

---

## Local development

```bash
pnpm install
pnpm dev
```

Test GET (snap cold load):
```bash
curl -sS -H 'Accept: application/vnd.farcaster.snap+json' http://localhost:3000/
```

Test POST (button tap) — SKIP_JFS_VERIFICATION=true is set by `pnpm dev`:
```bash
PAYLOAD=$(echo -n "{\"fid\":1,\"inputs\":{\"action\":\"spin\",\"bet\":\"1\"},\"nonce\":\"dev\",\"audience\":\"http://localhost:3000\",\"timestamp\":$(date +%s)}" \
  | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')

curl -sS -X POST \
  -H 'Accept: application/vnd.farcaster.snap+json' \
  -H 'Content-Type: application/json' \
  -d "{\"header\":\"dev\",\"payload\":\"$PAYLOAD\",\"signature\":\"dev\"}" \
  http://localhost:3000/
```

Test daily claim:
```bash
# Change inputs to {"action":"daily"}
PAYLOAD=$(echo -n "{\"fid\":1,\"inputs\":{\"action\":\"daily\"},\"nonce\":\"dev2\",\"audience\":\"http://localhost:3000\",\"timestamp\":$(date +%s)}" \
  | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')
```

---

## Deploy to host.neynar.app (first time)

1. Fetch the deploy skill:
   ```bash
   curl -fsSL https://host.neynar.app/SKILL.md
   ```

2. Follow the skill. Key parameters for this snap:
   - `framework`: `hono`
   - `projectName`: `luck-snap-casino`
   - **Exclude** `src/server.ts` from archive (Node.js built-in, breaks Edge)
   - **Exclude** `node_modules`
   - Set env: `SNAP_PUBLIC_BASE_URL=https://luck-snap-casino.host.neynar.app`

3. After deploy, verify:
   ```bash
   curl -fsSL -H 'Accept: application/vnd.farcaster.snap+json' \
     https://luck-snap-casino.host.neynar.app/
   ```
   Expect HTTP 200 + `Content-Type: application/vnd.farcaster.snap+json`.

4. Cast the live URL on Farcaster to share the snap! 🎰

---

## Update an existing deploy

Same as above — reuse the saved `apiKey` from first deploy, same `projectName`.

---

## Reward logic

| Outcome  | Probability (normal) | Probability (max bet) | Multiplier |
|----------|--------------------|----------------------|------------|
| Jackpot  | 1%                 | 2%                   | 50×        |
| Big win  | 9%                 | 20%                  | 5×         |
| Small win| 30%                | 28%                  | 1.2×       |
| Loss     | 60%                | 50%                  | 0×         |

---

## Upgrade path — DONUT/Glaze Casino Rig

All token sink hooks are stubs in `src/game.ts`. Replace each function body with the onchain call:

### 1. DONUT token sink (buy credits)
```ts
// src/game.ts — burnDonutForCredits
export async function burnDonutForCredits(fid: number, amount: number): Promise<number> {
  // Call DONUT contract's burn(amount) on Base
  // Use Viem/Wagmi via a server wallet or sign from client
  const tx = await donutContract.burn(BigInt(amount));
  await tx.wait();
  return amount * DONUT_TO_CREDITS_RATE;
}
```
Add a "BUY WITH DONUT 🍩" button in `src/ui.ts` using `action: "send_token"` → redirect back with credits.

### 2. LUCK token rewards on jackpot
```ts
// src/game.ts — mintLuckReward
export async function mintLuckReward(fid: number, credits: number): Promise<void> {
  // Distribute from LUCK treasury to fid's custody address
  const address = await resolveAddressForFid(fid);
  await luckToken.transfer(address, BigInt(credits * LUCK_PER_CREDIT));
}
```
Call this inside the `if (result.kind === "jackpot")` branch in `src/index.ts`.

### 3. Onchain jackpot pool
```ts
// src/game.ts — contributeToJackpotPool
export async function contributeToJackpotPool(amount: number): Promise<void> {
  // Send % of each bet to a Solidity jackpot pool contract
  await jackpotContract.deposit({ value: BigInt(amount) });
}
```
Replace the in-memory `g.jackpotPool` with a live read from the contract in `getGlobalState()`.

### 4. Buyback hook
```ts
// src/game.ts — triggerBuyback
export async function triggerBuyback(): Promise<void> {
  // After jackpot drains, call protocol fee wallet to buyback LUCK
  await buybackContract.trigger();
}
```
Call from `addWin()` in `src/state.ts` when `kind === "jackpot"`.

### 5. Add "Glaze" tier (ultra-high roller)
- Add a `GLAZE_BET_AMOUNT = 100` constant in `src/state.ts`
- Add a new outcome tier `"glazewin"` with 100× multiplier and 0.1% probability
- Add a `btn_glaze_bet` element in `src/ui.ts`
- Gate it behind DONUT token holding check via Farcaster user context

---

## Social viral features

- **SHARE WIN** button composes a pre-filled cast with result text
- **Jackpot confetti** effect on 50× hit
- **Leaderboard** bar chart of top 5 winners by FID
- **Recent wins ticker** — last 5 wins shown in feed
- **Streak counter** — consecutive win tracking with escalating fire emoji
- **Daily claim** — keeps users coming back every 24h
- **Loss messages** — meme-ready flavor text for sharing rugs

---

## Notes

- `@noble/curves@^2.0.0` is pinned as a direct dep — required by `@farcaster/jfs` peer dep
- CORS header (`Access-Control-Allow-Origin: *`) is set automatically by `@farcaster/snap-hono`
- State is in-memory locally, persisted to Turso in production (auto-provisioned by host.neynar.app)
- `src/server.ts` must be excluded from Edge deploy archive (uses `@hono/node-server`)

# seller-agent

The **fulfillment agent** — it sells a service for SOL over CoralOS. coral-server launches it as a
container; it speaks one protocol over MCP threads, the same whether the buyer is another agent or a
human (via the bridge):

```
request <query>                  → PAYMENT_REQUIRED reference=<R> amount=<sol> url=solana:…
paid <sig> reference=<R>         → (verify on-chain) → DELIVERED <data>   |   ERROR …
```

## How it's secured

- **Reference-bound payments** (`payment.ts`): `generatePaymentUrl` mints a unique single-use
  reference key per request; `verifyPayment` uses Solana Pay's `validateTransfer` to confirm the
  transaction paid the right amount to the right wallet **and carries that reference**. A proof can't
  be stolen or reused for another order.
- **Replay guard** (`replay.ts`): consumed signatures are rejected.

## The fork point

```ts
// src/service.ts
export async function deliverService(request: string) { /* ← what you sell */ }
```
Built-ins via the `SERVICE` env: `jupiter` (default) · `coingecko` · `news` · `inference` (a Claude completion).

## Files

| File | Role |
|------|------|
| `src/index.ts` | the agent loop — command routing, verify, deliver |
| `src/payment.ts` | `generatePaymentUrl` (reference) + `verifyPayment` (`validateTransfer`) |
| `src/replay.ts` | `ReplayGuard` — rejects reused payment signatures |
| `src/service.ts` | `deliverService` — **the fork point** |

## Env

`SELLER_WALLET` (recipient pubkey, required) · `PRICE_SOL` (default 0.0001) · `SERVICE` ·
`SOLANA_RPC_URL` · plus per-service keys (`JUPITER_API_KEY`, `NEWS_API_KEY`, `ANTHROPIC_API_KEY`).
Devnet only.

## Test

```sh
npm install && npm run typecheck && npm test   # verifyPayment + ReplayGuard (6 cases)
```

Built into a Docker image by `bash build-agents.sh seller`; launched by coral-server per session.

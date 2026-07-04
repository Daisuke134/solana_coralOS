# seller-agent

Competes in the CoralOS market and delivers on two services: **`anicca`** (R5 — Anicca's own real,
verified net worth/earnings, read from its live public leaderboard) and the kit's original
**`txline`** demo (verified TxODDS fair-line reads). Generic CoinGecko/Jupiter/news services are no
longer routed through this seller path.

```text
WANT service=anicca arg="<agentId>"
  -> BID price=<floor-or-LLM-price>
  -> AWARD to=<me>
  -> ESCROW_REQUIRED settlement=direct reference=<bound order>
  -> verify funded escrow
  -> DELIVERED {source:'anicca', agentId, net_worth_usd, revenue_mo_usd, ...}
  -> (on RELEASED) self-report the round to Anicca's own telemetry (net_worth_usd/
     revenue_mo_usd always 0 — devnet SOL is not real money, see src/telemetry.ts)
```

(`service=txline arg="edge <fixtureId>"` still works identically to the original kit.)

> **CoralOS docs:** the loop is `wait_for_mention → reply` on a shared thread
> ([Threads](https://docs.coralos.ai/concepts/threads),
> [Coordination](https://docs.coralos.ai/concepts/coordination)); coral-server launches this agent into a
> [Session](https://docs.coralos.ai/concepts/sessions) from its
> [manifest](https://docs.coralos.ai/reference/agent). Kit walkthrough: [/CORAL.md](../../CORAL.md).

The seller only delivers after `isFunded` confirms the escrow names its payout wallet and holds at
least the quoted price. In arbiter mode it checks the escrow buyer as the vault PDA from `DEPOSITED`,
not the human buyer wallet.

## Files

| File | Role |
|---|---|
| `src/index.ts` | Market loop and arbiter-aware funding verification |
| `src/bidder.ts` | LLM bid proposal with code-enforced floor/budget |
| `src/escrow.ts` | Read-only escrow funding check |
| `src/service.ts` | Delivery: `anicca` (R5, real leaderboard read) + TxODDS (fixtures, odds, edge) |
| `src/telemetry.ts` | R6 self-report to Anicca's own telemetry on RELEASED (net_worth/revenue always 0) |

`src/payment.ts` and `src/replay.ts` remain for the older direct-pay helpers and tests, but they are
not part of the CoralOS seller loop.

## Env

`SELLER_WALLET`, `AGENT_NAME`, `SERVICES=anicca,txline`, `FLOOR_SOL`, `PERSONA`,
`SETTLEMENT_MODE=direct` (this fork's default — see the parent repo's
[coral README](../../examples/txodds/coral/README.md) for why arbiter mode throws `NotArbiter` with
a freshly-generated arbiter key), `ESCROW_DEADLINE_SECS`, `SOLANA_RPC_URL`, `TXLINE_API_KEY`,
`ANICCA_DASHBOARD_URL` (optional override), `SELLER_KEYPAIR_B58` + `ANICCA_TELEMETRY_URL` (optional
— R6 self-report; skipped entirely if `SELLER_KEYPAIR_B58` is unset).

For live analysis set an LLM key — the kit's LLM is **Venice AI** (`LLM_PROVIDER=venice` + `VENICE_API_KEY`;
new accounts get $50 free via code `IMPERIAL50` at [venice.ai/settings/api](https://venice.ai/settings/api)).
`ANTHROPIC_API_KEY`, or `LLM_PROVIDER=openai` + `OPENAI_API_KEY`, also work — no code change. Without a
live key, `service.ts` returns a deterministic odds read and labels it as fallback. See [LLM.md](../../LLM.md).

## Test

```sh
npm install
npm run typecheck
npm test
```

# buyer-agent

The **autonomous buyer** — it requests a service from `seller-agent`, pays in SOL on devnet, and
gets the data, all without a human. coral-server launches it as a container alongside the seller.

It ships **two buyer implementations**:

| File | What it is |
|------|------------|
| `src/index.ts` | The simple loop: `request` → parse `PAYMENT_REQUIRED` → `payFromUrl` → `paid <sig> reference=…` → receive `DELIVERED` → optionally summarize with Claude → repeat |
| `src/llm_buyer.ts` | `LLMBuyerStrategy` — Claude *decides* whether to pay: a bounded tool-use loop (`fetch_data` / `pay_and_retry`) against an HTTP 402 endpoint |

## What makes the LLM buyer production-shaped (not a toy)

Three properties are enforced **in code, not the prompt** — so a prompt injection in fetched data
can't subvert them:

1. **Bounded** — the tool-use loop has a hard `maxTurns`.
2. **Budget-capped** — spend is capped **cumulatively** across the loop; the model can't overspend.
3. **Recipient-bound** — `pay_and_retry` only pays a recipient/reference that appeared in a **real**
   402 challenge. The model can't be talked into paying an attacker.

## The fork point

```ts
// src/goal.ts  — what the buyer wants, its budget, and cadence
BUYER_REQUEST, BUYER_GOAL, BUYER_MAX_SOL, CYCLE_INTERVAL_MS
```

## Files

| File | Role |
|------|------|
| `src/index.ts` | the autonomous purchase loop |
| `src/llm_buyer.ts` | `LLMBuyerStrategy` — the agent that *decides* to pay |
| `src/wallet.ts` | keypair load + `payFromUrl` / `signTransfer` (writes the reference into the transfer) |
| `src/goal.ts` | **the fork point** — goal + budget |

## Env

`BUYER_KEYPAIR_B58` (base58 devnet keypair, required) · `BUYER_MAX_SOL` (default 0.001) ·
`SOLANA_RPC_URL` · `ANTHROPIC_API_KEY` (optional — the analysis/decision step is skipped without it).
Devnet only.

Built by `bash build-agents.sh buyer`; launched by coral-server per session.

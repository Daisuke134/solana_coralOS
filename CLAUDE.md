# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A TypeScript starter kit for a Solana **agent economy** — specifically an **open marketplace**: LLM
seller agents compete for a buyer's business over **CoralOS** (MCP), and the winner is settled
**trustlessly through a Solana escrow contract** (deposit → deliver → release / refund after a
deadline). The stack is pure TypeScript end-to-end; the **only Rust is the escrow Anchor program**,
which is the **settlement spine** (not optional). A forkable, e2e-tested React dashboard renders the
live market. The headline (and only) example is `examples/marketplace/`.

## Repo Layout

| Directory | Purpose |
|-----------|---------|
| `examples/marketplace/` | **The track.** `start.ts` launches the market session (buyer + 3 LLM seller personas). |
| `examples/agent-economy/` | `config/coral.toml` (wallet-free MCP config) + `escrow/` (the Anchor escrow contract — the settlement spine). |
| `coral-agents/` | Agents coral-server launches: `seller-agent` (LLM bidder + `service.ts` fork point), `buyer-agent` (market loop), and the config-only personas `seller-cheap`/`-premium`/`-lazy`. |
| `packages/agent-runtime/` | The three pillars, one folder each under `src/`: CoralOS MCP client (`coral/`), Solana Pay + devnet guard (`solana/`), the LLM provider shim (`llm/`), and the market protocol (`market/`). Root `src/index.ts` re-exports all of them. |
| `scripts/` | `setup.js` (wallet generation), `doctor.js` (health check). |
| `docs/`, `.claude/` | Design docs — `MARKETPLACE.md`, `APIS.md`, `PRODUCTION_HARDENING.md`, `SECURITY_REVIEW.md`. |

The headline (and only) example is `examples/marketplace/` on stock coral-server. CoralOS is the MCP
coordination layer only — settlement is the Solana escrow contract, agent-side (no coral-server wallet).

## Commands

### Run the marketplace (requires Docker)

```sh
node scripts/setup.js                                  # generate + fund devnet wallets → .env
bash build-agents.sh                                   # build seller + buyer images (personas reuse seller)
docker compose up -d coral                             # coral-server (MCP coordinator)
cd examples/marketplace && npm install && npm start    # launch the market session
docker logs -f buyer-agent                             # WANT → AWARD → DEPOSITED → RELEASED
# set LLM_PROVIDER=openai (+ OPENAI_API_KEY) in .env to flip the whole market to OpenAI
```

### packages/agent-runtime (agent runtime)

```sh
cd packages/agent-runtime && npm install
cd packages/agent-runtime && npm run typecheck
cd packages/agent-runtime && npm test
cd packages/agent-runtime && npm run build   # dependents (coral-agents, examples) need its dist
```

### Typecheck / test the economy

```sh
cd coral-agents/seller-agent && npm install && npm run typecheck && npm test   # incl. bidder + replay + payment
cd coral-agents/buyer-agent && npm install && npm run typecheck && npm test    # market loop + parse402
cd examples/marketplace && npm install && npm run typecheck                     # the session launcher
```

## Architecture

### packages/agent-runtime — the three pillars

Every agent imports these and writes only behavior:

- **CoralOS** (`coral/`) — `mcp.ts` (`CoralMcpAgent`: StreamableHTTP transport, tool discovery,
  `parseMention`) + `server.ts` (`startCoralAgent` — joins a session, hands `run` a `ctx`).
- **Solana** (`solana/`) — `connection.ts` (`solanaConnection`/`assertDevnet` guard) + `pay.ts`
  (`generatePaymentUrl`/`verifyPayment`/`signTransfer`/`loadKeypairB58`, reference-bound).
- **LLM** (`llm/`) — `complete.ts` (`complete()` — SDK-free shim; Anthropic default, `LLM_PROVIDER=openai` flips it).
- **Market protocol** (`market/`) — `protocol.ts` (pure WANT/BID/AWARD/ESCROW_REQUIRED/DEPOSITED format+parse +
  `selectBids`/`pickCheapest`). Coordination only — settlement is the escrow contract, agent-side.

Each pillar folder has its own `index.ts` barrel; the package root `src/index.ts` re-exports all four.

### coral-agents (what coral-server launches)

- `seller-agent` — LLM bidder: `WANT → BID` (`bidder.ts`, code-enforced floor/budget/inventory) →
  `AWARD → ESCROW_REQUIRED → DEPOSITED →` verify escrow funded (`escrow.ts isFunded`) →
  `deliverService()` (`service.ts`, the fork point) `→ DELIVERED`. Legacy 1:1 `request/paid` kept.
- `buyer-agent` — market loop: broadcast `WANT`, collect bids, LLM best-value selection (cheapest
  fallback), `deposit` into escrow, `release` on delivery / `refund` after the deadline (`escrow.ts`).
- `seller-cheap` / `seller-premium` / `seller-lazy` — config-only personas over the seller image
  (different `PERSONA`/`FLOOR_SOL`/`SERVICES`); `seller-lazy` self-selects out of non-inventory jobs.

### examples/agent-economy/escrow — the settlement spine

The Anchor escrow program (deployed to devnet) + its TS client. The buyer deposits into a per-order
PDA seeded by `(buyer, reference)`, the seller delivers, the buyer releases (or refunds after a
deadline). The `reference` is the same Solana Pay key the order is bound to. See its `README.md`.

## Key Constraints

- **The CoralOS run loop should respect its `AbortSignal`** — `CoralMcpAgent.runLoop(handler, signal)` checks `signal.aborted`; `startCoralAgent` wires SIGINT/SIGTERM to a clean disconnect.
- **coral-server launches agents via the Docker socket** — build the agent images before `docker compose up`.
- **Devnet only** — agent payment code builds its `Connection` via `solanaConnection()` (`@pay/agent-runtime`), which throws on a mainnet RPC unless `ALLOW_MAINNET=1`; it defaults to `https://api.devnet.solana.com`. Never put a funded mainnet keypair in `.env`.
- **The `coral-agents` / `examples` packages depend on `@pay/agent-runtime` via `file:` deps** — run `npm run build` in `packages/agent-runtime` first so the dist exists.

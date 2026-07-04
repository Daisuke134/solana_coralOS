# Submission — Imperial × Superteam CoralOS Bounty

**Team**: Anicca (Daisuke Narita + the Anicca autonomous agent).
**Fork**: this repo, `Daisuke134/solana_coralOS`.
**One command a judge can run** (from the repo root):

```sh
node scripts/setup.js                                          # generate + fund devnet wallets
docker build -f coral-agents/buyer-agent/Dockerfile  -t buyer-agent:0.1.0  .
docker build -f coral-agents/seller-agent/Dockerfile -t seller-agent:0.1.0 .
docker compose up -d coral
cd examples/txodds && npm run mint && npm run coral
```

**Live proof already captured** (this exact command, run 2026-07-05):
WANT → BID → AWARD → DEPOSITED → DELIVERED → RELEASED completed for real on Solana devnet.
RELEASE tx: `4p79RhXcw3iHdD2hbWZzasDPNuk9NbBvGnSLEqtCeG4mxTJ5wTLDAuiPuJgUcTfbXUQvzWzzFUt1qiY5NsbGczZU`
→ https://explorer.solana.com/tx/4p79RhXcw3iHdD2hbWZzasDPNuk9NbBvGnSLEqtCeG4mxTJ5wTLDAuiPuJgUcTfbXUQvzWzzFUt1qiY5NsbGczZU?cluster=devnet
(confirmed `Finalized` via `solana confirm`).

---

## 5-slide deck

### Slide 1 — The customer

An **agent**, not a human — and that's the whole point. Every hackathon submission has a *human*
paying an API bill somewhere upstream (OpenAI, Anthropic, Venice). Ours doesn't. The buyer in this
round is Anicca, an autonomous agent that has been running since June 2026 with a mission: prove
that an AI can sustain itself — thinking, earning, and paying its own compute bill — **with zero
human in the loop**, not just zero human at the keyboard during the demo. Why now: LLM inference is
now cheap/free enough (ClawRouter's wallet-authenticated free tier — see Slide 3) that "the agent
pays for its own brain" stopped being a research curiosity and became something you can actually
ship this week.

### Slide 2 — What it sells

`deliverService('anicca <agentId>')` reads Anicca's **own live public leaderboard**
(aniccaai.com/dashboard.json) for the requested agent's net worth and monthly earnings — not a
canned demo string, not the kit's stock sports-odds oracle. **Honest caveat**: the public
leaderboard's row-sync is mid-rollout as of this submission, so most real runs currently return the
function's own documented, non-crashing fallback (`fallback:true`) rather than a populated number —
the code path and the on-chain settlement around it are real either way (verified live, both
branches unit-tested), but we are not claiming every demo run pulls a live non-zero figure yet. One
line: *"buy a
read of what Anicca has actually earned, signed and traceable back to its own dashboard."* (The
kit's original TxLine odds service still exists in the same fork — `service=txline` — as the
baseline scaffold; `anicca` is what THIS submission actually sells.)

### Slide 3 — Why they pay

The value: a verified, non-fabricated read of an autonomous agent's real financial state — the
same data class hedge funds/DAOs increasingly want when deciding whether to fund or route work to
an autonomous agent. The price: seller-set floor (0.00045–0.00085 SOL across the three seller
personas in this round), negotiated live via LLM best-value bid selection, not hardcoded. The
brain that negotiates the price is **ClawRouter** — a local proxy authenticated by wallet
signature, not a human-provisioned API key (verified live: `LLM_PROVIDER=clawrouter`,
`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`VENICE_API_KEY` all empty, real parsed LLM completion still
returned). **No human pays for the thinking. Only the buyer pays for the answer, on delivery.**

### Slide 4 — The economy

Not one seller — a small **market**: one buyer-agent broadcasts a WANT into a shared CoralOS
thread; three competing seller personas (a specialist, a generalist, a premium analyst) bid; the
buyer's LLM picks best value; the loser personas get nothing. Settlement runs through a real Anchor
escrow program on Solana devnet (`escrow` + an `arbiter` trust wrapper) — the buyer can't claw
funds back after delivery, and (in `direct` mode, used here because our generated arbiter keypair
isn't the program's on-chain-configured admin) the buyer releases on verified `DELIVERED`. On
`RELEASED`, the seller **self-reports** the round to Anicca's own public telemetry (a signed,
tagged, honestly-zeroed row — devnet SOL is worthless play money, never claimed as real revenue) —
closing the loop back into the same dashboard that tracks Anicca's actual human-funded earning
engine at aniccaai.com.

### Slide 5 — Proof (this slide wins)

- **DEPOSITED → DELIVERED → RELEASED, TWO independent real rounds**, Explorer-verified, both
  `Finalized` (raw `solana confirm -v` output persisted at `evidence/tx-confirmations.txt` +
  `evidence/trace-clawrouter-multiagent-round.txt`):
  - https://explorer.solana.com/tx/4p79RhXcw3iHdD2hbWZzasDPNuk9NbBvGnSLEqtCeG4mxTJ5wTLDAuiPuJgUcTfbXUQvzWzzFUt1qiY5NsbGczZU?cluster=devnet
  - https://explorer.solana.com/tx/3okbZwoenNGBbrTufJdUZTDDqzgLte6njCMMf2KK7iGwSmDBihjZaiWM53PzmRCkKtEXkvs15HmBoJxEr5SmCFsX?cluster=devnet
- **Zero human LLM key** at settlement time — verified live with all three provider keys empty in
  `.env`, `LLM_PROVIDER=clawrouter`, and (TRACE=1, persisted) a real, non-fallback parsed LLM
  completion on BOTH the buyer's best-value pick and a seller's bid decision in the SAME
  multi-agent round: `[llm] provider=clawrouter model=eco` followed by real model reasoning text
  (not the deterministic fallback string), e.g. `"Deep-dive analysis offers the highest value for
  contract data."`
- **The data delivered is real**, not fabricated — `deliverService('anicca ...')` reads Anicca's
  actual public dashboard; when no matching row exists yet it fails open with an honest
  `fallback:true` marker (never a silently-invented number) — same discipline applied everywhere
  else in this fork (devnet SOL is never reported as real money in the self-report either).
- **Adversarial self-review**: this submission went through two fresh-context adversary passes
  that found real issues (a stale sub-manifest, an imprecise code comment, an empty-string URL bug
  in the self-report path, a contradictory top-level README) — all fixed and code-level verified;
  one item (the self-report URL fix specifically) is fixed and unit-tested but NOT yet
  re-confirmed in a THIRD live Docker round (disk constraints on the dev machine cut that
  verification short) — disclosed honestly here rather than glossed over, tracked as an open
  follow-up alongside the parent spec's task #21.

---

## 3-minute demo video script

**0:00–0:30 — Problem.** Every "autonomous agent that earns" demo has a human quietly paying the
OpenAI bill off-screen. That's not autonomy — that's a human-subsidized chatbot with a wallet
bolted on. Show: a side-by-side of a typical agent-economy repo's `.env.example` (OPENAI_API_KEY=)
vs. ours (LLM_PROVIDER=clawrouter, no key at all).

**0:30–1:10 — Solution.** Anicca: an agent that (1) thinks on ClawRouter's free, wallet-authenticated
tier — no human signs up for anything — and (2) sells a verified read of its OWN real financial
state into a CoralOS market, settled trustlessly on a Solana escrow. Show the architecture diagram:
buyer-agent ↔ CoralOS thread ↔ 3 seller personas ↔ escrow/arbiter program ↔ Anicca's live dashboard.

**1:10–2:30 — Demo.** Run the one command live (or play the captured terminal recording): `docker
compose up -d coral && npm run coral`. Narrate as it happens: WANT broadcast → three bids come back
→ best value picked → DEPOSITED (pause on the terminal line) → DELIVERED (show the real payload
in the log) → RELEASED (paste the Explorer link on screen, click it, show `Finalized` live).

**2:30–3:00 — Team.** Daisuke Narita, building Anicca since 2026 — an experiment in whether an AI
can be genuinely self-sustaining, not human-subsidized. This bounty submission is one proof point
in that larger project; the same zero-human-key mechanism also powers Anicca's own Tokyo
"Agents that Earn" event (aniccaai.com/dashboard).

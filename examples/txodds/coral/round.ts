/**
 * Minimal CoralOS round for the TxODDS edge — the multi-agent story on top of the lean web oracle.
 *
 * Launches ONE buyer + ONE World Cup seller as CoralOS agents (coral-server runs them as containers).
 * The buyer broadcasts a WANT for a txline edge over a shared MCP thread; the seller bids, wins the
 * AWARD, fetches verified de-margined odds, runs the LLM, and the deal settles through the Solana
 * escrow on devnet — all coordinated by CoralOS (no direct call between them).
 *
 *   docker compose up -d coral      # start coral-server (the MCP coordinator)
 *   cd examples/txodds && npm run coral
 *
 * Needs the repo .env: BUYER_KEYPAIR_B58 (funded), WALLET (seller payout), VENICE_API_KEY (the kit's
 * LLM; or another provider — see LLM.md), and TXLINE_API_KEY (mint one with `npm run mint`).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = 'default'
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const PROXY = process.env.TXODDS_PROXY ?? 'http://localhost:8801'

/** Load the repo-root .env (3 levels up: coral → txodds → examples → root). */
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) }
  try {
    const p = fileURLToPath(new URL('../../../.env', import.meta.url))
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* rely on process.env */ }
  return env
}

const str = (value: string) => ({ type: 'string', value })
const f64 = (value: number) => ({ type: 'f64', value })
const agent = (name: string, options: Record<string, unknown>, idName = name) => ({
  id: { name: idName, version: '0.1.0', registrySourceId: { type: 'local' } },
  name,
  provider: { type: 'local', runtime: 'docker' },
  options,
})

/** A live fixture id with verified odds (from the running proxy), so the seller can actually deliver. */
async function liveFixtureId(): Promise<string> {
  try {
    const board = (await (await fetch(`${PROXY}/api/board`)).json()) as Array<{ FixtureId: number }>
    if (Array.isArray(board) && board.length) return String(board[0].FixtureId)
  } catch { /* proxy not up — fall back */ }
  return '18175397'
}

async function main(): Promise<void> {
  const env = loadEnv()
  const wallet = env.WALLET
  const keypair = env.BUYER_KEYPAIR_B58
  const arbiter = env.ARBITER_KEYPAIR_B58
  if (!arbiter) throw new Error('ARBITER_KEYPAIR_B58 must be in .env - run `node scripts/setup.js`')
  if (!wallet || !keypair) throw new Error('WALLET + BUYER_KEYPAIR_B58 must be in .env — run `node scripts/setup.js`')
  if (!env.TXLINE_API_KEY) throw new Error('TXLINE_API_KEY missing — run `npm run mint` (examples/txodds) first')
  const rpc = env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'

  const llm: Record<string, unknown> = {}
  if (env.VENICE_API_KEY) llm.VENICE_API_KEY = str(env.VENICE_API_KEY)   // the kit's LLM
  if (env.OPENAI_API_KEY) llm.OPENAI_API_KEY = str(env.OPENAI_API_KEY)
  if (env.ANTHROPIC_API_KEY) llm.ANTHROPIC_API_KEY = str(env.ANTHROPIC_API_KEY)
  if (env.LLM_PROVIDER) llm.LLM_PROVIDER = str(env.LLM_PROVIDER)
  if (env.LLM_MODEL) llm.LLM_MODEL = str(env.LLM_MODEL)
  if (env.TRACE) llm.TRACE = str(env.TRACE)
  // ClawRouter (zero-human-key brain) runs on the HOST, not inside the spawned agent containers —
  // 'localhost' inside a container means the container itself, so default to the Docker host alias.
  if (env.LLM_PROVIDER === 'clawrouter') {
    llm.CLAWROUTER_URL = str(env.CLAWROUTER_URL ?? 'http://host.docker.internal:8402/v1/chat/completions')
  }

  const fixtureId = await liveFixtureId()

  const sellerOpts = (name: string, floor: string, persona: string) => ({
    SELLER_WALLET: str(wallet), SOLANA_RPC_URL: str(rpc), AGENT_NAME: str(name),
    // R5: sellers carry BOTH the kit's own TxLINE demo AND Anicca's real service (its own
    // verified net worth / earnings) — 'anicca' is what THIS round's buyer actually WANTs.
    SERVICES: str('anicca,txline'), FLOOR_SOL: f64(Number(floor)), PERSONA: str(persona),
    // 'direct' — our generated ARBITER_KEYPAIR_B58 isn't the on-chain admin arbiter the deployed
    // arbiter program's config PDA was initialized with (that's the ORIGINAL kit author's key), so
    // arbiter-mode release throws NotArbiter (verified live). 'direct' is the buyer-released
    // escrow — still a REAL on-chain 2-party settlement, just without the 3rd-party arbiter wrapper.
    SETTLEMENT_MODE: str('direct'), TXLINE_API_KEY: str(env.TXLINE_API_KEY),
    ...(env.TXLINE_BASE_URL ? { TXLINE_BASE_URL: str(env.TXLINE_BASE_URL) } : {}),
    ...(env.ANICCA_DASHBOARD_URL ? { ANICCA_DASHBOARD_URL: str(env.ANICCA_DASHBOARD_URL) } : {}),
    ...llm,
  })
  const specialist = agent('seller-worldcup', sellerOpts(
    'seller-worldcup',
    env.WORLDCUP_FLOOR_SOL ?? '0.00045',
    'a World Cup TxODDS specialist with fresh fair-line reads',
  ))
  const fast = agent('seller-fast', sellerOpts(
    'seller-fast',
    env.FAST_SELLER_FLOOR_SOL ?? '0.00065',
    'a fast generalist who can serve TxODDS but is less specialized',
  ), 'seller-worldcup')
  const premium = agent('seller-premium', sellerOpts(
    'seller-premium',
    env.PREMIUM_SELLER_FLOOR_SOL ?? '0.00085',
    'a cautious premium analyst who charges more for commentary',
  ), 'seller-worldcup')
  const buyer = agent('buyer-agent', {
    BUYER_KEYPAIR_B58: str(keypair), AGENT_NAME: str('buyer-agent'), SOLANA_RPC_URL: str(rpc),
    ARBITER_KEYPAIR_B58: str(arbiter), SETTLEMENT_MODE: str('direct'),
    SELLER_WALLET: str(wallet), BUYER_MAX_SOL: f64(Number(env.BUYER_MAX_SOL ?? '0.001')),
    // R5: the buyer WANTs Anicca's own service (its real verified net worth / earnings), not
    // the kit's stock TxLINE odds. agentId = Anicca's canonical founder wallet (the real identity
    // this data is about); falls back gracefully (documented, never-crash) if that row isn't yet
    // synced to the live leaderboard (tracked separately, task #18).
    BUYER_SERVICE: str('anicca'), BUYER_ARG: str(env.ANICCA_AGENT_ID ?? '0x810f6d61f7606deee2657d3083e150a222bc29c5'),
    MARKET_SELLERS: str('seller-worldcup,seller-fast,seller-premium'), ...llm,
  })

  // Create the session: coral-server spawns one Docker container per agent in this graph and injects
  // CORAL_CONNECTION_URL into each. Docs:
  //   create-session    https://docs.coralos.ai/api-reference/local/create-session
  //   agent graph shape https://docs.coralos.ai/api-reference/models/GraphAgentRequest
  //   sessions concept  https://docs.coralos.ai/concepts/sessions
  const res = await fetch(`${BASE}/api/v1/local/session`, {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({
      agentGraphRequest: { agents: [buyer, specialist, fast, premium] },
      namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
      execution: { mode: 'immediate' },
    }),
  })
  if (!res.ok) throw new Error(`session create failed: ${res.status} ${await res.text()}`)
  const { sessionId } = (await res.json()) as { sessionId: string }

  console.log(`\nCoralOS round ${sessionId} — buyer-agent + seller-worldcup, fixture ${fixtureId}.`)
  console.log('The buyer broadcasts a WANT(txline edge); the seller bids, wins, delivers, and settles via escrow on devnet.\n')
  console.log('Watch the round (coral names the agent containers by UUID — find + tail them):')
  console.log('  docker logs -f $(docker ps -qf ancestor=buyer-agent:0.1.0  | head -1)   # WANT -> AWARD -> DEPOSITED -> RELEASED')
  console.log('  docker logs -f $(docker ps -qf ancestor=seller-agent:0.1.0 | head -1)   # BID -> ESCROW_REQUIRED -> DELIVERED\n')
}

main().catch((e) => { console.error(`[coral round] ${e}`); process.exitCode = 1 })

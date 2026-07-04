/**
 * Self-report (R6 — "wakes, decides, sells/earns, settles, self-reports") to Anicca's own
 * telemetry system (aniccaai.com), so a real CoralOS round is visible on the dashboard.
 *
 * HONESTY CONSTRAINT: this settles on Solana DEVNET — devnet SOL is worthless play money. Reporting
 * it as net_worth_usd/revenue_mo_usd would inject a fake number into a system built to have none.
 * So this ALWAYS reports 0/0 and tags the row 'coralos-hackathon' with a log_feed line that says
 * so explicitly — only the mechanism (a real signed report reaches the real endpoint) is proven.
 */
import nacl from 'tweetnacl'
import bs58 from 'bs58'

// `??` only falls through on null/undefined, not ''. coral-server injects a manifest-declared
// option's toml `default = ""` into the container env whenever the caller omits that option from
// the session request (verified live: this exact bug bit CLAWROUTER_URL's sibling here — round.ts
// only forwards ANICCA_TELEMETRY_URL when there's a real override, so the container saw `''`, not
// undefined). Same fix as packages/agent-runtime/complete.ts's LLM_MODEL bug: treat '' as unset.
const TELEMETRY_URL = process.env.ANICCA_TELEMETRY_URL || 'https://aniccaai.com/.netlify/functions/telemetry'

export interface RoundPayload {
  id: string
  chain: 'solana'
  ts: number
  host: string
  geo: string
  model_live: string
  model_tier: 'free'
  net_worth_usd: 0
  revenue_mo_usd: 0
  burn_day_usd: number
  runway_days: number
  status: 'alive'
  tags: string[]
  log_feed: Array<{ ts: number; line: string }>
}

export function buildRoundPayload(args: { id: string; round: number; sig: string; host: string }): RoundPayload {
  const ts = Math.floor(Date.now() / 1000)
  return {
    id: args.id, chain: 'solana', ts, host: args.host, geo: 'US', model_live: 'clawrouter/eco',
    model_tier: 'free', net_worth_usd: 0, revenue_mo_usd: 0, burn_day_usd: 0, runway_days: 999,
    status: 'alive', tags: ['coralos-hackathon'],
    log_feed: [{
      ts,
      line: `CoralOS round=${args.round} settled on Solana devnet (test-value-only, NOT real money) — tx=${args.sig}`,
    }],
  }
}

// The real verifier (apps/landing/netlify/functions/_lib/telemetry-verify.js) does NOT recompute
// a canonical form to compare against — it parses OUR exact `message` bytes, recovers the signer
// from them directly, and runs telemetry-schema.js's validate() against the parsed object. So the
// actual requirement is narrower than "byte-for-byte agreement": this object's REQUIRED keys (id,
// ts, host, geo, model_live, model_tier, net_worth_usd, revenue_mo_usd, burn_day_usd, runway_days,
// status) and correctly-typed OPTIONAL keys (chain, tags, log_feed) must satisfy that schema —
// there is no cross-repo import to type-check this against, so it is verified by disciplined
// manual cross-reference with the field list in that file, re-checked below in the test.
export function canonicalMessage(p: RoundPayload): string {
  const m: Record<string, unknown> = {
    id: p.id, ts: p.ts, host: p.host, geo: p.geo, model_live: p.model_live,
    model_tier: p.model_tier, net_worth_usd: p.net_worth_usd, revenue_mo_usd: p.revenue_mo_usd,
    burn_day_usd: p.burn_day_usd, runway_days: p.runway_days, status: p.status,
  }
  m.chain = p.chain
  m.tags = p.tags
  m.log_feed = p.log_feed
  return JSON.stringify(m)
}

export async function reportRound(args: {
  id: string; secretKeyB58: string; round: number; sig: string; host: string
}): Promise<void> {
  try {
    const payload = buildRoundPayload(args)
    const message = canonicalMessage(payload)
    const secretKey = bs58.decode(args.secretKeyB58)
    const sigBytes = nacl.sign.detached(Buffer.from(message, 'utf8'), secretKey)
    const signature = bs58.encode(Buffer.from(sigBytes))
    const res = await fetch(TELEMETRY_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    })
    if (!res.ok) console.error(`[telemetry] report failed: ${res.status} ${await res.text()}`)
  } catch (e) {
    // Never crash the round on a self-report failure (S-C3.5) — same fail-open contract as
    // every other network call in this fork.
    console.error(`[telemetry] report error: ${(e as Error)?.message ?? e}`)
  }
}

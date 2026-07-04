import { afterEach, describe, expect, it, vi } from 'vitest'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { buildRoundPayload, canonicalMessage, reportRound } from './telemetry.js'

const kp = nacl.sign.keyPair()
const ID = bs58.encode(Buffer.from(kp.publicKey))
const SECRET_B58 = bs58.encode(Buffer.from(kp.secretKey))

describe('buildRoundPayload (S-C3.1, S-C3.2)', () => {
  it('always pins net_worth_usd and revenue_mo_usd to 0 — devnet SOL is never reported as real money', () => {
    const p = buildRoundPayload({ id: ID, round: 1, sig: 'abc123', host: 'coralos-devnet' })
    expect(p.net_worth_usd).toBe(0)
    expect(p.revenue_mo_usd).toBe(0)
  })

  it('tags the row coralos-hackathon so it is never mistaken for real GAIN', () => {
    const p = buildRoundPayload({ id: ID, round: 1, sig: 'abc123', host: 'coralos-devnet' })
    expect(p.tags).toContain('coralos-hackathon')
  })

  it('log_feed explicitly says devnet / test-value-only and includes the round + sig', () => {
    const p = buildRoundPayload({ id: ID, round: 3, sig: 'realTxSig456', host: 'coralos-devnet' })
    const line = p.log_feed[0].line
    expect(line).toContain('devnet')
    expect(line).toMatch(/round[=\s]*3/)
    expect(line).toContain('realTxSig456')
  })

  it('chain is solana, id is case-preserved (never lowercased)', () => {
    const p = buildRoundPayload({ id: ID, round: 1, sig: 'x', host: 'coralos-devnet' })
    expect(p.chain).toBe('solana')
    expect(p.id).toBe(ID)
  })
})

describe('reportRound (S-C3.3, S-C3.5 — real ed25519 sign, never throws)', () => {
  const realFetch = global.fetch
  afterEach(() => { global.fetch = realFetch; vi.restoreAllMocks() })

  it('POSTs a real ed25519-signed {message, signature} body to the telemetry endpoint', async () => {
    let posted: any = null
    global.fetch = vi.fn(async (_url: string, opts: any) => {
      posted = JSON.parse(opts.body)
      return { ok: true, status: 202, text: async () => '' }
    }) as unknown as typeof fetch

    await reportRound({ id: ID, secretKeyB58: SECRET_B58, round: 2, sig: 'tx789', host: 'coralos-devnet' })

    expect(posted).not.toBeNull()
    const payload = JSON.parse(posted.message)
    expect(payload.id).toBe(ID)
    expect(payload.net_worth_usd).toBe(0)
    // verify the signature is real and matches this exact message
    const sigBytes = bs58.decode(posted.signature)
    const ok = nacl.sign.detached.verify(Buffer.from(posted.message, 'utf8'), sigBytes, kp.publicKey)
    expect(ok).toBe(true)
  })

  it('never throws when the network call fails (S-C3.5, same fail-open contract as the rest of the fork)', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network down') }) as unknown as typeof fetch
    await expect(reportRound({ id: ID, secretKeyB58: SECRET_B58, round: 1, sig: 'x', host: 'coralos-devnet' })).resolves.not.toThrow()
  })

  it('never throws when the endpoint responds non-ok', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'bad_signature' })) as unknown as typeof fetch
    await expect(reportRound({ id: ID, secretKeyB58: SECRET_B58, round: 1, sig: 'x', host: 'coralos-devnet' })).resolves.not.toThrow()
  })
})

describe('canonicalMessage (regression guard vs apps/landing telemetry-verify.js field order)', () => {
  it('produces the exact field set the aniccaai.com verifier expects', () => {
    const msg = canonicalMessage(buildRoundPayload({ id: ID, round: 1, sig: 'x', host: 'coralos-devnet' }))
    const parsed = JSON.parse(msg)
    for (const k of ['id', 'ts', 'host', 'geo', 'model_live', 'model_tier', 'net_worth_usd',
      'revenue_mo_usd', 'burn_day_usd', 'runway_days', 'status', 'chain', 'tags', 'log_feed']) {
      expect(parsed).toHaveProperty(k)
    }
  })
})

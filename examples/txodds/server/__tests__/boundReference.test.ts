// VCSDD RED — coralos-anicca-seller v2, REQ-1/REQ-2 (retargeted to proxy.ts's boundReference/order,
// the function that feeds ALL THREE settle paths: direct settle(), settleViaArbiter(), pay-intent).
// FAILS until proxy.ts exports boundReference wired to the real Anicca dashboard source instead of
// TxLine board()/favouriteOf().
import { test } from 'node:test'
import assert from 'node:assert'

test('REQ-1: boundReference(order) is derived from a REAL Anicca payload, not TxLine odds', async () => {
  const { boundReference, __setAniccaFetchForTest } = await import('../proxy.js')
  const fixture = {
    leaderboard: [{ id: '0xa3cdd4ec6b94f01826aaf90a6d5538a2aa8c4c21', net_worth_usd: 9.26, revenue_mo_usd: -0.229083, net_worth_src: 'chain', earn_src: 'unverified' }],
  }
  __setAniccaFetchForTest(async () => ({ ok: true, json: async () => fixture } as Response))

  const { reference, order } = await boundReference('0xa3cdd4ec6b94f01826aaf90a6d5538a2aa8c4c21')
  assert.ok(reference, 'must return a PublicKey-shaped reference')
  assert.strictEqual(order.source, 'anicca')
  assert.strictEqual(order.agentId, '0xa3cdd4ec6b94f01826aaf90a6d5538a2aa8c4c21')
  assert.strictEqual(order.net_worth_usd, 9.26)
  assert.ok(typeof order.preimage === 'string' && order.preimage.startsWith('anicca:'))
})

test('REQ-2: unreachable Anicca source -> boundReference still resolves (deterministic fallback), never throws', async () => {
  const { boundReference, __setAniccaFetchForTest } = await import('../proxy.js')
  __setAniccaFetchForTest(async () => { throw new Error('ECONNREFUSED') })

  const { reference, order } = await boundReference('0xa3cdd4ec6b94f01826aaf90a6d5538a2aa8c4c21')
  assert.ok(reference)
  assert.strictEqual(order.source, 'anicca')
  assert.ok(order.fallback === true, 'must flag deterministic fallback, never crash')
})

test('REQ-1: two calls produce distinct references (nonce still varies)', async () => {
  const { boundReference, __setAniccaFetchForTest } = await import('../proxy.js')
  __setAniccaFetchForTest(async () => ({ ok: true, json: async () => ({ leaderboard: [{ id: 'x', net_worth_usd: 1 }] }) } as Response))
  const a = await boundReference('x')
  await new Promise((r) => setTimeout(r, 2))
  const b = await boundReference('x')
  assert.notStrictEqual(a.reference.toBase58(), b.reference.toBase58())
})

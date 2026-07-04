import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deliverService } from './service.js'

describe('deliverService txline-only routing', () => {
  const realFetch = global.fetch

  beforeEach(() => {
    process.env.TXLINE_API_KEY = 'token'
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.VENICE_API_KEY
    delete process.env.LLM_PROVIDER
  })

  afterEach(() => {
    global.fetch = realFetch
    vi.restoreAllMocks()
  })

  it('rejects legacy generic services', async () => {
    const out = JSON.parse(await deliverService('coingecko eth'))
    expect(out).toEqual({ error: 'unsupported service', service: 'coingecko', supported: ['txline', 'anicca'] })
  })

  it('returns fixtures from TxLINE', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/guest/start')) return { ok: true, json: async () => ({ token: 'jwt' }) }
      return { ok: true, json: async () => ([{ FixtureId: 1 }, { FixtureId: 2 }]) }
    }) as unknown as typeof fetch

    const out = JSON.parse(await deliverService('txline fixtures'))
    expect(out).toMatchObject({ service: 'txline-fixtures', count: 2 })
  })

  it('produces a deterministic edge when no live LLM key is configured', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/guest/start')) return { ok: true, json: async () => ({ token: 'jwt' }) }
      if (url.includes('/api/odds/snapshot/123')) {
        return {
          ok: true,
          json: async () => ([{
            SuperOddsType: '1X2',
            PriceNames: ['part1', 'x', 'part2'],
            Pct: ['62', '22', '16'],
          }]),
        }
      }
      return {
        ok: true,
        json: async () => ([{
          FixtureId: 123,
          Participant1: 'A',
          Participant2: 'B',
          Competition: 'World Cup',
        }]),
      }
    }) as unknown as typeof fetch

    const out = JSON.parse(await deliverService('txline edge 123'))
    expect(out.analysis.call).toContain('A')
    expect(out.analysis.note).toContain('deterministic fallback')
  })
})

describe('deliverService anicca routing (R5 — the real Anicca-produced service)', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
    vi.restoreAllMocks()
  })

  it('returns the matching leaderboard entry when found', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        leaderboard: [
          { id: '0xabc', net_worth_usd: 12.5, net_worth_src: 'verified', revenue_mo_usd: 3, earn_src: 'verified' },
        ],
      }),
    })) as unknown as typeof fetch

    const out = JSON.parse(await deliverService('anicca 0xabc'))
    expect(out).toMatchObject({
      service: 'anicca', agentId: '0xabc',
      net_worth_usd: 12.5, revenue_mo_usd: 3,
    })
    expect(out.fallback).toBeUndefined()
  })

  it('falls back gracefully when the dashboard has no leaderboard entry (never crash)', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch
    const out = JSON.parse(await deliverService('anicca 0xnope'))
    expect(out).toMatchObject({ service: 'anicca', agentId: '0xnope', fallback: true })
  })

  it('falls back gracefully when the dashboard fetch fails (never crash)', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network down') }) as unknown as typeof fetch
    const out = JSON.parse(await deliverService('anicca 0xabc'))
    expect(out).toMatchObject({ service: 'anicca', agentId: '0xabc', fallback: true })
  })
})

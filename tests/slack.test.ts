import { describe, expect, it, vi } from 'vitest'
import { createSlackNotifier, formatSlackMessage } from '@/lib/notify/slack'
import type { AlertEvent } from '@/lib/types'

const alert = {
  rule: 'bgp-flap' as const, device: 'core-rtr-01', target: '10.0.0.2', severity: 'critical' as const,
  value: '3 transitions / 60s', key: 'bgp-flap:core-rtr-01:10.0.0.2', status: 'open' as const, openedAt: 4,
}
const NEW: AlertEvent = { kind: 'new', alert }
const RESOLVED: AlertEvent = { kind: 'resolved', alert: { ...alert, status: 'resolved', resolvedAt: 9 } }

const okFetch = () => vi.fn(async () => new Response('ok', { status: 200 }))

describe('createSlackNotifier', () => {
  it('is disabled without a URL and never calls fetch', async () => {
    const f = okFetch()
    const n = createSlackNotifier(undefined, f)
    expect(n.enabled).toBe(false)
    expect(await n.send([NEW])).toBe('disabled')
    expect(f).not.toHaveBeenCalled()
  })

  it('returns idle and skips fetch when there are no events', async () => {
    const f = okFetch()
    expect(await createSlackNotifier('https://hooks.example/x', f).send([])).toBe('idle')
    expect(f).not.toHaveBeenCalled()
  })

  it('posts one JSON message per event', async () => {
    const f = okFetch()
    expect(await createSlackNotifier('https://hooks.example/x', f).send([NEW, RESOLVED])).toBe('sent')
    expect(f).toHaveBeenCalledTimes(2)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hooks.example/x')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(formatSlackMessage(NEW))
  })

  it('reports error on a non-2xx response', async () => {
    const f = vi.fn(async () => new Response('no', { status: 404 }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await createSlackNotifier('https://hooks.example/x', f).send([NEW])).toBe('error')
    spy.mockRestore()
  })

  it('aborts a hanging request after the timeout and reports error', async () => {
    const hang = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const started = Date.now()
    expect(await createSlackNotifier('https://hooks.example/x', hang as unknown as typeof fetch, 50).send([NEW])).toBe('error')
    expect(Date.now() - started).toBeLessThan(1000)
    spy.mockRestore()
  })
})

describe('formatSlackMessage', () => {
  it('marks critical new alerts', () => {
    expect(formatSlackMessage(NEW).text).toBe('🔴 CRITICAL *bgp-flap* on `core-rtr-01` (10.0.0.2) — 3 transitions / 60s · tick 4')
  })

  it('marks warnings', () => {
    expect(formatSlackMessage({ kind: 'new', alert: { ...alert, severity: 'warning' } }).text.startsWith('🟠 WARNING')).toBe(true)
  })

  it('marks resolved events', () => {
    expect(formatSlackMessage(RESOLVED).text).toBe('✅ RESOLVED *bgp-flap* on `core-rtr-01` (10.0.0.2) — 3 transitions / 60s · tick 9')
  })
})

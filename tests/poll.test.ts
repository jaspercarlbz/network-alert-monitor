import { describe, expect, it } from 'vitest'
import { getConfig } from '@/lib/config'
import { runPoll } from '@/lib/poll'
import type { AlertEvent, Fault, Notifier, PollState } from '@/lib/types'

const cfg = getConfig({})

function recorder(): Notifier & { events: AlertEvent[] } {
  const events: AlertEvent[] = []
  return { enabled: true, events, async send(e) { events.push(...e); return e.length ? 'sent' : 'idle' } }
}

const INITIAL: PollState = { tick: 0, faults: [], history: [], alerts: [] }
const FLAP: Fault = { type: 'bgp-flap', device: 'core-rtr-01', peer: '10.0.0.2' }

describe('runPoll', () => {
  it('advances to tick 1 with 6 devices and no events from the initial state', async () => {
    const n = recorder()
    const r = await runPoll(INITIAL, n, cfg)
    expect(r.state.tick).toBe(1)
    expect(r.devices).toHaveLength(6)
    expect(r.events).toEqual([])
    expect(r.slack).toBe('idle')
    expect(r.demoMode).toBe(true)
  })

  it('opens a bgp-flap alert within 4 polls and notifies once', async () => {
    const n = recorder()
    let state: PollState = { ...INITIAL, faults: [FLAP] }
    for (let i = 0; i < 4; i++) state = (await runPoll(state, n, cfg)).state
    expect(state.alerts.find((a) => a.key === 'bgp-flap:core-rtr-01:10.0.0.2')?.status).toBe('open')
    expect(n.events.filter((e) => e.kind === 'new')).toHaveLength(1)
  })

  it('resolves the alert within 15 polls after the fault is cleared', async () => {
    const n = recorder()
    let state: PollState = { ...INITIAL, faults: [FLAP] }
    for (let i = 0; i < 4; i++) state = (await runPoll(state, n, cfg)).state
    state = { ...state, faults: [] }
    for (let i = 0; i < 15 && !n.events.some((e) => e.kind === 'resolved'); i++) state = (await runPoll(state, n, cfg)).state
    expect(n.events.map((e) => e.kind)).toEqual(['new', 'resolved'])
  })

  it('caps history at historyMax', async () => {
    let state = INITIAL
    for (let i = 0; i < cfg.historyMax + 5; i++) state = (await runPoll(state, recorder(), cfg)).state
    expect(state.history).toHaveLength(cfg.historyMax)
  })
})

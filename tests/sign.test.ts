import { describe, expect, it } from 'vitest'
import { signState, verifyState } from '@/lib/sign'
import type { PollState } from '@/lib/types'

const SECRET = 'test-secret'
const state: PollState = {
  tick: 3, faults: [], history: [],
  alerts: [{ rule: 'high-cpu', device: 'fw-01', target: 'cpu', severity: 'warning', value: '88%', key: 'high-cpu:fw-01:cpu', status: 'open', openedAt: 2 }],
}

describe('state signing', () => {
  it('verifies a state it signed', () => {
    expect(verifyState({ ...state, sig: signState(state, SECRET) }, SECRET)).toBe(true)
  })

  it('rejects unsigned state', () => {
    expect(verifyState(state, SECRET)).toBe(false)
  })

  it('rejects a tampered alert', () => {
    const sig = signState(state, SECRET)
    const forged = { ...state, alerts: [{ ...state.alerts[0], value: '<!channel> click here' }], sig }
    expect(verifyState(forged, SECRET)).toBe(false)
  })

  it('rejects a signature made with another secret', () => {
    expect(verifyState({ ...state, sig: signState(state, 'other') }, SECRET)).toBe(false)
  })

  it('does not depend on object key order', () => {
    const reordered = { alerts: state.alerts.map(({ openedAt, ...rest }) => ({ openedAt, ...rest })), history: [], faults: [], tick: 3 }
    expect(verifyState({ ...reordered, sig: signState(state, SECRET) }, SECRET)).toBe(true)
  })

  it('ignores faults, which the presenter changes freely', () => {
    const sig = signState(state, SECRET)
    expect(verifyState({ ...state, faults: [{ type: 'cpu-spike', device: 'fw-01' }], sig }, SECRET)).toBe(true)
  })
})

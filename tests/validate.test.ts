import { describe, expect, it } from 'vitest'
import { simulate } from '@/lib/simulator'
import { parsePollState, ValidationError } from '@/lib/validate'

const INITIAL = { tick: 0, faults: [], history: [], alerts: [] }

describe('parsePollState', () => {
  it('returns the initial state for an undefined or empty body', () => {
    expect(parsePollState(undefined)).toEqual(INITIAL)
    expect(parsePollState({})).toEqual(INITIAL)
  })

  it('collapses duplicate faults to one', () => {
    const f = { type: 'cpu-spike', device: 'fw-01' }
    expect(parsePollState({ ...INITIAL, faults: [f, f] }).faults).toEqual([f])
  })

  it('rejects a fault on an unknown hostname', () => {
    expect(() => parsePollState({ ...INITIAL, faults: [{ type: 'cpu-spike', device: 'nope' }] })).toThrow(ValidationError)
  })

  it('rejects an interface or peer that does not exist on the device', () => {
    expect(() => parsePollState({ ...INITIAL, faults: [{ type: 'interface-down', device: 'fw-01', iface: 'eth99' }] })).toThrow(ValidationError)
    expect(() => parsePollState({ ...INITIAL, faults: [{ type: 'bgp-flap', device: 'acc-sw-01', peer: '10.0.0.2' }] })).toThrow(ValidationError)
  })

  it('rejects an unknown fault type', () => {
    expect(() => parsePollState({ ...INITIAL, faults: [{ type: 'reboot', device: 'fw-01' }] })).toThrow(ValidationError)
  })

  it('rejects a non-numeric or negative tick', () => {
    expect(() => parsePollState({ ...INITIAL, tick: 'abc' })).toThrow(ValidationError)
    expect(() => parsePollState({ ...INITIAL, tick: -1 })).toThrow(ValidationError)
  })

  it('rejects more than 20 faults', () => {
    const faults = Array.from({ length: 21 }, () => ({ type: 'cpu-spike', device: 'fw-01' }))
    expect(() => parsePollState({ ...INITIAL, faults })).toThrow(ValidationError)
  })

  it('trims an oversized history to the last 60 ticks', () => {
    const tick = simulate(1, [])
    const history = Array.from({ length: 10_000 }, () => tick)
    expect(parsePollState({ ...INITIAL, tick: 1, history }).history).toHaveLength(60)
  })

  it('rejects malformed history and alerts', () => {
    expect(() => parsePollState({ ...INITIAL, history: 'x' })).toThrow(ValidationError)
    expect(() => parsePollState({ ...INITIAL, history: [[{ hostname: 'fw-01' }]] })).toThrow(ValidationError)
    expect(() => parsePollState({ ...INITIAL, alerts: [{ key: 1 }] })).toThrow(ValidationError)
  })
})

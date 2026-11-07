import { describe, expect, it } from 'vitest'
import { alertsByRule, cpuLevel, donutSegments, fleetHealth } from '@/lib/viz'
import type { Alert, DeviceSample } from '@/lib/types'

const dev = (hostname: string): DeviceSample => ({ hostname, tick: 1, cpu: 20, interfaces: [], bgp: [] })
const alert = (over: Partial<Alert>): Alert => ({
  rule: 'high-cpu', device: 'a', target: 'cpu', severity: 'warning', value: '88%',
  key: 'k', status: 'open', openedAt: 1, ...over,
})

describe('donutSegments', () => {
  it('splits the circumference by value and skips zeros', () => {
    const segs = donutSegments([{ key: 'a', value: 3 }, { key: 'b', value: 0 }, { key: 'c', value: 1 }], 100, 0)
    expect(segs.map((s) => s.key)).toEqual(['a', 'c'])
    expect(segs[0]).toMatchObject({ fraction: 0.75, length: 75, offset: 0 })
    expect(segs[1]).toMatchObject({ fraction: 0.25, length: 25, offset: 75 })
  })

  it('subtracts a gap between segments but not for a single segment', () => {
    const two = donutSegments([{ key: 'a', value: 1 }, { key: 'b', value: 1 }], 100, 2)
    expect(two.map((s) => s.length)).toEqual([48, 48])
    expect(donutSegments([{ key: 'a', value: 5 }], 100, 2)[0].length).toBe(100)
  })

  it('returns nothing when every value is zero', () => {
    expect(donutSegments([{ key: 'a', value: 0 }], 100, 2)).toEqual([])
  })
})

describe('fleetHealth', () => {
  it('counts each device by its worst open alert', () => {
    const devices = ['a', 'b', 'c', 'd'].map(dev)
    const alerts = [
      alert({ device: 'a', severity: 'warning' }),
      alert({ device: 'b', severity: 'warning' }),
      alert({ device: 'b', severity: 'critical', key: 'k2' }),
      alert({ device: 'c', severity: 'critical', status: 'resolved' }),
    ]
    expect(fleetHealth(devices, alerts)).toEqual({ ok: 2, warning: 1, critical: 1 })
  })
})

describe('alertsByRule', () => {
  it('counts open alerts per rule in a fixed order', () => {
    const alerts = [
      alert({ rule: 'bgp-flap' }),
      alert({ rule: 'bgp-flap', key: 'x' }),
      alert({ rule: 'interface-down', status: 'resolved' }),
    ]
    expect(alertsByRule(alerts)).toEqual([
      { key: 'high-cpu', value: 0 },
      { key: 'interface-down', value: 0 },
      { key: 'bgp-flap', value: 2 },
    ])
  })
})

describe('cpuLevel', () => {
  it('uses 70% and the 85% alert threshold as boundaries', () => {
    expect(cpuLevel(70)).toBe('normal')
    expect(cpuLevel(71)).toBe('elevated')
    expect(cpuLevel(85)).toBe('elevated')
    expect(cpuLevel(86)).toBe('critical')
  })
})

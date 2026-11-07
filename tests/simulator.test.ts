import { describe, expect, it } from 'vitest'
import { DEVICES } from '@/lib/devices'
import { simulate } from '@/lib/simulator'

const sample = (tick: number, faults: Parameters<typeof simulate>[1], host: string) =>
  simulate(tick, faults).find((s) => s.hostname === host)!

describe('simulate', () => {
  it('returns one sample per device', () => {
    expect(simulate(0, []).map((s) => s.hostname)).toEqual(DEVICES.map((d) => d.hostname))
  })

  it('gives identical output for the same tick and faults', () => {
    expect(simulate(7, [])).toEqual(simulate(7, []))
  })

  it('keeps baseline CPU within 15–45%', () => {
    for (let t = 0; t <= 50; t++) {
      for (const s of simulate(t, [])) {
        expect(s.cpu).toBeGreaterThanOrEqual(15)
        expect(s.cpu).toBeLessThanOrEqual(45)
      }
    }
  })

  it('puts CPU at 90–98% under a cpu-spike fault', () => {
    for (let t = 0; t <= 20; t++) {
      const cpu = sample(t, [{ type: 'cpu-spike', device: 'fw-01' }], 'fw-01').cpu
      expect(cpu).toBeGreaterThanOrEqual(90)
      expect(cpu).toBeLessThanOrEqual(98)
    }
  })

  it('sets oper down and keeps admin up under interface-down', () => {
    const iface = DEVICES.find((d) => d.hostname === 'core-rtr-01')!.interfaces[0]
    const s = sample(3, [{ type: 'interface-down', device: 'core-rtr-01', iface }], 'core-rtr-01')
    expect(s.interfaces.find((i) => i.name === iface)).toEqual({ name: iface, admin: 'up', oper: 'down' })
    expect(s.interfaces.filter((i) => i.name !== iface).every((i) => i.oper === 'up')).toBe(true)
  })

  it('alternates BGP state each tick under bgp-flap', () => {
    const f = [{ type: 'bgp-flap' as const, device: 'core-rtr-01', peer: '10.0.0.2' }]
    const state = (t: number) => sample(t, f, 'core-rtr-01').bgp.find((b) => b.peer === '10.0.0.2')!.state
    expect(state(4)).not.toBe(state(5))
    expect(state(4)).toBe(state(6))
    expect(sample(5, f, 'core-rtr-01').bgp.find((b) => b.peer === '10.0.0.6')!.state).toBe('Established')
  })

  it('does not let faults on one device affect another', () => {
    const f = [{ type: 'cpu-spike' as const, device: 'fw-01' }]
    expect(sample(9, f, 'core-rtr-01')).toEqual(sample(9, [], 'core-rtr-01'))
  })
})

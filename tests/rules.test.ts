import { describe, expect, it } from 'vitest'
import { getConfig } from '@/lib/config'
import { evaluateRules } from '@/lib/rules'
import { bgpHistory, cpuHistory, mk } from './helpers'

const cfg = getConfig({}) // demo: 60s window / 5s poll = 12 ticks
const E = 'Established' as const
const I = 'Idle' as const

describe('high-cpu rule', () => {
  it('fires a warning at 86% for 3 samples', () => {
    const hits = evaluateRules(cpuHistory([86, 86, 86]), cfg)
    expect(hits).toEqual([{ rule: 'high-cpu', device: 'r1', target: 'cpu', severity: 'warning', value: '86%' }])
  })

  it('fires critical when the latest sample is above 95%', () => {
    expect(evaluateRules(cpuHistory([90, 92, 96]), cfg)[0]).toMatchObject({ severity: 'critical', value: '96%' })
  })

  it('does not fire at exactly 85%', () => {
    expect(evaluateRules(cpuHistory([85, 85, 85]), cfg)).toEqual([])
  })

  it('does not fire with only 2 high samples', () => {
    expect(evaluateRules(cpuHistory([90, 90]), cfg)).toEqual([])
  })

  it('requires the samples to be consecutive', () => {
    expect(evaluateRules(cpuHistory([86, 90, 40]), cfg)).toEqual([])
  })
})

describe('interface-down rule', () => {
  it('fires critical when admin up and oper down', () => {
    const h = [[mk({ tick: 0, interfaces: [{ name: 'eth0', admin: 'up', oper: 'down' }] })]]
    expect(evaluateRules(h, cfg)).toEqual([
      { rule: 'interface-down', device: 'r1', target: 'eth0', severity: 'critical', value: 'oper down' },
    ])
  })

  it('ignores an administratively shut interface', () => {
    const h = [[mk({ tick: 0, interfaces: [{ name: 'eth0', admin: 'down', oper: 'down' }] })]]
    expect(evaluateRules(h, cfg)).toEqual([])
  })
})

describe('bgp-flap rule', () => {
  it('fires critical at 3 transitions inside the window', () => {
    expect(evaluateRules(bgpHistory([E, I, E, I]), cfg)).toEqual([
      { rule: 'bgp-flap', device: 'r1', target: '10.0.0.2', severity: 'critical', value: '3 transitions / 60s' },
    ])
  })

  it('does not fire at 2 transitions', () => {
    expect(evaluateRules(bgpHistory([E, I, E, E]), cfg)).toEqual([])
  })

  it('ignores transitions older than the window', () => {
    const old = [E, I, E, I, E] // 4 transitions, then 12 stable ticks
    expect(evaluateRules(bgpHistory([...old, ...Array(12).fill(E)]), cfg)).toEqual([])
  })
})

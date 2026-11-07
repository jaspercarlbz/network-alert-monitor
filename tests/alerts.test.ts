import { describe, expect, it } from 'vitest'
import { alertKey, reconcile } from '@/lib/alerts'
import type { Alert, RuleHit } from '@/lib/types'

const bgp: RuleHit = { rule: 'bgp-flap', device: 'core-rtr-01', target: '10.0.0.2', severity: 'critical', value: '3 transitions / 60s' }
const cpu: RuleHit = { rule: 'high-cpu', device: 'fw-01', target: 'cpu', severity: 'warning', value: '88%' }

describe('alertKey', () => {
  it('joins rule, device and target', () => {
    expect(alertKey(bgp)).toBe('bgp-flap:core-rtr-01:10.0.0.2')
  })
})

describe('reconcile', () => {
  it('opens an alert and emits one new event for a fresh hit', () => {
    const r = reconcile([], [bgp], 5)
    expect(r.alerts).toEqual([{ ...bgp, key: alertKey(bgp), status: 'open', openedAt: 5 }])
    expect(r.events).toEqual([{ kind: 'new', alert: r.alerts[0] }])
  })

  it('emits nothing when the same hit repeats (dedupe)', () => {
    const first = reconcile([], [bgp], 5)
    const second = reconcile(first.alerts, [bgp], 6)
    expect(second.events).toEqual([])
    expect(second.alerts).toEqual(first.alerts)
  })

  it('resolves an alert whose hit disappears', () => {
    const open = reconcile([], [bgp], 5).alerts
    const r = reconcile(open, [], 9)
    expect(r.alerts).toEqual([{ ...open[0], status: 'resolved', resolvedAt: 9 }])
    expect(r.events).toEqual([{ kind: 'resolved', alert: r.alerts[0] }])
  })

  it('updates severity and value on an open alert without a new event', () => {
    const open = reconcile([], [cpu], 1).alerts
    const r = reconcile(open, [{ ...cpu, severity: 'critical', value: '97%' }], 2)
    expect(r.events).toEqual([])
    expect(r.alerts[0]).toMatchObject({ severity: 'critical', value: '97%', openedAt: 1, status: 'open' })
  })

  it('opens a fresh alert when a resolved condition returns', () => {
    const resolved = reconcile(reconcile([], [bgp], 1).alerts, [], 2).alerts
    const r = reconcile(resolved, [bgp], 3)
    expect(r.events).toEqual([{ kind: 'new', alert: expect.objectContaining({ status: 'open', openedAt: 3 }) }])
    expect(r.alerts.map((a) => a.status)).toEqual(['open', 'resolved'])
  })

  it('does not re-announce an alert that stays open while a fault is toggled', () => {
    let alerts = reconcile([], [bgp], 1).alerts
    const events = []
    for (let t = 2; t <= 6; t++) {
      const r = reconcile(alerts, [bgp], t) // hit persists through the flap window
      alerts = r.alerts
      events.push(...r.events)
    }
    expect(events).toEqual([])
  })

  it('keeps open alerts first and caps resolved history at 20', () => {
    let alerts: Alert[] = []
    for (let i = 0; i < 25; i++) {
      const hit = { ...cpu, device: `dev-${i}` }
      alerts = reconcile(alerts, [hit], i * 2).alerts
      alerts = reconcile(alerts, [], i * 2 + 1).alerts
    }
    alerts = reconcile(alerts, [bgp], 100).alerts
    expect(alerts[0]).toMatchObject({ key: alertKey(bgp), status: 'open' })
    expect(alerts.filter((a) => a.status === 'resolved')).toHaveLength(20)
    expect(alerts[1].device).toBe('dev-24') // newest resolved first
  })
})

import { describe, expect, it } from 'vitest'
import { ALERT_EMAIL } from '@/lib/config'
import { addToMailbox, formatAlertEmail, MAILBOX_MAX } from '@/lib/email'
import type { AlertEvent } from '@/lib/types'

const alert = {
  rule: 'bgp-flap' as const, device: 'core-rtr-01', target: '10.0.0.2', severity: 'critical' as const,
  value: '3 transitions / 60s', key: 'bgp-flap:core-rtr-01:10.0.0.2', status: 'open' as const, openedAt: 4,
}
const NEW: AlertEvent = { kind: 'new', alert }
const RESOLVED: AlertEvent = { kind: 'resolved', alert: { ...alert, status: 'resolved', resolvedAt: 9 } }
const AT = new Date('2026-11-08T10:00:00Z')

describe('formatAlertEmail', () => {
  it('uses the host mailbox as sender and recipient', () => {
    const m = formatAlertEmail(NEW, AT)
    expect(ALERT_EMAIL).toBe('jaspercarl.game@gmail.com')
    expect(m.from).toBe(`Network Alert Monitor <${ALERT_EMAIL}>`)
    expect(m.to).toBe(ALERT_EMAIL)
    expect(m.sentAt).toBe('2026-11-08T10:00:00.000Z')
  })

  it('puts severity, rule, device and target in the subject of a new alert', () => {
    expect(formatAlertEmail(NEW, AT).subject).toBe('[CRITICAL] BGP flap on core-rtr-01 (10.0.0.2)')
  })

  it('marks a resolved alert in the subject', () => {
    expect(formatAlertEmail(RESOLVED, AT).subject).toBe('[RESOLVED] BGP flap on core-rtr-01 (10.0.0.2)')
  })

  it('includes device site, value, tick and a next step in the body', () => {
    const body = formatAlertEmail(NEW, AT).body.join('\n')
    expect(body).toContain('Site: HQ')
    expect(body).toContain('3 transitions / 60s')
    expect(body).toContain('tick 4')
    expect(body).toMatch(/Next step:/)
  })

  it('gives new and resolved emails for the same alert different ids', () => {
    expect(formatAlertEmail(NEW, AT).id).not.toBe(formatAlertEmail(RESOLVED, AT).id)
  })
})

describe('addToMailbox', () => {
  it('puts the newest email first and starts unread', () => {
    const box = addToMailbox(addToMailbox([], [NEW], AT), [RESOLVED], AT)
    expect(box.map((m) => m.kind)).toEqual(['resolved', 'new'])
    expect(box.every((m) => !m.read)).toBe(true)
  })

  it('ignores an event it already holds', () => {
    const once = addToMailbox([], [NEW], AT)
    expect(addToMailbox(once, [NEW], AT)).toHaveLength(1)
  })

  it(`keeps at most ${MAILBOX_MAX} emails`, () => {
    const events: AlertEvent[] = Array.from({ length: MAILBOX_MAX + 5 }, (_, i) => ({ kind: 'new', alert: { ...alert, openedAt: i } }))
    const box = addToMailbox([], events, AT)
    expect(box).toHaveLength(MAILBOX_MAX)
    expect(box[0].tick).toBe(MAILBOX_MAX + 4)
  })

  it('returns the same array when there are no events', () => {
    const box = addToMailbox([], [NEW], AT)
    expect(addToMailbox(box, [], AT)).toBe(box)
  })
})

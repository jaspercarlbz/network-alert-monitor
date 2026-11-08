import { ALERT_EMAIL } from './config'
import { findDevice } from './devices'
import type { AlertEvent, RuleId, Severity } from './types'

export const MAILBOX_MAX = 50

export interface AlertEmail {
  id: string
  kind: AlertEvent['kind']
  severity: Severity
  rule: RuleId
  from: string
  to: string
  subject: string
  body: string[]
  tick: number
  sentAt: string
  read: boolean
}

const RULE_NAME: Record<RuleId, string> = {
  'high-cpu': 'High CPU',
  'interface-down': 'Interface down',
  'bgp-flap': 'BGP flap',
}

const NEXT_STEP: Record<RuleId, string> = {
  'high-cpu': 'Check the top processes and recent config or traffic changes on the device.',
  'interface-down': 'Check the cable, optic and far-end port, then the interface error counters.',
  'bgp-flap': 'Check the peer link for errors and compare hold timers and logs on both sides.',
}

/** Turn one alert event into the email an on-call engineer would receive. Preview only. */
export function formatAlertEmail(e: AlertEvent, sentAt: Date): AlertEmail {
  const a = e.alert
  const resolved = e.kind === 'resolved'
  const tick = resolved ? (a.resolvedAt ?? a.openedAt) : a.openedAt
  const tag = resolved ? 'RESOLVED' : a.severity.toUpperCase()
  const device = findDevice(a.device)
  const name = RULE_NAME[a.rule]
  const body = [
    'Hi team,',
    '',
    resolved
      ? `The ${name} alert on ${a.device} (${a.target}) has cleared. No action is needed.`
      : `A ${a.severity} ${name} alert opened on ${a.device} (${a.target}).`,
    '',
    `Device: ${a.device}${device ? ` (${device.vendor} ${device.role})` : ''}`,
    `Site: ${device?.site ?? 'unknown'}`,
    `Target: ${a.target}`,
    `Reading: ${a.value}`,
    `Severity: ${a.severity}`,
    resolved ? `Opened at tick ${a.openedAt}, resolved at tick ${tick}` : `Opened at tick ${tick}`,
    '',
    resolved ? 'Next step: none. Close any related ticket.' : `Next step: ${NEXT_STEP[a.rule]}`,
    '',
    '— Network Alert Monitor',
  ]
  return {
    id: `${a.key}:${e.kind}:${tick}`,
    kind: e.kind,
    severity: a.severity,
    rule: a.rule,
    from: `Network Alert Monitor <${ALERT_EMAIL}>`,
    to: ALERT_EMAIL,
    subject: `[${tag}] ${name} on ${a.device} (${a.target})`,
    body,
    tick,
    sentAt: sentAt.toISOString(),
    read: false,
  }
}

/** Add one email per event, newest first, skipping ones already held, capped at MAILBOX_MAX. */
export function addToMailbox(mail: AlertEmail[], events: AlertEvent[], sentAt: Date): AlertEmail[] {
  if (events.length === 0) return mail
  const seen = new Set(mail.map((m) => m.id))
  const fresh: AlertEmail[] = []
  for (const e of events) {
    const m = formatAlertEmail(e, sentAt)
    if (!seen.has(m.id)) { seen.add(m.id); fresh.unshift(m) }
  }
  return fresh.length === 0 ? mail : [...fresh, ...mail].slice(0, MAILBOX_MAX)
}

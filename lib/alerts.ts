import type { Alert, AlertEvent, RuleHit } from './types'

const RESOLVED_KEEP = 20

export const alertKey = (hit: RuleHit) => `${hit.rule}:${hit.device}:${hit.target}`

/**
 * Compare this tick's rule hits with the alerts already known.
 * New hit → open + 'new' event. Repeat hit → dedupe (update in place, no event).
 * Open alert with no hit → resolved + 'resolved' event.
 */
export function reconcile(alerts: Alert[], hits: RuleHit[], tick: number): { alerts: Alert[]; events: AlertEvent[] } {
  const events: AlertEvent[] = []
  const hitsByKey = new Map(hits.map((h) => [alertKey(h), h]))
  const open: Alert[] = []
  const resolved: Alert[] = alerts.filter((a) => a.status === 'resolved')

  for (const alert of alerts.filter((a) => a.status === 'open')) {
    const hit = hitsByKey.get(alert.key)
    if (hit) {
      open.push({ ...alert, severity: hit.severity, value: hit.value })
      hitsByKey.delete(alert.key)
    } else {
      const done: Alert = { ...alert, status: 'resolved', resolvedAt: tick }
      resolved.push(done)
      events.push({ kind: 'resolved', alert: done })
    }
  }

  for (const [key, hit] of hitsByKey) {
    const fresh: Alert = { ...hit, key, status: 'open', openedAt: tick }
    open.push(fresh)
    events.push({ kind: 'new', alert: fresh })
  }

  open.sort((a, b) => b.openedAt - a.openedAt)
  resolved.sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
  return { alerts: [...open, ...resolved.slice(0, RESOLVED_KEEP)], events }
}

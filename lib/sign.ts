import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PollState } from './types'

/** JSON with sorted keys, so the signature does not depend on key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Sign the monitoring state the browser carries between polls. Faults are left
 * out on purpose: the presenter changes them freely from the dashboard.
 */
export function signState(state: PollState, secret: string): string {
  const payload = canonical({ tick: state.tick, history: state.history, alerts: state.alerts })
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifyState(state: PollState, secret: string): boolean {
  if (!state.sig) return false
  const expected = Buffer.from(signState(state, secret), 'hex')
  const given = Buffer.from(state.sig, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

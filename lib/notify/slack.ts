import type { AlertEvent, Notifier, SlackStatus } from '../types'

const BADGE = { critical: '🔴 CRITICAL', warning: '🟠 WARNING' } as const

export function formatSlackMessage(e: AlertEvent): { text: string } {
  const a = e.alert
  const badge = e.kind === 'resolved' ? '✅ RESOLVED' : BADGE[a.severity]
  const tick = e.kind === 'resolved' ? a.resolvedAt : a.openedAt
  return { text: `${badge} *${a.rule}* on \`${a.device}\` (${a.target}) — ${a.value} · tick ${tick}` }
}

async function post(url: string, body: { text: string }, fetchImpl: typeof fetch, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) console.error(`Slack webhook returned ${res.status}`)
    return res.ok
  } catch (err) {
    console.error('Slack webhook failed:', err)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Slack Incoming Webhook notifier. Without a URL it is disabled and the
 * dashboard still works. A failure never throws; it reports 'error'.
 */
export function createSlackNotifier(url: string | undefined, fetchImpl: typeof fetch = fetch, timeoutMs = 3000): Notifier {
  return {
    enabled: Boolean(url),
    async send(events: AlertEvent[]): Promise<SlackStatus> {
      if (!url) return 'disabled'
      if (events.length === 0) return 'idle'
      const results = await Promise.all(events.map((e) => post(url, formatSlackMessage(e), fetchImpl, timeoutMs)))
      return results.every(Boolean) ? 'sent' : 'error'
    },
  }
}

import type { AlertEvent, Notifier, SlackStatus } from '../types'

const BADGE = { critical: '🔴 CRITICAL', warning: '🟠 WARNING' } as const
const MAX_POSTS = 5

/** Slack treats < > & as control characters (mentions, links). */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function formatSlackMessage(e: AlertEvent): { text: string } {
  const a = e.alert
  const badge = e.kind === 'resolved' ? '✅ RESOLVED' : BADGE[a.severity]
  const tick = e.kind === 'resolved' ? a.resolvedAt : a.openedAt
  return { text: `${badge} *${a.rule}* on \`${esc(a.device)}\` (${esc(a.target)}) — ${esc(a.value)} · tick ${tick}` }
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
      // One at a time and capped, to stay within Slack's webhook rate limit.
      const messages = events.slice(0, MAX_POSTS).map(formatSlackMessage)
      const extra = events.length - MAX_POSTS
      if (extra > 0) messages.push({ text: `…and ${extra} more alert changes. See the dashboard.` })
      let ok = true
      for (const m of messages) ok = (await post(url, m, fetchImpl, timeoutMs)) && ok
      return ok ? 'sent' : 'error'
    },
  }
}

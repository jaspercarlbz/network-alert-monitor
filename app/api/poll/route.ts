import { getConfig } from '@/lib/config'
import { createSlackNotifier } from '@/lib/notify/slack'
import { runPoll } from '@/lib/poll'
import { parsePollState, ValidationError } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 512 * 1024
// Signs the state the browser carries. Falls back to the (secret) webhook URL;
// with neither set, Slack is off, so a forged state can only fool its own tab.
const STATE_SECRET = process.env.STATE_SECRET || process.env.SLACK_WEBHOOK_URL || 'local-dev-only'

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request body too large' }, { status: 413 })
  }
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return Response.json({ error: 'Request body too large' }, { status: 413 })
    body = text ? JSON.parse(text) : undefined
  } catch {
    return Response.json({ error: 'Body must be valid JSON' }, { status: 400 })
  }

  try {
    const state = parsePollState(body)
    const notifier = createSlackNotifier(process.env.SLACK_WEBHOOK_URL || undefined)
    return Response.json(await runPoll(state, notifier, getConfig(), STATE_SECRET))
  } catch (err) {
    if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 })
    throw err
  }
}

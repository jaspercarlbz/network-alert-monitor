import { getConfig } from '@/lib/config'
import { createSlackNotifier } from '@/lib/notify/slack'
import { runPoll } from '@/lib/poll'
import { parsePollState, ValidationError } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: unknown
  try {
    const text = await request.text()
    body = text ? JSON.parse(text) : undefined
  } catch {
    return Response.json({ error: 'Body must be valid JSON' }, { status: 400 })
  }

  try {
    const state = parsePollState(body)
    const notifier = createSlackNotifier(process.env.SLACK_WEBHOOK_URL || undefined)
    return Response.json(await runPoll(state, notifier, getConfig()))
  } catch (err) {
    if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 })
    throw err
  }
}

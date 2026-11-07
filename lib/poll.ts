import { reconcile } from './alerts'
import type { Config } from './config'
import { evaluateRules } from './rules'
import { signState, verifyState } from './sign'
import { simulate } from './simulator'
import type { Notifier, PollResponse, PollState } from './types'

/**
 * One monitoring cycle: simulate → evaluate rules → reconcile alerts → notify.
 * State the server did not sign (new or forged) restarts from a clean slate,
 * so a crafted request cannot make the app send alerts it never raised.
 */
export async function runPoll(input: PollState, notifier: Notifier, cfg: Config, secret: string): Promise<PollResponse> {
  const state = verifyState(input, secret) ? input : { tick: 0, faults: input.faults, history: [], alerts: [] }
  const tick = state.tick + 1
  const devices = simulate(tick, state.faults)
  const history = [...state.history, devices].slice(-cfg.historyMax)
  const hits = evaluateRules(history, cfg)
  const { alerts, events } = reconcile(state.alerts, hits, tick)
  const slack = await notifier.send(events)
  const next: PollState = { tick, faults: state.faults, history, alerts }
  return { state: { ...next, sig: signState(next, secret) }, devices, events, slack, demoMode: cfg.demoMode }
}

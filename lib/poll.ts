import { reconcile } from './alerts'
import type { Config } from './config'
import { evaluateRules } from './rules'
import { simulate } from './simulator'
import type { Notifier, PollResponse, PollState } from './types'

/** One monitoring cycle: simulate → evaluate rules → reconcile alerts → notify. */
export async function runPoll(state: PollState, notifier: Notifier, cfg: Config): Promise<PollResponse> {
  const tick = state.tick + 1
  const devices = simulate(tick, state.faults)
  const history = [...state.history, devices].slice(-cfg.historyMax)
  const hits = evaluateRules(history, cfg)
  const { alerts, events } = reconcile(state.alerts, hits, tick)
  const slack = await notifier.send(events)
  return { state: { tick, faults: state.faults, history, alerts }, devices, events, slack, demoMode: cfg.demoMode }
}

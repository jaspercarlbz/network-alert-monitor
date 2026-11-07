import type { Config } from './config'
import type { DeviceSample, RuleHit } from './types'

/** Samples for one device, oldest first. */
function series(history: DeviceSample[][], hostname: string): DeviceSample[] {
  return history.flatMap((tick) => tick.filter((s) => s.hostname === hostname))
}

function highCpu(samples: DeviceSample[], cfg: Config): RuleHit[] {
  const recent = samples.slice(-cfg.cpuConsecutive)
  if (recent.length < cfg.cpuConsecutive || !recent.every((s) => s.cpu > cfg.cpuThreshold)) return []
  const latest = recent[recent.length - 1]
  return [{
    rule: 'high-cpu', device: latest.hostname, target: 'cpu',
    severity: latest.cpu > cfg.cpuCritical ? 'critical' : 'warning', value: `${latest.cpu}%`,
  }]
}

function interfaceDown(latest: DeviceSample): RuleHit[] {
  return latest.interfaces
    .filter((i) => i.admin === 'up' && i.oper === 'down')
    .map((i) => ({ rule: 'interface-down', device: latest.hostname, target: i.name, severity: 'critical', value: 'oper down' }))
}

function bgpFlap(samples: DeviceSample[], cfg: Config): RuleHit[] {
  const windowTicks = Math.round(cfg.bgpWindowS / cfg.pollIntervalS)
  const recent = samples.slice(-(windowTicks + 1))
  const latest = recent[recent.length - 1]
  return latest.bgp.flatMap(({ peer }) => {
    const states = recent.map((s) => s.bgp.find((b) => b.peer === peer)?.state)
    let transitions = 0
    for (let i = 1; i < states.length; i++) if (states[i] !== states[i - 1]) transitions++
    if (transitions < cfg.bgpTransitions) return []
    return [{
      rule: 'bgp-flap', device: latest.hostname, target: peer, severity: 'critical',
      value: `${transitions} transitions / ${cfg.bgpWindowS}s`,
    } satisfies RuleHit]
  })
}

/** Evaluate every rule against the rolling history (oldest tick first). */
export function evaluateRules(history: DeviceSample[][], cfg: Config): RuleHit[] {
  const latestTick = history[history.length - 1] ?? []
  return latestTick.flatMap((latest) => {
    const samples = series(history, latest.hostname)
    return [...highCpu(samples, cfg), ...interfaceDown(latest), ...bgpFlap(samples, cfg)]
  })
}

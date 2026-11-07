export interface Config {
  pollIntervalS: number
  historyMax: number
  cpuThreshold: number
  cpuCritical: number
  cpuConsecutive: number
  bgpTransitions: number
  bgpWindowS: number
  demoMode: boolean
}

/** All alert thresholds in one place, so they are easy to tune and explain. */
export function getConfig(env: Record<string, string | undefined> = process.env): Config {
  const demoMode = env.DEMO_MODE !== 'false'
  return {
    pollIntervalS: 5,
    historyMax: 60,
    cpuThreshold: 85,
    cpuCritical: 95,
    cpuConsecutive: 3,
    bgpTransitions: 3,
    bgpWindowS: demoMode ? 60 : 300,
    demoMode,
  }
}

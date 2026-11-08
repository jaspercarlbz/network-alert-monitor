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
  const pollIntervalS = 5
  const bgpWindowS = demoMode ? 60 : 300
  return {
    pollIntervalS,
    // Keep at least one full BGP window (+1 sample to count transitions).
    historyMax: Math.max(60, bgpWindowS / pollIntervalS + 1),
    cpuThreshold: 85,
    cpuCritical: 95,
    cpuConsecutive: 3,
    bgpTransitions: 3,
    bgpWindowS,
    demoMode,
  }
}

/** Mailbox the Outlook-style preview shows as sender and recipient. Preview only; nothing is sent. */
export const ALERT_EMAIL = 'jaspercarl.game@gmail.com'

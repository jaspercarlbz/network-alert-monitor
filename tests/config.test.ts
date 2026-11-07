import { describe, expect, it } from 'vitest'
import { getConfig } from '@/lib/config'

describe('getConfig', () => {
  it('defaults to demo mode with a 60s BGP window', () => {
    expect(getConfig({})).toMatchObject({
      pollIntervalS: 5, historyMax: 60, cpuThreshold: 85, cpuCritical: 95,
      cpuConsecutive: 3, bgpTransitions: 3, bgpWindowS: 60, demoMode: true,
    })
  })

  it('uses a 300s BGP window when DEMO_MODE=false', () => {
    expect(getConfig({ DEMO_MODE: 'false' })).toMatchObject({ bgpWindowS: 300, demoMode: false, historyMax: 61 })
  })
})

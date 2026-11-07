import type { BgpState, DeviceSample } from '@/lib/types'

/** Build one device sample with sensible healthy defaults. */
export function mk(over: Partial<DeviceSample> & { tick: number }): DeviceSample {
  return {
    hostname: 'r1',
    cpu: 20,
    interfaces: [{ name: 'eth0', admin: 'up', oper: 'up' }],
    bgp: [{ peer: '10.0.0.2', state: 'Established' }],
    ...over,
  }
}

/** History of single-device ticks from a list of CPU values. */
export const cpuHistory = (values: number[]) => values.map((cpu, tick) => [mk({ tick, cpu })])

/** History of single-device ticks from a list of BGP states. */
export const bgpHistory = (states: BgpState[]) =>
  states.map((state, tick) => [mk({ tick, bgp: [{ peer: '10.0.0.2', state }] })])

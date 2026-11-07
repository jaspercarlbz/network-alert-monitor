import { DEVICES } from './devices'
import type { DeviceSample, Fault } from './types'

/** FNV-1a hash mapped to [0, 1). Deterministic stand-in for Math.random. */
function noise(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 0x100000000
}

/** Produce one tick of metrics for every device. Pure: same input, same output. */
export function simulate(tick: number, faults: Fault[]): DeviceSample[] {
  return DEVICES.map((d) => {
    const mine = faults.filter((f) => f.device === d.hostname)
    const spiking = mine.some((f) => f.type === 'cpu-spike')
    const r = noise(`${d.hostname}:${tick}`)
    const cpu = spiking ? Math.round(90 + r * 8) : Math.round(15 + r * 30)

    const interfaces = d.interfaces.map((name) => {
      const down = mine.some((f) => f.type === 'interface-down' && f.iface === name)
      return { name, admin: 'up' as const, oper: down ? ('down' as const) : ('up' as const) }
    })

    const bgp = d.bgpPeers.map(({ ip }) => {
      const flapping = mine.some((f) => f.type === 'bgp-flap' && f.peer === ip)
      return { peer: ip, state: flapping && tick % 2 === 1 ? ('Idle' as const) : ('Established' as const) }
    })

    return { hostname: d.hostname, tick, cpu, interfaces, bgp }
  })
}

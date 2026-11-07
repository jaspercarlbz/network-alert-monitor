import { getConfig } from './config'
import type { Alert, DeviceSample, RuleId } from './types'

export interface DonutInput<K extends string = string> {
  key: K
  value: number
}

export interface DonutSegment<K extends string = string> extends DonutInput<K> {
  fraction: number
  /** Visible arc length, already shortened by the gap. */
  length: number
  /** Distance along the circle where the arc starts. */
  offset: number
}

/**
 * Lay out donut arcs along a circle of the given circumference.
 * Zero values are skipped; `gap` is the surface gap between neighbouring arcs.
 */
export function donutSegments<K extends string>(items: DonutInput<K>[], circumference: number, gap: number): DonutSegment<K>[] {
  const shown = items.filter((i) => i.value > 0)
  const total = shown.reduce((sum, i) => sum + i.value, 0)
  if (total === 0) return []
  const g = shown.length > 1 ? gap : 0
  let offset = 0
  return shown.map((i) => {
    const fraction = i.value / total
    const span = fraction * circumference
    const seg = { ...i, fraction, length: Math.max(span - g, 0), offset }
    offset += span
    return seg
  })
}

export interface FleetHealth {
  ok: number
  warning: number
  critical: number
}

/** Count devices by their worst open alert. */
export function fleetHealth(devices: DeviceSample[], alerts: Alert[]): FleetHealth {
  const worst = new Map<string, 'warning' | 'critical'>()
  for (const a of alerts) {
    if (a.status !== 'open') continue
    if (a.severity === 'critical' || !worst.has(a.device)) worst.set(a.device, a.severity)
  }
  const result: FleetHealth = { ok: 0, warning: 0, critical: 0 }
  for (const d of devices) result[worst.get(d.hostname) ?? 'ok']++
  return result
}

export const RULE_ORDER: RuleId[] = ['high-cpu', 'interface-down', 'bgp-flap']

/** Open alerts per rule, always in RULE_ORDER so colors follow the rule, not its rank. */
export function alertsByRule(alerts: Alert[]): DonutInput<RuleId>[] {
  return RULE_ORDER.map((rule) => ({
    key: rule,
    value: alerts.filter((a) => a.status === 'open' && a.rule === rule).length,
  }))
}

export type CpuLevel = 'normal' | 'elevated' | 'critical'

const ELEVATED_AT = 70

/** Above the alert threshold is critical; above 70% is a heads-up. */
export function cpuLevel(cpu: number, threshold = getConfig({}).cpuThreshold): CpuLevel {
  if (cpu > threshold) return 'critical'
  return cpu > ELEVATED_AT ? 'elevated' : 'normal'
}

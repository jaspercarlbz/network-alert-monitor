import { getConfig } from './config'
import { findDevice } from './devices'
import type { Alert, DeviceSample, Fault, PollState } from './types'

export class ValidationError extends Error {}

const MAX_FAULTS = 20
const MAX_ALERTS = 200
const BGP_STATES = ['Established', 'Idle', 'Active']
const LINK = ['up', 'down']
const RULES = ['high-cpu', 'interface-down', 'bgp-flap']
const SEVERITIES = ['warning', 'critical']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

function fail(msg: string): never {
  throw new ValidationError(msg)
}

function parseFault(v: unknown): Fault {
  if (!isObj(v) || !isStr(v.device)) fail('fault must have a device')
  const device = findDevice(v.device) ?? fail(`unknown device: ${v.device}`)
  switch (v.type) {
    case 'cpu-spike':
      return { type: 'cpu-spike', device: device.hostname }
    case 'interface-down':
      if (!isStr(v.iface) || !device.interfaces.includes(v.iface)) fail(`unknown interface on ${device.hostname}`)
      return { type: 'interface-down', device: device.hostname, iface: v.iface }
    case 'bgp-flap':
      if (!isStr(v.peer) || !device.bgpPeers.some((p) => p.ip === v.peer)) fail(`unknown BGP peer on ${device.hostname}`)
      return { type: 'bgp-flap', device: device.hostname, peer: v.peer }
    default:
      fail(`unknown fault type: ${String(v.type)}`)
  }
}

function parseSample(v: unknown): DeviceSample {
  if (!isObj(v) || !isStr(v.hostname) || !findDevice(v.hostname) || !isCount(v.tick) || !isNum(v.cpu)) fail('bad sample')
  if (!Array.isArray(v.interfaces) || !Array.isArray(v.bgp)) fail('bad sample')
  const interfaces = v.interfaces.map((i) => {
    if (!isObj(i) || !isStr(i.name) || !LINK.includes(i.admin as string) || !LINK.includes(i.oper as string)) fail('bad interface')
    return { name: i.name, admin: i.admin, oper: i.oper } as DeviceSample['interfaces'][number]
  })
  const bgp = v.bgp.map((b) => {
    if (!isObj(b) || !isStr(b.peer) || !BGP_STATES.includes(b.state as string)) fail('bad bgp')
    return { peer: b.peer, state: b.state } as DeviceSample['bgp'][number]
  })
  return { hostname: v.hostname, tick: v.tick, cpu: v.cpu, interfaces, bgp }
}

function parseAlert(v: unknown): Alert {
  if (!isObj(v)) fail('bad alert')
  const { rule, device, target, severity, value, key, status, openedAt, resolvedAt } = v
  if (!RULES.includes(rule as string) || !isStr(device) || !isStr(target) || !SEVERITIES.includes(severity as string)) fail('bad alert')
  if (!isStr(value) || !isStr(key) || (status !== 'open' && status !== 'resolved') || !isCount(openedAt)) fail('bad alert')
  if (resolvedAt !== undefined && !isCount(resolvedAt)) fail('bad alert')
  return { rule, device, target, severity, value, key, status, openedAt, ...(resolvedAt !== undefined && { resolvedAt }) } as Alert
}

/** Validate the client-held state sent with each poll. Never trust the browser. */
export function parsePollState(body: unknown): PollState {
  if (body === undefined || body === null) body = {}
  if (!isObj(body)) fail('body must be an object')
  const { tick = 0, faults = [], history = [], alerts = [] } = body
  if (!isCount(tick)) fail('tick must be a non-negative integer')
  if (!Array.isArray(faults) || !Array.isArray(history) || !Array.isArray(alerts)) fail('faults, history and alerts must be arrays')
  if (faults.length > MAX_FAULTS) fail(`at most ${MAX_FAULTS} faults`)
  if (alerts.length > MAX_ALERTS) fail(`at most ${MAX_ALERTS} alerts`)

  const unique = new Map<string, Fault>()
  for (const f of faults.map(parseFault)) unique.set(JSON.stringify(f), f)

  const trimmed = history.slice(-getConfig().historyMax)
  return {
    tick,
    faults: [...unique.values()],
    history: trimmed.map((t) => (Array.isArray(t) ? t.map(parseSample) : fail('history entries must be arrays'))),
    alerts: alerts.map(parseAlert),
  }
}

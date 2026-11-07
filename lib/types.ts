export type Role = 'router' | 'switch' | 'firewall'
export type BgpState = 'Established' | 'Idle' | 'Active'
export type Severity = 'warning' | 'critical'
export type RuleId = 'high-cpu' | 'interface-down' | 'bgp-flap'
export type LinkState = 'up' | 'down'

export interface BgpPeer {
  ip: string
  remoteAs: number
}

export interface Device {
  hostname: string
  role: Role
  vendor: string
  site: string
  interfaces: string[]
  bgpPeers: BgpPeer[]
}

export type Fault =
  | { type: 'cpu-spike'; device: string }
  | { type: 'interface-down'; device: string; iface: string }
  | { type: 'bgp-flap'; device: string; peer: string }

export interface DeviceSample {
  hostname: string
  tick: number
  cpu: number
  interfaces: { name: string; admin: LinkState; oper: LinkState }[]
  bgp: { peer: string; state: BgpState }[]
}

export interface RuleHit {
  rule: RuleId
  device: string
  target: string
  severity: Severity
  value: string
}

export interface Alert extends RuleHit {
  key: string
  status: 'open' | 'resolved'
  openedAt: number
  resolvedAt?: number
}

export interface AlertEvent {
  kind: 'new' | 'resolved'
  alert: Alert
}

export interface PollState {
  tick: number
  faults: Fault[]
  history: DeviceSample[][]
  alerts: Alert[]
}

export type SlackStatus = 'sent' | 'idle' | 'disabled' | 'error'

export interface PollResponse {
  state: PollState
  devices: DeviceSample[]
  events: AlertEvent[]
  slack: SlackStatus
  demoMode: boolean
}

export interface Notifier {
  enabled: boolean
  send(events: AlertEvent[]): Promise<SlackStatus>
}

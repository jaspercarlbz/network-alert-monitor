import type { RuleId } from '@/lib/types'

export const RULE_LABEL: Record<RuleId, string> = {
  'high-cpu': 'High CPU',
  'interface-down': 'Interface down',
  'bgp-flap': 'BGP flap',
}

/** Fixed color per rule, so a rule keeps its color whatever its count. */
export const RULE_COLOR: Record<RuleId, string> = {
  'high-cpu': 'var(--rule-cpu)',
  'interface-down': 'var(--rule-iface)',
  'bgp-flap': 'var(--rule-bgp)',
}

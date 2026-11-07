import type { RuleId } from '@/lib/types'

export const RULE_LABEL: Record<RuleId, string> = {
  'high-cpu': 'High CPU',
  'interface-down': 'Interface down',
  'bgp-flap': 'BGP flap',
}

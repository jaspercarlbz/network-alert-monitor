import type { Alert, DeviceSample, SlackStatus } from '@/lib/types'
import styles from './Header.module.css'

const SLACK_LABEL: Record<SlackStatus, string> = {
  sent: 'Slack connected',
  idle: 'Slack connected',
  disabled: 'Slack off',
  error: 'Slack error',
}

interface Props {
  devices: DeviceSample[]
  alerts: Alert[]
  slack: SlackStatus | null
  demoMode: boolean
  lastUpdated: Date | null
}

export function Header({ devices, alerts, slack, demoMode, lastUpdated }: Props) {
  const open = alerts.filter((a) => a.status === 'open')
  const alerting = new Set(open.map((a) => a.device))
  const healthy = devices.filter((d) => !alerting.has(d.hostname)).length
  const critical = open.filter((a) => a.severity === 'critical').length
  const warning = open.length - critical

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Network Alert Monitor</h1>
          <p className={styles.subtitle}>Simulated routers, switches and firewalls · polled every 5s</p>
        </div>
        <div className={styles.badges}>
          {demoMode ? <span className={styles.badge}>Demo mode · 60s BGP window</span> : null}
          {slack ? <span className={`${styles.badge} ${styles[`slack_${slack}`]}`}>{SLACK_LABEL[slack]}</span> : null}
        </div>
      </div>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Healthy devices</dt>
          <dd className="mono">{healthy}/{devices.length}</dd>
        </div>
        <div className={`${styles.stat} ${critical ? styles.crit : ''}`}>
          <dt>Critical</dt>
          <dd className="mono">{critical}</dd>
        </div>
        <div className={`${styles.stat} ${warning ? styles.warn : ''}`}>
          <dt>Warning</dt>
          <dd className="mono">{warning}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Last updated</dt>
          <dd className="mono" aria-live="polite">{lastUpdated ? lastUpdated.toLocaleTimeString() : 'Connecting…'}</dd>
        </div>
      </dl>
    </header>
  )
}

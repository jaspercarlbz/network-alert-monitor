import { fleetHealth } from '@/lib/viz'
import type { Alert, DeviceSample, SlackStatus } from '@/lib/types'
import { Donut } from './Donut'
import styles from './Header.module.css'

const SLACK_LABEL: Record<SlackStatus, string> = {
  sent: 'Slack sent OK',
  idle: 'Slack configured',
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
  const health = fleetHealth(devices, alerts)
  const open = alerts.filter((a) => a.status === 'open')
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
          {demoMode ? <span className={`${styles.badge} ${styles.demo}`}>Demo mode · 60s BGP window</span> : null}
          {slack ? <span className={`${styles.badge} ${styles[`slack_${slack}`]}`}>{SLACK_LABEL[slack]}</span> : null}
        </div>
      </div>

      <div className={styles.overview}>
        <section className={styles.healthCard} aria-label="Fleet health">
          <Donut
            title="Fleet health"
            centerValue={`${health.ok}/${devices.length || 0}`}
            centerLabel="healthy"
            items={[
              { key: 'ok', label: 'Healthy', value: health.ok, color: 'var(--status-good)' },
              { key: 'warning', label: 'Warning', value: health.warning, color: 'var(--status-warning)' },
              { key: 'critical', label: 'Critical', value: health.critical, color: 'var(--status-critical)' },
            ]}
          />
        </section>

        <dl className={styles.stats}>
          <div className={`${styles.stat} ${styles.statCrit}`}>
            <dt>Critical alerts</dt>
            <dd className="mono">{critical}</dd>
          </div>
          <div className={`${styles.stat} ${styles.statWarn}`}>
            <dt>Warning alerts</dt>
            <dd className="mono">{warning}</dd>
          </div>
          <div className={`${styles.stat} ${styles.statDevices}`}>
            <dt>Devices polled</dt>
            <dd className="mono">{devices.length}</dd>
          </div>
          <div className={`${styles.stat} ${styles.statTime}`}>
            <dt>Last updated</dt>
            <dd className={`mono ${styles.time}`}>{lastUpdated ? lastUpdated.toLocaleTimeString() : 'Connecting…'}</dd>
          </div>
        </dl>
      </div>
    </header>
  )
}

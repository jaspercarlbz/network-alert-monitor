import type { Alert } from '@/lib/types'
import styles from './AlertFeed.module.css'
import { RULE_LABEL } from './labels'

export function AlertFeed({ alerts }: { alerts: Alert[] }) {
  const openCount = alerts.filter((a) => a.status === 'open').length

  return (
    <section className={styles.panel} aria-labelledby="alerts-heading">
      <h2 id="alerts-heading" className={styles.heading}>
        Alerts <span className={styles.count}>{openCount} open</span>
      </h2>
      {alerts.length === 0 ? (
        <p className={styles.empty}>No alerts yet. Inject a fault to see one.</p>
      ) : (
        <ol className={styles.list} aria-live="polite">
          {alerts.map((a) => {
            const resolved = a.status === 'resolved'
            return (
              <li key={`${a.key}:${a.openedAt}`} className={`${styles.item} ${resolved ? styles.resolved : styles[a.severity]}`}>
                <div className={styles.top}>
                  <span className={styles.sev}>{resolved ? 'Resolved' : a.severity}</span>
                  <strong>{RULE_LABEL[a.rule]}</strong>
                  <span className={`${styles.when} mono`}>
                    tick {a.openedAt}{resolved ? `→${a.resolvedAt}` : ''}
                  </span>
                </div>
                <div className={styles.detail}>
                  <span className="mono">{a.device}</span> · <span className="mono">{a.target}</span> · {a.value}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

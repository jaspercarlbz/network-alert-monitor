import { DEVICES } from '@/lib/devices'
import type { Alert, DeviceSample, Severity } from '@/lib/types'
import { CpuRing } from './CpuRing'
import styles from './DeviceGrid.module.css'

type Health = 'ok' | Severity
const HEALTH_LABEL: Record<Health, string> = { ok: 'Healthy', warning: 'Warning', critical: 'Critical' }

function worst(alerts: Alert[]): Health {
  if (alerts.some((a) => a.severity === 'critical')) return 'critical'
  return alerts.length ? 'warning' : 'ok'
}

export function DeviceGrid({ devices, alerts }: { devices: DeviceSample[]; alerts: Alert[] }) {
  const samples = new Map(devices.map((d) => [d.hostname, d]))
  const open = alerts.filter((a) => a.status === 'open')

  return (
    <section aria-labelledby="devices-heading">
      <h2 id="devices-heading" className={styles.heading}>Devices</h2>
      <ul className={styles.grid}>
        {DEVICES.map((device) => {
          const s = samples.get(device.hostname)
          const health = worst(open.filter((a) => a.device === device.hostname))
          return (
            <li key={device.hostname} className={`${styles.card} ${styles[health]} ${styles[`role_${device.role}`]}`}>
              <div className={styles.cardHead}>
                <div>
                  <h3 className={`${styles.host} mono`} translate="no">{device.hostname}</h3>
                  <p className={styles.meta}>
                    <span className={styles.roleChip}>{device.role}</span>
                    {device.vendor} · {device.site}
                  </p>
                </div>
                <span className={`${styles.status} ${styles[`status_${health}`]}`}>{HEALTH_LABEL[health]}</span>
              </div>

              <div className={styles.cpu}>
                <CpuRing cpu={s ? s.cpu : null} hostname={device.hostname} />
                <div className={styles.cpuText}>
                  <span className={styles.label}>CPU</span>
                  <span className={styles.cpuHint}>{s && s.cpu > 85 ? 'Above 85% alert threshold' : 'Alert threshold 85%'}</span>
                </div>
              </div>

              <div className={styles.section}>
                <span className={styles.label}>Interfaces</span>
                <ul className={styles.list}>
                  {(s?.interfaces ?? device.interfaces.map((name) => ({ name, admin: 'up', oper: 'up' }))).map((i) => (
                    <li key={i.name} className={styles.item}>
                      <span className={`${styles.dot} ${i.oper === 'up' ? styles.dotUp : styles.dotDown}`} aria-hidden="true" />
                      <span className="mono">{i.name}</span>
                      <span className={i.oper === 'up' ? styles.muted : styles.down}>{i.oper}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {device.bgpPeers.length ? (
                <div className={styles.section}>
                  <span className={styles.label}>BGP peers</span>
                  <ul className={styles.list}>
                    {device.bgpPeers.map((p) => {
                      const state = s?.bgp.find((b) => b.peer === p.ip)?.state ?? 'Established'
                      return (
                        <li key={p.ip} className={styles.item}>
                          <span className={`${styles.dot} ${state === 'Established' ? styles.dotUp : styles.dotDown}`} aria-hidden="true" />
                          <span className="mono">{p.ip}</span>
                          <span className={styles.muted}>AS{p.remoteAs}</span>
                          <span className={state === 'Established' ? styles.muted : styles.down}>{state}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

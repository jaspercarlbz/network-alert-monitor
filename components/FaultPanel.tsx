'use client'

import { useState } from 'react'
import { DEVICES } from '@/lib/devices'
import type { Fault } from '@/lib/types'
import styles from './FaultPanel.module.css'

interface Props {
  faults: Fault[]
  onAdd: (f: Fault) => void
  onRemove: (f: Fault) => void
  onClear: () => void
}

function describe(f: Fault): string {
  if (f.type === 'cpu-spike') return `CPU spike · ${f.device}`
  if (f.type === 'interface-down') return `Interface down · ${f.device} ${f.iface}`
  return `BGP flap · ${f.device} ${f.peer}`
}

export function FaultPanel({ faults, onAdd, onRemove, onClear }: Props) {
  const [hostname, setHostname] = useState(DEVICES[0].hostname)
  const device = DEVICES.find((d) => d.hostname === hostname) ?? DEVICES[0]
  const [iface, setIface] = useState(device.interfaces[0])
  const [peer, setPeer] = useState(device.bgpPeers[0]?.ip ?? '')

  const pickDevice = (h: string) => {
    const d = DEVICES.find((x) => x.hostname === h) ?? DEVICES[0]
    setHostname(d.hostname)
    setIface(d.interfaces[0])
    setPeer(d.bgpPeers[0]?.ip ?? '')
  }

  return (
    <section className={styles.panel} aria-labelledby="faults-heading">
      <h2 id="faults-heading" className={styles.heading}>Inject a Fault</h2>
      <p className={styles.hint}>Simulates a problem on a device. Alerts follow on the next polls.</p>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Device</span>
          <select value={hostname} onChange={(e) => pickDevice(e.target.value)}>
            {DEVICES.map((d) => <option key={d.hostname} value={d.hostname}>{d.hostname} ({d.role})</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Interface</span>
          <select value={iface} onChange={(e) => setIface(e.target.value)}>
            {device.interfaces.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>BGP peer</span>
          <select value={peer} onChange={(e) => setPeer(e.target.value)} disabled={!device.bgpPeers.length}>
            {device.bgpPeers.length
              ? device.bgpPeers.map((p) => <option key={p.ip} value={p.ip}>{p.ip} (AS{p.remoteAs})</option>)
              : <option value="">No BGP on this device</option>}
          </select>
        </label>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => onAdd({ type: 'cpu-spike', device: hostname })}>Spike CPU</button>
        <button type="button" className={styles.btn} onClick={() => onAdd({ type: 'interface-down', device: hostname, iface })}>Down Interface</button>
        <button type="button" className={styles.btn} disabled={!peer} onClick={() => onAdd({ type: 'bgp-flap', device: hostname, peer })}>Flap BGP</button>
      </div>

      <div className={styles.active}>
        <div className={styles.activeHead}>
          <span>Active Faults ({faults.length})</span>
          <button type="button" className={styles.link} onClick={onClear} disabled={!faults.length}>Clear All Faults</button>
        </div>
        {faults.length ? (
          <ul className={styles.faultList}>
            {faults.map((f) => (
              <li key={JSON.stringify(f)}>
                <span>{describe(f)}</span>
                <button type="button" className={styles.link} onClick={() => onRemove(f)} aria-label={`Clear ${describe(f)}`}>Clear</button>
              </li>
            ))}
          </ul>
        ) : <p className={styles.hint}>None. The fleet is running clean.</p>}
      </div>
    </section>
  )
}

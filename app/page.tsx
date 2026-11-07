'use client'

import { AlertFeed } from '@/components/AlertFeed'
import { DeviceGrid } from '@/components/DeviceGrid'
import { FaultPanel } from '@/components/FaultPanel'
import { Header } from '@/components/Header'
import { usePoll } from '@/components/usePoll'
import styles from './page.module.css'

export default function Home() {
  const { data, error, lastUpdated, faults, addFault, removeFault, clearFaults } = usePoll()
  const alerts = data?.state.alerts ?? []

  return (
    <main className={styles.main}>
      <Header devices={data?.devices ?? []} alerts={alerts} slack={data?.slack ?? null} demoMode={data?.demoMode ?? false} lastUpdated={lastUpdated} />
      {error ? <p className={styles.banner} role="alert">Poll failed: {error}. Showing last known state; retrying.</p> : null}
      <div className={styles.layout}>
        <DeviceGrid devices={data?.devices ?? []} alerts={alerts} />
        <div className={styles.side}>
          <FaultPanel faults={faults} onAdd={addFault} onRemove={removeFault} onClear={clearFaults} />
          <AlertFeed alerts={alerts} />
        </div>
      </div>
    </main>
  )
}

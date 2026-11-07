'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Fault, PollResponse, PollState } from '@/lib/types'

const INTERVAL_MS = 5000
const INITIAL: PollState = { tick: 0, faults: [], history: [], alerts: [] }
const sameFault = (a: Fault, b: Fault) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Polls /api/poll every 5s. The browser owns the monitoring state and sends it
 * with each request, so the serverless function can stay stateless.
 */
export function usePoll() {
  const [data, setData] = useState<PollResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [faults, setFaults] = useState<Fault[]>([])

  const stateRef = useRef<PollState>(INITIAL)
  const inFlight = useRef(false)

  const poll = useCallback(async () => {
    if (inFlight.current) return // never overlap polls
    inFlight.current = true
    try {
      const res = await fetch('/api/poll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(stateRef.current),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const next = json as PollResponse
      // Keep faults changed while this request was in flight.
      stateRef.current = { ...next.state, faults: stateRef.current.faults }
      setData(next)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poll failed') // keep last good data
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const loop = async () => {
      if (!document.hidden) await poll()
      if (!stopped) timer = setTimeout(loop, INTERVAL_MS)
    }
    loop()
    const onVisible = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [poll])

  const setFaultList = useCallback((next: Fault[]) => {
    stateRef.current = { ...stateRef.current, faults: next }
    setFaults(next)
  }, [])

  const addFault = useCallback((f: Fault) => {
    const current = stateRef.current.faults
    if (!current.some((x) => sameFault(x, f))) setFaultList([...current, f])
  }, [setFaultList])

  const removeFault = useCallback((f: Fault) => {
    setFaultList(stateRef.current.faults.filter((x) => !sameFault(x, f)))
  }, [setFaultList])

  const clearFaults = useCallback(() => setFaultList([]), [setFaultList])

  return { data, error, lastUpdated, faults, addFault, removeFault, clearFaults }
}

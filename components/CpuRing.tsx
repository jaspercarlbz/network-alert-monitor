import { cpuLevel } from '@/lib/viz'
import styles from './CpuRing.module.css'

const SIZE = 64
const STROKE = 7
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
const THRESHOLD = 85
const CX = SIZE / 2
const round = (n: number) => Math.round(n * 100) / 100
// Threshold tick, computed once and rounded so server and browser render identical SVG.
const TICK_RAD = (((THRESHOLD / 100) * 360 - 90) * Math.PI) / 180
const TICK = {
  x1: round(CX + (R - STROKE / 2 - 1) * Math.cos(TICK_RAD)),
  y1: round(CX + (R - STROKE / 2 - 1) * Math.sin(TICK_RAD)),
  x2: round(CX + (R + STROKE / 2 + 1) * Math.cos(TICK_RAD)),
  y2: round(CX + (R + STROKE / 2 + 1) * Math.sin(TICK_RAD)),
}

/** Ring gauge for CPU %, with a tick at the 85% alert threshold. */
export function CpuRing({ cpu, hostname }: { cpu: number | null; hostname: string }) {
  const value = cpu ?? 0
  const level = cpuLevel(value)
  const cx = CX

  return (
    <div className={styles.ring} role="meter" aria-label={`${hostname} CPU`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="var(--track)" strokeWidth={STROKE} />
        <circle
          className={styles.arc}
          cx={cx} cy={cx} r={R} fill="none"
          stroke={`var(--cpu-${level})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${round((value / 100) * C)} ${round(C)}`}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        <line
          {...TICK}
          stroke="var(--muted)" strokeWidth={2} strokeLinecap="round"
        />
      </svg>
      <span className={`${styles.value} mono`}>{cpu === null ? '—' : `${value}%`}</span>
    </div>
  )
}

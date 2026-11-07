'use client'

import { useState } from 'react'
import { donutSegments } from '@/lib/viz'
import styles from './Donut.module.css'

export interface DonutItem {
  key: string
  label: string
  value: number
  /** CSS color for the arc, e.g. 'var(--status-good)'. */
  color: string
}

interface Props {
  items: DonutItem[]
  /** Big number in the middle when nothing is hovered. */
  centerValue: string
  centerLabel: string
  /** Shown as a full gray ring when every value is zero. */
  emptyLabel?: string
  title: string
  size?: number
}

const STROKE = 14

export function Donut({ items, centerValue, centerLabel, emptyLabel, title, size = 132 }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const r = (size - STROKE) / 2
  const c = 2 * Math.PI * r
  const segs = donutSegments(items, c, 3)
  const active = items.find((i) => i.key === hovered)
  const total = items.reduce((s, i) => s + i.value, 0)

  return (
    <figure className={styles.figure}>
      <div className={styles.chart} style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}: ${items.map((i) => `${i.value} ${i.label}`).join(', ')}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={STROKE} />
            {segs.map((s) => {
              const item = items.find((i) => i.key === s.key)!
              return (
                <circle
                  key={s.key}
                  className={styles.arc}
                  cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke={item.color}
                  strokeWidth={hovered === s.key ? STROKE + 4 : STROKE}
                  strokeDasharray={`${s.length.toFixed(2)} ${(c - s.length).toFixed(2)}`}
                  strokeDashoffset={(-s.offset).toFixed(2)}
                  onMouseEnter={() => setHovered(s.key)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <title>{`${item.label}: ${item.value} (${Math.round(s.fraction * 100)}%)`}</title>
                </circle>
              )
            })}
          </g>
        </svg>
        <div className={styles.center} aria-hidden="true">
          <span className={`${styles.value} mono`}>{active ? active.value : total === 0 && emptyLabel ? '0' : centerValue}</span>
          <span className={styles.label}>{active ? active.label : total === 0 && emptyLabel ? emptyLabel : centerLabel}</span>
        </div>
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.title}>{title}</span>
        <ul className={styles.legend}>
          {items.map((i) => (
            <li
              key={i.key}
              className={hovered && hovered !== i.key ? styles.dim : ''}
              onMouseEnter={() => setHovered(i.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={styles.swatch} style={{ background: i.color }} aria-hidden="true" />
              <span>{i.label}</span>
              <span className={`${styles.count} mono`}>{i.value}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}

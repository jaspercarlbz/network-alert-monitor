'use client'

import { useState } from 'react'
import { ALERT_EMAIL } from '@/lib/config'
import type { AlertEmail } from '@/lib/email'
import { RULE_COLOR } from './labels'
import styles from './OutlookInbox.module.css'

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const fullDate = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })

function Flag({ m }: { m: AlertEmail }) {
  if (m.kind === 'resolved') return <span className={`${styles.flag} ${styles.flagOk}`}>✓ Resolved</span>
  return <span className={`${styles.flag} ${styles[`flag_${m.severity}`]}`}>⚑ {m.severity}</span>
}

/** Outlook-style preview of the email each alert would send. Nothing leaves the browser. */
export function OutlookInbox({ mail, onOpen, onMarkAllRead }: {
  mail: AlertEmail[]
  onOpen: (id: string) => void
  onMarkAllRead: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = mail.find((m) => m.id === selectedId) ?? null
  const unread = mail.filter((m) => !m.read).length

  const open = (id: string) => { setSelectedId(id); onOpen(id) }

  return (
    <section className={styles.panel} aria-labelledby="inbox-heading">
      <div className={styles.bar}>
        <div className={styles.barTitle}>
          <span className={styles.mailIcon} aria-hidden="true">✉</span>
          <h2 id="inbox-heading" className={styles.heading}>Email alerts</h2>
          <span className={styles.address}>{ALERT_EMAIL}</span>
        </div>
        <div className={styles.barRight}>
          <span className={styles.preview}>Preview only, no email is sent</span>
          <button type="button" className={styles.markAll} onClick={onMarkAllRead} disabled={unread === 0}>Mark all read</button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.listPane}>
          <div className={styles.folder}>
            Inbox <span className={styles.unread} aria-label={`${unread} unread`}>{unread}</span>
          </div>
          {mail.length === 0 ? (
            <p className={styles.empty}>No emails yet. Each new or resolved alert lands here as an email.</p>
          ) : (
            <ul className={styles.list}>
              {mail.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`${styles.row} ${m.read ? '' : styles.rowUnread} ${m.id === selectedId ? styles.rowSelected : ''}`}
                    onClick={() => open(m.id)}
                    aria-current={m.id === selectedId ? 'true' : undefined}
                  >
                    <span className={styles.rule} style={{ background: RULE_COLOR[m.rule] }} aria-hidden="true" />
                    <span className={styles.rowMain}>
                      <span className={styles.rowTop}>
                        <span className={styles.sender}>Network Alert Monitor</span>
                        <span className={`${styles.time} mono`}>{time(m.sentAt)}</span>
                      </span>
                      <span className={styles.subject}>{m.subject}</span>
                      <span className={styles.rowBottom}>
                        <span className={styles.snippet}>{m.body[2]}</span>
                        <Flag m={m} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <article className={styles.reading} aria-live="polite">
          {selected ? (
            <>
              <h3 className={styles.readSubject}>{selected.subject}</h3>
              <div className={styles.meta}>
                <span className={styles.avatar} aria-hidden="true">NA</span>
                <dl className={styles.headers}>
                  <div><dt>From</dt><dd>{selected.from}</dd></div>
                  <div><dt>To</dt><dd>{selected.to}</dd></div>
                  <div><dt>Date</dt><dd>{fullDate(selected.sentAt)}</dd></div>
                </dl>
                <Flag m={selected} />
              </div>
              <div className={styles.message}>
                {selected.body.map((line, i) => (line ? <p key={i}>{line}</p> : <br key={i} />))}
              </div>
            </>
          ) : (
            <p className={styles.empty}>Select an email to read it.</p>
          )}
        </article>
      </div>
    </section>
  )
}

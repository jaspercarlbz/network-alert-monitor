# Network Alert Monitor — Design Spec

**Date:** 2026-11-07
**Status:** Draft, awaiting review
**Purpose:** Portfolio project for a Forward Deployed Engineer (FDE) interview. It shows how a network engineer's daily monitoring work (routers, switches, firewalls) becomes an automated alerting tool.

## 1. Goals

- Monitor a fleet of **simulated** network devices. No real network access.
- Detect three issue types: **high CPU**, **interface down**, **BGP peer flap**.
- Show alerts on a **dashboard** and send them to **Slack** through an Incoming Webhook (optional).
- Let the presenter **inject faults live** during the interview.
- Deploy to **Vercel** with no database or extra services.

### Non-goals (v1)

- Real SNMP, SSH, or streaming telemetry collection.
- User accounts, multi-tenancy, or persistent alert history.
- Other channels (Teams, email). The notifier interface makes these easy to add later.

## 2. Tech stack

- Next.js (App Router) + TypeScript, deployed on Vercel.
- Plain CSS Modules for styling. No UI library.
- Vitest for unit tests.
- Node v24 locally (`~/.local/node/bin`).

## 3. Architecture

```
Browser (dashboard)
  │  every 5s: POST /api/poll { tick, faults, history }
  ▼
/api/poll (Vercel Function)
  ├─ lib/devices    → inventory
  ├─ lib/simulator  → metrics for this tick (+ injected faults)
  ├─ lib/rules      → evaluate CPU / interface / BGP rules
  ├─ lib/alerts     → dedupe, open/resolve lifecycle
  └─ lib/notify     → Slack webhook for new + resolved alerts
  ▼
Response { devices, alerts, history }
```

Vercel Functions are stateless, so **the browser holds the state**: the current tick, the active injected faults, and a short rolling history of samples and open alerts. The browser sends this state with each poll, and the server returns the updated state. This keeps the app database-free. Section 8 covers the trade-off.

## 4. Components

### 4.1 `lib/devices.ts` — inventory
A static list of 6 devices:

| Hostname | Role | Vendor (label only) | Site |
|---|---|---|---|
| core-rtr-01 | router | Cisco IOS-XE | HQ |
| edge-rtr-01 | router | Juniper MX | HQ |
| dist-sw-01 | switch | Cisco Catalyst | HQ |
| acc-sw-01 | switch | Aruba CX | Branch-A |
| acc-sw-02 | switch | Aruba CX | Branch-B |
| fw-01 | firewall | Fortinet FortiGate | HQ |

Each device has 2–4 interfaces. Routers and the firewall have 1–2 BGP peers (peer IP and remote ASN).

### 4.2 `lib/simulator.ts` — metrics
`simulate(tick, faults) → DeviceSample[]`. The function is pure and deterministic: the same input always gives the same output, so it is easy to test.
- **CPU:** a baseline of 15–45% plus seeded noise.
- **Interfaces:** admin up and oper up, unless a fault applies.
- **BGP:** `Established`, unless a fault applies.

Fault types:
- `cpu-spike` (device): CPU 90–98%.
- `interface-down` (device, interface): oper down while admin stays up.
- `bgp-flap` (device, peer): the state alternates `Established` ↔ `Idle`/`Active` on each tick.

Faults stay active until the presenter clears them.

### 4.3 `lib/rules.ts` — detection
Each rule is a pure function, `(history: DeviceSample[][], device) → RuleHit[]`.

| Rule | Condition | Severity |
|---|---|---|
| High CPU | CPU > **85%** for **3 consecutive** samples | warning; critical if > 95% |
| Interface down | admin **up** and oper **down** | critical |
| BGP flap | **≥ 3** state transitions within the last **5 minutes** of samples | critical |

Thresholds live in one `config` object so they are easy to tune and to explain.

### 4.4 `lib/alerts.ts` — lifecycle
- Alert key: `${rule}:${device}:${target}`, for example `bgp-flap:core-rtr-01:10.0.0.2`.
- A new hit with no matching open alert opens an alert. This is a **new** event.
- A matching open alert stays open with no new notification. This is **dedupe**.
- An open alert whose condition has cleared becomes a **resolved** event.

### 4.5 `lib/notify/slack.ts` — channel
- If `SLACK_WEBHOOK_URL` is set: POST one Slack message per new or resolved event, with an emoji by severity, the device, the rule, the value, and a timestamp.
- If it is not set: skip the post silently and report `slack: "disabled"` in the response. The dashboard keeps working.
- Failures (timeout or non-2xx) are logged and surfaced as `slack: "error"`. They never fail the poll.
- A `Notifier` interface means Teams or email can be added later without touching the rules.

### 4.6 `app/api/poll/route.ts`
Validates the input, runs simulator → rules → alerts → notify, and returns the new state. The rolling history is capped at about 60 ticks (5 minutes at 5s per tick).

### 4.7 Dashboard (`app/page.tsx` + components)
- **Header:** fleet summary (devices up, open alerts by severity) and the Slack status badge.
- **Device grid:** one card per device, colored by worst open alert (green / amber / red). Shows CPU, interfaces, and BGP peers.
- **Alert feed:** newest first, with open and resolved states.
- **Fault panel:** buttons such as "Spike CPU", "Down interface", "Flap BGP", plus "Clear all faults".

## 5. Data flow (demo example)
1. The presenter clicks **Flap BGP → core-rtr-01 / 10.0.0.2**.
2. On the next polls, the simulator alternates the peer state.
3. By about the 3rd transition, the BGP flap rule fires and the alert opens.
4. The card turns red, the feed shows the alert, and Slack receives the message.
5. The presenter clears the fault. After the 5-minute window drains, the alert resolves and Slack receives a "resolved" message.

For a snappier demo, a `DEMO_MODE` setting shortens the BGP window to 60 seconds. It is on by default and labeled as such in the UI.

## 6. Error handling
- Invalid poll body: 400 with a message. The dashboard shows a banner and keeps the last good state.
- Slack failure: the poll continues and the badge shows the error.
- Network error from the browser: the next poll retries. A "last updated" timestamp makes stale data visible.

## 7. Testing
- Unit tests (Vitest) for each rule: threshold edges (85% vs 86%, 2 vs 3 samples, 2 vs 3 transitions).
- Unit tests for the alert lifecycle: open, dedupe, resolve.
- Simulator determinism test: the same tick and faults give the same output.
- One route test: a poll with a `bgp-flap` fault yields an open alert after enough ticks.
- Manual check: run locally, inject each fault, and confirm the dashboard and Slack.

## 8. Known limitations (talking points)
- State lives in the browser. Two viewers see independent simulations. **Next step:** move state to a store (for example Redis) and run evaluation on a schedule instead of on dashboard polls.
- Data is simulated. **Next step:** a collector that pulls real SNMP or API data and feeds the same `DeviceSample` shape. The rules don't change.

## 9. Deliverables
- Working Next.js app in this folder.
- `README.md`: what it is, how to run it, architecture.
- `docs/STEP-BY-STEP.md`: VS Code guide from empty folder to Vercel deploy.
- `docs/DEMO-SCRIPT.md`: 5-minute demo flow and FDE talking points. Any MSPbots-specific claims are verified against their public site before writing.
- `.env.example` with `SLACK_WEBHOOK_URL=`.

## 10. Out of scope for this build
No deploy, push, or PR unless the user asks.

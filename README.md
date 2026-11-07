# Network Alert Monitor

Automated alerting for a fleet of **simulated** routers, switches and firewalls. Every 5 seconds the app polls each device and checks three rules: **high CPU**, **interface down** and **BGP peer flap**. Alerts appear on a live dashboard and, optionally, in a **Slack** channel. During a demo you can inject faults from the dashboard and watch alerts open and resolve.

The device data is simulated, so nothing here touches a real network. The app has no database and deploys to Vercel as-is.

## Quick start

Requires Node.js 18 or later.

```bash
npm install
npm test        # unit tests (Vitest)
npm run dev     # http://localhost:3000
```

To send alerts to Slack, copy `.env.example` to `.env.local` and set `SLACK_WEBHOOK_URL`. Without it, alerts still show on the dashboard and the header reads "Slack off". With a URL set, it reads "Slack configured" until the first alert is sent, then "Slack sent OK" or "Slack error".

| Variable | Default | Purpose |
|---|---|---|
| `SLACK_WEBHOOK_URL` | empty | Slack Incoming Webhook URL. Treat it as a secret. |
| `DEMO_MODE` | `true` | Shortens the BGP flap window to 60s. Set to `false` for 300s. |
| `STATE_SECRET` | the webhook URL | Optional. Signs the state the browser carries between polls. |

## Alert rules

| Rule | Fires when | Severity |
|---|---|---|
| High CPU | CPU > 85% for 3 consecutive polls | warning, or critical above 95% |
| Interface down | admin up **and** oper down | critical |
| BGP flap | ≥ 3 state changes within the window (60s demo / 300s) | critical |

Each alert is deduplicated: it opens once, stays open while the condition holds, and sends a "resolved" message when the condition clears. All thresholds live in [`lib/config.ts`](lib/config.ts).

## Architecture

```
Browser (dashboard)
  │  every 5s: POST /api/poll { tick, faults, history, alerts }
  ▼
/api/poll  (Vercel Function)
  ├─ lib/devices     inventory (6 devices)
  ├─ lib/simulator   metrics for this tick + injected faults
  ├─ lib/rules       CPU / interface / BGP rules
  ├─ lib/alerts      open → dedupe → resolve
  └─ lib/notify      Slack webhook (3s timeout, never fails the poll)
  ▼
{ devices, alerts, events, slack }
```

Vercel Functions are stateless, so the browser holds the monitoring state and sends it with each poll. The server validates that state on every request ([`lib/validate.ts`](lib/validate.ts)) and signs it with an HMAC ([`lib/sign.ts`](lib/sign.ts)). State the server did not sign starts over from a clean slate, so a crafted request cannot make the app post alerts it never raised. Slack posts are escaped, sent one at a time, and capped at 5 per poll.

```
lib/           pure TypeScript logic (unit-tested)
app/api/poll   the poll endpoint
app/page.tsx   dashboard
components/    Header, DeviceGrid, AlertFeed, FaultPanel, usePoll
tests/         Vitest suites
docs/          spec, plan, step-by-step guide, demo script
```

## Known limitations and next steps

- **State lives in the browser.** Two viewers see two separate simulations. Next step: keep state in a store such as Redis and run evaluation on a schedule (for example, a cron job) instead of on dashboard polls.
- **Data is simulated.** Next step: add a collector that reads real SNMP or vendor APIs and outputs the same `DeviceSample` shape. The rules, alerting and dashboard stay unchanged.
- **One channel.** The `Notifier` interface makes Teams or email a new file, not a rewrite.

## Docs

- [Step-by-step guide (VS Code → Vercel)](docs/STEP-BY-STEP.md)
- [Demo script and talking points](docs/DEMO-SCRIPT.md)
- [Design spec](docs/superpowers/specs/2026-11-07-network-alert-monitor-design.md)

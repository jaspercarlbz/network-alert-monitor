# Network Alert Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vercel-ready Next.js app that simulates 6 network devices, detects high CPU, interface down and BGP flap, and shows alerts on a dashboard and in Slack. The presenter can inject faults live.

**Architecture:** Pure TypeScript modules (`lib/`) for the simulator, rules, alert lifecycle and notifier. A thin orchestrator (`lib/poll.ts`) wires them together, and the `POST /api/poll` route wraps it. The browser holds all state (tick, faults, history, alerts) and sends it on every poll, so the server stays stateless with no database.

**Tech Stack:** Next.js (App Router), React, TypeScript, CSS Modules, Vitest. Node v24 at `~/.local/node/bin`.

**Spec:** `docs/superpowers/specs/2026-11-07-network-alert-monitor-design.md`

## Global Constraints

- Every shell command first runs `export PATH="$HOME/.local/node/bin:$PATH"`.
- The project folder name has spaces, so **do not use `create-next-app`** (invalid npm name). Scaffold by hand; `package.json` `name` is `network-alert-monitor`.
- Poll interval: **5 s**. History cap: **60 ticks**.
- CPU: threshold **85%** for **3 consecutive** samples; **critical if > 95%**, else warning.
- Interface down: admin `up` and oper `down` → critical.
- BGP flap: **≥ 3** state transitions within the window → critical. Window **300 s**, or **60 s** when `DEMO_MODE` is on (default on).
- Slack is optional: `SLACK_WEBHOOK_URL` unset → `slack: "disabled"`. A failure never fails the poll.
- No real network access. No database. No deploy, push or PR unless the user asks.

## Review Focus

1. **The same fault injected twice** → it is stored once and never doubles the effect. Test in Task 6 (`parsePollState` dedupes faults).
2. **A tampered or oversized poll body** (unknown hostname, 10,000-entry history, non-numeric tick) → 400 or truncation, never a crash. Test in Task 6.
3. **The Slack webhook hangs** → aborted after 3 s, and the poll still returns with `slack: "error"`. Test in Task 5.
4. **Clearing and re-injecting a fault while its alert is still open** → no second "new" event. Test in Task 4.
5. **Overlapping polls** (slow response, background tab) → only one poll is in flight at a time. Covered by the `inFlight` guard in Task 7's `usePoll`; checked manually in Task 8.

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, .gitignore, .env.example
lib/types.ts            shared types (single source of truth)
lib/config.ts           thresholds + getConfig()
lib/devices.ts          static inventory
lib/simulator.ts        simulate(tick, faults)
lib/rules.ts            evaluateRules(history, config)
lib/alerts.ts           reconcile(alerts, hits, tick)
lib/notify/slack.ts     createSlackNotifier(url?)
lib/validate.ts         parsePollState(body)
lib/poll.ts             runPoll(state, notifier, config)
app/api/poll/route.ts   POST handler
app/layout.tsx, app/page.tsx, app/globals.css
components/usePoll.ts, Header.tsx, DeviceGrid.tsx, AlertFeed.tsx, FaultPanel.tsx (+ *.module.css)
tests/*.test.ts
README.md, docs/STEP-BY-STEP.md, docs/DEMO-SCRIPT.md
```

---

### Task 1: Scaffold, shared types, config

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, `lib/types.ts`, `lib/config.ts`, `app/layout.tsx`, `app/page.tsx` (placeholder), `app/globals.css`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces (`lib/types.ts`):
  ```ts
  type Role = 'router' | 'switch' | 'firewall'
  type BgpState = 'Established' | 'Idle' | 'Active'
  type Severity = 'warning' | 'critical'
  type RuleId = 'high-cpu' | 'interface-down' | 'bgp-flap'
  interface BgpPeer { ip: string; remoteAs: number }
  interface Device { hostname: string; role: Role; vendor: string; site: string; interfaces: string[]; bgpPeers: BgpPeer[] }
  type Fault =
    | { type: 'cpu-spike'; device: string }
    | { type: 'interface-down'; device: string; iface: string }
    | { type: 'bgp-flap'; device: string; peer: string }
  interface DeviceSample { hostname: string; tick: number; cpu: number;
    interfaces: { name: string; admin: 'up' | 'down'; oper: 'up' | 'down' }[];
    bgp: { peer: string; state: BgpState }[] }
  interface RuleHit { rule: RuleId; device: string; target: string; severity: Severity; value: string }
  interface Alert extends RuleHit { key: string; status: 'open' | 'resolved'; openedAt: number; resolvedAt?: number }
  interface AlertEvent { kind: 'new' | 'resolved'; alert: Alert }
  interface PollState { tick: number; faults: Fault[]; history: DeviceSample[][]; alerts: Alert[] }
  type SlackStatus = 'sent' | 'idle' | 'disabled' | 'error'
  interface PollResponse { state: PollState; devices: DeviceSample[]; events: AlertEvent[]; slack: SlackStatus }
  interface Notifier { enabled: boolean; send(events: AlertEvent[]): Promise<SlackStatus> }
  ```
- Produces (`lib/config.ts`): `interface Config { pollIntervalS: number; historyMax: number; cpuThreshold: number; cpuCritical: number; cpuConsecutive: number; bgpTransitions: number; bgpWindowS: number; demoMode: boolean }` and `getConfig(env?: Record<string, string | undefined>): Config`. The default `env` is `process.env`. `DEMO_MODE` is on unless it equals `"false"`.

- [ ] **Step 1: Write `package.json` by hand** with name `network-alert-monitor`, `"private": true`, and scripts `dev: next dev`, `build: next build`, `start: next start`, `test: vitest run`. Then run:
  `npm install next@latest react@latest react-dom@latest && npm install -D typescript @types/react @types/react-dom @types/node vitest`
  Expected: installs with no errors.
- [ ] **Step 2: Add config files.** `tsconfig.json` uses the standard Next.js settings with path alias `@/*` → `./*`. `vitest.config.ts` uses the same alias and `environment: 'node'`. `.gitignore` covers `node_modules`, `.next`, `.env*.local`, `.vercel`. `.env.example` contains `SLACK_WEBHOOK_URL=` and `DEMO_MODE=true`.
- [ ] **Step 3: Write the failing test** `tests/config.test.ts`:
  ```ts
  it('defaults to demo mode with a 60s BGP window', () => {
    const c = getConfig({})
    expect(c).toMatchObject({ pollIntervalS: 5, historyMax: 60, cpuThreshold: 85, cpuCritical: 95, cpuConsecutive: 3, bgpTransitions: 3, bgpWindowS: 60, demoMode: true })
  })
  it('uses a 300s BGP window when DEMO_MODE=false', () => {
    expect(getConfig({ DEMO_MODE: 'false' })).toMatchObject({ bgpWindowS: 300, demoMode: false })
  })
  ```
- [ ] **Step 4: Run** `npx vitest run tests/config.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 5: Implement** `lib/types.ts` and `lib/config.ts`. Then add a minimal `app/layout.tsx` and a placeholder `app/page.tsx` that renders "Network Alert Monitor".
- [ ] **Step 6: Run** `npx vitest run` and `npx next build`. Expected: tests PASS, build succeeds.
- [ ] **Step 7: Commit** `chore: scaffold Next.js app with shared types and config`

---

### Task 2: Device inventory + simulator

**Files:**
- Create: `lib/devices.ts`, `lib/simulator.ts`
- Test: `tests/simulator.test.ts`

**Interfaces:**
- Consumes: `Device`, `Fault`, `DeviceSample` from Task 1.
- Produces: `DEVICES: Device[]` and `simulate(tick: number, faults: Fault[]): DeviceSample[]`.

Inventory (from the spec): core-rtr-01 (router, Cisco IOS-XE, HQ), edge-rtr-01 (router, Juniper MX, HQ), dist-sw-01 (switch, Cisco Catalyst, HQ), acc-sw-01 (switch, Aruba CX, Branch-A), acc-sw-02 (switch, Aruba CX, Branch-B), fw-01 (firewall, Fortinet FortiGate, HQ). Each device has 2–4 interfaces. BGP peers: core-rtr-01 → 10.0.0.2 / AS65002 and 10.0.0.6 / AS65003; edge-rtr-01 → 203.0.113.1 / AS64500; fw-01 → 10.0.0.10 / AS65010. The switches have none.

- [ ] **Step 1: Write the failing tests:**
  - `same tick and faults give identical output` — `expect(simulate(7, [])).toEqual(simulate(7, []))`
  - `baseline CPU stays within 15–45` — for ticks 0..50, every `cpu` is `>= 15 && <= 45`
  - `cpu-spike puts CPU at 90–98` — device `fw-01`
  - `interface-down sets oper down, admin up` — `core-rtr-01` / its first interface
  - `bgp-flap alternates Established and Idle each tick` — the peer state at tick 4 ≠ the state at tick 5, and the state at tick 4 = the state at tick 6
  - `faults on other devices do not affect this one`
- [ ] **Step 2: Run** `npx vitest run tests/simulator.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Make noise deterministic with a small string hash, for example FNV-1a of `${hostname}:${tick}` mapped to [0, 1). No `Math.random`. With bgp-flap, the state is `Established` on even ticks and `Idle` on odd ticks.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add device inventory and deterministic simulator`

---

### Task 3: Rules engine

**Files:**
- Create: `lib/rules.ts`
- Test: `tests/rules.test.ts`

**Interfaces:**
- Consumes: `DeviceSample`, `RuleHit`, `Config`.
- Produces: `evaluateRules(history: DeviceSample[][], config: Config): RuleHit[]`. `history` is oldest-first; each entry is one tick's samples for all devices. Targets: `'cpu'` for high-cpu, the interface name, or the peer IP. Values: `"97%"`, `"oper down"`, `"4 transitions / 60s"`.

- [ ] **Step 1: Write the failing tests** (build sample helpers inline):
  - `cpu at 86 for 3 samples → warning hit`; `cpu at 96 for 3 → critical`
  - `cpu at 85 for 3 → no hit` (strictly greater than)
  - `cpu at 90 for only 2 samples → no hit`; `86, 90, 40 → no hit` (must be consecutive)
  - `admin up + oper down → critical interface-down hit`; `admin down + oper down → no hit`
  - `3 transitions inside window → bgp-flap hit`; `2 transitions → no hit`
  - `transitions older than window are ignored` (windowTicks = `bgpWindowS / pollIntervalS`)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Count BGP transitions over the last `windowTicks + 1` samples per peer, as the number of adjacent pairs whose state differs.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add CPU, interface and BGP flap rules`

---

### Task 4: Alert lifecycle

**Files:**
- Create: `lib/alerts.ts`
- Test: `tests/alerts.test.ts`

**Interfaces:**
- Consumes: `Alert`, `RuleHit`, `AlertEvent`.
- Produces: `alertKey(hit: RuleHit): string` → `${rule}:${device}:${target}`, and `reconcile(alerts: Alert[], hits: RuleHit[], tick: number): { alerts: Alert[]; events: AlertEvent[] }`. The output keeps every open alert plus the newest **20** resolved alerts, newest first.

- [ ] **Step 1: Write the failing tests:**
  - `a new hit opens an alert and emits one 'new' event`
  - `the same hit next tick emits no event` (dedupe)
  - `a hit that disappears resolves the alert with resolvedAt = tick and emits 'resolved'`
  - `a severity change on an open alert updates severity and value without a new event`
  - `a hit returning after resolve opens a fresh alert` (a new event is allowed here)
  - Review Focus #4: `the hit persists across ticks while the fault is toggled; the alert is still open → no second 'new' event`
  - `resolved history is capped at 20`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add alert open/dedupe/resolve lifecycle`

---

### Task 5: Slack notifier

**Files:**
- Create: `lib/notify/slack.ts`
- Test: `tests/slack.test.ts`

**Interfaces:**
- Consumes: `Notifier`, `AlertEvent`, `SlackStatus`.
- Produces: `createSlackNotifier(url: string | undefined, fetchImpl: typeof fetch = fetch, timeoutMs = 3000): Notifier` and `formatSlackMessage(e: AlertEvent): { text: string }`.

Message format: `🔴 CRITICAL` / `🟠 WARNING` / `✅ RESOLVED`, then `*{rule}* on \`{device}\` ({target}) — {value}` and the tick. `send([])` returns `'idle'` with no fetch.

- [ ] **Step 1: Write the failing tests** (inject a fake `fetchImpl`):
  - `url undefined → enabled false, send returns 'disabled', fetch never called`
  - `two events → two POSTs with JSON body {text}, returns 'sent'`
  - `non-2xx response → 'error'`
  - Review Focus #3: `a fetch that never resolves → aborted after timeoutMs (use 50 in test) → 'error'`
  - `formatSlackMessage for a resolved event starts with ✅ RESOLVED`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with `AbortController` + `setTimeout`. Catch everything and log with `console.error`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add Slack webhook notifier with timeout`

---

### Task 6: Validation, poll orchestrator, API route

**Files:**
- Create: `lib/validate.ts`, `lib/poll.ts`, `app/api/poll/route.ts`
- Test: `tests/validate.test.ts`, `tests/poll.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces:
  - `parsePollState(body: unknown): PollState`. It throws `ValidationError` (exported class) on bad input. An empty or missing body gives the initial state `{ tick: 0, faults: [], history: [], alerts: [] }`.
  - `runPoll(state: PollState, notifier: Notifier, config: Config): Promise<PollResponse>`. Order: `tick = state.tick + 1` → `simulate` → append to history and trim to `historyMax` → `evaluateRules` → `reconcile` → `notifier.send(events)`.
  - `POST /api/poll`: returns 200 with the `PollResponse` JSON, or 400 `{ error }` on `ValidationError`. Set `export const dynamic = 'force-dynamic'`.

- [ ] **Step 1: Write the failing validation tests:**
  - `undefined body → initial state`
  - Review Focus #1: `duplicate faults are collapsed to one`
  - Review Focus #2: `unknown hostname in a fault → ValidationError`; `tick "abc" → ValidationError`; `history of 10_000 entries → trimmed to the last 60`; `more than 20 faults → ValidationError`
  - `an interface or peer that does not exist on the device → ValidationError`
- [ ] **Step 2: Write the failing poll tests** (fake notifier records the events):
  - `a poll from the initial state returns tick 1, 6 devices, no events`
  - `with bgp-flap on core-rtr-01/10.0.0.2, a bgp-flap alert opens within 4 polls and the notifier receives one 'new' event`
  - `after clearing the fault, the alert resolves within 15 polls once the window drains` (demo config: 60s / 5s = 12-tick window)
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement** `validate.ts`, `poll.ts` and `route.ts`. The route builds the notifier from `process.env.SLACK_WEBHOOK_URL` and the config from `getConfig()`.
- [ ] **Step 5: Run** `npx vitest run`. Expected: all PASS.
- [ ] **Step 6: Smoke test.** Run `npm run dev` in the background, then `curl -s -X POST localhost:3000/api/poll -d '{}' -H 'content-type: application/json'`. Expected: JSON with `"tick":1` and `"slack":"idle"` or `"disabled"`.
- [ ] **Step 7: Commit** `feat: add poll orchestrator and /api/poll route`

---

### Task 7: Dashboard UI

**Files:**
- Create: `components/usePoll.ts`, `components/Header.tsx`, `components/DeviceGrid.tsx`, `components/AlertFeed.tsx`, `components/FaultPanel.tsx`, and a `*.module.css` for each component
- Modify: `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `PollResponse`, `Fault`, `DEVICES`.
- Produces: `usePoll(): { data: PollResponse | null; error: string | null; lastUpdated: Date | null; addFault(f: Fault): void; clearFaults(): void }`. It polls every 5 s with an `inFlight` ref guard (Review Focus #5), keeps the last good data on error, and pauses when `document.hidden`.

UI requirements (spec §4.7):
- **Header:** title, devices up / total, open alerts by severity, Slack badge (sent/idle = "Slack connected", disabled = "Slack off", error = "Slack error"), "Demo mode" label, last-updated time.
- **DeviceGrid:** one card per device with hostname, role, vendor, site, CPU bar, an interface list with up/down dots, and BGP peers with their state. Card border color comes from the worst open alert: none = green, warning = amber, critical = red. The color always comes with a text label, never color alone.
- **AlertFeed:** newest first. Open alerts on top, then resolved alerts dimmed. Each shows severity, rule, device, target, value and tick.
- **FaultPanel:** selects for device → interface or peer, buttons "Spike CPU", "Down interface", "Flap BGP", "Clear all faults", and a list of active faults.
- Error banner when `error` is set. Use semantic HTML, `<button>` elements, and visible focus. Must work at 375 px width. Respect `prefers-color-scheme`.

- [ ] **Step 1: Implement `usePoll`** and the four components, then wire them in `app/page.tsx` (client component).
- [ ] **Step 2: Run** `npx next build`. Expected: succeeds with no type errors.
- [ ] **Step 3: Manual check in the browser pane.** On `npm run dev`, inject each fault type and confirm the card color, the feed entry, and the resolve after clearing.
- [ ] **Step 4: Run** the `web-design-guidelines` skill review on `components/` and `app/`. Fix the findings that matter.
- [ ] **Step 5: Commit** `feat: add dashboard with device grid, alert feed and fault panel`

---

### Task 8: Docs, demo script, final verification

**Files:**
- Create: `README.md`, `docs/STEP-BY-STEP.md`, `docs/DEMO-SCRIPT.md`

- [ ] **Step 1: README.md.** What it is (one paragraph), screenshot placeholder path, quick start (`npm install`, `npm run dev`, `npm test`), env vars, architecture diagram (copy from the spec §3), and known limitations (spec §8).
- [ ] **Step 2: docs/STEP-BY-STEP.md** (Taglish, for the user in VS Code). Cover:
  1. Prerequisites: Node PATH, VS Code extensions (ESLint, Vitest).
  2. Opening the folder.
  3. `npm install`.
  4. `npm test`.
  5. `npm run dev`.
  6. Creating a Slack app with an Incoming Webhook and putting the URL in `.env.local`.
  7. A walk-through of the files in build order (types → simulator → rules → alerts → notify → poll → UI).
  8. Pushing to GitHub. This is the user's own step.
  9. Importing the project in the Vercel dashboard and setting `SLACK_WEBHOOK_URL` and `DEMO_MODE`.
  10. Testing the deployed URL.

  Verify each Vercel and Slack step against the current docs before writing it.
- [ ] **Step 3: Research MSPbots** on their public site (what they sell, who their customers are, what the FDE role entails if a posting is public). Note the sources. Write only claims you verified.
- [ ] **Step 4: docs/DEMO-SCRIPT.md.** Cover:
  - A 5-minute flow: context → healthy fleet → inject BGP flap → Slack ping → explain the rule → clear → resolve → architecture → limitations and next steps.
  - Talking points linking the project to FDE work: taking a real customer workflow, turning it into automation, deploying it fast, and iterating with the customer. Add MSPbots-specific points only from Step 3 sources.
  - Likely interview questions with short answers.
- [ ] **Step 5: Final verification.** Run `npx vitest run` (all pass) and `npx next build` (succeeds). In the browser pane, check each fault type end to end and check that polls don't overlap (network tab shows no concurrent `/api/poll`).
- [ ] **Step 6: Commit** `docs: add README, step-by-step guide and demo script`

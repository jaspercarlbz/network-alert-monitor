# Demo Script and Talking Points (FDE Interview)

> English ang script para direkta mo itong masabi sa interview. Ang mga claim tungkol sa MSPbots ay galing lang sa public homepage nila (mspbots.ai, tiningnan noong 2026-11-07). I-double check bago ang interview, dahil pwedeng nagbago na ang site.

## Before the demo

- [ ] Open the deployed URL (or `npm run dev`) and confirm the fleet shows **6/6 healthy**.
- [ ] Open the Slack channel next to the browser.
- [ ] Check that the Slack badge says **"Slack configured"**. Do one test run first (inject and clear a fault) and confirm the badge turns **"Slack sent OK"**. If it says "Slack error", the webhook URL is wrong.
- [ ] Clear all faults.
- [ ] Have `lib/rules.ts` and `lib/config.ts` ready in VS Code.

---

## 5-minute flow

**0:00 · Context (30s)**
> "In my current role I monitor routers, switches and firewalls. A lot of the work is noticing the same few problems early: CPU running hot, an interface dropping, a BGP session flapping. I built this to show how I'd turn that daily workflow into an automated tool that a team can deploy in an afternoon."

**0:30 · Healthy fleet (30s)**
Point at the fleet health donut, then the device grid.
> "Six simulated devices across HQ and two branches, from mixed vendors, color-coded by role. The donut is the at-a-glance view a NOC wants: how many devices are healthy, warning or critical. Each card has a CPU ring with a tick at the 85% alert threshold. Every five seconds the app polls them and runs three rules."

**1:00 · Inject a BGP flap (60s)**
Select `core-rtr-01` → peer `10.0.0.2` → **Flap BGP**.
> "Let me break something. I'm making this BGP session to AS65002 bounce between Established and Idle."

After about 15 seconds the card turns red, the alert appears, and the Slack message arrives.
> "Three state changes inside the window counts as a flap, so the alert fires. Notice it fires **once**. It doesn't spam the channel every poll, because alerts are deduplicated."

**2:00 · Explain the rule (45s)**
Show `lib/config.ts` and `bgpFlap` in `lib/rules.ts`.
> "Each rule is a small pure function with its own unit tests at the edges: 85% CPU doesn't alert, 86% does; two transitions don't count as a flap, three do. The CPU rule needs three consecutive samples so a single spike doesn't page anyone at 3am."

**2:45 · Clear the fault, then keep talking (15s)**
Click **Clear All Faults**.
> "I've fixed the session. The flap alert won't resolve instantly: it waits until the flaps age out of the 60-second window, so a link that's still unstable doesn't get closed too early. While that drains, here's how it's built."

Resolving takes about 45–60 seconds. Don't wait in silence; go straight to the architecture.

**3:00 · Architecture (60s)**
Show the README diagram.
> "It's one Next.js app on Vercel. The logic is plain TypeScript (simulator, rules, alert lifecycle, notifier), so each piece is tested on its own. The API function is stateless, so the browser carries the state, and the server validates and signs it on every request, so a crafted request can't make it post fake alerts to Slack. If Slack is down or slow, a 3-second timeout means monitoring keeps running."

**4:00 · Point at the resolve (15s)**
By now the card is green again and Slack shows ✅ RESOLVED.
> "There's the resolved message, so the on-call engineer knows they can stand down."

**4:15 · Limits and next steps (45s)**
> "Two things I'd do next. First, swap the simulator for a real collector (SNMP or vendor APIs) that outputs the same data shape, so the rules don't change. Second, move state into a store and run checks on a schedule instead of on dashboard polls, so it monitors even when nobody has the page open."

---

## Linking it to the FDE role

The job is about taking a customer's real workflow, understanding it, and shipping a working tool fast. Points to make:

- **I started from a real workflow I do every day.** I didn't invent a problem; I took one I know well and encoded the judgment I already use: thresholds, debouncing, not paging on a single blip.
- **I shipped something small but complete.** Rules, alerting, a channel the team already uses, and a dashboard, deployed on Vercel with no infrastructure to manage.
- **It's built to adapt to each customer.** All thresholds are in one config file. The notifier is an interface, so a customer on Teams gets a Teams notifier without touching the rules.
- **I know where the edges are.** I can name the limitations and what I'd change for production (state store, scheduled checks, real collectors).
- **I translate between network ops and software.** I can talk to a NOC engineer about BGP and to a developer about pure functions and tests.

### Tying it to MSPbots (verified from their homepage)

What their public site says:
- They describe themselves as "AI-powered automation and insights for MSPs."
- They require a PSA (ConnectWise Manage, Autotask or Halo PSA) and show logos for RMM tools such as NinjaOne, Datto and N-able, plus LogicMonitor and Microsoft Teams.
- They describe **Automation Bots** that act automatically when metrics go off track, **Business Intelligence** dashboards, and **AgentHub**, which turns SOPs into AI-agent workflows and pauses sensitive actions for approval.

Ways to connect this project, phrased as questions or observations rather than claims about their internals:
- "My project is a small version of the same pattern: watch metrics, act when they go off track, and tell people where they already work. That's why the Automation Bots idea clicked for me."
- "MSPs already have monitoring through their RMM and tools like LogicMonitor. The value is in turning those signals into the right action, like a ticket, a Teams message, or a dashboard. I'd like to understand how your customers decide which signals deserve an automation."
- "As an FDE I'd expect to sit with an MSP's service desk, learn which alerts they actually act on, and configure or build bots around that. That's the same thing I did here for my own team's workflow."

> I didn't find a public MSPbots Forward Deployed Engineer posting (I only saw other roles, such as Internal Automations Engineer). Use the details from the actual job post you received.

---

## Likely questions and short answers

**"Why simulate instead of using real devices?"**
> "To keep it safe and portable: no credentials, no network access, and anyone can run it. The simulator outputs the same shape a real collector would, so swapping it in doesn't touch the rules."

**"How do you avoid alert fatigue?"**
> "Three ways: CPU must stay high for three consecutive polls, every alert is deduplicated so it notifies once, and there's an explicit resolved message so people aren't left guessing."

**"What happens if Slack is down?"**
> "The webhook call has a 3-second timeout and its errors are caught. The poll still returns, the dashboard keeps working, and the header shows 'Slack error'."

**"How would this scale to hundreds of devices or many customers?"**
> "Move state to a store keyed by customer, run evaluation on a schedule or queue instead of per browser, and feed it from real collectors. The rule functions stay the same because they only take a history of samples."

**"Why Next.js and Vercel?"**
> "One codebase for the UI and the API, no servers to run, and a preview URL for every change. For a forward-deployed setting, fast iteration with a customer matters more than infrastructure."

**"How did you test it?"**
> "68 unit tests covering threshold edges, the alert lifecycle, input validation, state signing, Slack timeouts and limits, and the chart math. Then I checked each fault type end to end in the browser."

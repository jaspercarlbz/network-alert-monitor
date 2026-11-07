# Step-by-step guide: from VS Code to Vercel

Sundan ang mga hakbang na ito para patakbuhin, intindihin, at i-deploy ang Network Alert Monitor. Ang mga command ay para sa Terminal ng VS Code (**View → Terminal**).

---

## 1. Ihanda ang machine

1. **Node.js.** Naka-install ang Node v24 sa `~/.local/node/bin`. Para mahanap ito ng terminal, idagdag ito sa PATH:

   ```bash
   echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
   ```

   I-check kung gumagana:

   ```bash
   node -v
   ```

2. **VS Code extensions** (opsyonal, pero nakakatulong):
   - **Vitest** (`vitest.explorer`): makikita at mapapatakbo mo ang mga test sa sidebar.
   - **ESLint**: nagha-highlight ng mga problema sa code.

## 2. Buksan ang project

**File → Open Folder…** → piliin ang `Desktop/Automated Alerts Monitoring`.

## 3. I-install ang mga dependency

```bash
npm install
```

## 4. Patakbuhin ang mga test

```bash
npm test
```

Dapat pumasa ang lahat ng 68 test. Ang mga test ang patunay na tama ang mga alert rule, halimbawa na hindi nag-a-alert sa eksaktong 85% CPU pero nag-a-alert sa 86%.

## 5. Patakbuhin ang app

```bash
npm run dev
```

Buksan ang http://localhost:3000. Subukan ang **Inject a Fault**: pumili ng device, pindutin ang **Flap BGP**, at maghintay ng mga 15–20 segundo. Magiging pula ang card at lalabas ang alert. Pindutin ang **Clear All Faults**, at mare-resolve ang mga alert sa loob ng mga isang minuto.

## 6. Ikonekta ang Slack (opsyonal)

1. Pumunta sa https://api.slack.com/apps → **Create New App** → **From scratch**. Bigyan ito ng pangalan (halimbawa "Network Alerts") at piliin ang workspace mo.
2. Sa settings ng app, buksan ang **Incoming Webhooks** at i-on ang **Activate Incoming Webhooks**.
3. Pindutin ang **Add New Webhook to Workspace**, pumili ng channel (mas mabuti kung test channel), at i-**Authorize**.
4. Kopyahin ang webhook URL (`https://hooks.slack.com/services/…`).
5. Sa project, kopyahin ang `.env.example` papuntang `.env.local` at ilagay ang URL:

   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   DEMO_MODE=true
   ```

6. I-restart ang `npm run dev`. Dapat "Slack configured" na ang badge sa header. Magiging "Slack sent OK" ito kapag may unang alert na naipadala. Kung "Slack error", mali ang URL.

> **Paalala:** Secret ang webhook URL. Huwag itong i-commit o i-post. Naka-ignore na ang `.env.local` sa `.gitignore`.

## 7. Intindihin ang code (basahin ayon sa ganitong ayos)

| # | File | Ano ang ginagawa |
|---|---|---|
| 1 | `lib/types.ts` | Lahat ng shared type: `Device`, `Fault`, `DeviceSample`, `Alert`, at iba pa |
| 2 | `lib/config.ts` | Lahat ng threshold sa iisang lugar |
| 3 | `lib/devices.ts` | Ang 6 na mock device |
| 4 | `lib/simulator.ts` | Gumagawa ng CPU, interface, at BGP data bawat tick, kasama ang mga fault |
| 5 | `lib/rules.ts` | Ang tatlong alert rule |
| 6 | `lib/alerts.ts` | Pagbukas, dedupe, at resolve ng mga alert |
| 7 | `lib/notify/slack.ts` | Pagpapadala sa Slack, may 3s timeout |
| 8 | `lib/validate.ts` | Sinusuri ang state na galing sa browser |
| 9 | `lib/poll.ts` | Pinagsasama ang lahat: simulate → rules → alerts → notify |
| 10 | `app/api/poll/route.ts` | Ang API endpoint |
| 11 | `components/usePoll.ts` | Nagpo-poll bawat 5s mula sa browser |
| 12 | `components/*.tsx` | Ang dashboard UI |

Ang katapat na test ng bawat `lib/` file ay nasa `tests/`.

**Para magpalit ng threshold:** baguhin ang `lib/config.ts`, tapos patakbuhin ang `npm test`.

## 8. I-push sa GitHub (ikaw ang gagawa nito)

1. Gumawa ng bagong **empty** repo sa GitHub (walang README).
2. Sa terminal (palitan ang `<user>`):

   ```bash
   git remote add origin https://github.com/<user>/network-alert-monitor.git
   ```

   ```bash
   git push -u origin main
   ```

   Kung nasa ibang branch pa ang trabaho (halimbawa `feat/alert-monitor`), i-merge muna ito sa `main` o i-push ang branch na iyon.

## 9. I-deploy sa Vercel

1. Mag-sign in sa https://vercel.com at pumunta sa **New Project** (https://vercel.com/new).
2. Ikonekta ang GitHub account mo, piliin ang `network-alert-monitor` repo, at pindutin ang **Import**.
3. Awtomatikong makikilala ng Vercel na Next.js ito. Hindi na kailangang baguhin ang build settings.
4. Sa **Environment Variables**, idagdag ang:
   - `SLACK_WEBHOOK_URL`: ang webhook URL mo. Gawin itong **Secret**.
   - `DEMO_MODE`: `true`
5. Pindutin ang **Deploy**.

> Kapag binago mo ang environment variable pagkatapos ng deploy, kailangan mong mag-**Redeploy**. Sa bagong deployment lang gumagana ang mga pagbabago.

**Alternatibo, gamit ang CLI:**

```bash
npm i -g vercel
```

```bash
vercel login
```

```bash
vercel --prod
```

## 10. I-test ang na-deploy na URL

1. Buksan ang URL na binigay ng Vercel.
2. Mag-inject ng **Flap BGP** at hintaying lumabas ang alert sa dashboard at sa Slack.
3. I-clear ito at hintaying may dumating na **RESOLVED** na mensahe.

Kung "Slack error" ang badge, i-check sa Vercel dashboard (**Logs**) ang mensaheng `Slack webhook returned …`.

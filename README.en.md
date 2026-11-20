# AI Pilot — Intelligent monitoring for GPS trackers

🇺🇿 [O'zbekcha](README.md) · 🇬🇧 English

Fleets run GPS trackers, and trackers go silent: connectivity drops, SIM cards fail, devices hang. Existing telematics platforms can raise an alert, but someone has to set it up, watch it and act on it. In practice the fleet manager often finds out days later.

AI Pilot is a **reliability layer on top of existing telematics**. It watches every tracker's heartbeat, detects outages automatically, attempts a remote recovery, escalates to a person when recovery fails, and computes uptime per device.

- **Web monitor:** https://ai-pilot-1-bwm2.onrender.com
- **Mobile app:** https://ai-pilot-1-bwm2.onrender.com/app

> The demo runs on simulated trackers. The backend, diagnostics and Copilot logic are real, tested code. It is hosted on a free tier, so the first load may take up to a minute.

## Mobile app

The owner opens it from a link on the phone. No app store is needed.

- **Fleet at a glance:** how many trackers are online, which one is silent, since when, and which restart attempt is running.
- **One tracker:** a signal timeline and an outage log with the start, duration, restart attempts and outcome.
- **Copilot:** questions and commands in plain words.
- **Three languages:** Uzbek, Russian and English. Switch inside the app, or open `/app?lang=uz`, `/app?lang=ru` or `/app?lang=en`.
- **Install:** on Android (Chrome), use the browser menu to install the app or add it to the Home screen. On iPhone (Safari), tap Share, then Add to Home Screen.

It is a web app served by the same Node.js server. The app itself is kept on the phone, so it opens while the free-tier server is still waking up. Tracker data is never cached.

## Modules

| File | What it does |
| --- | --- |
| `lib.js` | Signal monitoring: ONLINE / DELAYED / OFFLINE state machine, uptime % |
| `diagnostics.js` | Device reliability diagnostics and automatic recovery (restart with cooldown, escalation) |
| `store.js` | Persistent storage on SQLite (`node:sqlite`); history survives a restart |
| `copilot.js` | Copilot: status questions and commands in Uzbek, Russian and English (pattern-based) |
| `server.js` | HTTP backend that ties the modules together |
| `static.js` | The list of files the server may send; nothing else on disk can be requested |
| `mobile.js` | Builds the one summary the mobile app reads (`/api/app/overview`) |
| `app.html`, `sw.js`, `app.webmanifest` | The mobile web app, its offline copy and its install manifest |
| `index.html` | Web monitor and Copilot chat |
| `simulate.js` | Demo tracker simulator (TREKER-3 drops offline on a cycle) |
| `start.js` | Starts the server and the simulator together (demo mode) |

## API

| Request | What it does |
| --- | --- |
| `POST /api/heartbeat` | A tracker reports in: `{ "deviceId": "TREKER-1", "lat": 41.31, "lng": 69.28 }` |
| `GET /api/devices` | Status of every device |
| `GET /api/devices/TREKER-1` | One device in detail |
| `GET /api/diagnostics/risk` | Reliability score and risk level per device |
| `GET /api/diagnostics/log` | Log of restart attempts and escalations |
| `POST /api/diagnostics/check/TREKER-1` | Run the check and recovery for one device now |
| `POST /api/copilot` | Copilot: `{ "query": "which trackers are offline?", "lang": "en" }` |
| `GET /api/app/overview` | Everything the mobile app shows, in one response |

## Running locally

Requires Node.js 22.13 or newer (for `node:sqlite`). No external dependencies.

```bash
npm start        # server + demo simulator: http://localhost:3000 (monitor) and /app (mobile app)
npm run server   # server only, without simulated trackers
npm test         # 112 automated tests in 7 files
```

`PORT` sets the port (3000 by default). The demo uses short timings so that an outage shows within seconds: delayed after 5 s, offline after 15 s, a restart attempt every 20 s, escalation after 3 attempts. They are set in `THRESHOLDS` in `server.js`. The built-in defaults are 5 minutes, 10 minutes and 5 minutes.

## Status

- ✅ Signal monitoring — built, tested
- ✅ Device reliability diagnostics and automatic recovery — built, tested
- ✅ Persistent storage — history is restored after a server restart
- ✅ Copilot (pattern-based; Uzbek, Russian, English) — built, tested
- ✅ Mobile web app (three languages, installs on the phone) — built, checked in Chrome at phone screen sizes
- ⏳ Wialon adapter, alerts, OTA updates, edge AI, LLM backend, security layer — designed, next phase

**Limits of the current version.** The trackers in the demo are simulated. A restart command is recorded by the server; it is not yet delivered to a physical device. The API has no authentication yet, so do not put it on the open internet with real fleet data.

## What has been tested

112 automated tests cover the signal state machine, diagnostics and recovery, storage across a restart, the Copilot in three languages, the list of files the server may send, and the summary the mobile app reads.

Checked by hand:

- An end-to-end run against the HTTP server: two trackers online → one drops offline → automatic restart attempts → escalation → server restarted → full history restored from the database → Copilot answers "which devices are at risk?" correctly.
- The mobile app in Chrome at phone screen sizes: a fleet of 42 trackers, long and non-Latin tracker names, a lost connection, a server that is still waking up.

## Where it fits in the market

In Uzbekistan the dominant telematics platform is Gurtam Wialon, distributed through local integrators (IMG, Stavtrack UZ, GPS Solutions and others). Global leaders — Samsara, Geotab, Verizon Connect, Trimble — offer deep vehicle diagnostics built on millions of vehicles.

Those platforms **analyse the data**. AI Pilot **watches whether the data arrives at all**, and acts when it doesn't. Wialon gives the building blocks; AI Pilot packages them into one recovery layer.

| | Wialon today | AI Pilot |
| --- | --- | --- |
| Connection lost | Alert rule: Telegram, app, e-mail | Every tracker watched; outages logged with duration |
| Root cause | Health check flags the unit; the fix is manual | Reliability score per tracker; repeat offenders flagged |
| Recovery | One command can be attached to an alert | Restart attempts with cooldown, then escalation to a person |
| Reporting | Reports and tables | Phone app and Copilot in three languages; uptime per tracker |
| Setup | Configured by the integrator, rule by rule | One layer on top; nothing to replace |

The closest analogue is Navixy's device-health automation (auto-reboot, escalation), which works inside the Navixy platform. AI Pilot brings this to fleets that stay on Wialon.

## Integration with existing systems

AI Pilot replaces nothing. Three ways to connect:

1. **Wialon Remote API** — token login, `core/search_items` and `unit/calc_last_message` give per-device last-seen times.
2. **Wialon retranslator** — messages are forwarded to our endpoint as they arrive, in real time.
3. **Secondary server on the tracker** — Teltonika-class devices send to two servers at once; the existing platform is untouched.

In the code this is one adapter: status data currently enters through `/api/heartbeat`; integration swaps that source for Wialon. Monitoring, diagnostics and Copilot logic stay unchanged.

## Roadmap

1. Wialon API adapter and a pilot with a local integrator on a real fleet
2. Operations automation: work orders on escalation, alerts, monthly "fleet actually monitored" report
3. Device layer: module-based prototype, dual-SIM failover, offline buffer, OTA with rollback
4. LLM backend for the Copilot; production database (PostgreSQL + TimescaleDB)

We deliberately do not build vehicle diagnostics — that market belongs to platforms with millions of vehicles of training data. We deepen the reliability layer instead.

## License

The code is under the MIT license, see [LICENSE](LICENSE). The app includes the Sofia Sans typeface under the SIL Open Font License 1.1, see [font-license.txt](font-license.txt).

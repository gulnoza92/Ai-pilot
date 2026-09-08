# AI Pilot — Intelligent monitoring for GPS trackers

🇺🇿 [O'zbekcha](README.md) · 🇬🇧 English

Fleets run GPS trackers, and trackers go silent: connectivity drops, SIM cards fail, devices hang. Existing telematics platforms show "no signal" — but among hundreds of devices nobody is watching, and the fleet manager often finds out days later.

AI Pilot is a **reliability layer on top of existing telematics**. It watches every tracker's heartbeat, detects outages automatically, attempts a remote recovery, escalates to a person when recovery fails, and computes uptime per device.

**Live demo:** https://ai-pilot-1-bwm2.onrender.com

> The demo runs on simulated trackers. The backend, diagnostics and Copilot logic are real, tested code. It is hosted on a free tier, so the first load may take 30–40 seconds.

## Modules

| File | What it does |
| --- | --- |
| `lib.js` | Signal monitoring: ONLINE / DELAYED / OFFLINE state machine, uptime % |
| `diagnostics.js` | Device reliability diagnostics and automatic recovery (restart with cooldown, escalation) |
| `store.js` | Persistent storage on SQLite (`node:sqlite`) — history survives a restart |
| `copilot.js` | AI Copilot: natural-language status queries and agentic commands |
| `server.js` | HTTP backend that ties the modules together |
| `simulate.js` | Demo tracker simulator (TREKER-3 drops offline on a cycle) |
| `index.html` | Dashboard and Copilot chat |
| `start.js` | Starts the server and the simulator together |

## Running locally

Requires Node.js 22.13 or newer (for `node:sqlite`). No external dependencies.

```bash
npm start        # server + demo simulator → http://localhost:3000
npm run server   # server only
npm test         # 34 unit tests
```

## Status

- ✅ Signal monitoring — built, tested
- ✅ Device reliability diagnostics and automatic recovery — built, tested
- ✅ Persistent storage — history is restored after a server restart
- ✅ AI Copilot (pattern-based) — built, tested
- ⏳ OTA updates, edge AI, LLM backend, security layer — designed, next phase

## What has been tested

34 automated tests plus a manual end-to-end run against the HTTP server: two trackers online → one drops offline → automatic restart attempts → escalation → server restarted → full history restored from the database → Copilot answers "which devices are at risk?" correctly.

## Where it fits in the market

In Uzbekistan the dominant telematics platform is Gurtam Wialon, distributed through local integrators (IMG, Stavtrack UZ, GPS Solutions and others). Global leaders — Samsara, Geotab, Verizon Connect, Trimble — offer deep vehicle diagnostics built on millions of vehicles.

Those platforms **analyse the data**. AI Pilot **watches whether the data arrives at all**, and acts when it doesn't.

| | Existing platforms | AI Pilot |
| --- | --- | --- |
| Connection lost | Shown on the dashboard | Detected automatically, timestamped |
| Root cause | Operator investigates by hand | Pattern-based device diagnosis |
| Recovery | Manual — a call, a field visit | Automatic restart attempt, then escalation |
| Reporting | Tables and filters | Plain-language questions to the Copilot; uptime per device |

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

MIT

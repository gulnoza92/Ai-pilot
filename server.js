/**
 * AI Pilot — Backend prototipi
 * ------------------------------------------------------------
 * To'rt modulni birlashtiradi:
 *   1) Signal Holati Monitoring (lib.js)      — heartbeat, onlayn/offlayn holat
 *   2) Bashoratli diagnostika + Avtomatik davolash (diagnostics.js)
 *   3) SQLite orqali doimiy saqlash (store.js) — server qayta ishga tushsa ham ma'lumot yo'qolmaydi
 *   4) AI Copilot (copilot.js)                — tabiiy tilda savol-javob va amal (agentic)
 *
 * Faqat Node.js ichki modullari bilan yozilgan — tashqi kutubxona shart emas.
 *
 * Ishga tushirish:   node server.js
 * Sinov uchun:        node simulate.js   (boshqa terminalda)
 * Dashboard:          http://localhost:3000
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { createTracker } = require("./lib");
const { createDiagnostics } = require("./diagnostics");
const { createSqliteStore } = require("./store");
const { createCopilot } = require("./copilot");
const { resolvePublicFile } = require("./static");
const { buildOverview } = require("./mobile");

// ---- Sozlamalar (demo uchun soniyalarda; production'da daqiqalarga o'zgartiriladi) ----
// One place for the thresholds: the monitoring loop and the mobile app read the same values.
const THRESHOLDS = { delayMs: 5 * 1000, offlineMs: 15 * 1000, retryIntervalMs: 20 * 1000, maxAttempts: 3 };
// start.js sets AIPILOT_DEMO=1 when it launches the simulator; the mobile app then shows a "demo" note.
const DEMO = process.env.AIPILOT_DEMO === "1";

const store = createSqliteStore(path.join(__dirname, "aipilot.db"));
const tracker = createTracker({ delayMs: THRESHOLDS.delayMs, offlineMs: THRESHOLDS.offlineMs, store });
const diagnostics = createDiagnostics(tracker, { retryIntervalMs: THRESHOLDS.retryIntervalMs, maxAttempts: THRESHOLDS.maxAttempts });
const copilot = createCopilot(tracker, diagnostics);

const startedWith = tracker.all().length;
if (startedWith > 0) {
  console.log(`Bazadan ${startedWith} ta qurilma tiklandi (oldingi seansdan).`);
}

// Har 5 soniyada barcha qurilmalarni avtomatik tekshirib, kerak bo'lsa
// "qayta ishga tushirish" buyrug'ini yuboradi (auto-remediation loop).
setInterval(() => {
  const actions = diagnostics.checkAll();
  for (const a of actions) {
    if (a.action === "restart_yuborildi") {
      console.log(`[AUTO-REMEDIATION] ${a.deviceId} -> qayta ishga tushirish buyurildi (urinish #${a.attempt})`);
    } else if (a.action === "eskalatsiya") {
      console.log(`[AUTO-REMEDIATION] ${a.deviceId} -> ${a.attempts} urinishdan keyin ham tuzalmadi, dispetcherga eskalatsiya qilindi`);
    }
  }
}, 5000);

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

// Only the files listed in static.js are served (web monitor + mobile app).
// The database, the source code and paths with "../" get a 404.
function serveStatic(req, res) {
  const file = req.method === "GET" || req.method === "HEAD" ? resolvePublicFile(req.url, __dirname) : null;
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  fs.readFile(file.filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": file.contentType,
      "Content-Length": data.length,
      "Cache-Control": file.cacheControl,
      "X-Content-Type-Options": "nosniff",
      "X-AI-Pilot": "1", // lets the app's service worker tell our pages from a hosting "waking up" page
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // 1) Qurilmadan heartbeat qabul qilish
  if (req.method === "POST" && req.url === "/api/heartbeat") {
    try {
      const raw = await readBody(req);
      const { deviceId, lat, lng } = JSON.parse(raw || "{}");
      if (!deviceId) return sendJson(res, 400, { error: "deviceId majburiy" });

      const location = lat != null && lng != null ? { lat, lng } : null;
      const device = tracker.heartbeat(deviceId, location);

      return sendJson(res, 200, { ok: true, deviceId, receivedAt: device.lastSeen });
    } catch (e) {
      return sendJson(res, 400, { error: "noto'g'ri so'rov: " + e.message });
    }
  }

  // 2) Barcha qurilmalar holati
  if (req.method === "GET" && req.url === "/api/devices") {
    const list = tracker.all().map((d) => ({
      ...d,
      secondsSinceLastSeen: d.lastSeen ? Math.round((Date.now() - d.lastSeen) / 1000) : null,
    }));
    return sendJson(res, 200, { generatedAt: Date.now(), devices: list });
  }

  // 3) Bitta qurilma bo'yicha batafsil: /api/devices/TREKER-1
  if (req.method === "GET" && req.url.startsWith("/api/devices/")) {
    const id = decodeURIComponent(req.url.split("/api/devices/")[1]);
    const snap = tracker.snapshot(id);
    if (!snap) return sendJson(res, 404, { error: "topilmadi" });
    return sendJson(res, 200, snap);
  }

  // 4) Bashoratli diagnostika — barcha qurilmalarning ishonchlilik balli
  if (req.method === "GET" && req.url === "/api/diagnostics/risk") {
    return sendJson(res, 200, { generatedAt: Date.now(), report: diagnostics.riskReport() });
  }

  // 5) Avtomatik davolash — amallar tarixi (log)
  if (req.method === "GET" && req.url === "/api/diagnostics/log") {
    return sendJson(res, 200, { generatedAt: Date.now(), log: diagnostics.getLog() });
  }

  // 6) Bitta qurilmani qo'lda tekshirish/davolashni ishga tushirish
  if (req.method === "POST" && req.url.startsWith("/api/diagnostics/check/")) {
    const id = decodeURIComponent(req.url.split("/api/diagnostics/check/")[1]);
    const result = diagnostics.checkAndRemediate(id);
    return sendJson(res, 200, result);
  }

  // 7) AI Copilot — tabiiy tilda savol-javob va amal (agentic)
  if (req.method === "POST" && req.url === "/api/copilot") {
    try {
      const raw = await readBody(req);
      // lang ("uz" | "ru" | "en") is optional: the mobile app sends its interface language.
      const { query, lang } = JSON.parse(raw || "{}");
      if (!query) return sendJson(res, 400, { error: "query majburiy" });
      const answer = copilot.answer(String(query), lang);
      return sendJson(res, 200, { query, answer });
    } catch (e) {
      return sendJson(res, 400, { error: "noto'g'ri so'rov: " + e.message });
    }
  }

  // 8) Mobil ilova uchun bitta ixcham javob (mobile.js)
  if (req.method === "GET" && req.url.split("?")[0] === "/api/app/overview") {
    return sendJson(res, 200, buildOverview(tracker, diagnostics, { thresholds: THRESHOLDS, demo: DEMO }));
  }

  // 9) Statik fayllar (dashboard + mobil ilova)
  return serveStatic(req, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`AI Pilot backend http://localhost:${PORT} portida ishga tushdi`);
  console.log(`Mobil ilova (telefon uchun): http://localhost:${PORT}/app`);
  console.log(`Signal Monitoring: /api/heartbeat, /api/devices`);
  console.log(`Bashoratli diagnostika: /api/diagnostics/risk, /api/diagnostics/log`);
  console.log(`AI Copilot: POST /api/copilot { "query": "..." }`);
});

process.on("SIGINT", () => {
  console.log("\nServer to'xtatilmoqda, baza yopilmoqda...");
  store.close();
  process.exit(0);
});

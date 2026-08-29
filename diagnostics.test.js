/**
 * Bashoratli diagnostika va avtomatik davolash moduli uchun testlar.
 * Real vaqt kutmasdan, soxta soat (fake clock) bilan ishlaydi.
 *
 * Ishga tushirish: node diagnostics.test.js
 */
const { createTracker } = require("./lib");
const { createDiagnostics } = require("./diagnostics");

let fakeNow = 0;
const clock = () => fakeNow;

const tracker = createTracker({ delayMs: 5000, offlineMs: 15000, clock });
const diag = createDiagnostics(tracker, { retryIntervalMs: 10000, maxAttempts: 3, clock });

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✅ OK:", msg);
  }
}

// --- Ishonchlilik balli testi ---
tracker.heartbeat("STABIL-1");
let report = diag.riskReport();
assert(report[0].reliabilityScore === 100, "Hech qanday uzilishsiz qurilma balli 100 bo'lishi kerak, oldi: " + report[0].reliabilityScore);
assert(report[0].risk === "BARQAROR", "Yangi qurilma BARQAROR deb belgilanishi kerak");

// --- Avtomatik davolash: hali ONLAYN bo'lganda hech narsa qilmasligi kerak ---
let action = diag.checkAndRemediate("STABIL-1");
assert(action.action === "kerak_emas", "ONLAYN qurilma uchun hech qanday amal bajarilmasligi kerak, oldi: " + action.action);

// --- Qurilma offlaynga o'tadi ---
tracker.heartbeat("NOSOZ-1");
fakeNow += 20000; // 15s threshold'dan o'tdi -> OFFLAYN
let snap = tracker.snapshot("NOSOZ-1");
assert(snap.status === "OFFLAYN", "NOSOZ-1 endi OFFLAYN bo'lishi kerak");

// 1-urinish: darhol restart yuborilishi kerak
action = diag.checkAndRemediate("NOSOZ-1");
assert(action.action === "restart_yuborildi" && action.attempt === 1, "1-chi restart urinishi darhol yuborilishi kerak, oldi: " + JSON.stringify(action));

// darhol qayta tekshirsak — kutish rejimida bo'lishi kerak (cooldown)
action = diag.checkAndRemediate("NOSOZ-1");
assert(action.action === "kutish_rejimi", "Cooldown ichida qayta urinmasligi kerak, oldi: " + action.action);

// 10s o'tdi -> 2-chi urinish
fakeNow += 10000;
action = diag.checkAndRemediate("NOSOZ-1");
assert(action.action === "restart_yuborildi" && action.attempt === 2, "2-chi urinish bo'lishi kerak, oldi: " + JSON.stringify(action));

// yana 10s -> 3-chi urinish
fakeNow += 10000;
action = diag.checkAndRemediate("NOSOZ-1");
assert(action.action === "restart_yuborildi" && action.attempt === 3, "3-chi urinish bo'lishi kerak, oldi: " + JSON.stringify(action));

// yana 10s -> endi MAX_ATTEMPTS (3) ga yetdi -> eskalatsiya
fakeNow += 10000;
action = diag.checkAndRemediate("NOSOZ-1");
assert(action.action === "eskalatsiya", "3 urinishdan keyin eskalatsiya bo'lishi kerak, oldi: " + JSON.stringify(action));

// eskalatsiyadan keyin qayta so'ralsa ham eskalatsiya holatida qolishi kerak (spam qilmaydi)
action = diag.checkAndRemediate("NOSOZ-1");
assert(action.action === "eskalatsiya_qilingan", "Eskalatsiyadan keyin holat saqlanishi kerak, oldi: " + action.action);

// log'da barcha urinishlar qayd etilganini tekshiramiz
const log = diag.getLog();
const restartEntries = log.filter((l) => l.deviceId === "NOSOZ-1" && l.action === "QAYTA_ISHGA_TUSHIRISH_YUBORILDI");
assert(restartEntries.length === 3, "Logda 3 ta restart urinishi yozilgan bo'lishi kerak, oldi: " + restartEntries.length);
const escalations = log.filter((l) => l.deviceId === "NOSOZ-1" && l.action === "ESKALATSIYA_INSONGA");
assert(escalations.length === 1, "Logda 1 ta eskalatsiya yozuvi bo'lishi kerak, oldi: " + escalations.length);

// --- Qurilma tuzalganda: yangi uzilish alohida hisoblanishi kerak ---
tracker.heartbeat("NOSOZ-1"); // signal qaytdi
snap = tracker.snapshot("NOSOZ-1");
assert(snap.status === "ONLAYN", "Signal qaytgach ONLAYN bo'lishi kerak");

report = diag.riskReport();
const noszReport = report.find((r) => r.deviceId === "NOSOZ-1");
assert(noszReport.episodeCount === 1 && noszReport.risk !== "BARQAROR", "1 marta uzilgan qurilma endi BARQAROR bo'lmasligi kerak, oldi: " + noszReport.risk);

console.log("\nBarcha diagnostika testlari yakunlandi.");

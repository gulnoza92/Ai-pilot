/**
 * Soxta soat (fake clock) bilan tezkor test — real vaqt kutmasdan
 * ONLAYN -> KECHIKISH -> OFFLAYN -> qayta ONLAYN o'tishlarini va
 * uptime % hisobini tekshiradi.
 *
 * Ishga tushirish: node test.js
 */
const { createTracker } = require("./lib");

let fakeNow = 0;
const clock = () => fakeNow;

const tracker = createTracker({ delayMs: 5000, offlineMs: 15000, clock });

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✅ OK:", msg);
  }
}

// t=0: birinchi signal
tracker.heartbeat("TREKER-9", { lat: 41.3, lng: 69.2 });
let snap = tracker.snapshot("TREKER-9");
assert(snap.status === "ONLAYN", "t=0s da holat ONLAYN bo'lishi kerak, oldi: " + snap.status);

// t=3s: hali ONLAYN bo'lishi kerak (threshold 5s)
fakeNow += 3000;
snap = tracker.snapshot("TREKER-9");
assert(snap.status === "ONLAYN", "t=3s da holat ONLAYN bo'lishi kerak, oldi: " + snap.status);

// t=7s: KECHIKISH bo'lishi kerak (5s < 7s <= 15s)
fakeNow += 4000; // jami 7s
snap = tracker.snapshot("TREKER-9");
assert(snap.status === "KECHIKISH", "t=7s da holat KECHIKISH bo'lishi kerak, oldi: " + snap.status);

// t=20s: OFFLAYN bo'lishi kerak (>15s)
fakeNow += 13000; // jami 20s
snap = tracker.snapshot("TREKER-9");
assert(snap.status === "OFFLAYN", "t=20s da holat OFFLAYN bo'lishi kerak, oldi: " + snap.status);
assert(snap.downPeriods.length === 1 && snap.downPeriods[0].end === null, "downPeriods'da 1 ta ochiq davr bo'lishi kerak");

// t=25s: qayta signal keladi -> ONLAYNga qaytadi, down-davr yopiladi
fakeNow += 5000; // jami 25s
tracker.heartbeat("TREKER-9", { lat: 41.3, lng: 69.2 });
snap = tracker.snapshot("TREKER-9");
assert(snap.status === "ONLAYN", "t=25s da qayta signal kelgach ONLAYN bo'lishi kerak, oldi: " + snap.status);
assert(snap.downPeriods[0].end !== null, "qaytgach down-davr yopilishi kerak (end != null)");

// uptime % mantiqiy oraliqda bo'lishi kerak (0-100)
assert(snap.uptimePercent > 0 && snap.uptimePercent <= 100, "uptimePercent 0-100 oralig'ida bo'lishi kerak, oldi: " + snap.uptimePercent);
console.log("Hisoblangan uptime:", snap.uptimePercent + "%", "(kutilgan taxminan ~65-75% oralig'ida, chunki 25s dan 15s offlayn bo'lgan)");

// Ikkinchi qurilma — hech qachon signal yubormagan
snap = tracker.snapshot("YO'Q-QURILMA");
assert(snap === null, "mavjud bo'lmagan qurilma uchun null qaytishi kerak");

console.log("\nBarcha testlar yakunlandi.");

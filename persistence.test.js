/**
 * SQLite orqali doimiy saqlashni tekshiradi: server "qayta ishga tushganda"
 * (yangi tracker + eski baza fayli bilan) qurilma holati yo'qolmasligi kerak.
 *
 * Ishga tushirish: node persistence.test.js
 */
const fs = require("fs");
const path = require("path");
const { createTracker } = require("./lib");
const { createSqliteStore } = require("./store");

const DB_PATH = path.join(__dirname, "test-persistence.db");
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✅ OK:", msg);
  }
}

let fakeNow = 0;
const clock = () => fakeNow;

// ---- 1-"seans": server birinchi marta ishga tushdi ----
let store = createSqliteStore(DB_PATH);
let tracker = createTracker({ delayMs: 5000, offlineMs: 15000, clock, store });

tracker.heartbeat("PERSIST-1", { lat: 41.3, lng: 69.2 });
fakeNow += 3000;
tracker.heartbeat("PERSIST-1", { lat: 41.3, lng: 69.2 });

// PERSIST-2 ni offlaynga tushiramiz (down-davr yozilishi kerak)
tracker.heartbeat("PERSIST-2", { lat: 40.1, lng: 65.3 });
fakeNow += 20000; // 15s threshold'dan o'tdi
let snap = tracker.snapshot("PERSIST-2");
assert(snap.status === "OFFLAYN", "1-seansda PERSIST-2 OFFLAYN bo'lishi kerak");
assert(snap.downPeriods.length === 1, "1-seansda 1 ta down-davr yozilgan bo'lishi kerak");

// "Server o'chdi" — bazani yopamiz
store.close();

// ---- 2-"seans": server qayta ishga tushdi, xotira bo'sh, lekin baza bor ----
let store2 = createSqliteStore(DB_PATH);
let tracker2 = createTracker({ delayMs: 5000, offlineMs: 15000, clock, store: store2 });

const revived1 = tracker2.snapshot("PERSIST-1");
assert(revived1 !== null, "Qayta ishga tushgach PERSIST-1 bazadan tiklanishi kerak");
assert(revived1.totalBeats === 2, "PERSIST-1'ning totalBeats soni saqlanishi kerak (2), oldi: " + revived1?.totalBeats);

const revived2 = tracker2.snapshot("PERSIST-2");
assert(revived2 !== null, "Qayta ishga tushgach PERSIST-2 bazadan tiklanishi kerak");
assert(revived2.status === "OFFLAYN", "PERSIST-2'ning OFFLAYN holati saqlanishi kerak, oldi: " + revived2?.status);
assert(revived2.downPeriods.length === 1, "PERSIST-2'ning down-davri saqlanishi kerak");

// 2-seansda qayta signal kelsa, tiklanishi kerak
tracker2.heartbeat("PERSIST-2", { lat: 40.1, lng: 65.3 });
const revivedAfterHeartbeat = tracker2.snapshot("PERSIST-2");
assert(revivedAfterHeartbeat.status === "ONLAYN", "Qayta signal kelgach ONLAYNga qaytishi kerak");
assert(revivedAfterHeartbeat.downPeriods[0].end !== null, "Down-davr yopilgan bo'lishi kerak");

store2.close();
fs.unlinkSync(DB_PATH); // test bazasini tozalaymiz

console.log("\nBarcha persistence testlari yakunlandi.");

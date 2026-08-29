/**
 * AI Pilot — SQLite orqali doimiy saqlash
 * ------------------------------------------------------------
 * Node.js'ning ichki `node:sqlite` moduli (Node 22.5+) ishlatiladi —
 * tashqi kutubxona (better-sqlite3 va h.k.) shart emas.
 *
 * Bu qatlam lib.js'dagi `devices` xotirasini fayl(baza)ga aks ettiradi,
 * shunda server qayta ishga tushganda ma'lumot yo'qolmaydi.
 */

const { DatabaseSync } = require("node:sqlite");

function createSqliteStore(dbPath = "./aipilot.db") {
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      deviceId TEXT PRIMARY KEY,
      firstSeen INTEGER,
      lastSeen INTEGER,
      totalBeats INTEGER,
      lastLat REAL,
      lastLng REAL,
      currentlyDown INTEGER,
      downSince INTEGER
    );
    CREATE TABLE IF NOT EXISTS down_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId TEXT,
      start INTEGER,
      end INTEGER,
      escalated INTEGER DEFAULT 0,
      remediationAttempts TEXT
    );
  `);

  const upsertDeviceStmt = db.prepare(`
    INSERT INTO devices (deviceId, firstSeen, lastSeen, totalBeats, lastLat, lastLng, currentlyDown, downSince)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(deviceId) DO UPDATE SET
      lastSeen = excluded.lastSeen,
      totalBeats = excluded.totalBeats,
      lastLat = excluded.lastLat,
      lastLng = excluded.lastLng,
      currentlyDown = excluded.currentlyDown,
      downSince = excluded.downSince
  `);
  const deleteDownPeriodsStmt = db.prepare(`DELETE FROM down_periods WHERE deviceId = ?`);
  const insertDownPeriodStmt = db.prepare(`
    INSERT INTO down_periods (deviceId, start, end, escalated, remediationAttempts)
    VALUES (?, ?, ?, ?, ?)
  `);
  const allDevicesStmt = db.prepare(`SELECT * FROM devices`);
  const periodsForDeviceStmt = db.prepare(`SELECT * FROM down_periods WHERE deviceId = ? ORDER BY id`);

  // Bitta qurilmaning to'liq holatini yozadi (qurilma + uning down-davrlari).
  // Prototip miqyosi kichik bo'lgani uchun down_periods'ni sodda tarzda
  // o'chirib-qayta yozamiz — production'da faqat farqni yangilash tavsiya etiladi.
  function upsertDevice(device) {
    upsertDeviceStmt.run(
      device.deviceId,
      device.firstSeen,
      device.lastSeen,
      device.totalBeats,
      device.lastLocation ? device.lastLocation.lat : null,
      device.lastLocation ? device.lastLocation.lng : null,
      device.currentlyDown ? 1 : 0,
      device.downSince
    );
    deleteDownPeriodsStmt.run(device.deviceId);
    for (const p of device.downPeriods) {
      insertDownPeriodStmt.run(
        device.deviceId,
        p.start,
        p.end,
        p.escalated ? 1 : 0,
        JSON.stringify(p.remediationAttempts || [])
      );
    }
  }

  // Barcha qurilmalarni bazadan o'qib, lib.js kutgan shaklda qaytaradi
  // (createTracker() ishga tushganda xotirani "isitish" uchun).
  function loadAll() {
    const result = {};
    for (const row of allDevicesStmt.all()) {
      const periods = periodsForDeviceStmt.all(row.deviceId);
      result[row.deviceId] = {
        deviceId: row.deviceId,
        firstSeen: row.firstSeen,
        lastSeen: row.lastSeen,
        totalBeats: row.totalBeats,
        lastLocation: row.lastLat != null ? { lat: row.lastLat, lng: row.lastLng } : null,
        currentlyDown: !!row.currentlyDown,
        downSince: row.downSince,
        downPeriods: periods.map((p) => ({
          start: p.start,
          end: p.end,
          escalated: !!p.escalated,
          remediationAttempts: JSON.parse(p.remediationAttempts || "[]"),
        })),
      };
    }
    return result;
  }

  function close() {
    db.close();
  }

  return { upsertDevice, loadAll, close };
}

module.exports = { createSqliteStore };

/**
 * AI Pilot — Signal Holati Monitoring: sof mantiq (Edge/Server umumiy qismi)
 * HTTP'dan mustaqil — shuning uchun oson test qilinadi.
 */

function createTracker(config = {}) {
  const DELAY_THRESHOLD_MS = config.delayMs ?? 5 * 60 * 1000;     // default 5 daqiqa
  const OFFLINE_THRESHOLD_MS = config.offlineMs ?? 10 * 60 * 1000; // default 10 daqiqa
  const clock = config.clock ?? (() => Date.now());
  const store = config.store ?? null; // ixtiyoriy: store.js dan createSqliteStore(...)

  // Agar store berilgan bo'lsa, oldingi seansdan qolgan qurilmalarni yuklaymiz
  const devices = store ? store.loadAll() : {};

  function persist(device) {
    if (store) store.upsertDevice(device);
  }

  function getOrCreateDevice(deviceId) {
    if (!devices[deviceId]) {
      devices[deviceId] = {
        deviceId,
        firstSeen: clock(),
        lastSeen: null,
        totalBeats: 0,
        downPeriods: [],
        currentlyDown: false,
        downSince: null,
        lastLocation: null,
      };
    }
    return devices[deviceId];
  }

  function computeStatus(device) {
    if (device.lastSeen === null || device.lastSeen === undefined) return "NOMA'LUM";
    const diff = clock() - device.lastSeen;
    if (diff <= DELAY_THRESHOLD_MS) return "ONLAYN";
    if (diff <= OFFLINE_THRESHOLD_MS) return "KECHIKISH";
    return "OFFLAYN";
  }

  function computeUptime(device) {
    const totalWindow = clock() - device.firstSeen;
    if (totalWindow <= 0) return 100;
    let downMs = 0;
    for (const p of device.downPeriods) {
      downMs += (p.end || clock()) - p.start;
    }
    const uptime = ((totalWindow - downMs) / totalWindow) * 100;
    return Math.max(0, Math.min(100, uptime));
  }

  function reconcileStatus(device) {
    const status = computeStatus(device);
    const isDown = status === "OFFLAYN";

    if (isDown && !device.currentlyDown) {
      device.currentlyDown = true;
      device.downSince = device.lastSeen + OFFLINE_THRESHOLD_MS;
      device.downPeriods.push({ start: device.downSince, end: null });
      persist(device);
    } else if (!isDown && device.currentlyDown) {
      device.currentlyDown = false;
      const last = device.downPeriods[device.downPeriods.length - 1];
      if (last && last.end === null) last.end = clock();
      device.downSince = null;
      persist(device);
    }
    return status;
  }

  function heartbeat(deviceId, location) {
    const device = getOrCreateDevice(deviceId);
    reconcileStatus(device);
    device.lastSeen = clock();
    device.totalBeats += 1;
    if (location) device.lastLocation = location;
    reconcileStatus(device);
    persist(device);
    return device;
  }

  function snapshot(deviceId) {
    const d = devices[deviceId];
    if (!d) return null;
    const status = reconcileStatus(d);
    return {
      deviceId: d.deviceId,
      status,
      lastSeen: d.lastSeen,
      uptimePercent: Number(computeUptime(d).toFixed(2)),
      totalBeats: d.totalBeats,
      downPeriods: d.downPeriods.map((p) => ({ ...p })),
    };
  }

  function all() {
    return Object.keys(devices).map((id) => snapshot(id));
  }

  function getRaw(deviceId) {
    return devices[deviceId] || null;
  }

  function persistById(deviceId) {
    const d = devices[deviceId];
    if (d) persist(d);
  }

  return { heartbeat, snapshot, all, getRaw, persistById, _devices: devices };
}

module.exports = { createTracker };

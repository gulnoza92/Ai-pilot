/**
 * AI Pilot — data for the mobile app
 * ------------------------------------------------------------
 * One compact answer for the phone instead of three separate requests:
 * every tracker with its status, reliability score, last position and the
 * outages that fall inside the time window the app draws.
 *
 * Built on top of lib.js (createTracker) and diagnostics.js. Pure logic,
 * no HTTP — easy to test (mobile.test.js).
 */

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

function cleanLocation(loc) {
  if (!loc) return null;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * @param tracker      createTracker(...) instance
 * @param diagnostics  createDiagnostics(...) instance
 * @param opts.thresholds {delayMs, offlineMs, retryIntervalMs, maxAttempts} — the values the server runs with
 * @param opts.demo        true when the trackers are simulated
 * @param opts.windowMs    how far back outages are listed (default: 10 min for
 *                         second-scale demo thresholds, otherwise 24 h)
 * @param opts.maxIncidents cap per tracker (default 120)
 * @param opts.clock       () => ms, for tests
 */
function buildOverview(tracker, diagnostics, opts = {}) {
  const now = (opts.clock || Date.now)();
  const thresholds = {
    delayMs: opts.thresholds?.delayMs ?? 5 * 60 * 1000,
    offlineMs: opts.thresholds?.offlineMs ?? 10 * 60 * 1000,
    retryIntervalMs: opts.thresholds?.retryIntervalMs ?? 5 * 60 * 1000,
    maxAttempts: opts.thresholds?.maxAttempts ?? 3,
  };
  const windowMs = opts.windowMs ?? (thresholds.offlineMs < 60 * 1000 ? TEN_MINUTES : ONE_DAY);
  const maxIncidents = opts.maxIncidents ?? 120;
  const windowStart = now - windowMs;

  const devices = tracker.all().map((snap) => {
    const raw = tracker.getRaw(snap.deviceId) || {};
    const score = diagnostics.reliabilityScore(snap);
    const incidents = snap.downPeriods
      .filter((p) => p.end == null || p.end >= windowStart)
      .slice(-maxIncidents)
      .map((p) => ({
        start: p.start,
        end: p.end ?? null,
        escalated: !!p.escalated,
        attempts: Array.isArray(p.remediationAttempts) ? p.remediationAttempts.slice() : [],
      }));

    return {
      deviceId: snap.deviceId,
      status: snap.status,
      lastSeen: snap.lastSeen ?? null,
      firstSeen: raw.firstSeen ?? null,
      uptimePercent: snap.uptimePercent,
      totalBeats: snap.totalBeats,
      reliabilityScore: score,
      risk: diagnostics.riskLevel(score),
      incidentCount: snap.downPeriods.length,
      lastLocation: cleanLocation(raw.lastLocation),
      incidents,
    };
  });

  return { generatedAt: now, demo: !!opts.demo, thresholds, windowMs, devices };
}

module.exports = { buildOverview, cleanLocation };

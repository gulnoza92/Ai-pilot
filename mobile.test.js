/**
 * Tests for the mobile-app overview (mobile.js).
 * Uses a fake clock, like the other tests — no real waiting.
 *
 * Run: node mobile.test.js
 */
const { createTracker } = require("./lib");
const { createDiagnostics } = require("./diagnostics");
const { buildOverview, cleanLocation } = require("./mobile");

let fakeNow = 0;
const clock = () => fakeNow;

const THRESHOLDS = { delayMs: 5000, offlineMs: 15000, retryIntervalMs: 20000, maxAttempts: 3 };
const tracker = createTracker({ delayMs: THRESHOLDS.delayMs, offlineMs: THRESHOLDS.offlineMs, clock });
const diag = createDiagnostics(tracker, { retryIntervalMs: THRESHOLDS.retryIntervalMs, maxAttempts: THRESHOLDS.maxAttempts, clock });
const overview = (extra = {}) => buildOverview(tracker, diag, { thresholds: THRESHOLDS, demo: true, clock, ...extra });
const byId = (o, id) => o.devices.find((d) => d.deviceId === id);

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✅ OK:", msg);
  }
}

// t=0: two trackers report, one of them with a position
tracker.heartbeat("TREKER-A", { lat: 41.311, lng: 69.279 });
tracker.heartbeat("TREKER-B");
let o = overview();
assert(o.generatedAt === 0 && o.demo === true, "the answer carries the server time and the demo flag");
assert(o.thresholds.offlineMs === 15000 && o.thresholds.maxAttempts === 3, "the thresholds the server runs with are passed on");
assert(o.windowMs === 10 * 60 * 1000, "second-scale (demo) thresholds give a 10-minute window, got: " + o.windowMs);
assert(o.devices.length === 2, "both trackers are listed");
assert(byId(o, "TREKER-A").status === "ONLAYN" && byId(o, "TREKER-A").incidents.length === 0, "a fresh tracker is online with no outages");
assert(byId(o, "TREKER-A").lastLocation.lat === 41.311 && byId(o, "TREKER-A").firstSeen === 0, "last position and first-seen time are included");
assert(byId(o, "TREKER-B").lastLocation === null, "a tracker without a position has lastLocation = null");
assert(byId(o, "TREKER-A").reliabilityScore === 100 && byId(o, "TREKER-A").risk === "BARQAROR", "reliability score and risk level come from diagnostics.js");

// t=20s: A has been silent for 20 s -> offline; the recovery loop makes its first attempt
fakeNow = 20000;
tracker.heartbeat("TREKER-B");
diag.checkAll();
o = overview();
let a = byId(o, "TREKER-A");
assert(a.status === "OFFLAYN", "after 20 s of silence the tracker is offline, got: " + a.status);
assert(a.incidents.length === 1 && a.incidents[0].end === null, "the outage is listed and still open");
assert(a.incidents[0].start === 15000, "the outage starts when the offline threshold was crossed (15 s), got: " + a.incidents[0].start);
assert(a.incidents[0].attempts.length === 1 && a.incidents[0].attempts[0] === 20000, "the restart attempt is attached to the outage");
assert(a.incidents[0].escalated === false, "one attempt is not an escalation yet");
assert(byId(o, "TREKER-B").status === "ONLAYN", "the other tracker stays online");

// t=30s: the signal comes back -> the outage is closed
fakeNow = 30000;
tracker.heartbeat("TREKER-A");
o = overview();
a = byId(o, "TREKER-A");
assert(a.status === "ONLAYN" && a.incidents[0].end === 30000, "when the signal returns the outage gets its end time");
assert(a.incidentCount === 1, "the total number of outages is counted");

// A second outage, to test the cap and the window
fakeNow = 60000;
diag.checkAll();
fakeNow = 70000;
tracker.heartbeat("TREKER-A");
o = overview({ maxIncidents: 1 });
a = byId(o, "TREKER-A");
assert(a.incidents.length === 1 && a.incidents[0].start === 45000, "the cap keeps only the most recent outages, got start: " + a.incidents[0]?.start);
assert(a.incidentCount === 2, "the total still counts every outage");

// 11 minutes later both outages are older than the 10-minute window
fakeNow = 70000 + 11 * 60 * 1000;
tracker.heartbeat("TREKER-A");
o = overview();
a = byId(o, "TREKER-A");
assert(a.incidents.length === 1 && a.incidentCount === 3, "outages that ended before the window are left out of the list but stay in the total");

// Minute-scale (production) thresholds -> 24-hour window
const prod = buildOverview(tracker, diag, { thresholds: { delayMs: 300000, offlineMs: 600000, retryIntervalMs: 300000, maxAttempts: 3 }, clock });
assert(prod.windowMs === 24 * 60 * 60 * 1000 && prod.demo === false, "minute-scale thresholds give a 24-hour window and demo = false");

// Positions are cleaned before they reach the phone
assert(cleanLocation({ lat: "41.3", lng: "69.2" }).lng === 69.2, "numeric strings become numbers");
assert(cleanLocation({ lat: "<b>", lng: 69 }) === null, "a non-numeric position is dropped");
assert(cleanLocation({ lat: 141, lng: 69 }) === null, "an impossible latitude is dropped");
assert(cleanLocation(null) === null, "no position stays null");

console.log("\nAll mobile overview tests finished.");

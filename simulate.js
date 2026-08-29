/**
 * Bir nechta GPS-trekerni simulyatsiya qiladi:
 * - TREKER-1 va TREKER-2 muntazam heartbeat yuboradi (doim onlayn)
 * - TREKER-3 vaqti-vaqti bilan "aloqasi uziladi" (offlayn holatni ko'rsatish uchun)
 *
 * Ishga tushirish: server.js ishlab turgan holda, boshqa terminalda:
 *   node simulate.js
 */
const http = require("http");

const SERVER = process.env.SIM_TARGET || "http://localhost:3000";

function sendHeartbeat(deviceId, lat, lng) {
  const data = JSON.stringify({ deviceId, lat, lng });
  const req = http.request(
    `${SERVER}/api/heartbeat`,
    { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": data.length } },
    (res) => res.on("data", () => {})
  );
  req.on("error", (e) => console.error("Xato:", e.message));
  req.write(data);
  req.end();
}

let tick = 0;
setInterval(() => {
  tick += 1;

  // TREKER-1: doim barqaror, har 2 soniyada signal
  sendHeartbeat("TREKER-1", 41.311 + Math.random() * 0.001, 69.279 + Math.random() * 0.001);

  // TREKER-2: doim barqaror
  sendHeartbeat("TREKER-2", 40.1 + Math.random() * 0.001, 65.37 + Math.random() * 0.001);

  // TREKER-3: har 30 soniyalik davrning birinchi 10 soniyasida "aloqasi yo'q" (signal yubormaydi)
  const phase = tick % 15; // ~30 soniyalik davr (2s interval * 15)
  if (phase >= 5) {
    sendHeartbeat("TREKER-3", 39.65 + Math.random() * 0.001, 66.96 + Math.random() * 0.001);
    console.log(`[${new Date().toLocaleTimeString()}] TREKER-3 signal yubordi`);
  } else {
    console.log(`[${new Date().toLocaleTimeString()}] TREKER-3 SIGNAL YO'QOLDI (simulyatsiya)`);
  }
}, 2000);

console.log("Simulyatsiya boshlandi — Ctrl+C bilan to'xtatish mumkin");

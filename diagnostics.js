/**
 * AI Pilot — Bashoratli diagnostika + Avtomatik o'z-o'zini davolash
 * ------------------------------------------------------------
 * lib.js (createTracker) ustiga quriladi. HTTP'dan mustaqil — sinash oson.
 *
 * Ikki vazifani bajaradi:
 *  1) Ishonchlilik balli (reliability score) — har bir qurilma qanchalik
 *     "muammoli" ekanini ko'p uzilishlar soni va uptime asosida hisoblaydi.
 *  2) Avtomatik o'z-o'zini davolash — qurilma OFFLAYN bo'lganda, dispetcher
 *     aralashuvisiz "qayta ishga tushirish" buyrug'ini yuboradi. Agar bir
 *     necha urinishdan keyin ham tuzalmasa, inson e'tiboriga eskalatsiya
 *     qiladi (spam qilib urinaverish o'rniga).
 */

function createDiagnostics(tracker, config = {}) {
  const clock = config.clock ?? (() => Date.now());
  const RETRY_INTERVAL_MS = config.retryIntervalMs ?? 5 * 60 * 1000; // urinishlar orasidagi kutish
  const MAX_ATTEMPTS = config.maxAttempts ?? 3;                       // shundan keyin eskalatsiya

  const remediationLog = []; // {deviceId, at, action, attempt}

  // ---- 1) Ishonchlilik balli ----
  function reliabilityScore(deviceSnapshot) {
    const episodeCount = deviceSnapshot.downPeriods.length;
    const uptime = deviceSnapshot.uptimePercent;
    // Har bir uzilish -10 ball, past uptime qo'shimcha kamaytiradi
    let score = 100 - episodeCount * 10 - (100 - uptime) * 0.5;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function riskLevel(score) {
    if (score >= 80) return "BARQAROR";
    if (score >= 50) return "KUZATISH KERAK";
    return "XAVFLI";
  }

  function riskReport() {
    return tracker.all().map((d) => {
      const score = reliabilityScore(d);
      return {
        deviceId: d.deviceId,
        uptimePercent: d.uptimePercent,
        episodeCount: d.downPeriods.length,
        reliabilityScore: score,
        risk: riskLevel(score),
      };
    });
  }

  // ---- 2) Avtomatik o'z-o'zini davolash ----
  // Har bir "down davri" (downPeriods elementi) ga urinishlar tarixini
  // biriktiramiz. Shu orqali bitta uzilish uchun cheksiz spam qilinmaydi.
  function checkAndRemediate(deviceId) {
    const raw = tracker.getRaw(deviceId);
    if (!raw) return { deviceId, action: "noma'lum_qurilma" };

    const status = tracker.snapshot(deviceId).status; // holatni yangilab, joriy qiymatni olamiz
    if (status !== "OFFLAYN") {
      return { deviceId, action: "kerak_emas", status };
    }

    const episode = raw.downPeriods[raw.downPeriods.length - 1];
    if (!episode || episode.end !== null) {
      return { deviceId, action: "kerak_emas", reason: "ochiq uzilish topilmadi" };
    }

    if (!episode.remediationAttempts) episode.remediationAttempts = [];
    if (episode.escalated) {
      return { deviceId, action: "eskalatsiya_qilingan", attempts: episode.remediationAttempts.length };
    }

    const attempts = episode.remediationAttempts;
    const now = clock();
    const lastAttempt = attempts[attempts.length - 1];

    // Hali urinilmagan, yoki oxirgi urinishdan RETRY_INTERVAL_MS o'tgan bo'lsa
    if (attempts.length === 0 || now - lastAttempt >= RETRY_INTERVAL_MS) {
      if (attempts.length >= MAX_ATTEMPTS) {
        episode.escalated = true;
        remediationLog.push({ deviceId, at: now, action: "ESKALATSIYA_INSONGA", attempt: attempts.length });
        if (tracker.persistById) tracker.persistById(deviceId);
        return { deviceId, action: "eskalatsiya", attempts: attempts.length };
      }
      attempts.push(now);
      remediationLog.push({ deviceId, at: now, action: "QAYTA_ISHGA_TUSHIRISH_YUBORILDI", attempt: attempts.length });
      if (tracker.persistById) tracker.persistById(deviceId);
      return { deviceId, action: "restart_yuborildi", attempt: attempts.length };
    }

    return { deviceId, action: "kutish_rejimi", nextAttemptInMs: RETRY_INTERVAL_MS - (now - lastAttempt) };
  }

  function checkAll() {
    return tracker.all().map((d) => checkAndRemediate(d.deviceId));
  }

  function getLog() {
    return remediationLog.slice();
  }

  return { reliabilityScore, riskLevel, riskReport, checkAndRemediate, checkAll, getLog };
}

module.exports = { createDiagnostics };

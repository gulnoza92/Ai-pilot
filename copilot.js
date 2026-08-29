/**
 * AI Pilot — AI Copilot (suhbat orqali boshqarish) prototipi
 * ------------------------------------------------------------
 * Bu prototip haqiqiy LLM chaqirmaydi (internetsiz muhitda ishlashi kerak) —
 * o'rniga dispetcherning tez-tez beradigan savollariga mos naqsh-asosli
 * (pattern-based) tabiiy til qatlami sifatida ishlaydi. Maqsad — arxitektura
 * va foydalanuvchi tajribasini isbotlash (proof of concept); production'da
 * bu qatlam haqiqiy LLM (masalan, Claude API) bilan almashtiriladi, lekin
 * pastdagi funksiyalar ("ma'lumotni olish" va "amal bajarish") xuddi shu
 * tarzda ishlab turadi.
 *
 * "Agentic" xususiyat: Copilot faqat javob bermaydi — ruxsat etilgan doirada
 * amal ham bajaradi (masalan, qurilmani qayta ishga tushirishga buyruq berish).
 */

function normalize(text) {
  return text.toLowerCase().replace(/['’ʻ]/g, "'").trim();
}

function createCopilot(tracker, diagnostics) {
  // "qayta ishga tushir TREKER-3" (fe'l oldin) yoki
  // "TREKER-3 ni qayta ishga tushir" (o'zbekcha tabiiy tartib: obyekt oldin) — ikkalasini ham ushlaydi
  function tryRemediationCommand(text) {
    let m = text.match(/(qayta ishga tushir|restart)\s+([a-z0-9\-_]+)/i);
    let deviceId = m ? m[2] : null;
    if (!deviceId) {
      m = text.match(/([a-z0-9\-_]+)\s+ni\s+(qayta ishga tushir|restart)/i);
      deviceId = m ? m[1] : null;
    }
    if (!deviceId) return null;
    deviceId = deviceId.toUpperCase();
    const snap = tracker.snapshot(deviceId);
    if (!snap) return `"${deviceId}" nomli qurilma topilmadi.`;

    const result = diagnostics.checkAndRemediate(deviceId);
    if (result.action === "restart_yuborildi") {
      return `${deviceId} uchun qayta ishga tushirish buyrug'i yuborildi (urinish #${result.attempt}).`;
    }
    if (result.action === "kerak_emas") {
      return `${deviceId} hozir ${result.status} holatda — qayta ishga tushirish shart emas.`;
    }
    if (result.action === "kutish_rejimi") {
      const sec = Math.ceil(result.nextAttemptInMs / 1000);
      return `${deviceId} uchun yaqinda urinish qilingan — keyingi urinishgacha ~${sec} soniya kutish kerak.`;
    }
    if (result.action === "eskalatsiya" || result.action === "eskalatsiya_qilingan") {
      return `${deviceId} maksimal urinishlardan o'tdi va inson e'tiboriga eskalatsiya qilingan — qo'lda tekshirish tavsiya etiladi.`;
    }
    return `${deviceId} bo'yicha amal: ${result.action}`;
  }

  function answerStatus(deviceId) {
    const snap = tracker.snapshot(deviceId);
    if (!snap) return `"${deviceId}" nomli qurilma topilmadi.`;
    return `${deviceId} — holati: ${snap.status}, uptime: ${snap.uptimePercent}%, jami signal: ${snap.totalBeats}, uzilishlar soni: ${snap.downPeriods.length}.`;
  }

  function answerOfflineCount() {
    const all = tracker.all();
    const offline = all.filter((d) => d.status === "OFFLAYN");
    if (offline.length === 0) return "Hozircha barcha qurilmalar onlayn yoki kechikish holatida — offlayn qurilma yo'q.";
    return `Hozir ${offline.length} ta qurilma offlayn: ${offline.map((d) => d.deviceId).join(", ")}.`;
  }

  function answerRiskiest() {
    const report = diagnostics.riskReport();
    if (report.length === 0) return "Hozircha hech qanday qurilma ma'lumoti yo'q.";
    const sorted = [...report].sort((a, b) => a.reliabilityScore - b.reliabilityScore);
    const worst = sorted[0];
    return `Eng ishonchsiz qurilma — ${worst.deviceId} (ball: ${worst.reliabilityScore}/100, holat: ${worst.risk}, uzilishlar soni: ${worst.episodeCount}).`;
  }

  function answerAverageUptime() {
    const all = tracker.all();
    if (all.length === 0) return "Hozircha hech qanday qurilma ma'lumoti yo'q.";
    const avg = all.reduce((sum, d) => sum + d.uptimePercent, 0) / all.length;
    return `Barcha qurilmalarning o'rtacha uptime ko'rsatkichi — ${avg.toFixed(1)}% (${all.length} ta qurilma bo'yicha).`;
  }

  function answerRiskList() {
    const report = diagnostics.riskReport();
    const risky = report.filter((r) => r.risk !== "BARQAROR");
    if (risky.length === 0) return "Barcha qurilmalar BARQAROR holatda — e'tibor talab qiladigani yo'q.";
    return `E'tibor talab qiladigan qurilmalar: ${risky.map((r) => `${r.deviceId} (${r.risk}, ${r.reliabilityScore} ball)`).join("; ")}.`;
  }

  function answer(rawText) {
    const text = normalize(rawText || "");
    if (!text) return "Savol bo'sh bo'lmasligi kerak.";

    // 1) Amal (agentic) buyrug'i — eng avval tekshiriladi
    const remediation = tryRemediationCommand(text);
    if (remediation) return remediation;

    // 2) Bitta qurilma holati: "TREKER-3 holati qanday?"
    // (ID sifatida faqat bosh harfi katta yozilgan so'zlarni qabul qilamiz —
    // shunda "ob-havo qanday?" kabi oddiy so'zlar ID deb noto'g'ri talqin qilinmaydi)
    const idMatch = rawText.match(/\b([A-Z][A-Za-z]*-[A-Za-z0-9]+)\b/);
    if (idMatch && /(holat|status|qanday)/.test(text)) {
      return answerStatus(idMatch[1].toUpperCase());
    }

    // 3) Necha ta qurilma offlayn?
    if (/(nechta|necha ta).*(offlayn|aloqa yo'q|signal yo'q)/.test(text) || /offlayn.*(nechta|necha ta)/.test(text)) {
      return answerOfflineCount();
    }

    // 4) Eng ishonchsiz / eng muammoli qurilma
    if (/(eng ishonchsiz|eng muammoli|eng xavfli)/.test(text)) {
      return answerRiskiest();
    }

    // 5) E'tibor talab qiladigan / xavfli qurilmalar ro'yxati
    if (/(qaysi qurilmalar|risk|xavf|e'tibor talab)/.test(text)) {
      return answerRiskList();
    }

    // 6) O'rtacha uptime
    if (/(o'rtacha|umumiy).*uptime/.test(text) || /uptime.*(o'rtacha|umumiy)/.test(text)) {
      return answerAverageUptime();
    }

    // 7) Fallback — qo'llab-quvvatlanadigan savollar haqida ma'lumot
    return (
      "Kechirasiz, bu savolni tushunmadim. Quyidagicha so'rashingiz mumkin:\n" +
      "- \"TREKER-3 holati qanday?\"\n" +
      "- \"nechta qurilma offlayn?\"\n" +
      "- \"eng ishonchsiz qurilma qaysi?\"\n" +
      "- \"qaysi qurilmalar xavfli?\"\n" +
      "- \"o'rtacha uptime qancha?\"\n" +
      "- \"TREKER-3 ni qayta ishga tushir\""
    );
  }

  return { answer };
}

module.exports = { createCopilot };

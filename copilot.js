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
 *
 * Three languages (uz / ru / en):
 *  - a question is understood in any of the three, whatever the answer language;
 *  - the answer language is the `lang` argument of answer(text, lang);
 *  - without `lang`: Cyrillic text is answered in Russian, everything else in
 *    Uzbek — exactly as before this change (the web monitor sends no `lang`).
 */

function normalize(text) {
  return text.toLowerCase().replace(/['’ʻʼ`]/g, "'").replace(/ё/g, "е").trim();
}

// ---- Answers. The Uzbek texts are unchanged; status and risk codes stay as the server stores them. ----
const TEXT = {
  uz: {
    status: (code) => code,
    risk: (code) => code,
    number: (n) => String(n),
    notFound: (id) => `"${id}" nomli qurilma topilmadi.`,
    restartSent: (id, attempt) => `${id} uchun qayta ishga tushirish buyrug'i yuborildi (urinish #${attempt}).`,
    restartNotNeeded: (id, status) => `${id} hozir ${status} holatda — qayta ishga tushirish shart emas.`,
    restartWait: (id, sec) => `${id} uchun yaqinda urinish qilingan — keyingi urinishgacha ~${sec} soniya kutish kerak.`,
    restartEscalated: (id) => `${id} maksimal urinishlardan o'tdi va inson e'tiboriga eskalatsiya qilingan — qo'lda tekshirish tavsiya etiladi.`,
    restartOther: (id, action) => `${id} bo'yicha amal: ${action}`,
    deviceStatus: (id, s) => `${id} — holati: ${s.status}, uptime: ${s.uptime}%, jami signal: ${s.beats}, uzilishlar soni: ${s.outages}.`,
    noneOffline: "Hozircha barcha qurilmalar onlayn yoki kechikish holatida — offlayn qurilma yo'q.",
    offline: (n, ids) => `Hozir ${n} ta qurilma offlayn: ${ids}.`,
    noData: "Hozircha hech qanday qurilma ma'lumoti yo'q.",
    riskiest: (w) => `Eng ishonchsiz qurilma — ${w.id} (ball: ${w.score}/100, holat: ${w.risk}, uzilishlar soni: ${w.outages}).`,
    avgUptime: (avg, n) => `Barcha qurilmalarning o'rtacha uptime ko'rsatkichi — ${avg}% (${n} ta qurilma bo'yicha).`,
    allStable: "Barcha qurilmalar BARQAROR holatda — e'tibor talab qiladigani yo'q.",
    riskList: (items) => `E'tibor talab qiladigan qurilmalar: ${items}.`,
    riskItem: (r) => `${r.id} (${r.risk}, ${r.score} ball)`,
    empty: "Savol bo'sh bo'lmasligi kerak.",
    help:
      "Kechirasiz, bu savolni tushunmadim. Quyidagicha so'rashingiz mumkin:\n" +
      "- \"TREKER-3 holati qanday?\"\n" +
      "- \"nechta qurilma offlayn?\"\n" +
      "- \"eng ishonchsiz qurilma qaysi?\"\n" +
      "- \"qaysi qurilmalar xavfli?\"\n" +
      "- \"o'rtacha uptime qancha?\"\n" +
      "- \"TREKER-3 ni qayta ishga tushir\"",
  },

  ru: {
    status: (code) => ({ ONLAYN: "на связи", KECHIKISH: "задержка", OFFLAYN: "нет связи" }[code] || "сигнала ещё не было"),
    risk: (code) => ({ BARQAROR: "стабильный", "KUZATISH KERAK": "нужно наблюдать", XAVFLI: "ненадёжный" }[code] || code),
    number: (n) => String(n).replace(".", ","),
    notFound: (id) => `Трекер «${id}» не найден.`,
    restartSent: (id, attempt) => `Команда перезагрузки для ${id} отправлена (попытка №${attempt}).`,
    restartNotNeeded: (id, status) => `${id}: ${status} — перезагрузка не нужна.`,
    restartWait: (id, sec) => `Для ${id} попытка была недавно — следующая возможна примерно через ${sec} с.`,
    restartEscalated: (id) => `${id} исчерпал автоматические попытки и передан человеку — нужна проверка вручную.`,
    restartOther: (id, action) => `${id}: ${action}`,
    deviceStatus: (id, s) => `${id}: ${s.status}, uptime ${s.uptime}%, получено сигналов: ${s.beats}, обрывов: ${s.outages}.`,
    noneOffline: "Сейчас трекеров без связи нет: все на связи или отвечают с задержкой.",
    offline: (n, ids) => `Не на связи сейчас: ${ids} (всего ${n}).`,
    noData: "Данных о трекерах пока нет.",
    riskiest: (w) => `Самый ненадёжный трекер — ${w.id} (${w.score} из 100, ${w.risk}, обрывов: ${w.outages}).`,
    avgUptime: (avg, n) => `Средний uptime по всем трекерам — ${avg}% (трекеров: ${n}).`,
    allStable: "Все трекеры стабильны — внимания ничто не требует.",
    riskList: (items) => `Требуют внимания: ${items}.`,
    riskItem: (r) => `${r.id} (${r.risk}, ${r.score} из 100)`,
    empty: "Вопрос не должен быть пустым.",
    help:
      "Не понял вопрос. Можно спросить так:\n" +
      "- «Какой статус у TREKER-3?»\n" +
      "- «Сколько трекеров не на связи?»\n" +
      "- «Какой трекер самый ненадёжный?»\n" +
      "- «Какие трекеры требуют внимания?»\n" +
      "- «Какой средний uptime?»\n" +
      "- «Перезагрузи TREKER-3»",
  },

  en: {
    status: (code) => ({ ONLAYN: "online", KECHIKISH: "delayed", OFFLAYN: "offline" }[code] || "no signal yet"),
    risk: (code) => ({ BARQAROR: "stable", "KUZATISH KERAK": "watch", XAVFLI: "unreliable" }[code] || code),
    number: (n) => String(n),
    notFound: (id) => `Tracker "${id}" was not found.`,
    restartSent: (id, attempt) => `Restart command sent to ${id} (attempt #${attempt}).`,
    restartNotNeeded: (id, status) => `${id} is ${status} now — no restart needed.`,
    restartWait: (id, sec) => `${id} was tried recently — the next attempt is possible in about ${sec} s.`,
    restartEscalated: (id) => `${id} has used up the automatic attempts and was handed to a person — check it manually.`,
    restartOther: (id, action) => `${id}: ${action}`,
    deviceStatus: (id, s) => `${id}: ${s.status}, uptime ${s.uptime}%, signals received: ${s.beats}, outages: ${s.outages}.`,
    noneOffline: "No trackers are offline right now: all are online or delayed.",
    offline: (n, ids) => `Offline right now: ${ids} (${n} in total).`,
    noData: "There is no tracker data yet.",
    riskiest: (w) => `The least reliable tracker is ${w.id} (${w.score} of 100, ${w.risk}, outages: ${w.outages}).`,
    avgUptime: (avg, n) => `Average uptime across all trackers is ${avg}% (${n} ${n === 1 ? "tracker" : "trackers"}).`,
    allStable: "All trackers are stable — nothing needs attention.",
    riskList: (items) => `Need attention: ${items}.`,
    riskItem: (r) => `${r.id} (${r.risk}, ${r.score} of 100)`,
    empty: "The question cannot be empty.",
    help:
      "Sorry, I did not understand. You can ask:\n" +
      "- \"What is the status of TREKER-3?\"\n" +
      "- \"How many trackers are offline?\"\n" +
      "- \"Which tracker is the least reliable?\"\n" +
      "- \"Which trackers need attention?\"\n" +
      "- \"What is the average uptime?\"\n" +
      "- \"Restart TREKER-3\"",
  },
};

// Answer language: the one asked for; otherwise Russian for Cyrillic text, Uzbek for the rest.
function pickLanguage(lang, rawText) {
  if (typeof lang === "string" && Object.prototype.hasOwnProperty.call(TEXT, lang)) return lang;
  return /[а-яё]/i.test(rawText) ? "ru" : "uz";
}

// ---- What the question is about. Each list holds the Uzbek, Russian and English ways of asking. ----
const ID = "([a-z0-9][a-z0-9\\-_]*)";
const RESTART = [
  new RegExp(`qayta ishga tushir\\s+${ID}`, "i"),                                        // "qayta ishga tushir TREKER-3"
  new RegExp(`${ID}\\s+ni\\s+(?:qayta ishga tushir|restart)`, "i"),                      // "TREKER-3 ni qayta ishga tushir"
  new RegExp(`(?:перезагруз\\S*|перезапус\\S*|рестарт\\S*)\\s+(?:трекер\\S*\\s+)?${ID}`, "i"), // "перезагрузи (трекер) TREKER-3"
  new RegExp(`${ID}\\s+(?:перезагруз\\S*|перезапус\\S*)`, "i"),                          // "TREKER-3 перезагрузи"
  new RegExp(`(?:restart|reboot)\\s+(?:the\\s+)?(?:tracker\\s+|device\\s+)?${ID}`, "i"), // "restart (the tracker) TREKER-3"
];
const ABOUT_STATUS = /(holat|status|qanday|статус|состояни|что с|как там|как дела|state|how is|how's)/;
const HOW_MANY = "(?:nechta|necha ta|сколько|how many)";
const WHICH = "(?:qaysi|какие|какой|кто|which|what|who)";
const NO_SIGNAL = "(?:offlayn|aloqa yo'q|signal yo'q|офлайн|оффлайн|не на связи|без связи|нет связи|молч|offline|silent|not responding)";
const ASKS_OFFLINE = [
  new RegExp(`${HOW_MANY}.*${NO_SIGNAL}`),
  new RegExp(`${NO_SIGNAL}.*${HOW_MANY}`),
  new RegExp(`${WHICH}.*${NO_SIGNAL}`),
];
const ASKS_RISKIEST = /(eng ishonchsiz|eng muammoli|eng xavfli|(?:сам\S+|наиболее)\s+(?:ненадежн|проблемн|плох|рискован|слаб)|least reliable|least stable|most unreliable|most problematic|worst|riskiest)/;
const ASKS_RISK_LIST = /(qaysi qurilmalar|risk|xavf|e'tibor talab|требу\S* внимани|риск|ненадежные|проблемные|need\S* attention|require\S* attention|unreliable)/;
const ASKS_AVG_UPTIME = [
  /(?:o'rtacha|umumiy|средн|общ|average|mean|overall|avg).*(?:uptime|аптайм)/,
  /(?:uptime|аптайм).*(?:o'rtacha|umumiy|средн|общ|average|mean|overall|avg)/,
];

function createCopilot(tracker, diagnostics) {
  // "qayta ishga tushir TREKER-3" (fe'l oldin) yoki
  // "TREKER-3 ni qayta ishga tushir" (o'zbekcha tabiiy tartib: obyekt oldin) — ikkalasini ham ushlaydi;
  // ruscha va inglizcha buyruqlar ham shu yerda.
  function tryRemediationCommand(text, T) {
    let deviceId = null;
    for (const pattern of RESTART) {
      const m = text.match(pattern);
      if (m) { deviceId = m[1]; break; }
    }
    if (!deviceId) return null;
    const looksLikeId = /[\d\-_]/.test(deviceId);
    deviceId = deviceId.toUpperCase();
    const snap = tracker.snapshot(deviceId);
    if (!snap) {
      // An ordinary word after "restart" ("restart attempts"): not a command, let the other rules answer.
      return looksLikeId ? T.notFound(deviceId) : null;
    }

    const result = diagnostics.checkAndRemediate(deviceId);
    if (result.action === "restart_yuborildi") return T.restartSent(deviceId, result.attempt);
    if (result.action === "kerak_emas") return T.restartNotNeeded(deviceId, T.status(result.status));
    if (result.action === "kutish_rejimi") return T.restartWait(deviceId, Math.ceil(result.nextAttemptInMs / 1000));
    if (result.action === "eskalatsiya" || result.action === "eskalatsiya_qilingan") return T.restartEscalated(deviceId);
    return T.restartOther(deviceId, result.action);
  }

  function answerStatus(deviceId, T) {
    const snap = tracker.snapshot(deviceId);
    if (!snap) return T.notFound(deviceId);
    return T.deviceStatus(deviceId, {
      status: T.status(snap.status),
      uptime: T.number(snap.uptimePercent),
      beats: snap.totalBeats,
      outages: snap.downPeriods.length,
    });
  }

  function answerOfflineCount(T) {
    const all = tracker.all();
    const offline = all.filter((d) => d.status === "OFFLAYN");
    if (offline.length === 0) return T.noneOffline;
    return T.offline(offline.length, offline.map((d) => d.deviceId).join(", "));
  }

  function answerRiskiest(T) {
    const report = diagnostics.riskReport();
    if (report.length === 0) return T.noData;
    const sorted = [...report].sort((a, b) => a.reliabilityScore - b.reliabilityScore);
    const worst = sorted[0];
    return T.riskiest({ id: worst.deviceId, score: worst.reliabilityScore, risk: T.risk(worst.risk), outages: worst.episodeCount });
  }

  function answerAverageUptime(T) {
    const all = tracker.all();
    if (all.length === 0) return T.noData;
    const avg = all.reduce((sum, d) => sum + d.uptimePercent, 0) / all.length;
    return T.avgUptime(T.number(avg.toFixed(1)), all.length);
  }

  function answerRiskList(T) {
    const report = diagnostics.riskReport();
    const risky = report.filter((r) => r.risk !== "BARQAROR");
    if (risky.length === 0) return T.allStable;
    return T.riskList(risky.map((r) => T.riskItem({ id: r.deviceId, risk: T.risk(r.risk), score: r.reliabilityScore })).join("; "));
  }

  /**
   * @param {string} rawText the question
   * @param {"uz"|"ru"|"en"} [lang] answer language (optional, see the note at the top)
   */
  function answer(rawText, lang) {
    rawText = typeof rawText === "string" ? rawText : "";
    const T = TEXT[pickLanguage(lang, rawText)];
    const text = normalize(rawText);
    if (!text) return T.empty;

    // 1) Amal (agentic) buyrug'i — eng avval tekshiriladi
    const remediation = tryRemediationCommand(text, T);
    if (remediation) return remediation;

    // 2) Bitta qurilma holati: "TREKER-3 holati qanday?"
    // (ID sifatida faqat bosh harfi katta yozilgan so'zlarni qabul qilamiz —
    // shunda "ob-havo qanday?" kabi oddiy so'zlar ID deb noto'g'ri talqin qilinmaydi)
    const idMatch = rawText.match(/\b([A-Z][A-Za-z]*-[A-Za-z0-9]+)\b/);
    if (idMatch && ABOUT_STATUS.test(text)) {
      return answerStatus(idMatch[1].toUpperCase(), T);
    }

    // 3) Necha ta qurilma offlayn? / Какие не на связи? / Which are offline?
    if (ASKS_OFFLINE.some((p) => p.test(text))) {
      return answerOfflineCount(T);
    }

    // 4) Eng ishonchsiz / eng muammoli qurilma
    if (ASKS_RISKIEST.test(text)) {
      return answerRiskiest(T);
    }

    // 5) E'tibor talab qiladigan / xavfli qurilmalar ro'yxati
    if (ASKS_RISK_LIST.test(text)) {
      return answerRiskList(T);
    }

    // 6) O'rtacha uptime
    if (ASKS_AVG_UPTIME.some((p) => p.test(text))) {
      return answerAverageUptime(T);
    }

    // 7) Fallback — qo'llab-quvvatlanadigan savollar haqida ma'lumot
    return T.help;
  }

  return { answer };
}

module.exports = { createCopilot };

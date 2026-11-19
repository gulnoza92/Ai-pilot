/**
 * Tests for the three languages of AI Copilot (uz / ru / en).
 * The original Uzbek behaviour is covered by copilot.test.js and must not change.
 *
 * Run: node copilot.lang.test.js
 */
const { createTracker } = require("./lib");
const { createDiagnostics } = require("./diagnostics");
const { createCopilot } = require("./copilot");

let fakeNow = 0;
const clock = () => fakeNow;

const tracker = createTracker({ delayMs: 5000, offlineMs: 15000, clock });
const diag = createDiagnostics(tracker, { retryIntervalMs: 10000, maxAttempts: 3, clock });
const copilot = createCopilot(tracker, diag);

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✅ OK:", msg);
  }
}

// Same scene as copilot.test.js: TREKER-1 keeps reporting, TREKER-2 falls silent and goes offline.
tracker.heartbeat("TREKER-1");
tracker.heartbeat("TREKER-2");
for (let i = 0; i < 4; i++) {
  fakeNow += 5000;
  tracker.heartbeat("TREKER-1");
}

let ans;

// --- Russian ---
ans = copilot.answer("Какой статус у TREKER-1?", "ru");
assert(ans.includes("TREKER-1") && ans.includes("на связи"), "RU: status of one tracker: " + ans);
ans = copilot.answer("Сколько не на связи?", "ru");
assert(ans.includes("TREKER-2") && ans.includes("всего 1"), "RU: how many are offline: " + ans);
ans = copilot.answer("Какие трекеры молчат?", "ru");
assert(ans.includes("TREKER-2") && !ans.includes("TREKER-1"), "RU: \"which are silent\" lists the offline ones: " + ans);
ans = copilot.answer("Самый ненадёжный", "ru");
assert(ans.includes("TREKER-2") && ans.includes("из 100"), "RU: least reliable tracker: " + ans);
ans = copilot.answer("Какие требуют внимания?", "ru");
assert(ans.startsWith("Требуют внимания") && ans.includes("TREKER-2"), "RU: which need attention: " + ans);
ans = copilot.answer("Средний uptime", "ru");
assert(/\d+,\d%/.test(ans) || /\d+%/.test(ans), "RU: average uptime with a decimal comma: " + ans);
ans = copilot.answer("какая сегодня погода?", "ru");
assert(ans.startsWith("Не понял вопрос") && ans.includes("Перезагрузи TREKER-3"), "RU: unknown question gets Russian help: " + ans.split("\n")[0]);
ans = copilot.answer("", "ru");
assert(ans === "Вопрос не должен быть пустым.", "RU: empty question: " + ans);

// --- English ---
ans = copilot.answer("What is the status of TREKER-1?", "en");
assert(ans.includes("TREKER-1") && ans.includes("online"), "EN: status of one tracker: " + ans);
ans = copilot.answer("How many are offline?", "en");
assert(ans.includes("TREKER-2") && ans.includes("1 in total"), "EN: how many are offline: " + ans);
ans = copilot.answer("Which trackers are offline?", "en");
assert(ans.includes("TREKER-2") && !ans.includes("TREKER-1"), "EN: \"which are offline\" lists them: " + ans);
ans = copilot.answer("Least reliable tracker", "en");
assert(ans.includes("TREKER-2") && ans.includes("of 100"), "EN: least reliable tracker: " + ans);
ans = copilot.answer("Which need attention?", "en");
assert(ans.startsWith("Need attention") && ans.includes("TREKER-2"), "EN: which need attention: " + ans);
ans = copilot.answer("Average uptime", "en");
assert(/Average uptime.*\d+(\.\d)?%/.test(ans), "EN: average uptime: " + ans);
ans = copilot.answer("what is the weather today?", "en");
assert(ans.startsWith("Sorry, I did not understand"), "EN: unknown question gets English help: " + ans.split("\n")[0]);
ans = copilot.answer("how many restart attempts were made?", "en");
assert(!ans.includes("ATTEMPTS"), "EN: an ordinary word after \"restart\" is not taken for a tracker name: " + ans.split("\n")[0]);

// --- A question in one language, the answer in another (the app sends its interface language) ---
ans = copilot.answer("nechta qurilma offlayn?", "en");
assert(ans.startsWith("Offline right now") && ans.includes("TREKER-2"), "Uzbek question, English answer: " + ans);
ans = copilot.answer("how many are offline?", "ru");
assert(ans.startsWith("Не на связи сейчас"), "English question, Russian answer: " + ans);
ans = copilot.answer("Сколько не на связи?", "uz");
assert(ans.includes("1 ta qurilma offlayn"), "Russian question, Uzbek answer: " + ans);

// --- Without a language: unchanged Uzbek, except that Cyrillic gets a Russian answer ---
ans = copilot.answer("nechta qurilma offlayn?");
assert(ans.includes("1 ta qurilma offlayn"), "no language given, Latin text -> Uzbek as before: " + ans);
ans = copilot.answer("Сколько не на связи?");
assert(ans.startsWith("Не на связи сейчас"), "no language given, Cyrillic text -> Russian: " + ans);
ans = copilot.answer("how many are offline?", "de");
assert(ans.includes("1 ta qurilma offlayn"), "an unknown language code falls back to Uzbek: " + ans);

// --- Commands (the "agentic" part) in Russian and English ---
ans = copilot.answer("Перезагрузи TREKER-2", "ru");
assert(ans.includes("отправлена") && ans.includes("№1"), "RU: restart command is carried out: " + ans);
ans = copilot.answer("restart the tracker TREKER-2", "en");
assert(ans.includes("tried recently"), "EN: a second command right away meets the cooldown: " + ans);
ans = copilot.answer("перезапусти трекер TREKER-1", "ru");
assert(ans.includes("на связи") && ans.includes("не нужна"), "RU: no restart for a tracker that is online: " + ans);
ans = copilot.answer("reboot TREKER-404", "en");
assert(ans === "Tracker \"TREKER-404\" was not found.", "EN: restart of an unknown tracker: " + ans);
fakeNow += 10000; diag.checkAll();
fakeNow += 10000; diag.checkAll();
fakeNow += 10000; diag.checkAll();
ans = copilot.answer("TREKER-2 перезагрузи", "ru");
assert(ans.includes("передан человеку"), "RU: after the automatic attempts the tracker is handed to a person: " + ans);

console.log("\nAll Copilot language tests finished.");

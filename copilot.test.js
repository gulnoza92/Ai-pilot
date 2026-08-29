/**
 * AI Copilot uchun testlar — turli savol turlari va "qayta ishga tushir"
 * agentic buyrug'ini tekshiradi. Soxta soat bilan tezkor ishlaydi.
 *
 * Ishga tushirish: node copilot.test.js
 */
const { createTracker } = require("./lib");
const { createDiagnostics } = require("./diagnostics");
const { createCopilot } = require("./copilot");

let fakeNow = 0;
const clock = () => fakeNow;

const tracker = createTracker({ delayMs: 5000, offlineMs: 15000, clock });
const diagnostics = createDiagnostics(tracker, { retryIntervalMs: 10000, maxAttempts: 3, clock });
const copilot = createCopilot(tracker, diagnostics);

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✅ OK:", msg);
  }
}

// --- Boshlang'ich ma'lumot: ikkita qurilma ---
tracker.heartbeat("TREKER-1");
tracker.heartbeat("TREKER-2");
// TREKER-1'ni har 5s'da "boqib" turamiz (chegara aniq 5000ms — hech qachon uzilmaydi)
fakeNow += 5000;
tracker.heartbeat("TREKER-1");
fakeNow += 5000;
tracker.heartbeat("TREKER-1");
fakeNow += 5000;
tracker.heartbeat("TREKER-1");
fakeNow += 5000; // jami 20s — TREKER-2 boshidan beri signal yubormadi -> OFFLAYN bo'lishi kerak
tracker.heartbeat("TREKER-1");

// 1) Bitta qurilma holati
let ans = copilot.answer("TREKER-1 holati qanday?");
assert(ans.includes("TREKER-1") && ans.includes("ONLAYN"), "TREKER-1 holati to'g'ri javob berilishi kerak: " + ans);

// 2) Mavjud bo'lmagan qurilma
ans = copilot.answer("TREKER-99 holati qanday?");
assert(ans.includes("topilmadi"), "Mavjud bo'lmagan qurilma uchun 'topilmadi' bo'lishi kerak: " + ans);

// 3) Nechta qurilma offlayn?
ans = copilot.answer("Hozir nechta qurilma offlayn?");
assert(ans.includes("1 ta qurilma offlayn") && ans.includes("TREKER-2"), "Offlayn son to'g'ri hisoblanishi kerak: " + ans);

// 4) Eng ishonchsiz qurilma
ans = copilot.answer("Eng ishonchsiz qurilma qaysi?");
assert(ans.includes("TREKER-2"), "Eng ishonchsiz qurilma TREKER-2 bo'lishi kerak: " + ans);

// 5) Xavfli qurilmalar ro'yxati
ans = copilot.answer("Qaysi qurilmalar xavfli?");
assert(ans.includes("TREKER-2"), "Risk ro'yxatida TREKER-2 bo'lishi kerak: " + ans);

// 6) O'rtacha uptime
ans = copilot.answer("O'rtacha uptime qancha?");
assert(/\d+(\.\d+)?%/.test(ans), "O'rtacha uptime foiz bilan qaytishi kerak: " + ans);

// 7) Fallback — tushunarsiz savol
ans = copilot.answer("bugun ob-havo qanday?");
assert(ans.includes("tushunmadim"), "Tushunarsiz savolga fallback javob berilishi kerak: " + ans);

// 8) Agentic amal: qayta ishga tushirish buyrug'i
ans = copilot.answer("TREKER-2 ni qayta ishga tushir");
assert(ans.includes("buyrug'i yuborildi") && ans.includes("#1"), "1-chi restart buyrug'i berilishi kerak: " + ans);

// darhol qayta so'ralsa — cooldown xabari kelishi kerak
ans = copilot.answer("restart TREKER-2");
assert(ans.includes("kutish") || ans.includes("soniya"), "Cooldown holatida mos javob berilishi kerak: " + ans);

// mavjud bo'lmagan qurilmani qayta ishga tushirishga urinish
ans = copilot.answer("TREKER-404 ni qayta ishga tushir");
assert(ans.includes("topilmadi"), "Mavjud bo'lmagan qurilmani restart qilishda xabar berilishi kerak: " + ans);

console.log("\nBarcha AI Copilot testlari yakunlandi.");

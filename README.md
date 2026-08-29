# AI Pilot — GPS Trekerlar uchun Aqlli Monitoring Tizimi

Ushbu papkada loyihaning barcha materiallari — biznes reja, texnik
arxitektura, taqdimot va ishlaydigan kod prototipi (4 modul) — bitta joyda
to'plangan.

## Papka tuzilishi

```
AI_Pilot_Loyiha/
├── hujjatlar/
│   ├── AI_Pilot_Biznes_Reja.docx          — muammo, bozor tahlili, monetizatsiya, roadmap
│   ├── AI_Pilot_Texnik_Arxitektura.docx   — tizim arxitekturasi, texnologik stack
│   └── AI_Pilot_Taqdimot.pptx             — 14 slaydli vizual taqdimot
│
└── kod/
    ├── lib.js                 — Signal monitoring: ONLAYN/KECHIKISH/OFFLAYN, uptime %
    ├── diagnostics.js         — Bashoratli diagnostika + avtomatik o'z-o'zini davolash
    ├── store.js               — SQLite orqali doimiy saqlash (node:sqlite)
    ├── copilot.js             — AI Copilot: tabiiy tilda savol-javob + agentic amal
    ├── server.js              — barcha modullarni birlashtiruvchi HTTP backend
    ├── simulate.js            — soxta trekerlarni simulyatsiya qilish skripti
    ├── test.js, diagnostics.test.js,
    │   persistence.test.js, copilot.test.js  — 34 ta unit-test
    ├── public/index.html      — dashboard + AI Copilot chat oynasi
    └── README.md              — kodni ishga tushirish bo'yicha batafsil qo'llanma
```

## Qayerdan boshlash kerak

1. **Biznes g'oyani ko'rib chiqish** — `hujjatlar/AI_Pilot_Biznes_Reja.docx`
2. **Texnik yechimni tushunish** — `hujjatlar/AI_Pilot_Texnik_Arxitektura.docx`
3. **Jamoaga/investorga taqdimot** — `hujjatlar/AI_Pilot_Taqdimot.pptx`
4. **Ishlaydigan kodni sinab ko'rish** — `kod/README.md`:
   ```
   cd kod
   node test.js && node diagnostics.test.js && node persistence.test.js && node copilot.test.js
   node server.js    # http://localhost:3000 — dashboard + AI Copilot chat
   node simulate.js  # boshqa terminalda — soxta trekerlarni simulyatsiya qilish
   ```
   Eslatma: `node:sqlite` uchun Node.js 22.5+ versiyasi kerak.

## Hozirgi holat

- ✅ Biznes-reja va bozor tahlili — tayyor
- ✅ Texnik arxitektura hujjati — tayyor
- ✅ Taqdimot — tayyor
- ✅ Signal Holati Monitoring — ishlaydigan prototip, testdan o'tgan
- ✅ Bashoratli diagnostika + Avtomatik o'z-o'zini davolash — ishlaydigan prototip, testdan o'tgan
- ✅ SQLite orqali doimiy saqlash — ishlaydigan prototip, testdan o'tgan (server qayta ishga tushsa ham ma'lumot yo'qolmaydi)
- ✅ AI Copilot (naqsh-asosli suhbat + agentic amal) — ishlaydigan prototip, testdan o'tgan
- ⏳ Qolgan modullar (OTA, Edge-AI, real LLM integratsiyasi, xavfsizlik qatlami) — hujjatlarda rejalashtirilgan, kod hali yozilmagan

## Nima real sinovdan o'tgan

Jami **34 ta avtomatik test** (soxta soat bilan, tezkor) + real HTTP server
orqali qo'lda sinov: ikkita treker → biri offlaynga tushdi → avtomatik
restart urinishlari → eskalatsiya → server qayta ishga tushirildi → **barcha
tarix bazadan tiklandi** → AI Copilot orqali "qaysi qurilmalar xavfli?"
so'ralganda to'g'ri javob berdi.

## Keyingi qadamlar (tavsiya)

1. AI Copilot'ni haqiqiy LLM API (masalan, Claude) bilan almashtirish
2. OTA (masofadan firmware yangilash) modulini kodlashtirish
3. Xavfsizlik qatlami: TLS, autentifikatsiya, buyruqlarni imzolash
4. Haqiqiy GPS-qurilma bilan integratsiya (hozircha faqat simulyatsiya)
5. Ko'p qurilmali production uchun Postgres/TimescaleDB'ga o'tish

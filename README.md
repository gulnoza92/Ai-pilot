# AI Pilot — GPS-trekerlar uchun aqlli monitoring tizimi

🇺🇿 O'zbekcha · 🇬🇧 [English](README.en.md)

Avtoparklarda GPS-trekerlar ishlaydi, lekin trekerlar jim bo'lib qoladi: aloqa uziladi, SIM-karta ishlamay qoladi, qurilma qotib qoladi. Mavjud telematika platformalari ogohlantirish yubora oladi, biroq uni kimdir sozlashi, kuzatishi va chora ko'rishi kerak. Amalda avtopark rahbari uzilishni ko'pincha bir necha kundan keyin biladi.

AI Pilot — **mavjud telematika ustidagi ishonchlilik qatlami**. U har bir trekerning signalini kuzatadi, uzilishni avtomatik aniqlaydi, masofadan tiklashga urinadi, tiklanmasa insonga topshiradi va har bir qurilma uchun uptime hisoblaydi.

- **Veb-monitor:** https://ai-pilot-1-bwm2.onrender.com
- **Mobil ilova:** https://ai-pilot-1-bwm2.onrender.com/app

> Demo simulyatsiya qilingan trekerlarda ishlaydi. Backend, diagnostika va Copilot mantig'i — haqiqiy, testdan o'tgan kod. Demo bepul tarifda joylashgan, shuning uchun birinchi ochilish bir daqiqagacha cho'zilishi mumkin.

## Mobil ilova

Egasi uni telefonda havola orqali ochadi. Ilovalar do'koni kerak emas.

- **Bir qarashda:** nechta treker aloqada, qaysi biri jim, qachondan beri va hozir nechanchi qayta ishga tushirish urinishi ketayotgani.
- **Bitta treker:** signal tasmasi va uzilishlar jurnali: boshlanishi, davomiyligi, urinishlar soni va natija.
- **Copilot:** oddiy so'zlar bilan savol va buyruqlar.
- **Uch til:** o'zbek, rus va ingliz. Til ilovaning o'zida almashtiriladi yoki havola orqali tanlanadi: `/app?lang=uz`, `/app?lang=ru`, `/app?lang=en`.
- **O'rnatish:** Android'da (Chrome) brauzer menyusidan ilovani o'rnating yoki bosh ekranga qo'shing. iPhone'da (Safari) «Ulashish» tugmasini bosing, so'ng «Bosh ekranga qo'shish»ni tanlang.

Bu o'sha Node.js serverining o'zi beradigan veb-ilova. Ilovaning o'zi telefonda saqlanadi, shuning uchun bepul tarifdagi server hali uyg'onayotgan paytda ham ochiladi. Trekerlar ma'lumoti hech qachon keshlanmaydi.

## Modullar

| Fayl | Vazifasi |
| --- | --- |
| `lib.js` | Signal monitoring: ONLAYN / KECHIKISH / OFFLAYN holatlari, uptime % |
| `diagnostics.js` | Qurilma ishonchliligi diagnostikasi va avtomatik tiklash (tanaffus bilan qayta ishga tushirish, eskalatsiya) |
| `store.js` | SQLite'da doimiy saqlash (`node:sqlite`); server qayta ishga tushsa ham tarix saqlanadi |
| `copilot.js` | Copilot: o'zbek, rus va ingliz tillarida holat bo'yicha savollar va buyruqlar (naqsh asosida) |
| `server.js` | Barcha modullarni birlashtiruvchi HTTP backend |
| `static.js` | Server berishi mumkin bo'lgan fayllar ro'yxati; diskdagi boshqa hech narsani so'rab bo'lmaydi |
| `mobile.js` | Mobil ilova o'qiydigan yagona umumiy javobni tuzadi (`/api/app/overview`) |
| `app.html`, `sw.js`, `app.webmanifest` | Mobil veb-ilova, uning oflayn nusxasi va o'rnatish manifesti |
| `index.html` | Veb-monitor va Copilot chati |
| `simulate.js` | Demo trekerlar simulyatori (TREKER-3 davriy ravishda offlaynga tushadi) |
| `start.js` | Server va simulyatorni birga ishga tushiradi (demo rejimi) |

## API

| So'rov | Vazifasi |
| --- | --- |
| `POST /api/heartbeat` | Treker signal yuboradi: `{ "deviceId": "TREKER-1", "lat": 41.31, "lng": 69.28 }` |
| `GET /api/devices` | Barcha qurilmalar holati |
| `GET /api/devices/TREKER-1` | Bitta qurilma bo'yicha batafsil ma'lumot |
| `GET /api/diagnostics/risk` | Har bir qurilmaning ishonchlilik balli va xavf darajasi |
| `GET /api/diagnostics/log` | Qayta ishga tushirish urinishlari va eskalatsiyalar jurnali |
| `POST /api/diagnostics/check/TREKER-1` | Bitta qurilmani hozir tekshirish va tiklashni ishga tushirish |
| `POST /api/copilot` | Copilot: `{ "query": "nechta qurilma offlayn?", "lang": "uz" }` |
| `GET /api/app/overview` | Mobil ilova ko'rsatadigan hamma narsa bitta javobda |

## Ishga tushirish

Node.js 22.13 yoki undan yangi versiya kerak (`node:sqlite` uchun). Tashqi bog'liqliklar yo'q.

```bash
npm start        # server + demo simulyator: http://localhost:3000 (monitor) va /app (mobil ilova)
npm run server   # faqat server, simulyatsiya qilingan trekerlarsiz
npm test         # 7 ta faylda 112 ta avtomatik test
```

`PORT` portni belgilaydi (odatda 3000). Demoda uzilish bir necha soniyada ko'rinishi uchun vaqtlar qisqa olingan: 5 soniyadan keyin kechikish, 15 soniyadan keyin offlayn, har 20 soniyada qayta ishga tushirish urinishi, 3 urinishdan keyin eskalatsiya. Ular `server.js` faylidagi `THRESHOLDS` ichida berilgan. Odatiy qiymatlar: 5 daqiqa, 10 daqiqa va 5 daqiqa.

## Hozirgi holat

- ✅ Signal monitoring — tayyor, testdan o'tgan
- ✅ Qurilma ishonchliligi diagnostikasi va avtomatik tiklash — tayyor, testdan o'tgan
- ✅ Doimiy saqlash — server qayta ishga tushgach, tarix bazadan tiklanadi
- ✅ Copilot (naqsh asosida; o'zbek, rus, ingliz) — tayyor, testdan o'tgan
- ✅ Mobil veb-ilova (uch tilda, telefonga o'rnatiladi) — tayyor, Chrome'da telefon ekrani o'lchamlarida tekshirilgan
- ⏳ Wialon adapteri, ogohlantirishlar, OTA yangilanishlari, Edge-AI, LLM backend, xavfsizlik qatlami — loyihalashtirilgan, keyingi bosqich

**Joriy versiyaning cheklovlari.** Demodagi trekerlar simulyatsiya qilingan. Qayta ishga tushirish buyrug'i serverda qayd etiladi, haqiqiy qurilmaga hali yuborilmaydi. API'da hali autentifikatsiya yo'q, shuning uchun uni haqiqiy avtopark ma'lumotlari bilan ochiq internetga qo'ymang.

## Nima sinovdan o'tgan

112 ta avtomatik test quyidagilarni qamraydi: signal holatlari, diagnostika va tiklash, server qayta ishga tushganda saqlash, uch tildagi Copilot, server berishi mumkin bo'lgan fayllar ro'yxati va mobil ilova o'qiydigan umumiy javob.

Qo'lda tekshirilgan:

- HTTP server orqali boshidan oxirigacha sinov: ikkita treker onlayn → biri offlaynga tushdi → avtomatik qayta ishga tushirish urinishlari → eskalatsiya → server qayta ishga tushirildi → barcha tarix bazadan tiklandi → Copilot «qaysi qurilmalar xavfli?» savoliga to'g'ri javob berdi.
- Mobil ilova Chrome'da telefon ekrani o'lchamlarida: 42 ta trekerli avtopark, uzun va lotin bo'lmagan yozuvdagi treker nomlari, aloqa uzilishi, hali uyg'onayotgan server.

## Bozordagi o'rni

O'zbekistonda yetakchi telematika platformasi — Gurtam Wialon; u mahalliy integratorlar (IMG, Stavtrack UZ, GPS Solutions va boshqalar) orqali tarqatiladi. Jahon yetakchilari — Samsara, Geotab, Verizon Connect, Trimble — millionlab avtomobillar ma'lumotiga asoslangan chuqur avtomobil diagnostikasini taklif qiladi.

Bu platformalar **ma'lumotni tahlil qiladi**. AI Pilot esa **ma'lumot umuman kelyaptimi-yo'qmi, shuni kuzatadi** va kelmay qolsa, chora ko'radi. Wialon qurilish bloklarini beradi; AI Pilot ularni bitta tiklash qatlamiga yig'adi.

| | Bugungi Wialon | AI Pilot |
| --- | --- | --- |
| Aloqa uzildi | Ogohlantirish qoidasi: Telegram, ilova, e-mail | Har bir treker kuzatiladi; uzilishlar davomiyligi bilan qayd etiladi |
| Sabab | Tekshiruv qurilmani belgilaydi; tuzatish qo'lda | Har bir treker uchun ishonchlilik balli; tez-tez uziladiganlari belgilanadi |
| Tiklash | Ogohlantirishga bitta buyruq biriktirish mumkin | Tanaffus bilan qayta ishga tushirish urinishlari, so'ng insonga topshirish |
| Hisobot | Hisobotlar va jadvallar | Telefon ilovasi va uch tildagi Copilot; har bir treker uchun uptime |
| Sozlash | Integrator har bir qoidani alohida sozlaydi | Ustiga qo'yiladigan bitta qatlam; hech narsa almashtirilmaydi |

Eng yaqin o'xshash yechim — Navixy'ning qurilma holatini avtomatlashtirish vositasi (avtomatik qayta yuklash, eskalatsiya); u Navixy platformasi ichida ishlaydi. AI Pilot buni Wialon'da qoladigan avtoparklarga olib keladi.

## Mavjud tizimlar bilan integratsiya

AI Pilot hech narsani almashtirmaydi. Ulanishning uch yo'li bor:

1. **Wialon Remote API** — token orqali kirish; `core/search_items` va `unit/calc_last_message` har bir qurilmaning so'nggi signal vaqtini beradi.
2. **Wialon retranslyatori** — xabarlar kelishi bilan bizning manzilimizga real vaqtda uzatiladi.
3. **Trekerdagi ikkinchi server** — Teltonika sinfidagi qurilmalar bir vaqtda ikkita serverga yuboradi; mavjud platformaga tegilmaydi.

Kodda bu bitta adapter: holat ma'lumoti hozir `/api/heartbeat` orqali kiradi; integratsiyada bu manba Wialon bilan almashtiriladi. Monitoring, diagnostika va Copilot mantig'i o'zgarmaydi.

## Yo'l xaritasi

1. Wialon API adapteri va mahalliy integrator bilan haqiqiy avtoparkda pilot
2. Operatsiyalarni avtomatlashtirish: eskalatsiyada ish topshiriqlari, ogohlantirishlar, oylik «avtopark aslida qancha kuzatildi» hisoboti
3. Qurilma qatlami: modul asosidagi prototip, ikki SIM-kartali zaxira aloqa, oflayn bufer, orqaga qaytarish imkoniyatiga ega OTA
4. Copilot uchun LLM backend; production ma'lumotlar bazasi (PostgreSQL + TimescaleDB)

Biz avtomobil diagnostikasini ataylab qurmaymiz — bu bozor millionlab avtomobillar ma'lumotiga ega platformalarga tegishli. Biz ishonchlilik qatlamini chuqurlashtiramiz.

## Litsenziya

Kod MIT litsenziyasi ostida, [LICENSE](LICENSE) fayliga qarang. Ilovaga SIL Open Font License 1.1 ostidagi Sofia Sans shrifti kiritilgan, [font-license.txt](font-license.txt) fayliga qarang.

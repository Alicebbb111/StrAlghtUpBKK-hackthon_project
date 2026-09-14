# SkillBridge

**Small steps. Real possibilities.**

เว็บสำหรับสำรวจทักษะ เริ่มเรียน และเก็บความก้าวหน้าไว้ใน Skill Passport ต่อยอดจาก `Alicebbb111/codexhackthon_project` สาขา `develop` เป็นเวอร์ชัน 2.1 สำหรับส่งงานและเดโม

## เปิดใช้งาน

ต้องมี **Node.js 22.13 ขึ้นไป** แนะนำ Node.js 24 ขึ้นไป

```sh
npm start
```

เปิด **http://localhost:3000** ไม่ต้องรัน `npm install`, ไม่ต้องตั้ง MySQL และฟีเจอร์หลักไม่ต้องใช้ API key (AI Studio ต้องตั้งคีย์แยก)

บน Windows ดับเบิลคลิก `START-WINDOWS.cmd` ได้เช่นกัน จากนั้นเปิด URL ที่แสดงในหน้าต่าง เมื่อใช้งานเสร็จ กด Ctrl+C ในหน้าต่างนั้นเพื่อหยุดเซิร์ฟเวอร์

**ต้องเปิดผ่านเซิร์ฟเวอร์** ไม่ใช่ดับเบิลคลิกไฟล์ HTML เพราะระบบมีการบันทึกข้อมูลจริงผ่าน API

## สิ่งที่ทำได้

- Dashboard แสดงบทถัดไป บทเรียนที่จบ streak จากวันที่เรียนจริง และเป้าหมายรายสัปดาห์
- แบบประเมิน 3 เส้นทาง: Data Analyst, Web Developer, Digital Marketer รวม 36 คำถาม
- 12 บทเรียนที่อ่านได้ในเว็บ พร้อมโจทย์ตรวจความเข้าใจ mini project และแหล่งอ่านต่อ
- Learning path จัดบทเรียนจากคะแนนรายทักษะ โดยยังเลือกเรียนข้ามบทได้
- โน้ตส่วนตัวและ bookmark บทเรียน แยกข้อมูลแต่ละ workspace
- Guest session ที่เริ่มใช้ได้ทันที และสมัครบัญชีเพื่อเก็บความก้าวหน้าเดิมต่อได้
- Login, logout, ตั้งชื่อและเป้าหมาย, ส่งออก JSON และลบ workspace
- Skill Passport พร้อม stylesheet สำหรับพิมพ์และ Save as PDF จากเบราว์เซอร์
- ค้นหาทั้งในคลังบทเรียนและ global search กด `/` เพื่อเปิด
- UI ไทย–อังกฤษ ฟอนต์อยู่ในโปรเจกต์ รองรับมือถือและ reduced motion

## Demo flow

อ่าน `DEMO.md` สำหรับบทพูดและลำดับนำเสนอประมาณ 3–5 นาที

1. เปิด Overview แล้วกด **Discover my strengths**
2. เลือกเส้นทาง ตอบ 12 ข้อ และดูผลรายทักษะ
3. เปิด **My learning path** แล้วเลือกบทเรียน
4. อ่าน ทดลองตอบโจทย์ท้ายบท บันทึกโน้ต และ bookmark
5. กลับ Overview จะเห็นความก้าวหน้าอัปเดต
6. เปิด **Skill passport** แล้วกด **Print / Save PDF**

ไม่มีบัญชีสาธิตหรือผลเรียนที่เติมไว้ล่วงหน้า เมื่อเปิดครั้งแรกจะเริ่มจากข้อมูลว่าง การสาธิตจึงสะท้อนการใช้งานจริง

## รันทดสอบ

```sh
npm test
```

ชุดทดสอบใช้ `node:test` และฐานข้อมูลชั่วคราวแยกจากข้อมูลใช้งาน ตรวจทั้งการคำนวณคะแนน การไม่บันทึกซ้ำ การแยกผู้ใช้ การ login การ export/delete ความปลอดภัยพื้นฐาน การเขียนพร้อมกัน และการเปิดเซิร์ฟเวอร์ใหม่โดยข้อมูลไม่หาย

ผลตรวจและขั้นตอนที่ลองผ่านเบราว์เซอร์อยู่ใน `TEST-REPORT.md`

## โครงสร้าง

```text
backend/
  server.js           จุดเริ่มรัน
  app.js              HTTP API, sessions, SQLite, authentication
  content.js          บทเรียนและคลังคำถาม พร้อมเฉลยที่อยู่ฝั่ง server
ai/
  skillAnalysis.js    เก็บแกนวิเคราะห์ skill gap จากโค้ดเดิม
  careerSkills.js     เกณฑ์ทักษะสำหรับ 3 เส้นทาง
frontend/skillbridge-ai/
  index.html          App shell
  js/main.js          Routing และหน้าจอทั้งหมด
  css/                Design system, responsive, print, local fonts
  assets/             โลโก้ ฟอนต์ ใบอนุญาตฟอนต์ และมาสคอตต้นฉบับ
tests/app.test.js      Integration tests
data/                 สร้างอัตโนมัติตอนรัน ไม่รวมในไฟล์ส่งงาน
```

## ข้อมูลและการตั้งค่า

ข้อมูลอยู่ใน `data/skillbridge.sqlite` พร้อมไฟล์ WAL/SHM ที่ SQLite อาจสร้างไว้ ระบบใช้ scrypt สำหรับรหัสผ่านและคุกกี้ HttpOnly, SameSite=Lax อายุ 30 วัน การล้างคุกกี้ Guest จะทำให้เข้า workspace เดิมไม่ได้ จึงควรสมัครก่อนย้ายเบราว์เซอร์

ค่าเริ่มต้น bind เฉพาะ `127.0.0.1:3000` หากต้องเปลี่ยนพอร์ตหรือ data directory ให้คัดลอก `.env.example` เป็น `.env` แล้วรัน:

```sh
node --env-file=.env backend/server.js
```

สำหรับ LAN กำหนด `HOST=0.0.0.0` เฉพาะเมื่อคุณต้องการให้เครื่องอื่นเข้าถึง หากนำขึ้นเซิร์ฟเวอร์จริง ต้องใช้ persistent disk, HTTPS, reverse proxy และตั้ง `COOKIE_SECURE=1` การ deploy ไป static hosting อย่าง GitHub Pages อย่างเดียวไม่เพียงพอ เพราะต้องมี Node server

สำรองข้อมูลด้วยการหยุดเซิร์ฟเวอร์แล้วคัดลอกโฟลเดอร์ `data/` เก็บไว้อย่างปลอดภัย อย่าส่งฐานข้อมูลส่วนตัวไปพร้อม source code

## การตัดสินใจจากเวอร์ชันเดิม

- รักษาแนวคิด Discover → Learn → Grow → Passport, ตำแหน่งโฟลเดอร์ frontend และฟังก์ชัน `analyzeSkills` จากโค้ดเดิม
- URL เก่า เช่น `/assessment.html` และ `/passport.html` ยังเข้าแอปหน้าเดิมได้
- เปลี่ยนชั้นข้อมูลจาก MySQL ที่ต้องตั้งค่าแยก มาเป็น SQLite เพื่อให้ผู้ตรวจรันได้ทันที โค้ดเวอร์ชันนี้ **ไม่ได้ย้ายข้อมูลจาก MySQL เดิมอัตโนมัติ** และไม่คง compatibility ของ API เก่าทุก endpoint
- แทนที่ข้อมูล mock และแชทที่ยังไม่เชื่อม ด้วยบทเรียน ผลประเมิน และข้อมูลจากการใช้งานจริง
- แบบประเมินมาตรฐานใช้เกณฑ์ที่ตรวจสอบได้ ส่วน AI Studio เรียก OpenAI จริงเมื่อใส่คีย์และผู้เรียนกดสร้าง มีค่าใช้จ่าย API ตามบัญชีผู้ดูแล
- เวอร์ชัน Final แยกไว้ที่ `Alicebbb111/StrAlghtUpBKK-hackthon_project` โดยคงโค้ดและประวัติใน repository ต้นฉบับไว้ รายละเอียด baseline อยู่ใน `SOURCE.json`

## ขอบเขตของเวอร์ชันนี้

พร้อมเปิดรัน ส่งซอร์ส และสาธิตฟีเจอร์ข้างต้น การนำไปเปิดบริการสาธารณะยังต้องเพิ่ม email verification, password recovery, monitoring, นโยบายสำรอง/ลบข้อมูล และทบทวนเนื้อหากับผู้สอน ไม่มี job feed, การรับรองจากนายจ้าง หรือการประเมินคุณภาพ mini project อัตโนมัติ

คะแนน 3 ข้อต่อทักษะเป็นเพียงการสำรวจพื้นฐาน ค่าเกณฑ์ใน `careerSkills.js` เป็นเกณฑ์ของโปรเจกต์ ไม่ใช่มาตรฐานอุตสาหกรรม ความสำเร็จของบทเรียนมาจากการตอบโจทย์ท้ายบท ไม่ใช่หลักฐานความชำนาญแบบมีผู้คุมสอบ

Font licenses: `assets/DM-Sans-OFL.txt` และ `assets/Noto-Sans-Thai-OFL.txt` มาสคอตเดิมเก็บไว้เป็น asset ของโปรเจกต์ แต่หน้า UI ใหม่นี้ใช้โลโก้และภาพประกอบ SVG

## AI Studio (v2.1)

- Generate a five-question practice form from a topic, answer it and review explanations. AI practice scores remain separate from the standard Skill Passport assessment.
- Summarize pasted notes and receive suggested study steps. Optionally include the latest scores for the current track and completed lesson count.
- Keep the latest 10 outputs per workspace. AI does not run automatically.

### Enable later

1. Copy .env.example to .env in the project root.
2. Set OPENAI_API_KEY to your own key. Never commit .env or paste the key into frontend code.
3. Run npm start (or START-WINDOWS.cmd). The server automatically loads .env. Restart and refresh the browser after changing it.
4. Open AI Studio. A configured key does not guarantee valid credentials, credit or provider availability.

OPENAI_MODEL defaults to gpt-4.1-mini. AI_DAILY_LIMIT defaults to 20 attempted calls per server per UTC day, persisted in SQLite; failed calls also consume this application quota. This is a request limit, not a monetary cap. Set account spending controls separately. The server does not automatically retry charged requests.

Requests use the [OpenAI Responses API with Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), store:false, a 60-second provider timeout, and server-side output validation. Only the entered text and explicitly selected progress are sent; names, emails and unrelated notes are excluded. Review generated content for accuracy. Keeping store:false does not replace the provider's data policies.

No real key or paid request was used in verification. Automated AI tests use a mocked provider transport. Live response quality, account access and billing must be checked after the owner supplies a key. Without a key the page explains setup and disables generation; the original lessons and assessments continue to work.

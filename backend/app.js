const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} = require("node:crypto");
const { promisify } = require("node:util");
const { tracks, lessons, questions } = require("./content");
const { analyzeSkills } = require("../ai/skillAnalysis");
const hashPassword = promisify(scrypt);
const publicDir = path.resolve(__dirname, "../frontend/skillbridge-ai");
const cleanLesson = ({ correct, explanation, ...rest }) => rest;
const initialState = () => ({
  name: "",
  track: "analyst",
  weeklyGoal: 3,
  completed: [],
  notes: {},
  saved: [],
  assessments: [],
  activity: [],
});
const fail = (status, message) => Object.assign(new Error(message), { status });
function string(value, label, max, min = 1) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw fail(400, `${label} ต้องมี ${min}–${max} ตัวอักษร`);
  return value.trim();
}
function createApp({
  dataDir = process.env.DATA_DIR || path.resolve(__dirname, "../data"),
  clock = () => Date.now(),
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "skillbridge.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), track TEXT NOT NULL, expires INTEGER NOT NULL, submitted INTEGER DEFAULT 0);
  `);
  const limits = new Map();
  function limit(req, category, max) {
    const key = `${req.socket.remoteAddress}:${category}`;
    const now = clock();
    if (limits.size > 10000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    let item = limits.get(key);
    if (!item || item.until < now) {
      item = { count: 0, until: now + 15 * 60000 };
      limits.set(key, item);
    }
    if (++item.count > max)
      throw fail(429, "ลองบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่");
  }
  const save = (user, state) =>
    db
      .prepare("UPDATE users SET state=? WHERE id=?")
      .run(JSON.stringify(state), user.id);
  function session(res, id) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires < ?").run(clock());
    db.prepare("DELETE FROM attempts WHERE expires < ?").run(clock());
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      token,
      id,
      clock() + 30 * 86400000,
    );
    res.setHeader(
      "Set-Cookie",
      `sb_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.COOKIE_SECURE === "1" ? "; Secure" : ""}`,
    );
  }
  function getUser(req) {
    const token = (req.headers.cookie || "").match(
      /(?:^|;\s*)sb_session=([a-f0-9]{64})(?:;|$)/,
    )?.[1];
    const row =
      token &&
      db
        .prepare(
          "SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE token=? AND expires>?",
        )
        .get(token, clock());
    if (!row) throw fail(401, "เซสชันหมดอายุ กรุณาเปิดหน้าใหม่หรือเข้าสู่ระบบ");
    return { ...row, state: JSON.parse(row.state), token };
  }
  const publicUser = (user) => ({
    registered: Boolean(user.email),
    email: user.email || null,
    state: user.state,
  });
  async function body(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) throw fail(413, "ข้อมูลมีขนาดใหญ่เกินไป");
      chunks.push(chunk);
    }
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      if (!data || Array.isArray(data) || typeof data !== "object")
        throw Error();
      return data;
    } catch {
      throw fail(400, "รูปแบบข้อมูลไม่ถูกต้อง");
    }
  }
  function json(res, status, value) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost");
      const route = url.pathname;
      if (!route.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(req.method))
          throw fail(405, "Method not allowed");
        if (route === "/health") return json(res, 200, { status: "ok" });
        let relative =
          decodeURIComponent(route).replace(/^\/+/, "") || "index.html";
        // Preserve the original project's page URLs.
        if (
          /^(dashboard|assessment|path|passport|login|register|resources)\.html$/.test(
            relative,
          )
        )
          relative = "index.html";
        const file = path.resolve(publicDir, relative);
        if (
          !file.startsWith(publicDir + path.sep) ||
          !fs.existsSync(file) ||
          !fs.statSync(file).isFile()
        )
          throw fail(404, "ไม่พบหน้านี้");
        const types = {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".ttf": "font/ttf",
          ".woff2": "font/woff2",
          ".ico": "image/x-icon",
        };
        res.writeHead(200, {
          "Content-Type":
            types[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        return req.method === "HEAD"
          ? res.end()
          : fs.createReadStream(file).pipe(res);
      }
      if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method))
        throw fail(405, "Method not allowed");
      if (req.method !== "GET") {
        if (req.headers["x-skillbridge"] !== "1")
          throw fail(403, "คำขอไม่ถูกต้อง กรุณาเปิดผ่าน SkillBridge");
        if (
          req.headers.origin &&
          new URL(req.headers.origin).host !== req.headers.host
        )
          throw fail(403, "ไม่อนุญาตคำขอจากเว็บไซต์อื่น");
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw fail(415, "Expected JSON");
      }
      // Read the complete body before taking a state snapshot so concurrent writes cannot overwrite each other.
      const inputBody = req.method === "GET" ? {} : await body(req);
      if (route === "/api/catalog" && req.method === "GET")
        return json(res, 200, { tracks, lessons: lessons.map(cleanLesson) });
      if (route === "/api/session" && req.method === "POST") {
        try {
          return json(res, 200, publicUser(getUser(req)));
        } catch (e) {
          if (e.status !== 401) throw e;
        }
        limit(req, "guest", 50);
        const id = randomUUID();
        const state = initialState();
        db.prepare("INSERT INTO users VALUES (?,NULL,NULL,?)").run(
          id,
          JSON.stringify(state),
        );
        session(res, id);
        return json(res, 201, { registered: false, email: null, state });
      }
      if (route === "/api/login" && req.method === "POST") {
        limit(req, "auth", 30);
        const input = inputBody;
        const email = string(input.email, "Email", 254).toLowerCase();
        const password = string(input.password, "Password", 128, 1);
        const found = db
          .prepare("SELECT * FROM users WHERE email=?")
          .get(email);
        const [salt, stored] = (
          found?.password || `${"0".repeat(32)}:${"0".repeat(128)}`
        ).split(":");
        const actual = await hashPassword(password, salt, 64);
        if (!found || !timingSafeEqual(actual, Buffer.from(stored, "hex")))
          throw fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        const old = (req.headers.cookie || "").match(
          /sb_session=([a-f0-9]{64})/,
        )?.[1];
        if (old) db.prepare("DELETE FROM sessions WHERE token=?").run(old);
        session(res, found.id);
        return json(
          res,
          200,
          publicUser({ ...found, state: JSON.parse(found.state) }),
        );
      }
      const user = getUser(req);
      const state = user.state;
      if (route === "/api/me" && req.method === "GET")
        return json(res, 200, publicUser(user));
      if (route === "/api/register" && req.method === "POST") {
        limit(req, "auth", 30);
        const input = inputBody;
        if (user.email) throw fail(409, "บัญชีนี้สมัครแล้ว");
        const email = string(input.email, "Email", 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw fail(400, "กรอกอีเมลให้ถูกต้อง");
        const name = string(input.name, "ชื่อ", 60);
        const password = string(input.password, "Password", 128, 8);
        if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
          throw fail(409, "อีเมลนี้ถูกใช้แล้ว ลองเข้าสู่ระบบ");
        const salt = randomBytes(16).toString("hex");
        const hashed = `${salt}:${(await hashPassword(password, salt, 64)).toString("hex")}`;
        // Reload after asynchronous hashing to avoid overwriting simultaneous learning updates.
        const fresh = JSON.parse(
          db.prepare("SELECT state FROM users WHERE id=?").get(user.id).state,
        );
        fresh.name = name;
        try {
          db.prepare(
            "UPDATE users SET email=?,password=?,state=? WHERE id=?",
          ).run(email, hashed, JSON.stringify(fresh), user.id);
        } catch (error) {
          if (String(error.message).includes("UNIQUE"))
            throw fail(409, "อีเมลนี้ถูกใช้แล้ว");
          throw error;
        }
        db.prepare("DELETE FROM sessions WHERE token=?").run(user.token);
        session(res, user.id);
        return json(res, 201, { registered: true, email, state: fresh });
      }
      if (route === "/api/logout" && req.method === "POST") {
        db.prepare("DELETE FROM sessions WHERE token=?").run(user.token);
        res.setHeader(
          "Set-Cookie",
          "sb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        );
        return json(res, 200, { ok: true });
      }
      if (route === "/api/profile" && req.method === "PATCH") {
        const input = inputBody;
        if ("name" in input) state.name = string(input.name, "ชื่อ", 60, 0);
        if ("track" in input) {
          if (!tracks.some((t) => t.id === input.track))
            throw fail(400, "ไม่พบเส้นทางนี้");
          state.track = input.track;
        }
        if ("weeklyGoal" in input) {
          if (![1, 3, 5, 7].includes(input.weeklyGoal))
            throw fail(400, "เลือกเป้าหมาย 1, 3, 5 หรือ 7 บทต่อสัปดาห์");
          state.weeklyGoal = input.weeklyGoal;
        }
        save(user, state);
        return json(res, 200, state);
      }
      if (route === "/api/assessment" && req.method === "POST") {
        limit(req, "assessment", 80);
        const input = inputBody;
        if (!tracks.some((t) => t.id === input.track))
          throw fail(400, "เลือกเส้นทางก่อนเริ่ม");
        const id = randomUUID();
        db.prepare("INSERT INTO attempts VALUES (?,?,?,?,0)").run(
          id,
          user.id,
          input.track,
          clock() + 2 * 3600000,
        );
        return json(res, 201, {
          id,
          track: input.track,
          questions: questions[input.track].map(({ correct, ...rest }) => rest),
        });
      }
      if (route === "/api/assessment/submit" && req.method === "POST") {
        const input = inputBody;
        const attempt =
          typeof input.id === "string" &&
          db
            .prepare("SELECT * FROM attempts WHERE id=? AND user_id=?")
            .get(input.id, user.id);
        if (!attempt || attempt.expires < clock())
          throw fail(400, "แบบประเมินหมดอายุ กรุณาเริ่มใหม่");
        if (attempt.submitted) throw fail(409, "แบบประเมินนี้ส่งแล้ว");
        const qs = questions[attempt.track];
        if (
          !Array.isArray(input.answers) ||
          input.answers.length !== qs.length ||
          input.answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)
        )
          throw fail(400, "ตอบให้ครบทุกข้อก่อนส่ง");
        const track = tracks.find((t) => t.id === attempt.track);
        const scores = {};
        for (const skill of track.skills) {
          const indices = qs
            .map((q, i) => (q.skill === skill ? i : -1))
            .filter((i) => i >= 0);
          scores[skill] = Math.round(
            (indices.filter((i) => qs[i].correct === input.answers[i]).length /
              indices.length) *
              100,
          );
        }
        const correct = qs.filter(
          (q, i) => q.correct === input.answers[i],
        ).length;
        const result = {
          id: attempt.id,
          track: attempt.track,
          at: new Date(clock()).toISOString(),
          scores,
          correct,
          total: qs.length,
          analysis: analyzeSkills(scores, track.name),
        };
        state.track = attempt.track;
        state.assessments = [...state.assessments, result].slice(-30);
        db.exec("BEGIN");
        try {
          save(user, state);
          db.prepare("UPDATE attempts SET submitted=1 WHERE id=?").run(
            attempt.id,
          );
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
        return json(res, 200, {
          result,
          state,
          review: qs.map((q, i) => ({
            text: q.text,
            selected: q.choices[input.answers[i]],
            correct: q.choices[q.correct],
            passed: input.answers[i] === q.correct,
          })),
        });
      }
      const match = route.match(
        /^\/api\/lessons\/([a-z]+-\d)\/(complete|note|save)$/,
      );
      if (match && req.method === "POST") {
        const l = lessons.find((l) => l.id === match[1]);
        if (!l) throw fail(404, "ไม่พบบทเรียน");
        const input = inputBody;
        if (match[2] === "complete") {
          if (
            !Number.isInteger(input.answer) ||
            input.answer < 0 ||
            input.answer > 3
          )
            throw fail(400, "เลือกคำตอบก่อนตรวจ");
          if (input.answer !== l.correct)
            return json(res, 200, {
              passed: false,
              explanation: "ยังไม่ตรง ลองทบทวนเนื้อหาด้านบนแล้วเลือกอีกครั้ง",
              state,
            });
          if (!state.completed.includes(l.id)) {
            state.completed.push(l.id);
            state.activity.push({
              lessonId: l.id,
              at: new Date(clock()).toISOString(),
            });
          }
          save(user, state);
          return json(res, 200, {
            passed: true,
            explanation: l.explanation,
            state,
          });
        }
        if (match[2] === "note")
          state.notes[l.id] = string(input.note, "บันทึก", 4000, 0);
        if (match[2] === "save") {
          if (typeof input.saved !== "boolean")
            throw fail(400, "สถานะบันทึกไม่ถูกต้อง");
          state.saved = input.saved
            ? [...new Set([...state.saved, l.id])]
            : state.saved.filter((id) => id !== l.id);
        }
        save(user, state);
        return json(res, 200, state);
      }
      if (route === "/api/export" && req.method === "GET") {
        if (url.searchParams.get("download") === "1") {
          res.setHeader("Content-Disposition", `attachment; filename="skillbridge-data-${new Date(clock()).toISOString().slice(0, 10)}.json"`);
        }
        return json(res, 200, {
          product: "SkillBridge",
          version: 2,
          exportedAt: new Date(clock()).toISOString(),
          ...publicUser(user),
        });
      }
      if (route === "/api/me" && req.method === "DELETE") {
        const input = inputBody;
        if (input.confirm !== "DELETE")
          throw fail(400, "ยืนยันการลบข้อมูลก่อน");
        db.exec("BEGIN");
        try {
          db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
          db.prepare("DELETE FROM attempts WHERE user_id=?").run(user.id);
          db.prepare("DELETE FROM users WHERE id=?").run(user.id);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
        res.setHeader(
          "Set-Cookie",
          "sb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        );
        return json(res, 200, { ok: true });
      }
      throw fail(404, "ไม่พบรายการที่ขอ");
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent)
        json(res, error.status || 500, {
          error: error.status
            ? error.message
            : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        });
      else res.end();
    }
  });
  server.on("close", () => db.close());
  return server;
}
module.exports = { createApp };

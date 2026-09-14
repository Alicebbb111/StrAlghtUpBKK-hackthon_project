const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createApp } = require("../backend/app");
const { tracks, lessons, questions } = require("../backend/content");
const { analyzeSkills } = require("../ai/skillAnalysis");

async function setup(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "skillbridge-test-"));
  const server = createApp({ dataDir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  function client() {
    let cookie = "";
    return async (route, method = "GET", body, headers = {}) => {
      const res = await fetch(base + route, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-SkillBridge": "1",
          Cookie: cookie,
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const data = res.headers.get("content-type")?.includes("json")
        ? await res.json()
        : await res.text();
      return { status: res.status, data, headers: res.headers };
    };
  }
  return { client, base, dataDir, server };
}

test("catalog content is complete, skill mappings are valid, answer keys remain private", async (t) => {
  const { client } = await setup(t);
  const request = client();
  const r = await request("/api/catalog");
  assert.equal(r.status, 200);
  assert.equal(r.data.lessons.length, 12);
  assert.equal(r.data.tracks.length, 3);
  assert.equal(new Set(lessons.map((l) => l.id)).size, 12);
  for (const l of r.data.lessons) {
    assert.equal(l.correct, undefined);
    assert.equal(l.explanation, undefined);
    assert.ok(l.sections.length >= 3);
    assert.equal(l.choices.length, 4);
    assert.ok(l.resource[1].startsWith("https://"));
  }
  for (const track of tracks) {
    assert.equal(questions[track.id].length, 12);
    assert.equal(lessons.filter((l) => l.track === track.id).length, 4);
    for (const skill of track.skills)
      assert.equal(
        questions[track.id].filter((q) => q.skill === skill).length,
        3,
      );
  }
});

test("guest state persists, account registration retains progress, login restores the correct user", async (t) => {
  const { client } = await setup(t);
  const a = client();
  const b = client();
  assert.equal((await a("/api/me")).status, 401);
  assert.equal((await a("/api/session", "POST", {})).status, 201);
  await a("/api/profile", "PATCH", { name: "ผู้เรียนทดสอบ", weeklyGoal: 5 });
  await a("/api/lessons/data-1/note", "POST", {
    note: "ทดสอบโน้ตภาษาไทย <script>เป็นข้อความเท่านั้น</script>",
  });
  await a("/api/lessons/data-1/complete", "POST", { answer: 0 });
  let r = await a("/api/register", "POST", {
    name: "Test Learner",
    email: "LEARNER@example.test",
    password: "correct-test-password",
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.email, "learner@example.test");
  assert.deepEqual(r.data.state.completed, ["data-1"]);
  assert.equal((await a("/api/session", "POST", {})).data.registered, true);
  await b("/api/session", "POST", {});
  assert.equal((await b("/api/me")).data.state.completed.length, 0);
  assert.equal(
    (
      await b("/api/login", "POST", {
        email: "learner@example.test",
        password: "wrong",
      })
    ).status,
    401,
  );
  r = await b("/api/login", "POST", {
    email: "learner@example.test",
    password: "correct-test-password",
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.state.weeklyGoal, 5);
  assert.deepEqual(r.data.state.completed, ["data-1"]);
  assert.match(r.data.state.notes["data-1"], /ภาษาไทย/);
  assert.equal(r.data.password, undefined);
  assert.equal(r.data.id, undefined);
  const exported = await b("/api/export?download=1");
  assert.match(exported.headers.get("content-disposition"), /attachment; filename="skillbridge-data-/);
  assert.equal(exported.data.version, 2);
  assert.equal(exported.data.state.name, "Test Learner");
  assert.equal(exported.data.password, undefined);
  await b("/api/logout", "POST", {});
  assert.equal((await b("/api/me")).status, 401);
  assert.equal((await a("/api/me")).status, 200);
});

test("assessment grading is server-owned, rejects incomplete submissions and duplicate attempts", async (t) => {
  const { client } = await setup(t);
  const a = client();
  await a("/api/session", "POST", {});
  for (const track of tracks) {
    const start = await a("/api/assessment", "POST", { track: track.id });
    assert.equal(start.status, 201);
    assert.equal(start.data.questions[0].correct, undefined);
    assert.equal(
      (
        await a("/api/assessment/submit", "POST", {
          id: start.data.id,
          answers: [1],
        })
      ).status,
      400,
    );
    const answers = questions[track.id].map((q) => q.correct);
    const result = await a("/api/assessment/submit", "POST", {
      id: start.data.id,
      answers,
      scores: { Excel: 0 },
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.result.correct, 12);
    assert.ok(Object.values(result.data.result.scores).every((s) => s === 100));
    assert.equal(
      (
        await a("/api/assessment/submit", "POST", {
          id: start.data.id,
          answers,
        })
      ).status,
      409,
    );
  }
  assert.equal((await a("/api/me")).data.state.assessments.length, 3);
  const start = await a("/api/assessment", "POST", { track: "analyst" });
  const result = await a("/api/assessment/submit", "POST", {
    id: start.data.id,
    answers: questions.analyst.map((q) => (q.correct + 1) % 4),
  });
  assert.equal(result.data.result.correct, 0);
  assert.equal(result.data.result.analysis.weak_or_missing_skills.length, 4);
});

test("practice completion is idempotent, all lessons grade correctly, notes and bookmarks persist", async (t) => {
  const { client } = await setup(t);
  const a = client();
  await a("/api/session", "POST", {});
  for (const l of lessons) {
    let r = await a(`/api/lessons/${l.id}/complete`, "POST", {
      answer: (l.correct + 1) % 4,
    });
    assert.equal(r.data.passed, false);
    assert.ok(!r.data.state.completed.includes(l.id));
    r = await a(`/api/lessons/${l.id}/complete`, "POST", { answer: l.correct });
    assert.equal(r.data.passed, true);
    await a(`/api/lessons/${l.id}/complete`, "POST", { answer: l.correct });
  }
  let r = await a("/api/me");
  assert.equal(r.data.state.completed.length, 12);
  assert.equal(r.data.state.activity.length, 12);
  await a("/api/lessons/data-2/save", "POST", { saved: true });
  await a("/api/lessons/data-2/save", "POST", { saved: true });
  assert.deepEqual((await a("/api/me")).data.state.saved, ["data-2"]);
  await a("/api/lessons/data-2/save", "POST", { saved: false });
  assert.deepEqual((await a("/api/me")).data.state.saved, []);
  assert.equal(
    (await a("/api/lessons/data-2/note", "POST", { note: "x".repeat(4001) }))
      .status,
    400,
  );
});

test("sessions isolate assessments and content; deleting an account revokes all sessions", async (t) => {
  const { client } = await setup(t);
  const a = client(),
    b = client();
  await a("/api/session", "POST", {});
  await b("/api/session", "POST", {});
  const attempt = (await a("/api/assessment", "POST", { track: "analyst" }))
    .data;
  assert.equal(
    (
      await b("/api/assessment/submit", "POST", {
        id: attempt.id,
        answers: questions.analyst.map((q) => q.correct),
      })
    ).status,
    400,
  );
  assert.equal((await a("/api/me", "DELETE", { confirm: "no" })).status, 400);
  assert.equal(
    (await a("/api/me", "DELETE", { confirm: "DELETE" })).status,
    200,
  );
  assert.equal((await a("/api/me")).status, 401);
  assert.equal((await b("/api/me")).status, 200);
});

test("validation and same-origin protection reject invalid mutations", async (t) => {
  const { client } = await setup(t);
  const a = client();
  await a("/api/session", "POST", {});
  assert.equal(
    (await a("/api/profile", "PATCH", { weeklyGoal: 0 })).status,
    400,
  );
  assert.equal(
    (await a("/api/profile", "PATCH", { track: "unknown" })).status,
    400,
  );
  assert.equal(
    (await a("/api/assessment", "POST", { track: "unknown" })).status,
    400,
  );
  assert.equal(
    (
      await a(
        "/api/profile",
        "PATCH",
        { name: "test" },
        { "X-SkillBridge": "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await a(
        "/api/profile",
        "PATCH",
        { name: "test" },
        { Origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await a("/api/register", "POST", {
        name: "Test",
        email: "not-an-email",
        password: "12345678",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a("/api/register", "POST", {
        name: "Test",
        email: "test@example.test",
        password: "short",
      })
    ).status,
    400,
  );
  assert.equal(
    (await a("/api/lessons/data-1/complete", "POST", { answer: 9 })).status,
    400,
  );
  assert.equal(
    (await a("/api/lessons/data-1/save", "POST", { saved: "yes" })).status,
    400,
  );
});

test("static app and original page URLs load with security headers, private files remain inaccessible", async (t) => {
  const { client } = await setup(t);
  const a = client();
  for (const page of [
    "/",
    "/dashboard.html",
    "/assessment.html",
    "/passport.html",
    "/path.html",
    "/login.html",
    "/register.html",
  ]) {
    const r = await a(page);
    assert.equal(r.status, 200);
    assert.match(r.data, /SkillBridge/);
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
  }
  for (const route of [
    "/backend/app.js",
    "/data/skillbridge.sqlite",
    "/.env",
    "/../package.json",
  ])
    assert.equal((await a(route)).status, 404);
  assert.equal((await a("/js/main.js")).status, 200);
  assert.equal((await a("/css/style.css")).status, 200);
  assert.equal((await a("/health")).data.status, "ok");
});

test("original skill analysis validates boundaries and supports all three career profiles", () => {
  assert.throws(() => analyzeSkills({ Excel: -1 }, "Data Analyst"));
  assert.throws(() => analyzeSkills({ Excel: NaN }, "Data Analyst"));
  assert.throws(() => analyzeSkills({}, "Unknown Career"));
  for (const track of tracks) {
    const result = analyzeSkills(
      Object.fromEntries(track.skills.map((s) => [s, 100])),
      track.name,
    );
    assert.equal(result.career_readiness, 100);
    assert.deepEqual(result.weak_or_missing_skills, []);
  }
});

test("concurrent delayed requests do not lose completed lessons", async (t) => {
  const { base } = await setup(t);
  const session = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-SkillBridge": "1" },
    body: "{}",
  });
  const cookie = session.headers.get("set-cookie").split(";")[0];
  await session.json();
  const http = require("node:http");
  let delayed;
  const first = new Promise((resolve, reject) => {
    delayed = http.request(
      base + "/api/lessons/data-1/complete",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-SkillBridge": "1",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(JSON.parse(data)));
      },
    );
    delayed.on("error", reject);
    delayed.write('{"answer":');
  });
  const second = await fetch(base + "/api/lessons/data-2/complete", {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      "X-SkillBridge": "1",
    },
    body: '{"answer":1}',
  });
  assert.equal((await second.json()).passed, true);
  delayed.end("0}");
  assert.equal((await first).passed, true);
  const result = await (
    await fetch(base + "/api/me", { headers: { Cookie: cookie } })
  ).json();
  assert.deepEqual(
    new Set(result.state.completed),
    new Set(["data-1", "data-2"]),
  );
  assert.equal(result.state.activity.length, 2);
});

test("SQLite state and sessions survive a complete server restart", async (t) => {
  const dataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "skillbridge-restart-"),
  );
  let server = createApp({ dataDir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  let base = `http://127.0.0.1:${server.address().port}`;
  const session = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-SkillBridge": "1" },
    body: "{}",
  });
  const cookie = session.headers.get("set-cookie").split(";")[0];
  await session.json();
  await fetch(base + "/api/profile", {
    method: "PATCH",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      "X-SkillBridge": "1",
    },
    body: '{"name":"Restart test","weeklyGoal":7}',
  });
  await new Promise((resolve) => server.close(resolve));
  server = createApp({ dataDir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
  const result = await (
    await fetch(base + "/api/me", { headers: { Cookie: cookie } })
  ).json();
  assert.equal(result.state.name, "Restart test");
  assert.equal(result.state.weeklyGoal, 7);
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { generate } = require("../ai/studio");
const { createApp } = require("../backend/app");
const form = {
  title: "SQL practice",
  questions: Array.from({ length: 5 }, (_, i) => ({
    text: `Question ${i}`,
    choices: ["A", "B", "C", "D"],
    correct: 1,
    explanation: "Because B",
  })),
};
const response = (value) => ({
  ok: true,
  json: async () => ({
    status: "completed",
    output: [
      { content: [{ type: "output_text", text: JSON.stringify(value) }] },
    ],
  }),
});
test("provider sends structured Responses request and strips unrelated personal data", async () => {
  const result = await generate(
    "form",
    { topic: "SQL" },
    {
      key: "test-only",
      transport: async (url, request) => {
        assert.equal(url, "https://api.openai.com/v1/responses");
        const body = JSON.parse(request.body);
        assert.equal(body.store, false);
        assert.equal(body.text.format.strict, true);
        assert.equal(body.max_output_tokens, 3500);
        return response(form);
      },
    },
  );
  assert.deepEqual(result, form);
});
test("provider handles missing key, refusal, malformed output and upstream failure without leaking details", async () => {
  await assert.rejects(generate("form", {}, { key: "" }), { status: 503 });
  for (const transport of [
    async () => response({}),
    async () => ({ ok: false, status: 401 }),
    async () => {
      throw Error("SECRET");
    },
    async () => ({
      ok: true,
      json: async () => ({
        status: "completed",
        output: [{ content: [{ type: "refusal" }] }],
      }),
    }),
  ]) {
    await assert.rejects(
      generate("form", {}, { key: "SECRET", transport }),
      (e) => e.status === 502 && !e.message.includes("SECRET"),
    );
  }
});
test("AI forms keep answer keys private, grade on server, persist history and enforce quota and ownership", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-ai-"));
  let calls = 0;
  const server = createApp({
    dataDir: dir,
    ai: {
      key: "test-only",
      transport: async () => {
        calls++;
        return response(form);
      },
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  async function request(route, body) {
    const res = await fetch(base + "/api" + route, {
      method: body ? "POST" : "GET",
      headers: {
        Cookie: cookie,
        "X-SkillBridge": "1",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.headers.get("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    return { status: res.status, data: await res.json() };
  }
  assert.equal((await request("/ai/status")).status, 401);
  await request("/session", {});
  assert.equal((await request("/ai/form", { topic: "SQL" })).status, 400);
  const generated = await request("/ai/form", { topic: "SQL", consent: true });
  assert.equal(generated.status, 200);
  assert.equal(generated.data.questions[0].correct, undefined);
  assert.equal(
    (await request("/me")).data.state.aiHistory[0].questions[0].correct,
    undefined,
  );
  assert.equal(
    (await request("/ai/history")).data.items[0].questions[0].explanation,
    undefined,
  );
  assert.equal(
    (await request("/ai/submit", { id: generated.data.id, answers: [1] }))
      .status,
    400,
  );
  const graded = await request("/ai/submit", {
    id: generated.data.id,
    answers: [1, 1, 1, 1, 1],
  });
  assert.equal(graded.data.correct, 5);
  assert.equal(
    (
      await request("/ai/submit", {
        id: generated.data.id,
        answers: [0, 0, 0, 0, 0],
      })
    ).data.correct,
    5,
  );
  const owner = cookie;
  cookie = "";
  await request("/session", {});
  assert.equal(
    (
      await request("/ai/submit", {
        id: generated.data.id,
        answers: [1, 1, 1, 1, 1],
      })
    ).status,
    404,
  );
  cookie = owner;
  for (let i = 1; i < 20; i++)
    assert.equal(
      (await request("/ai/form", { topic: "SQL", consent: true })).status,
      200,
    );
  assert.equal(
    (await request("/ai/form", { topic: "SQL", consent: true })).status,
    429,
  );
  assert.equal(calls, 20);
  assert.equal((await request("/me")).data.state.aiHistory.length, 10);
});

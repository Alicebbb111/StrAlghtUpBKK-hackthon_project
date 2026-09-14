"use strict";
const $ = (s, root = document) => root.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  path: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h9a4 4 0 0 1 0 8H8a2 2 0 0 0 0 4h9"/>',
  book: '<path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
  passport:
    '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="10" r="4"/><path d="M8 10h8m-4-4c-2 2-2 6 0 8 2-2 2-6 0-8M9 18h6"/>',
  chart: '<path d="M4 4v16h17M8 15v-4m5 4V7m5 8v-6"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  spark:
    '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V3m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bookmark: '<path d="M6 3h12v19l-6-4-6 4Z"/>',
  settings:
    '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  leaf: '<path d="M20 3C5 2 1 11 6 17s16 1 14-14ZM5 21 16 9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  trophy:
    '<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4m-5 3v6m-4 1h8"/>',
  logout: '<path d="M10 4H4v16h6m-1-8h12m-4-4 4 4-4 4"/>',
  print: '<path d="M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6ZM17 11h1"/>',
  heart: '<path d="M12 21 3 12a6 6 0 0 1 9-8 6 6 0 0 1 9 8Z"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.book}</svg>`;
const app = {
  catalog: null,
  user: null,
  draft: null,
  result: null,
  noteDrafts: {},
  library: { term: "", track: "all", saved: false },
};
let toastTimer;
function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), 3500);
}
async function api(path, method = "GET", data) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-SkillBridge": "1" },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "เชื่อมต่อไม่ได้ ตรวจว่าเซิร์ฟเวอร์ยังทำงาน แล้วลองอีกครั้ง",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาลองใหม่");
  }
  if (!response.ok) throw new Error(result.error || "ดำเนินการไม่สำเร็จ");
  return result;
}
function setState(state) {
  app.user.state = state;
  updateAccount();
}
const state = () => app.user.state;
const trackBy = (id) =>
  app.catalog.tracks.find((t) => t.id === id) || app.catalog.tracks[0];
const currentTrack = () => trackBy(state().track);
const trackLessons = (id = state().track) =>
  app.catalog.lessons.filter((l) => l.track === id);
const latest = (id = state().track) =>
  state()
    .assessments.filter((a) => a.track === id)
    .at(-1);
const lessonBy = (id) => app.catalog.lessons.find((l) => l.id === id);
const completed = (id) => state().completed.includes(id);
const formatDate = (iso) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
const dayKey = (date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
function orderedLessons() {
  const list = [...trackLessons()];
  const result = latest();
  if (result)
    list.sort(
      (a, b) => (result.scores[a.skill] ?? 0) - (result.scores[b.skill] ?? 0),
    );
  return list;
}
const nextLesson = () => orderedLessons().find((l) => !completed(l.id));
function weeklyInfo() {
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  const weekActivity = state().activity.filter(
    (a) => new Date(a.at) >= monday && new Date(a.at) < sunday,
  );
  const active = new Set(state().activity.map((a) => dayKey(new Date(a.at))));
  let streak = 0;
  const check = new Date(today);
  if (!active.has(dayKey(check))) check.setDate(check.getDate() - 1);
  while (active.has(dayKey(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    return {
      label: ["M", "T", "W", "T", "F", "S", "S"][i],
      at: date,
      today: dayKey(date) === dayKey(today),
      done: active.has(dayKey(date)),
    };
  });
  return { count: weekActivity.length, days, streak };
}
function heading(title, subtitle, action = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}
function meta(l) {
  return `<div class="lesson-meta"><span>${icon("clock")}${l.minutes} min</span><span>·</span><span>${esc(l.skill)}</span><span>·</span><span>${completed(l.id) ? "Completed" : "Beginner"}</span></div>`;
}
function trackCards() {
  return `<div class="track-grid">${app.catalog.tracks.map((t) => `<a class="track-card ${t.color}" href="#/assessment/${t.id}"><span class="track-arrow">${icon("diagonal")}</span><div class="track-icon">${icon(t.icon)}</div><div class="eyebrow">${t.label}</div><h3>${t.name}</h3><p>${t.thai}</p><div class="track-card-footer"><span>4 lessons <span>·</span> เริ่มต้นได้เลย</span>${icon("arrow")}</div></a>`).join("")}</div>`;
}
function journeyArt() {
  return `<svg class="journey-art" viewBox="0 0 380 240" aria-hidden="true"><defs><pattern id="dotgrid" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#aac291" opacity=".17"/></pattern></defs><rect width="380" height="240" fill="url(#dotgrid)"/><ellipse cx="198" cy="132" rx="137" ry="90" fill="none" stroke="#64835b" stroke-opacity=".25" transform="rotate(-20 198 132)"/><ellipse cx="198" cy="132" rx="112" ry="70" fill="none" stroke="#64835b" stroke-opacity=".23" transform="rotate(-20 198 132)"/><path d="M41 183C105 204 109 140 164 151S240 150 245 105 291 69 324 46" fill="none" stroke="#adc688" stroke-width="1.5" stroke-dasharray="4 6"/><circle cx="49" cy="184" r="22" fill="#2f5440" stroke="#68865a"/><path d="M42 184h14m-9-5 5 5-5 5" fill="none" stroke="#c7dba6" stroke-width="1.5"/><rect x="129" y="121" width="61" height="61" rx="16" fill="#dae6b8" transform="rotate(-9 159 151)"/><path d="M145 159v-20c5-1 9 0 14 3 5-3 9-4 14-3v20c-5-1-9 0-14 3-5-3-9-4-14-3Zm14-17v20" fill="none" stroke="#3c6040" stroke-width="1.6" transform="rotate(-9 159 151)"/><circle cx="247" cy="105" r="28" fill="#345540" stroke="#809966"/><path d="m236 105 7 7 14-16" fill="none" stroke="#cdddab" stroke-width="2"/><path d="m324 24 4 16 15 6-15 5-4 16-5-16-15-5 15-6Z" fill="#dfc092"/><text x="21" y="224" fill="#aac39a" font-size="9" font-family="sans-serif" letter-spacing="1">DISCOVER</text><text x="133" y="202" fill="#d2e0ba" font-size="9" font-family="sans-serif" letter-spacing="1">LEARN</text><text x="237" y="155" fill="#aac39a" font-size="9" font-family="sans-serif" letter-spacing="1">GROW</text><circle cx="79" cy="74" r="3" fill="#c7dca3" opacity=".5"/><path d="M186 51v10m-5-5h10" stroke="#9db983" stroke-width="1"/><circle cx="330" cy="180" r="3" fill="none" stroke="#789963"/></svg><span class="art-caption">A PATH THAT'S YOURS.</span>`;
}
function dashboard() {
  const s = state(),
    t = currentTrack(),
    result = latest(),
    next = nextLesson(),
    w = weeklyInfo();
  const total = s.completed.length;
  const minutes = s.completed.reduce(
    (n, id) => n + (lessonBy(id)?.minutes || 0),
    0,
  );
  const name = s.name ? `, ${esc(s.name.split(" ")[0])}` : "";
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return `${heading(`A fresh start${name}.`, "พื้นที่เล็ก ๆ สำหรับก้าวต่อไปของคุณ วันนี้อยากเรียนรู้อะไร?", `<span class="date-label">${icon("calendar")}${date}</span>`)}
  <section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="eyebrow-dot"></span>YOUR NEXT CHAPTER STARTS HERE</div><h2>Find your strengths.<br><em>Build your own way.</em></h2><p>ค้นหาสิ่งที่ถนัด เติมทักษะที่ยังขาด<br>แล้วค่อย ๆ ไปถึงงานที่อยากทำ ในจังหวะของคุณ</p><div class="hero-actions"><a class="btn btn-lime" href="#/${result ? "path" : "assessment"}">${result ? "Continue my journey" : "Discover my strengths"} ${icon("arrow")}</a><span class="hero-meta">${result ? "ก้าวต่อไป เริ่มจากวันนี้" : "12 คำถาม · ประมาณ 5 นาที"}</span></div></div><div class="hero-art">${journeyArt()}</div></section>
  <div class="stat-row" aria-label="ความก้าวหน้าของคุณ">${[
    [
      "Learning streak",
      `${w.streak} <small>${w.streak === 1 ? 'day' : 'days'}</small>`,
      w.streak ? "ทำต่ออีกนิด ให้เป็นนิสัย" : "เริ่มวันแรกของคุณวันนี้",
      "leaf",
    ],
    [
      "Lessons completed",
      `${total} <small>/ 12</small>`,
      "ผ่านโจทย์ท้ายบทแล้ว",
      "book",
    ],
    [
      "Learning covered",
      `${minutes} <small>min</small>`,
      "เวลาประมาณของบทที่จบ",
      "clock",
    ],
    [
      "My skill passport",
      `${s.assessments.length || s.completed.length ? "Active" : "Not yet"}`,
      s.assessments.length
        ? `${s.assessments.length} assessment${s.assessments.length > 1 ? "s" : ""} saved`
        : s.completed.length
          ? "มีบทเรียนที่จบแล้ว"
          : "เริ่มจากแบบประเมินแรก",
      "passport",
    ],
  ]
    .map(
      ([label, value, detail, i]) =>
        `<div class="stat"><div class="stat-top"><span>${label}</span>${icon(i)}</div><div class="stat-value">${value}</div><div class="stat-detail">${detail}</div></div>`,
    )
    .join("")}</div>
  <div class="content-grid"><section><div class="section-title"><h2>${next ? "Your next small step" : "Look how far you’ve come"}</h2><a class="text-link" href="#/path">View learning path ${icon("arrow")}</a></div>${next ? `<article class="lesson-feature ${t.color}"><div class="lesson-art">${icon(t.icon)}</div><div class="lesson-detail"><span class="badge">${result ? "Selected for your skill gaps" : "A GOOD PLACE TO START"}</span><h3>${next.title}</h3><p>${next.thai}</p>${meta(next)}<a class="btn btn-light" href="#/lesson/${next.id}">Start learning ${icon("arrow")}</a></div></article>` : `<div class="complete-banner"><h2>${t.name} · Completed</h2><p>คุณผ่านทั้ง 4 บทแล้ว ลองประเมินอีกครั้งเพื่อดูสิ่งที่ได้เรียนรู้</p><a class="btn btn-lime" href="#/assessment/${t.id}">Check my progress ${icon("arrow")}</a></div>`}</section>
  <aside class="week-card"><div class="section-title"><h3>This week, for you</h3><a class="text-link" href="#/settings" aria-label="แก้เป้าหมายรายสัปดาห์">${icon("settings")}</a></div><p>แค่วันละนิด ก็เข้าใกล้เป้าหมาย</p><div class="week-days">${w.days.map((d) => `<div class="day ${d.today ? "today" : ""} ${d.done ? "done" : ""}" title="${formatDate(d.at)}${d.done ? " · เรียนจบแล้ว" : ""}${d.today ? " · วันนี้" : ""}"><span>${d.label}</span><b>${d.done ? "✓" : d.at.getDate()}</b></div>`).join("")}</div><div class="goal-caption"><span>Weekly goal</span><span>${w.count} / ${s.weeklyGoal} lessons</span></div><div class="progress" role="progressbar" aria-label="เป้าหมายรายสัปดาห์" aria-valuenow="${Math.min(w.count, s.weeklyGoal)}" aria-valuemin="0" aria-valuemax="${s.weeklyGoal}"><span style="width:${Math.min(100, (w.count / s.weeklyGoal) * 100)}%"></span></div><div class="week-footer">${w.count >= s.weeklyGoal ? "ถึงเป้าหมายแล้ว เก็บแรงไว้สำหรับก้าวต่อไป" : "Every small step counts. คุณทำได้ในแบบของคุณ"}</div></aside></div>
  <section class="explore-section"><div class="section-title"><h2>A world of possibilities</h2><a class="text-link" href="#/resources">Explore all lessons ${icon("arrow")}</a></div>${trackCards()}</section>`;
}
function assessment(trackId) {
  if (app.draft && !trackId) return quiz();
  const chosen = trackBy(trackId || state().track);
  return `${heading("Start with what you know.", "ลองสำรวจพื้นฐานของตัวเอง แล้วเลือกสิ่งที่ควรเรียนต่อ")}
  <div class="two-column"><section class="panel"><div class="eyebrow">SKILL CHECK · ABOUT 5 MINUTES</div><h2>คุณอยากลองเส้นทางไหน?</h2><p>ไม่ต้องเตรียมตัว เลือกคำตอบจากสิ่งที่รู้ในตอนนี้</p><form id="assessment-start" class="small-spaced"><fieldset><legend class="sr-only">เส้นทางที่ต้องการประเมิน</legend><div class="stack">${app.catalog.tracks.map((t) => `<label class="track-choice ${t.color}"><div class="track-icon">${icon(t.icon)}</div><span><h3>${t.name}</h3><p>${t.description}</p></span><input type="radio" name="track" value="${t.id}" ${t.id === chosen.id ? "checked" : ""}></label>`).join("")}</div></fieldset><div id="form-error" class="error" role="alert"></div><div class="form-actions"><button class="btn" type="submit">Let’s find out ${icon("arrow")}</button><span class="form-hint">12 คำถาม · 4 ทักษะ · ย้อนกลับแก้คำตอบได้</span></div></form>${app.draft ? '<button class="link-button small-spaced" data-resume-quiz>ทำแบบประเมินเดิมต่อ</button>' : ""}</section><aside class="stack"><div class="panel"><div class="track-icon">${icon("compass")}</div><h3>A starting point, not a label.</h3><p class="small-spaced">ผลนี้เป็นการสำรวจพื้นฐานจากโจทย์สั้น ๆ ไม่ใช่ใบรับรองหรือคำตัดสินว่าคุณเหมาะกับอาชีพใด</p><p class="small-spaced">เราจะใช้คะแนนเพื่อจัดลำดับบทเรียนที่น่าจะช่วยคุณได้ก่อน คุณเลือกเรียนบทอื่นได้เสมอ</p></div><div class="callout">${icon("info")}<span>ระบบตรวจคำตอบด้วยเกณฑ์ที่กำหนดไว้ ไม่ต้องใช้ AI key และไม่ส่งคำตอบไปยังบริการ AI ภายนอก</span></div></aside></div>`;
}
function persistDraft() {
  try {
    sessionStorage.setItem("sb-assessment", JSON.stringify(app.draft));
  } catch {}
}
function quiz() {
  const d = app.draft,
    q = d.questions[d.index];
  return `${heading("A little self-discovery.", `${trackBy(d.track).name} · เลือกคำตอบที่ตรงที่สุดในแต่ละข้อ`)}<section class="panel quiz-panel"><div class="assessment-top"><span>QUESTION ${String(d.index + 1).padStart(2, "0")} / ${d.questions.length}</span><span>${d.answers.filter((a) => a !== null).length} answered</span></div><div class="progress"><span style="width:${((d.index + 1) / d.questions.length) * 100}%"></span></div><div class="eyebrow small-spaced">${esc(q.skill)}</div><h2 id="question-title">${esc(q.text)}</h2><fieldset aria-labelledby="question-title"><div class="answers">${q.choices.map((c, i) => `<label class="answer"><input type="radio" name="quiz-answer" value="${i}" ${d.answers[d.index] === i ? "checked" : ""}><span class="answer-letter">${"ABCD"[i]}</span><span>${esc(c)}</span></label>`).join("")}</div></fieldset><div id="form-error" class="error" role="alert"></div><div class="quiz-footer"><button class="btn btn-light" data-quiz-prev ${d.index === 0 ? "disabled" : ""}>${icon("back")} Back</button>${d.index === d.questions.length - 1 ? '<button class="btn" data-quiz-submit>See my results ' + icon("arrow") + "</button>" : '<button class="btn" data-quiz-next>Next question ' + icon("arrow") + "</button>"}</div><div class="question-dots" aria-label="เลือกข้อคำถาม">${d.questions.map((_, i) => `<button data-quiz-jump="${i}" class="${d.answers[i] !== null ? "answered" : ""} ${d.index === i ? "current" : ""}" aria-label="ข้อ ${i + 1}${d.answers[i] !== null ? " ตอบแล้ว" : ""}" ${d.index === i ? 'aria-current="step"' : ""}>${i + 1}</button>`).join("")}</div><p class="draft-note">บันทึกคำตอบระหว่างทำในแท็บนี้ · ทำต่อให้เสร็จภายใน 2 ชั่วโมง</p><p class="journey-caption"><a class="text-link" href="#/assessment/analyst">เริ่มแบบประเมินใหม่ / เลือกเส้นทางอื่น →</a></p></section>`;
}
function skillBars(result) {
  return `<div class="skill-list">${Object.entries(result.scores)
    .map(
      ([skill, score]) =>
        `<div><div class="skill-label"><span>${esc(skill)}</span><span>${Math.round((score / 100) * 3)} / 3 correct</span></div><div class="progress" role="progressbar" aria-label="${esc(skill)}" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100"><span style="width:${score}%"></span></div></div>`,
    )
    .join("")}</div>`;
}
function results() {
  const r = app.result?.result || latest();
  if (!r)
    return empty(
      "Your story starts here.",
      "ยังไม่มีผลประเมิน ลองสำรวจพื้นฐานของคุณก่อน",
      "#/assessment",
      "Start assessment",
      "compass",
    );
  const gaps = r.analysis.weak_or_missing_skills.map((s) => s.skill);
  return `${heading("Now you know where to start.", "นี่คือจุดเริ่มต้นสำหรับการเรียนครั้งถัดไปของคุณ")}<div class="two-column"><div class="panel"><span class="badge">ASSESSMENT COMPLETE</span><div class="result-summary"><div class="score-circle">${r.correct}<small>/${r.total}</small></div><div><h2>${trackBy(r.track).name}</h2><p>ตอบถูก ${r.correct} จาก ${r.total} ข้อ · ${formatDate(r.at)}</p></div></div><h3>Your skill snapshot</h3>${skillBars(r)}<div class="callout small-spaced">${icon("info")}<span>แต่ละทักษะมีเพียง 3 ข้อ ผลจึงเป็นภาพคร่าว ๆ ของพื้นฐาน ควรดูร่วมกับงานที่ได้ลงมือทำจริง</span></div><div class="form-actions"><a class="btn" href="#/path">See my learning path ${icon("arrow")}</a><a class="btn btn-light" href="#/passport">My passport</a></div>${app.result?.review ? `<details class="small-spaced"><summary>Review your answers · ทบทวนคำตอบ</summary>${app.result.review.map((q, i) => `<div class="result-review"><span class="review-status ${q.passed ? "" : "missed"}">${q.passed ? "✓ Correct" : "↗ Keep learning"}</span><h3>${i + 1}. ${esc(q.text)}</h3><p>คุณตอบ: ${esc(q.selected)}</p>${q.passed ? "" : `<p>คำตอบที่ถูก: ${esc(q.correct)}</p>`}</div>`).join("")}</details>` : ""}</div><aside class="stack"><div class="panel"><div class="track-icon">${icon("leaf")}</div><h3>${gaps.length ? "Make room to grow." : "A strong foundation."}</h3><p class="small-spaced">${gaps.length ? `เริ่มทบทวน ${gaps.map(esc).join(", ")} เราจัดบทเรียนที่คะแนนยังน้อยไว้ก่อน เพื่อให้คุณเลือกก้าวต่อไปได้ง่ายขึ้น` : "พื้นฐานจากชุดคำถามนี้ทำได้ดี ลองทำ mini project ท้ายบทเพื่อฝึกใช้ทักษะกับโจทย์จริง"}</p></div><a class="text-link" href="#/assessment/${r.track}">ลองประเมินอีกครั้ง ${icon("arrow")}</a></aside></div>`;
}
function empty(title, description, href, label, i = "book") {
  return `<section class="empty-state">${icon(i)}<h2>${title}</h2><p>${description}</p>${href ? `<a class="btn" href="${href}">${label} ${icon("arrow")}</a>` : ""}</section>`;
}
function pathPage() {
  const t = currentTrack(),
    list = orderedLessons(),
    done = list.filter((l) => completed(l.id)).length,
    next = nextLesson();
  return `${heading("One step closer.", "เส้นทางของคุณ เรียนตามลำดับที่แนะนำ หรือเลือกบทที่อยากลองได้เลย")}
  <div class="path-top"><label class="form-label no-margin" for="path-track">My direction</label><select id="path-track">${app.catalog.tracks.map((t) => `<option value="${t.id}" ${t.id === state().track ? "selected" : ""}>${t.name}</option>`).join("")}</select><span class="badge">${done} / 4 COMPLETE</span></div>
  <div class="two-column"><div>${!latest() ? `<div class="callout small-spaced" style="margin:0 0 20px">${icon("compass")}<span>ตอนนี้เรียงจากพื้นฐานไปสู่การลงมือทำ <a href="#/assessment/${t.id}">ลองประเมินทักษะ</a> เพื่อจัดบทที่ควรทบทวนไว้ก่อน</span></div>` : ""}${done === 4 ? '<div class="complete-banner"><h2>You followed through.</h2><p>ครบทั้ง 4 บทแล้ว นำแบบฝึกหัดไปต่อยอดเป็นพอร์ต แล้วกลับมาวัดพื้นฐานอีกครั้ง</p><a class="btn btn-lime" href="#/assessment/' + t.id + '">Retake assessment ' + icon("arrow") + "</a></div>" : ""}<div class="roadmap">${list.map((l, i) => `<article class="path-step"><div class="step-index"><span class="step-number ${completed(l.id) ? "done" : ""}">${completed(l.id) ? "✓" : String(i + 1).padStart(2, "0")}</span></div><div class="step-body ${l.id === next?.id ? "next" : ""}"><span class="badge ${completed(l.id) ? "" : "badge-neutral"}">${completed(l.id) ? "COMPLETED" : l.id === next?.id ? "YOUR NEXT STEP" : l.skill}</span><h3>${l.title}</h3><p>${l.summary}</p><div class="step-bottom">${meta(l)}<a class="btn ${l.id === next?.id ? "" : "btn-light"}" href="#/lesson/${l.id}">${completed(l.id) ? "Review lesson" : "Start lesson"} ${icon("arrow")}</a></div></div></article>`).join("")}</div></div><aside class="stack"><div class="panel"><div class="track-icon">${icon(t.icon)}</div><div class="eyebrow">YOUR DIRECTION</div><h2>${t.name}</h2><p class="small-spaced">${t.description}</p><div class="progress small-spaced"><span style="width:${(done / 4) * 100}%"></span></div><p>${done} of 4 lessons complete</p><div class="lesson-meta">${icon("clock")}${list.reduce((n, l) => n + l.minutes, 0)} min · เวลาที่แนะนำ</div></div><div class="task-card"><div class="eyebrow">BUILD SOMETHING REAL</div><h3>Leave with something you made.</h3><p>ทุกบทมีโจทย์ให้ลองทำ เก็บสิ่งที่ได้เรียนรู้ในโน้ต และรวมงานเหล่านั้นเป็นพอร์ตชิ้นแรกของคุณ</p></div><div class="callout">${icon("info")}<span>${latest() ? "ลำดับแนะนำอิงคะแนนรายทักษะจากผลประเมินล่าสุด ไม่ใช่การคาดการณ์โอกาสได้งาน" : "คุณยังเรียนได้ทันทีโดยไม่ต้องทำแบบประเมิน"}</span></div></aside></div>`;
}
function libraryCards() {
  const filter = app.library;
  const list = app.catalog.lessons.filter(
    (l) =>
      (filter.track === "all" || l.track === filter.track) &&
      (!filter.saved || state().saved.includes(l.id)) &&
      `${l.title} ${l.thai} ${l.skill} ${trackBy(l.track).name}`
        .toLowerCase()
        .includes(filter.term.toLowerCase()),
  );
  if (!list.length)
    return empty(
      "Nothing here just yet.",
      filter.saved && !state().saved.length
        ? "ยังไม่มีบทเรียนที่บันทึกไว้ กดไอคอนบุ๊กมาร์กบนบทเรียนที่สนใจ"
        : "ไม่พบบทเรียนที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหรือเลือกทุกเส้นทาง",
      null,
      null,
      "search",
    );
  return `<div class="library-grid">${list.map((l) => `<article class="library-card ${trackBy(l.track).color}"><div class="library-art">${icon(trackBy(l.track).icon)}</div><button class="save-button ${state().saved.includes(l.id) ? "saved" : ""}" data-save="${l.id}" aria-label="${state().saved.includes(l.id) ? "นำออกจาก" : "เพิ่มใน"}รายการบันทึก: ${esc(l.title)}" aria-pressed="${state().saved.includes(l.id)}">${icon("bookmark")}</button><div class="library-content"><span class="eyebrow">${esc(l.skill)} ${completed(l.id) ? "· COMPLETED" : ""}</span><h3><a href="#/lesson/${l.id}">${l.title}</a></h3><p>${l.thai}</p>${meta(l)}<a class="text-link" href="#/lesson/${l.id}">${completed(l.id) ? "Review lesson" : "Start learning"} ${icon("arrow")}</a></div></article>`).join("")}</div>`;
}
function resources() {
  return `${heading("Stay curious.", "บทเรียนสั้นที่พาคุณจากความเข้าใจ ไปสู่การลงมือทำ")}<div class="resource-controls"><label class="sr-only" for="library-search">ค้นหาบทเรียน</label><input type="search" id="library-search" value="${esc(app.library.term)}" placeholder="ค้นหาบทเรียน ทักษะ หรือสิ่งที่อยากลอง…"><label class="sr-only" for="library-track">กรองเส้นทาง</label><select id="library-track"><option value="all">All directions</option>${app.catalog.tracks.map((t) => `<option value="${t.id}" ${app.library.track === t.id ? "selected" : ""}>${t.name}</option>`).join("")}</select></div><div class="filter-tabs" aria-label="ประเภทบทเรียน"><button data-library-tab="all" class="${!app.library.saved ? "active" : ""}" aria-pressed="${!app.library.saved}">All lessons · 12</button><button data-library-tab="saved" class="${app.library.saved ? "active" : ""}" aria-pressed="${app.library.saved}">Saved for later · ${state().saved.length}</button></div><div id="library-results" aria-live="polite">${libraryCards()}</div>`;
}
function lessonPage(id) {
  const l = lessonBy(id);
  if (!l)
    return empty(
      "This page took a different path.",
      "ไม่พบบทเรียนนี้ กลับไปเลือกบทเรียนที่สนใจได้เลย",
      "#/resources",
      "Browse lessons",
    );
  const rest = trackLessons(l.track).filter(
    (item) => !completed(item.id) && item.id !== id,
  );
  const next = rest[0];
  return `<a class="back-link" href="#/path">${icon("back")}Back to my learning path</a><div class="lesson-header"><span class="badge">${trackBy(l.track).name} · ${completed(id) ? "COMPLETED" : "LEARNING IN PROGRESS"}</span><h1>${l.title}</h1><p>${l.thai}</p>${meta(l)}</div><div class="two-column"><div><article class="article-content">${l.sections.map(([title, text], i) => `<section class="reading-section"><h2><span class="section-number">0${i + 1}</span>${esc(title)}</h2><p>${esc(text)}</p></section>`).join("")}</article><section class="panel practice-panel"><div class="eyebrow">CHECK YOUR UNDERSTANDING</div><h2 id="practice-title">${esc(l.practice)}</h2><form id="practice-form" data-lesson="${id}"><fieldset aria-labelledby="practice-title"><div class="answers">${l.choices.map((choice, i) => `<label class="answer"><input type="radio" name="answer" value="${i}" required><span class="answer-letter">${"ABCD"[i]}</span><span>${esc(choice)}</span></label>`).join("")}</div></fieldset><div id="practice-feedback" aria-live="polite"></div><div id="form-error" class="error" role="alert"></div><div class="form-actions"><button class="btn" type="submit">Check my answer ${icon("check")}</button><span class="form-hint">ตอบถูกเพื่อบันทึกว่าเรียนจบแล้ว</span></div></form></section><div class="form-actions">${next ? `<a class="btn btn-light" href="#/lesson/${next.id}">Next lesson ${icon("arrow")}</a>` : '<a class="btn btn-light" href="#/passport">View my passport ' + icon("passport") + "</a>"}<button class="btn btn-light" data-save="${id}" aria-pressed="${state().saved.includes(id)}">${icon("bookmark")}${state().saved.includes(id) ? "Saved for later" : "Save for later"}</button></div></div><aside><div class="panel notes-panel"><h3>Make it yours.</h3><p>จดสิ่งที่เข้าใจ ตัวอย่างที่ลองทำ หรือคำถามที่อยากหาคำตอบต่อ</p><form id="note-form" data-lesson="${id}"><label class="sr-only" for="lesson-note">โน้ตส่วนตัวของบทเรียน</label><textarea id="lesson-note" name="note" maxlength="4000" placeholder="วันนี้ฉันได้เรียนรู้ว่า…">${esc(app.noteDrafts[id] ?? state().notes[id] ?? "")}</textarea><span class="form-hint" id="note-count">${(app.noteDrafts[id] ?? state().notes[id] ?? "").length} / 4,000 characters</span><div class="error" id="note-error" role="alert"></div><button class="btn btn-light" type="submit">Save my notes ${icon("check")}</button></form><a class="external" href="${l.resource[1]}" target="_blank" rel="noopener noreferrer">Read more · ${esc(l.resource[0])} ↗</a><p class="form-hint">แหล่งอ่านเพิ่มเติมภายนอก อาจมีภาษาอังกฤษหรือเงื่อนไขการใช้งานของผู้ให้บริการ</p></div><div class="task-card"><div class="eyebrow">YOUR MINI PROJECT</div><h3>Take it off the page.</h3><p>${esc(l.task)}</p><p class="small-spaced">ลองทำแล้วบันทึกผลในโน้ต งานส่วนนี้เป็นการฝึกด้วยตัวเอง ไม่ได้ตรวจอัตโนมัติ</p></div></aside></div>`;
}
function passport() {
  const s = state(),
    t = currentTrack(),
    r = latest();
  if (!r && !s.completed.length)
    return `${heading("Your skills, in one place.", "รวบรวมสิ่งที่ได้เรียนรู้ เพื่อมองเห็นความก้าวหน้าของตัวเอง")}${empty("A passport with your story.", "ทำแบบประเมินหรือเรียนจบบทแรก แล้วกลับมาดูสิ่งที่คุณได้ลงมือทำ", "#/assessment", "Start my first assessment", "passport")}`;
  const evidence = s.completed.map(lessonBy).filter(Boolean);
  return `${heading("Made of small achievements.", "Skill Passport ของคุณ อัปเดตจากผลประเมินและบทเรียนที่ทำสำเร็จ", `<button class="btn btn-light no-print" data-print>${icon("print")}Print / Save PDF</button>`)}<div class="two-column"><article class="passport"><div class="passport-head"><div><div class="passport-brand">SKILLBRIDGE / LEARNING RECORD</div><h2>Skill Passport</h2><p>A living record of your next chapter.</p></div><div class="passport-seal">${icon("passport")}</div></div><div class="passport-body"><div class="passport-meta"><div><small>LEARNER</small><strong>${esc(s.name || "Independent learner")}</strong></div><div><small>CURRENT DIRECTION</small><strong>${t.name}</strong></div><div><small>LESSONS COMPLETED</small><strong>${evidence.length} of 12</strong></div><div><small>LATEST ASSESSMENT</small><strong>${r ? formatDate(r.at) : "ยังไม่ได้ประเมินเส้นทางนี้"}</strong></div></div><section class="passport-section"><h3>01 / Skill snapshot</h3><p>ผลแบบประเมินล่าสุดในเส้นทาง ${t.name}</p>${r ? skillBars(r) : '<p class="small-spaced">ยังไม่มีผลประเมินสำหรับเส้นทางนี้</p>'}</section><section class="passport-section"><h3>02 / Learning evidence</h3><p>บทเรียนที่ผ่านโจทย์ตรวจความเข้าใจแล้ว</p>${evidence.length ? evidence.map((l) => `<div class="evidence-row">${icon("check")}<span>${l.title}<br><span class="muted">${esc(l.skill)} · ${trackBy(l.track).name}</span></span><small>${formatDate(s.activity.find((a) => a.lessonId === l.id)?.at || new Date())}</small></div>`).join("") : '<p class="small-spaced">ยังไม่มีบทเรียนที่เรียนจบ</p>'}</section><section class="passport-section"><h3>03 / What comes next</h3><p>${nextLesson() ? `บทเรียนแนะนำ: ${nextLesson().title} — ${nextLesson().thai}` : "ลองนำงานฝึกแต่ละบทมารวมเป็น mini portfolio แล้วเลือกเส้นทางใหม่ที่อยากสำรวจ"}</p></section></div><div class="passport-foot"><span>Personal learning record · ไม่ใช่ใบรับรองวิชาชีพ</span><span>Generated ${new Intl.DateTimeFormat("en-GB").format(new Date())}</span></div></article><aside class="stack no-print"><div class="panel"><h3>Take your progress with you.</h3><p class="small-spaced">พิมพ์หรือเลือก Save as PDF ในหน้าต่างพิมพ์ เพื่อเก็บสำเนา Passport ของคุณ</p><div class="download-actions small-spaced"><button class="btn" data-print>${icon("print")}Print / Save PDF</button><button class="btn btn-light" data-export>${icon("download")}Export my data · JSON</button></div><p class="form-hint small-spaced">JSON รวมชื่อ ผลประเมิน และโน้ตส่วนตัว ควรตรวจเนื้อหาก่อนส่งต่อให้ผู้อื่น</p></div><div class="panel"><h3>Assessment history</h3>${
    s.assessments.length
      ? s.assessments
          .slice(-5)
          .reverse()
          .map(
            (a) =>
              `<div class="history-item"><div>${trackBy(a.track).name}<small>${formatDate(a.at)}</small></div><strong>${a.correct}/${a.total}</strong></div>`,
          )
          .join("")
      : '<p class="small-spaced">ยังไม่มีประวัติ</p>'
  }<a class="text-link small-spaced" href="#/assessment">Check my skills again ${icon("arrow")}</a></div><div class="callout">${icon("info")}<span>คะแนนจากคำถาม 3 ข้อต่อทักษะเป็นเพียงการสำรวจพื้นฐาน ไม่มีการยืนยันตัวตนหรือรับรองโดยนายจ้าง</span></div></aside></div>`;
}
function settings() {
  const s = state();
  return `${heading("A space that feels like you.", "ตั้งค่าชื่อ เป้าหมายการเรียน และจัดการข้อมูลของคุณ")}<div class="settings-grid"><section class="panel"><h2>Your profile</h2><form id="profile-form"><div class="field"><label class="form-label" for="profile-name">ชื่อที่อยากให้เราเรียก</label><input id="profile-name" name="name" value="${esc(s.name)}" maxlength="60" placeholder="Your name" autocomplete="given-name"></div><fieldset><legend class="form-label">เป้าหมายรายสัปดาห์ · lessons per week</legend><div class="goal-options">${[1, 3, 5, 7].map((n) => `<label><input type="radio" name="weeklyGoal" value="${n}" ${s.weeklyGoal === n ? "checked" : ""}>${n} ${n === 1 ? "lesson" : "lessons"}</label>`).join("")}</div></fieldset><p class="form-hint small-spaced">เริ่มน้อย ๆ ได้ เป้าหมายนี้เปลี่ยนได้เสมอ สัปดาห์เริ่มวันจันทร์ตามเวลาบนอุปกรณ์ของคุณ</p><div id="form-error" class="error" role="alert"></div><button class="btn" type="submit">Save changes ${icon("check")}</button></form></section><section class="panel"><h2>${app.user.registered ? "Your account" : "Keep your progress."}</h2><p>${app.user.registered ? `เข้าสู่ระบบด้วย ${esc(app.user.email)} บันทึกความก้าวหน้าไว้ในบัญชีแล้ว` : "ตอนนี้คุณใช้ Guest workspace ข้อมูลเก็บบนเซิร์ฟเวอร์และเชื่อมกับคุกกี้เบราว์เซอร์นี้ สมัครบัญชีเพื่อกลับมาใช้ข้อมูลเดิมหลังเปลี่ยนเบราว์เซอร์ได้"}</p>${app.user.registered ? `<button class="btn btn-light" data-logout>${icon("logout")}Sign out</button>` : `<a class="btn" href="#/register">Create an account ${icon("arrow")}</a><div class="small-spaced"><a class="text-link" href="#/login">มีบัญชีแล้ว? Sign in</a></div>`}</section><section class="panel"><h2>Your data, yours to keep.</h2><p>ดาวน์โหลดชื่อ ผลประเมิน ประวัติการเรียน และโน้ตเป็น JSON เพื่อเก็บสำเนาข้อมูลส่วนตัว</p><button class="btn btn-light" data-export>${icon("download")}Export my data</button><p class="form-hint small-spaced">ไฟล์ส่งออกเป็นสำเนาสำหรับอ่านและเก็บ ยังไม่มีระบบนำเข้าข้อมูลกลับ</p></section><section class="panel"><h2>Start over</h2><p>ลบบัญชีหรือ Guest workspace พร้อมผลประเมิน โน้ต และประวัติทั้งหมด การลบนี้ย้อนคืนไม่ได้</p><button class="btn btn-light text-danger" data-delete-open>Delete my workspace</button><div id="delete-confirm" hidden class="small-spaced"><label class="form-label" for="delete-text">พิมพ์ DELETE เพื่อยืนยัน</label><input id="delete-text" autocomplete="off" placeholder="DELETE"><div class="form-actions"><button class="btn btn-danger" data-delete-confirm>ลบข้อมูลทั้งหมด</button><button class="btn btn-light" data-delete-cancel>ยกเลิก</button></div></div></section></div>`;
}
function auth(mode) {
  const register = mode === "register";
  if (app.user.registered)
    return `${heading("You’re already at home.", "บัญชีของคุณพร้อมใช้งานแล้ว")}<a class="btn" href="#/dashboard">Go to my workspace ${icon("arrow")}</a>`;
  return `<a class="back-link" href="#/dashboard">${icon("back")}Back to workspace</a><section class="auth-wrap"><div class="panel"><div class="eyebrow">${register ? "MAKE YOURSELF AT HOME" : "WELCOME BACK"}</div><h1>${register ? "Keep your next chapter." : "Good to see you again."}</h1><p>${register ? "สร้างบัญชีเพื่อเก็บสิ่งที่ได้เรียนรู้ ความก้าวหน้าจาก Guest workspace นี้จะอยู่ต่อในบัญชีของคุณ" : "เข้าสู่ระบบเพื่อกลับมาที่บทเรียนและโน้ตของคุณ"}</p><form id="auth-form" data-mode="${mode}">${register ? `<div class="field"><label class="form-label" for="auth-name">ชื่อของคุณ</label><input id="auth-name" name="name" value="${esc(state().name)}" maxlength="60" required autocomplete="name"></div>` : ""}<div class="field"><label class="form-label" for="auth-email">Email address</label><input id="auth-email" type="email" name="email" maxlength="254" required autocomplete="email"></div><div class="field"><label class="form-label" for="auth-password">Password</label><input id="auth-password" type="password" name="password" minlength="${register ? 8 : 1}" maxlength="128" required autocomplete="${register ? "new-password" : "current-password"}"><p class="form-hint">${register ? "อย่างน้อย 8 ตัวอักษร · โปรดใช้รหัสผ่านเฉพาะสำหรับโปรเจกต์นี้" : "ยังไม่มีระบบรีเซ็ตรหัสผ่านผ่านอีเมล"}</p></div>${register ? '<p class="form-hint">ระบบเก็บอีเมล ชื่อ และความก้าวหน้าบนเซิร์ฟเวอร์ของโปรเจกต์ <a href="#/about">อ่านรายละเอียดข้อมูลส่วนตัว</a></p>' : '<p class="form-hint">การเข้าสู่ระบบจะเปิดข้อมูลของบัญชีนั้น ข้อมูล Guest จะไม่ถูกรวมเข้าบัญชีเดิมโดยอัตโนมัติ</p>'}<div id="form-error" class="error" role="alert"></div><button class="btn" type="submit">${register ? "Create my account" : "Sign in"} ${icon("arrow")}</button></form><div class="auth-switch">${register ? 'มีบัญชีแล้ว? <a href="#/login">Sign in</a>' : 'ครั้งแรกที่นี่? <a href="#/register">Create an account</a>'}</div></div></section>`;
}
function about() {
  return `${heading("Learning, with a little direction.", "SkillBridge · พื้นที่เริ่มต้นสำหรับคนที่กำลังหาเส้นทางของตัวเอง")}<div class="about-copy"><section class="panel"><h2>Small steps. Real possibilities.</h2><p>SkillBridge ต่อยอดจากโปรเจกต์ strAIght Up BKK เพื่อช่วยให้ผู้เรียนลองสำรวจพื้นฐาน เลือกทักษะที่สนใจ และเก็บความก้าวหน้าจากการลงมือทำ</p><p>เวอร์ชันนี้มี 3 เส้นทาง 12 บทเรียน พร้อมแบบประเมินและโจทย์ท้ายบท ไม่ต้องสมัครบัญชีเพื่อเริ่มเรียน และไม่ต้องใช้บริการ AI ภายนอก</p></section><section class="panel"><h2>How recommendations work</h2><p>แบบประเมินมี 12 ข้อต่อเส้นทาง หรือ 3 ข้อต่อทักษะ ระบบตรวจคำตอบด้วยเกณฑ์ที่กำหนด แล้วเรียงบทเรียนที่ได้คะแนนน้อยไว้ก่อน ผลนี้ไม่ใช่การทำนายอาชีพ ความเหมาะสมกับงาน หรือใบรับรองที่นายจ้างรับรอง</p><p>การเรียนจบหมายถึงตอบโจทย์ท้ายบทได้ถูกต้อง ส่วน mini project และโน้ตเป็นงานฝึกด้วยตนเอง ระบบยังไม่ได้ประเมินคุณภาพของชิ้นงานเหล่านั้น เวลาเรียนที่แสดงเป็นเวลาแนะนำของบท ไม่ใช่เวลาที่จับจากหน้าจอ</p></section><section class="panel"><h2>Your privacy</h2><p>ข้อมูลถูกเก็บในฐานข้อมูล SQLite บนเซิร์ฟเวอร์ที่รันโปรเจกต์นี้ ได้แก่ ชื่อ อีเมล (เมื่อสมัคร) รหัสผ่านที่ผ่าน scrypt ผลประเมิน ประวัติเรียน และโน้ต ผู้ดูแลเซิร์ฟเวอร์เข้าถึงข้อมูลที่จัดเก็บได้</p><p>คุกกี้ HttpOnly ใช้ระบุ workspace และมีอายุ 30 วัน Guest ที่ล้างคุกกี้หรือเปลี่ยนเบราว์เซอร์จะเข้าข้อมูลเดิมไม่ได้ แบบประเมินระหว่างทำเก็บชั่วคราวใน sessionStorage ของแท็บและมีอายุ 2 ชั่วโมง</p><p>ไม่มี analytics และไม่มีการส่งข้อมูลไปยัง AI provider ฟอนต์โหลดจากไฟล์ในโปรเจกต์ ลิงก์อ่านเพิ่มเติมจะเปิดเว็บไซต์ภายนอกซึ่งมีนโยบายของตัวเอง</p><p>ส่งออกข้อมูลหรือลบ workspace ได้ที่ <a class="text-link" href="#/settings">Settings →</a> การลบจะนำข้อมูลออกจากฐานข้อมูลที่กำลังใช้งาน ผู้ดูแลต้องจัดการสำเนาสำรองแยกต่างหาก</p></section><section class="panel"><h2>Before using it with real learners</h2><p>นี่คือเวอร์ชันส่งงานและเดโมที่รันได้ครบวงจร สำหรับเปิดบริการสาธารณะ ผู้ดูแลต้องตั้งค่า HTTPS และ Secure cookie วางแผนสำรองและลบข้อมูล เพิ่มการยืนยันอีเมล การกู้บัญชี และทบทวนเนื้อหากับผู้สอนก่อนใช้งานในวงกว้าง</p></section></div>`;
}
function updateAccount() {
  if (!app.user) return;
  const name = state().name || "Your workspace";
  $("#account-name").textContent = name;
  $("#account-type").textContent = app.user.registered
    ? "Member · บันทึกในบัญชี"
    : "Guest · เชื่อมกับเบราว์เซอร์นี้";
  const initial = (state().name || "Y").slice(0, 1).toUpperCase();
  $("#avatar").textContent = initial;
  $("#top-avatar").textContent = initial;
}
function routeInfo() {
  const [page = "dashboard", id] = location.hash
    .replace(/^#\/?/, "")
    .split("/");
  return { page: page || "dashboard", id };
}
function render({ focus = false } = {}) {
  if (!app.user || !app.catalog) return;
  const { page, id } = routeInfo();
  const nav = [
    ["dashboard", "home", "Overview"],
    ["assessment", "compass", "Discover my skills"],
    ["path", "path", "My learning path"],
    ["resources", "book", "Learning library"],
    ["passport", "passport", "Skill passport"],
  ];
  $("#navigation").innerHTML =
    nav
      .map(
        ([p, i, label]) =>
          `<a href="#/${p}" class="nav-item ${p === page || (page === "lesson" && p === "path") || (page === "results" && p === "assessment") ? "active" : ""}" ${p === page ? 'aria-current="page"' : ""}>${icon(i)}${label}</a>`,
      )
      .join("") +
    `<div class="nav-divider"></div><a class="nav-item ${page === "settings" ? "active" : ""}" href="#/settings">${icon("settings")}Settings</a>`;
  const labels = {
    dashboard: "Overview",
    assessment: "Discover my skills",
    results: "Your results",
    path: "My learning path",
    lesson: "Learning room",
    resources: "Learning library",
    passport: "Skill passport",
    settings: "Settings",
    login: "Sign in",
    register: "Create account",
    about: "About SkillBridge",
  };
  $("#page-label").textContent = labels[page] || "Page not found";
  document.title = `${labels[page] || "Page not found"} · SkillBridge`;
  const pages = {
    dashboard,
    assessment: () => assessment(id),
    results,
    path: pathPage,
    resources,
    lesson: () => lessonPage(id),
    passport,
    settings,
    login: () => auth("login"),
    register: () => auth("register"),
    about,
  };
  $("#main").innerHTML = pages[page]
    ? pages[page]()
    : empty(
        "This page took a different path.",
        "ลิงก์นี้ไม่มีอยู่ใน SkillBridge กลับไปที่พื้นที่เรียนรู้ของคุณได้เลย",
        "#/dashboard",
        "Back to overview",
      );
  updateAccount();
  if (focus) {
    $("#main").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
function showError(error, selector = "#form-error") {
  const box = $(selector);
  if (box) box.textContent = error.message;
  else toast(error.message);
}
async function busy(button, action, errorSelector) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    await action();
  } catch (error) {
    showError(error, errorSelector);
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}
function openSearch() {
  $("#search-dialog").showModal();
  $("#global-search").value = "";
  searchResults("");
  $("#global-search").focus();
}
function searchResults(term) {
  const list = app.catalog.lessons.filter((l) =>
    `${l.title} ${l.thai} ${l.skill}`
      .toLowerCase()
      .includes(term.toLowerCase()),
  );
  $("#global-results").innerHTML = list.length
    ? list
        .map(
          (l) =>
            `<a class="search-result" href="#/lesson/${l.id}" data-close-dialog>${icon(trackBy(l.track).icon)}<span><strong>${l.title}</strong><small>${l.thai} · ${l.minutes} min</small></span></a>`,
        )
        .join("")
    : '<p class="small-spaced">ไม่พบบทเรียน ลองใช้คำอื่น เช่น SQL หรือ HTML</p>';
}
async function exportData(button) {
  await busy(button, async () => {
    await api("/me");
    const link = document.createElement("a");
    link.href = "/api/export?download=1";
    link.download = `skillbridge-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast("ส่งไฟล์ให้เบราว์เซอร์แล้ว ตรวจรายการดาวน์โหลดของคุณ");
  });
}
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const button = $("button[type=submit]", form);
  const data = Object.fromEntries(new FormData(form));
  if (form.id === "assessment-start")
    return busy(button, async () => {
      const result = await api("/assessment", "POST", { track: data.track });
      app.draft = {
        ...result,
        index: 0,
        answers: Array(result.questions.length).fill(null),
      };
      persistDraft();
      if (location.hash === "#/assessment") render({ focus: true });
      else location.hash = "/assessment";
    });
  if (form.id === "profile-form")
    return busy(button, async () => {
      setState(
        await api("/profile", "PATCH", {
          name: data.name,
          weeklyGoal: Number(data.weeklyGoal),
        }),
      );
      toast("บันทึกชื่อและเป้าหมายแล้ว");
    });
  if (form.id === "auth-form")
    return busy(button, async () => {
      app.user = await api("/" + form.dataset.mode, "POST", data);
      app.draft = null;
      app.result = null;
      app.noteDrafts = {};
      sessionStorage.removeItem("sb-assessment");
      location.hash = "/dashboard";
      toast(
        form.dataset.mode === "register"
          ? "บัญชีพร้อมแล้ว ความก้าวหน้าของคุณยังอยู่ครบ"
          : "Welcome back. กลับมาเรียนต่อกัน",
      );
    });
  if (form.id === "practice-form")
    return busy(button, async () => {
      const result = await api(
        `/lessons/${form.dataset.lesson}/complete`,
        "POST",
        { answer: Number(data.answer) },
      );
      setState(result.state);
      $("#practice-feedback").innerHTML =
        `<div class="practice-feedback ${result.passed ? "" : "wrong"}">${result.passed ? "✓ " : ""}${esc(result.explanation)}</div>`;
      if (result.passed) {
        button.textContent = "Completed ✓";
        toast("เรียนจบแล้ว บันทึกลง Skill Passport ให้เรียบร้อย");
        $(".lesson-header .badge").textContent =
          `${trackBy(lessonBy(form.dataset.lesson).track).name} · COMPLETED`;
      }
    });
  if (form.id === "note-form")
    return busy(
      button,
      async () => {
        setState(
          await api(`/lessons/${form.dataset.lesson}/note`, "POST", {
            note: data.note,
          }),
        );
        delete app.noteDrafts[form.dataset.lesson];
        $("#note-count").textContent =
          `${data.note.length} / 4,000 characters · บันทึกแล้ว`;
        toast("บันทึกโน้ตแล้ว");
      },
      "#note-error",
    );
});
document.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.name === "quiz-answer" && app.draft) {
    app.draft.answers[app.draft.index] = Number(target.value);
    persistDraft();
    const box = $("#form-error");
    if (box) box.textContent = "";
  }
  if (target.id === "path-track") {
    const old = state().track;
    target.disabled = true;
    try {
      setState(await api("/profile", "PATCH", { track: target.value }));
      render();
    } catch (e) {
      target.value = old;
      toast(e.message);
    } finally {
      target.disabled = false;
    }
  }
  if (target.id === "library-track") {
    app.library.track = target.value;
    $("#library-results").innerHTML = libraryCards();
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "library-search") {
    app.library.term = event.target.value;
    $("#library-results").innerHTML = libraryCards();
  }
  if (event.target.id === "global-search") searchResults(event.target.value);
  if (event.target.id === "lesson-note") {
    app.noteDrafts[routeInfo().id] = event.target.value;
    $("#note-count").textContent =
      `${event.target.value.length} / 4,000 characters · ยังไม่บันทึกการแก้ไข`;
  }
});
document.addEventListener("click", async (event) => {
  const el = event.target.closest("button,a");
  if (!el) return;
  if (el.classList.contains("skip")) {
    event.preventDefault();
    $("#main").focus();
    return;
  }
  if (el.id === "menu-toggle") {
    const open = $("#sidebar").classList.toggle("open");
    el.setAttribute("aria-expanded", String(open));
  }
  if (el.id === "search-open" && app.catalog) openSearch();
  if (el.hasAttribute("data-close-dialog")) $("#search-dialog").close();
  if (el.hasAttribute("data-print")) window.print();
  if (el.hasAttribute("data-export")) return exportData(el);
  if (el.hasAttribute("data-resume-quiz")) {
    location.hash = "/assessment";
    render({ focus: true });
  }
  if (el.hasAttribute("data-quiz-prev") && app.draft) {
    app.draft.index = Math.max(0, app.draft.index - 1);
    persistDraft();
    render({ focus: true });
  }
  if (el.hasAttribute("data-quiz-next") && app.draft) {
    if (app.draft.answers[app.draft.index] === null)
      return showError(new Error("เลือกคำตอบก่อนข้ามไปข้อถัดไป"));
    app.draft.index++;
    persistDraft();
    render({ focus: true });
  }
  if (el.dataset.quizJump !== undefined && app.draft) {
    app.draft.index = Number(el.dataset.quizJump);
    persistDraft();
    render({ focus: true });
  }
  if (el.hasAttribute("data-quiz-submit") && app.draft)
    return busy(el, async () => {
      if (app.draft.answers.includes(null))
        throw new Error("ยังตอบไม่ครบ กดหมายเลขข้อเพื่อกลับไปตอบให้ครบก่อนส่ง");
      app.result = await api("/assessment/submit", "POST", {
        id: app.draft.id,
        answers: app.draft.answers,
      });
      setState(app.result.state);
      app.draft = null;
      sessionStorage.removeItem("sb-assessment");
      location.hash = "/results";
    });
  if (el.dataset.libraryTab) {
    app.library.term = $("#library-search").value;
    app.library.saved = el.dataset.libraryTab === "saved";
    render();
  }
  if (el.dataset.save)
    return busy(el, async () => {
      const id = el.dataset.save;
      const saved = !state().saved.includes(id);
      setState(await api(`/lessons/${id}/save`, "POST", { saved }));
      const isLibrary = routeInfo().page === "resources";
      if (isLibrary) render();
      else {
        el.setAttribute("aria-pressed", String(saved));
        el.innerHTML =
          icon("bookmark") + (saved ? "Saved for later" : "Save for later");
      }
      toast(saved ? "เก็บบทเรียนไว้อ่านต่อแล้ว" : "นำออกจากรายการบันทึกแล้ว");
    });
  if (el.hasAttribute("data-logout"))
    return busy(el, async () => {
      await api("/logout", "POST", {});
      app.user = await api("/session", "POST", {});
      app.draft = null;
      app.result = null;
      app.noteDrafts = {};
      sessionStorage.removeItem("sb-assessment");
      location.hash = "/dashboard";
      toast("ออกจากระบบแล้ว");
    });
  if (el.hasAttribute("data-delete-open")) {
    $("#delete-confirm").hidden = false;
    $("#delete-text").focus();
  }
  if (el.hasAttribute("data-delete-cancel")) $("#delete-confirm").hidden = true;
  if (el.hasAttribute("data-delete-confirm"))
    return busy(el, async () => {
      if ($("#delete-text").value !== "DELETE")
        throw new Error("พิมพ์ DELETE ให้ตรงเพื่อยืนยันการลบ");
      await api("/me", "DELETE", { confirm: "DELETE" });
      app.user = await api("/session", "POST", {});
      app.draft = null;
      app.result = null;
      app.noteDrafts = {};
      sessionStorage.removeItem("sb-assessment");
      location.hash = "/dashboard";
      toast("ลบ workspace เดิมแล้ว เริ่มต้นใหม่ได้เลย");
    });
  if (el.hasAttribute("data-retry")) initialize();
});
function syncMobileMenu() {
  const mobile = window.matchMedia("(max-width:760px)").matches;
  $("#sidebar").inert = mobile && !$("#sidebar").classList.contains("open");
}
window.addEventListener("resize", syncMobileMenu);
new MutationObserver(syncMobileMenu).observe($("#sidebar"), {
  attributes: true,
  attributeFilter: ["class"],
});
syncMobileMenu();
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) &&
    !document.activeElement?.isContentEditable &&
    app.catalog
  ) {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape") {
    $("#sidebar").classList.remove("open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
  }
});
window.addEventListener("hashchange", () => {
  $("#sidebar").classList.remove("open");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  if ($("#search-dialog").open) $("#search-dialog").close();
  render({ focus: true });
});
async function initialize() {
  $("#main").innerHTML =
    '<div class="loading-state"><span class="loader"></span><p>กำลังเปิดพื้นที่การเรียนรู้ของคุณ…</p></div>';
  try {
    const [catalog, user] = await Promise.all([
      api("/catalog"),
      api("/session", "POST", {}),
    ]);
    app.catalog = catalog;
    app.user = user;
    try {
      const d = JSON.parse(sessionStorage.getItem("sb-assessment"));
      if (
        d?.id &&
        Array.isArray(d.questions) &&
        d.questions.length === 12 &&
        Array.isArray(d.answers) &&
        d.answers.length === 12 &&
        Number.isInteger(d.index) &&
        d.index >= 0 &&
        d.index < 12
      )
        app.draft = d;
    } catch {
      app.draft = null;
    }
    $("#search-icon").innerHTML = icon("search");
    if (!location.hash) {
      const original = location.pathname.split("/").pop().replace(".html", "");
      history.replaceState(
        null,
        "",
        `#/${["dashboard", "assessment", "passport", "path", "login", "register", "resources"].includes(original) ? original : "dashboard"}`,
      );
    }
    render();
  } catch (error) {
    $("#main").innerHTML =
      `<div class="panel inline-error"><h1>Let’s reconnect.</h1><p class="small-spaced">${esc(error.message)}</p><p class="small-spaced">เปิดเว็บผ่านเซิร์ฟเวอร์ด้วย <strong>npm start</strong> แล้วเข้า <strong>http://localhost:3000</strong></p><button class="btn small-spaced" data-retry>Try again ${icon("arrow")}</button></div>`;
  }
}
window.addEventListener("beforeunload", (event) => {
  if (Object.keys(app.noteDrafts).length) {
    event.preventDefault();
    event.returnValue = "";
  }
});
initialize();

import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import type { Server } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { LEVEL_PENDING, RESULT_COPY } from "../shared/copy.js";
import { LEGACY_QUESTIONS, QUESTIONS } from "../shared/questions.js";
import type { AnswerValue } from "../shared/types.js";
import { createApp } from "./app.js";
import { authenticate, createLead, createSession, finishSession, getLead, openDatabase, saveAnswer } from "./db.js";

let server: Server;
let base: string;
let db: DatabaseSync;

before(async () => {
  db = openDatabase(":memory:", { seedDemo: false });
  server = createApp(db).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  db.close();
});

function jar() {
  let cookie = "";
  return async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(base + path, { ...init, headers });
    for (const item of response.headers.getSetCookie()) {
      const [pair] = item.split(";");
      if (pair.startsWith("hc_admin=") && !item.includes("Max-Age=0")) cookie = pair;
      if (item.includes("Max-Age=0")) cookie = "";
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
}

const level2: AnswerValue[] = ["sim", "sim", "sim", "sim", "sim", "nao", "nao", "nao", "nao", "nao"];

async function openSession(
  request: ReturnType<typeof jar>,
  body: Record<string, unknown>,
) {
  return request("/api/sessions", { method: "POST", body: JSON.stringify(body) });
}

test("public result hides the score and a lead keeps campaign origin", async () => {
  const request = jar();
  const rejected = await openSession(request, { purposeAccepted: true, dataAccepted: false, name: "Helena Costa", whatsapp: "11988887777" });
  assert.equal(rejected.status, 400);

  const before = db.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number };
  const invalid = await openSession(request, {
    purposeAccepted: true,
    dataAccepted: true,
    name: "H",
    whatsapp: "123",
    tracking: { utmSource: "google" },
  });
  assert.equal(invalid.status, 400);
  const afterInvalid = db.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number };
  assert.equal(afterInvalid.n, before.n);

  const created = await openSession(request, {
    purposeAccepted: true,
    dataAccepted: true,
    name: "Helena Costa",
    whatsapp: "(11) 98888-7777",
    tracking: { utmSource: "google", utmMedium: "cpc", utmCampaign: "percepcao-outubro" },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.conversion, "Lead");
  assert.equal(created.body.origin, "google");
  const id = created.body.id as string;

  const recepcaoEarly = jar();
  await recepcaoEarly("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: "recepcao@ouvix.local", password: "ouvix-demo" }),
  });
  const early = await recepcaoEarly("/api/admin/leads?origin=google");
  const waiting = early.body.leads.find((item: { name: string }) => item.name === "Helena Costa");
  assert.ok(waiting);
  assert.equal(waiting.level, null);
  assert.equal(waiting.levelLabel, LEVEL_PENDING);
  assert.equal("score" in waiting, false);

  const audiometry = await request(`/api/sessions/${id}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId: 11, value: "as_vezes" }),
  });
  assert.equal(audiometry.status, 400);

  for (let index = 0; index < level2.length; index += 1) {
    const saved = await request(`/api/sessions/${id}/answers`, {
      method: "POST",
      body: JSON.stringify({ questionId: index + 1, value: level2[index] }),
    });
    assert.equal(saved.status, 200);
  }
  const tooSoon = await request(`/api/sessions/${id}/finish`, { method: "POST", body: "{}" });
  assert.equal(tooSoon.status, 400);
  const savedExtra = await request(`/api/sessions/${id}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId: 11, value: "sim" }),
  });
  assert.equal(savedExtra.status, 200);

  const finished = await request(`/api/sessions/${id}/finish`, { method: "POST", body: "{}" });
  assert.equal(finished.status, 200);
  assert.equal(finished.body.title, RESULT_COPY[2].title);
  assert.equal("score" in finished.body, false);
  assert.equal("level" in finished.body, false);
  assert.equal(JSON.stringify(finished.body).includes("20"), false);

  const locked = await request("/api/admin/leads");
  assert.equal(locked.status, 401);

  const recepcao = jar();
  const login = await recepcao("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: "recepcao@ouvix.local", password: "ouvix-demo" }),
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.role, "recepcao");

  const list = await recepcao("/api/admin/leads?origin=google");
  assert.equal(list.status, 200);
  const helena = list.body.leads.find((item: { name: string }) => item.name === "Helena Costa");
  assert.ok(helena);
  assert.equal(helena.campaign, "percepcao-outubro");
  assert.equal(helena.levelLabel, "Alerta leve a moderado");
  assert.equal(helena.whatsapp, "5511988887777");
  assert.equal("score" in helena, false);

  const hidden = await recepcao(`/api/admin/leads/${helena.id}`);
  assert.equal(hidden.status, 200);
  assert.equal("score" in hidden.body, false);
  assert.equal("answers" in hidden.body, false);
  assert.match(hidden.body.waUrl, /^https:\/\/wa\.me\/5511988887777/);

  const updated = await recepcao(`/api/admin/leads/${helena.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "em_contato" }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "em_contato");

  const avaliacao = jar();
  const clinical = await avaliacao("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: "avaliacao@ouvix.local", password: "ouvix-demo" }),
  });
  assert.equal(clinical.body.role, "avaliacao");
  const detail = await avaliacao(`/api/admin/leads/${helena.id}`);
  assert.equal(detail.body.score, 20);
  assert.equal(detail.body.answers.length, 11);
  assert.equal(detail.body.answers[0].text, QUESTIONS[0].text);
  assert.equal(detail.body.answers[0].label, "Sim");
  assert.equal(detail.body.answers[10].text, QUESTIONS[10].text);
  assert.equal(detail.body.answers[10].label, "Sim");
  assert.equal(detail.body.answers[10].scored, false);

  const closed = await request(`/api/sessions/${id}/close`, { method: "POST", body: "{}" });
  assert.equal(closed.status, 200);
  assert.match(closed.body.message, /especialistas entrará em contato/);
});

test("answering the audiometry question does not change the score", async () => {
  const request = jar();
  const created = await openSession(request, {
    purposeAccepted: true,
    dataAccepted: true,
    name: "Lia Nunes",
    whatsapp: "21988887777",
    tracking: { origem: "totem" },
  });
  const id = created.body.id as string;
  for (let index = 0; index < level2.length; index += 1) {
    await request(`/api/sessions/${id}/answers`, {
      method: "POST",
      body: JSON.stringify({ questionId: index + 1, value: level2[index] }),
    });
  }
  await request(`/api/sessions/${id}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId: 11, value: "nao" }),
  });
  const finished = await request(`/api/sessions/${id}/finish`, { method: "POST", body: "{}" });
  assert.equal(finished.body.title, RESULT_COPY[2].title);

  const staff = jar();
  await staff("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: "avaliacao@ouvix.local", password: "ouvix-demo" }),
  });
  const list = await staff("/api/admin/leads?origin=totem");
  const lia = list.body.leads.find((item: { name: string }) => item.name === "Lia Nunes");
  const detail = await staff(`/api/admin/leads/${lia.id}`);
  assert.equal(detail.body.score, 20);
  assert.equal(detail.body.answers[10].label, "Não");
});

test("older sessions keep the questionnaire they answered", () => {
  const sessionId = createSession(db, { origem: "site" });
  db.prepare("UPDATE sessions SET questionnaire_version = NULL WHERE id = ?").run(sessionId);
  LEGACY_QUESTIONS.forEach((_, index) => saveAnswer(db, sessionId, index + 1, index === 0 ? "sim" : "nao"));
  finishSession(db, sessionId);
  const lead = createLead(db, sessionId, "Antigo Silva", "11977776666");
  const detail = getLead(db, lead.id, "avaliacao");
  assert.ok(detail);
  assert.equal(detail.answers?.length, 10);
  assert.equal(detail.answers?.[0].text, LEGACY_QUESTIONS[0].text);
  assert.equal(detail.score, 4);
});

test("an existing database keeps old leads and accepts a lead before the test ends", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hearingcheck-legacy-"));
  const dbPath = path.join(dir, "hearingcheck.sqlite");
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      origin TEXT NOT NULL,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      gclid TEXT,
      fbclid TEXT,
      consent_purpose_at TEXT NOT NULL,
      consent_data_at TEXT NOT NULL,
      consent_version TEXT NOT NULL,
      finished_at TEXT,
      score INTEGER,
      level INTEGER,
      lead_choice TEXT
    );
    CREATE TABLE answers (
      session_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (session_id, question_id)
    );
    CREATE TABLE leads (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      score INTEGER NOT NULL,
      level INTEGER NOT NULL,
      origin TEXT NOT NULL,
      campaign TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  legacy.prepare(
    `INSERT INTO sessions (
      id, created_at, origin, consent_purpose_at, consent_data_at, consent_version, finished_at, score, level, lead_choice
    ) VALUES ('sess-old', '2026-10-01T00:00:00.000Z', 'site', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', '2026-10', '2026-10-01T00:00:00.000Z', 8, 1, 'sim')`,
  ).run();
  legacy.prepare(
    `INSERT INTO leads (
      id, session_id, name, whatsapp, score, level, origin, campaign, status, created_at, updated_at
    ) VALUES ('lead-old', 'sess-old', 'Antiga', '5511999999999', 8, 1, 'site', NULL, 'novo', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`,
  ).run();
  legacy.close();

  const migrated = openDatabase(dbPath, { seedDemo: false });
  try {
    const kept = migrated.prepare("SELECT score, level FROM leads WHERE id = 'lead-old'").get() as { score: number; level: number };
    assert.equal(kept.score, 8);
    assert.equal(kept.level, 1);
    const columns = migrated.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
    assert.ok(columns.some((column) => column.name === "closed_at"));
    assert.ok(columns.some((column) => column.name === "questionnaire_version"));

    const sessionId = createSession(migrated, { origem: "meta" });
    const lead = createLead(migrated, sessionId, "Nova Pessoa", "11966665555");
    const row = migrated.prepare("SELECT score, level FROM leads WHERE id = ?").get(lead.id) as { score: number | null; level: number | null };
    assert.equal(row.score, null);
    assert.equal(row.level, null);
  } finally {
    migrated.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a started test that is not finished is counted apart from completed tests", async () => {
  const staff = jar();
  const login = await staff("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: "avaliacao@ouvix.local", password: "ouvix-demo" }),
  });
  assert.equal(login.status, 200);
  const before = await staff("/api/admin/summary?days=30");
  assert.equal(before.status, 200);

  const request = jar();
  const created = await openSession(request, {
    purposeAccepted: true,
    dataAccepted: true,
    name: "Incompleto Dias",
    whatsapp: "11955554444",
    tracking: { origem: "site" },
  });
  assert.equal(created.status, 201);

  const afterStart = await staff("/api/admin/summary?days=30");
  assert.equal(afterStart.body.sessionsStarted, before.body.sessionsStarted + 1);
  assert.equal(afterStart.body.sessionsUnfinished, before.body.sessionsUnfinished + 1);
  assert.equal(afterStart.body.sessionsFinished, before.body.sessionsFinished);

  const id = created.body.id as string;
  for (let index = 0; index < 10; index += 1) {
    await request(`/api/sessions/${id}/answers`, {
      method: "POST",
      body: JSON.stringify({ questionId: index + 1, value: "nao" }),
    });
  }
  await request(`/api/sessions/${id}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId: 11, value: "nao" }),
  });
  const finished = await request(`/api/sessions/${id}/finish`, { method: "POST", body: "{}" });
  assert.equal(finished.status, 200);

  const afterFinish = await staff("/api/admin/summary?days=30");
  assert.equal(afterFinish.body.sessionsUnfinished, before.body.sessionsUnfinished);
  assert.equal(afterFinish.body.sessionsFinished, before.body.sessionsFinished + 1);
});

test("a host password replaces the password already stored", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hearingcheck-"));
  const dbPath = path.join(dir, "hearingcheck.sqlite");
  const previous = process.env.HEARINGCHECK_DEMO_PASSWORD;
  delete process.env.HEARINGCHECK_DEMO_PASSWORD;
  try {
    const first = openDatabase(dbPath, { seedDemo: false });
    assert.ok(authenticate(first, "recepcao@ouvix.local", "ouvix-demo"));
    first.close();

    process.env.HEARINGCHECK_DEMO_PASSWORD = "ouvir bem juntos";
    const second = openDatabase(dbPath, { seedDemo: false });
    assert.equal(authenticate(second, "recepcao@ouvix.local", "ouvix-demo"), undefined);
    assert.ok(authenticate(second, "avaliacao@ouvix.local", "ouvir bem juntos"));
    second.close();
  } finally {
    if (previous === undefined) delete process.env.HEARINGCHECK_DEMO_PASSWORD;
    else process.env.HEARINGCHECK_DEMO_PASSWORD = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

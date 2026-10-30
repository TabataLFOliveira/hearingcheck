import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";
import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { RESULT_COPY } from "../shared/copy.js";
import type { AnswerValue } from "../shared/types.js";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";

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

async function finishPublicTest(request: ReturnType<typeof jar>, answers: AnswerValue[]) {
  const created = await request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      purposeAccepted: true,
      dataAccepted: true,
      tracking: { utmSource: "google", utmMedium: "cpc", utmCampaign: "percepcao-outubro" },
    }),
  });
  assert.equal(created.status, 201);
  const id = created.body.id as string;
  for (let index = 0; index < answers.length; index += 1) {
    const saved = await request(`/api/sessions/${id}/answers`, {
      method: "POST",
      body: JSON.stringify({ questionId: index + 1, value: answers[index] }),
    });
    assert.equal(saved.status, 200);
  }
  const finished = await request(`/api/sessions/${id}/finish`, { method: "POST", body: "{}" });
  return { id, finished };
}

test("public result hides the score and a lead keeps campaign origin", async () => {
  const request = jar();
  const rejected = await request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ purposeAccepted: true, dataAccepted: false }),
  });
  assert.equal(rejected.status, 400);

  const { id, finished } = await finishPublicTest(request, level2);
  assert.equal(finished.status, 200);
  assert.equal(finished.body.title, RESULT_COPY[2].title);
  assert.equal("score" in finished.body, false);
  assert.equal("level" in finished.body, false);
  assert.equal(JSON.stringify(finished.body).includes("20"), false);

  const lead = await request(`/api/sessions/${id}/lead`, {
    method: "POST",
    body: JSON.stringify({ name: "Helena Costa", whatsapp: "(11) 98888-7777" }),
  });
  assert.equal(lead.status, 201);
  assert.equal(lead.body.conversion, "Lead");
  assert.equal(lead.body.origin, "google");
  assert.equal(lead.body.message.includes("diagnóst"), false);

  const again = await request(`/api/sessions/${id}/lead`, {
    method: "POST",
    body: JSON.stringify({ name: "Outra Pessoa", whatsapp: "11977776666" }),
  });
  assert.equal(again.status, 201);

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
  assert.equal(detail.body.answers.length, 10);
  assert.equal(detail.body.answers[0].label, "Sim");
});

test("declining contact does not create a lead", async () => {
  const request = jar();
  const created = await request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      purposeAccepted: true,
      dataAccepted: true,
      tracking: { origem: "totem" },
    }),
  });
  const id = created.body.id as string;
  for (let index = 0; index < 10; index += 1) {
    await request(`/api/sessions/${id}/answers`, {
      method: "POST",
      body: JSON.stringify({ questionId: index + 1, value: "nao" }),
    });
  }
  const finished = await request(`/api/sessions/${id}/finish`, { method: "POST", body: "{}" });
  assert.equal(finished.body.title, RESULT_COPY[1].title);
  const declined = await request(`/api/sessions/${id}/decline`, { method: "POST", body: "{}" });
  assert.equal(declined.status, 200);

  const staff = jar();
  await staff("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: "recepcao@ouvix.local", password: "ouvix-demo" }),
  });
  const list = await staff("/api/admin/leads?origin=totem");
  assert.equal(list.body.leads.length, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { resolveOrigin } from "./origin.js";
import { normalizeName, normalizeWhatsapp } from "./phone.js";
import { QUESTIONNAIRE_VERSION, QUESTIONS, questionsFor } from "./questions.js";
import { levelForScore, scoreAnswers } from "./scoring.js";
import type { AnswerValue } from "./types.js";

const nao = (): AnswerValue[] => Array(10).fill("nao");

test("scores the documented boundaries", () => {
  assert.equal(scoreAnswers(nao()), 0);
  assert.equal(levelForScore(0), 1);
  assert.equal(levelForScore(8), 1);
  const level2Floor = ["as_vezes", "as_vezes", "as_vezes", "as_vezes", "as_vezes", "nao", "nao", "nao", "nao", "nao"] as AnswerValue[];
  assert.equal(scoreAnswers(level2Floor), 10);
  assert.equal(levelForScore(10), 2);
  assert.equal(levelForScore(24), 2);
  const level3Floor = ["sim", "sim", "sim", "sim", "sim", "sim", "as_vezes", "nao", "nao", "nao"] as AnswerValue[];
  assert.equal(scoreAnswers(level3Floor), 26);
  assert.equal(levelForScore(26), 3);
  assert.equal(scoreAnswers(Array(10).fill("sim")), 40);
  assert.equal(levelForScore(40), 3);
  assert.throws(() => levelForScore(9));
  assert.throws(() => levelForScore(25));
});

test("the current questionnaire scores ten answers and keeps audiometry separate", () => {
  const scored = QUESTIONS.filter((question) => question.scored);
  assert.equal(QUESTIONS.length, 11);
  assert.equal(scored.length, 10);
  assert.equal(QUESTIONS[0].text, "Sente que está deixando de aproveitar a vida ou ficando em desvantagem por não ouvir bem?");
  assert.equal(QUESTIONS[3].text, "Em algum dos ouvidos você sente que escuta menos?");
  assert.equal(QUESTIONS[4].text, "Você ouve algum zumbido, chiado ou apito nos ouvidos?");
  assert.equal(QUESTIONS[10].text, "Você já fez um exame de audiometria alguma vez?");
  assert.equal(QUESTIONS[10].scored, false);
  assert.equal(questionsFor(null).length, 10);
  assert.equal(questionsFor(QUESTIONNAIRE_VERSION), QUESTIONS);
});

test("resolves campaign origin", () => {
  assert.equal(resolveOrigin({ origem: "totem", gclid: "abc" }), "totem");
  assert.equal(resolveOrigin({ gclid: "abc" }), "google");
  assert.equal(resolveOrigin({ fbclid: "abc" }), "meta");
  assert.equal(resolveOrigin({ utmSource: "instagram" }), "meta");
  assert.equal(resolveOrigin({ utmSource: "google" }), "google");
  assert.equal(resolveOrigin({ origem: "site" }), "site");
  assert.equal(resolveOrigin({}), "direto");
});

test("normalizes Brazilian WhatsApp numbers and names", () => {
  assert.equal(normalizeWhatsapp("(11) 98888-7777"), "5511988887777");
  assert.equal(normalizeWhatsapp("5511988887777"), "5511988887777");
  assert.equal(normalizeWhatsapp("123"), null);
  assert.equal(normalizeName("  Helena   Costa "), "Helena Costa");
  assert.equal(normalizeName("A"), null);
});

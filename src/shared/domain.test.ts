import assert from "node:assert/strict";
import test from "node:test";
import { resolveOrigin } from "./origin.js";
import { normalizeName, normalizeWhatsapp } from "./phone.js";
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

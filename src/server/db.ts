import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ANSWER_LABEL,
  CONSENT_VERSION,
  DEMO_PASSWORD,
  DEMO_USERS,
  LEVEL_LABEL,
  ORIGIN_LABEL,
  REMINDER,
  RESULT_COPY,
  STATUS_LABEL,
  THANKS_DONE,
  THANKS_LEAD,
  contactMessage,
} from "../shared/copy.js";
import { cleanTracking, resolveOrigin } from "../shared/origin.js";
import { formatWhatsapp, normalizeName, normalizeWhatsapp, whatsappLink } from "../shared/phone.js";
import { QUESTIONS } from "../shared/questions.js";
import { levelForScore, scoreAnswers } from "../shared/scoring.js";
import type { AnswerValue, LeadStatus, Level, Origin, Role, TrackingInput } from "../shared/types.js";
import { ANSWER_VALUES, LEAD_STATUSES, ORIGINS } from "../shared/types.js";

type SessionRow = {
  id: string;
  created_at: string;
  origin: Origin;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  finished_at: string | null;
  score: number | null;
  level: Level | null;
  lead_choice: "sim" | "nao" | null;
};

type AnswerRow = { question_id: number; value: AnswerValue };

type LeadRow = {
  id: string;
  session_id: string;
  name: string;
  whatsapp: string;
  score: number;
  level: Level;
  origin: Origin;
  campaign: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
};

export type PublicResult = { title: string; body: string; reminder: string };

export type PublicSession = {
  id: string;
  phase: "question" | "result" | "thanks";
  answers: { questionId: number; value: AnswerValue }[];
  result?: { title: string; body: string; reminder: string };
  thanks?: string;
};

export type LeadListItem = {
  id: string;
  name: string;
  whatsapp: string;
  whatsappDisplay: string;
  level: Level;
  levelLabel: string;
  origin: Origin;
  originLabel: string;
  campaign: string | null;
  status: LeadStatus;
  statusLabel: string;
  createdAt: string;
  score?: number;
};

export type LeadDetail = LeadListItem & {
  message: string;
  waUrl: string;
  answers?: { questionId: number; text: string; value: AnswerValue; label: string }[];
};

export type Summary = {
  days: number;
  since: string;
  leads: number;
  byOrigin: { origin: Origin; label: string; count: number }[];
  byLevel: { level: Level; label: string; count: number }[];
  byStatus: { status: LeadStatus; label: string; count: number }[];
  sessionsStarted: number;
  sessionsFinished: number;
};

export type StaffUser = { id: string; email: string; name: string; role: Role };

function as<T>(value: unknown): T | undefined {
  if (value == null) return undefined;
  return value as T;
}

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function passwordMatches(password: string, saltHex: string, hashHex: string): boolean {
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(hashHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function openDatabase(dbPath: string, options?: { seedDemo?: boolean }): DatabaseSync {
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 3000");
  if (dbPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
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
    CREATE TABLE IF NOT EXISTS answers (
      session_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (session_id, question_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
    CREATE TABLE IF NOT EXISTS leads (
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
      updated_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);
  ensureUsers(db);
  if (options?.seedDemo !== false) seedDemoLeads(db);
  return db;
}

function ensureUsers(db: DatabaseSync): void {
  const password = process.env.HEARINGCHECK_DEMO_PASSWORD || DEMO_PASSWORD;
  const insert = db.prepare(
    `INSERT INTO users (id, email, name, role, password_salt, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const existing = db.prepare("SELECT id FROM users WHERE email = ?");
  for (const user of DEMO_USERS) {
    if (existing.get(user.email)) continue;
    const { salt, hash } = hashPassword(password);
    insert.run(randomUUID(), user.email, user.name, user.role, salt, hash);
  }
}

function seedDemoLeads(db: DatabaseSync): void {
  const count = as<{ n: number }>(db.prepare("SELECT COUNT(*) AS n FROM leads").get());
  if ((count?.n ?? 0) > 0) return;
  const samples: Array<{
    name: string;
    phone: string;
    tracking: TrackingInput;
    answers: AnswerValue[];
    status: LeadStatus;
    hoursAgo: number;
  }> = [
    {
      name: "Ana Demo",
      phone: "11900000001",
      tracking: { utmSource: "google", utmMedium: "cpc", utmCampaign: "busca-setembro" },
      answers: ["sim", "sim", "sim", "sim", "sim", "sim", "sim", "sim", "nao", "nao"],
      status: "novo",
      hoursAgo: 5,
    },
    {
      name: "Carlos Demo",
      phone: "21900000002",
      tracking: { utmSource: "instagram", utmMedium: "paid", utmCampaign: "reels-familia" },
      answers: ["sim", "sim", "sim", "sim", "nao", "nao", "nao", "nao", "nao", "nao"],
      status: "em_contato",
      hoursAgo: 26,
    },
    {
      name: "Marina Demo",
      phone: "11900000003",
      tracking: { origem: "site", utmCampaign: "home-ouvix" },
      answers: ["nao", "nao", "nao", "nao", "nao", "nao", "nao", "nao", "sim", "nao"],
      status: "agendado",
      hoursAgo: 50,
    },
    {
      name: "Paulo Demo",
      phone: "11900000004",
      tracking: { origem: "totem" },
      answers: ["sim", "sim", "sim", "sim", "sim", "sim", "sim", "nao", "nao", "nao"],
      status: "sem_retorno",
      hoursAgo: 72,
    },
  ];
  for (const sample of samples) {
    const sessionId = createSession(db, sample.tracking);
    sample.answers.forEach((value, index) => saveAnswer(db, sessionId, index + 1, value));
    finishSession(db, sessionId);
    const lead = createLead(db, sessionId, sample.name, sample.phone);
    const when = new Date(Date.now() - sample.hoursAgo * 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE sessions SET created_at = ?, finished_at = ? WHERE id = ?").run(when, when, sessionId);
    db.prepare("UPDATE leads SET created_at = ?, updated_at = ?, status = ? WHERE id = ?").run(
      when,
      when,
      sample.status,
      lead.id,
    );
  }
}

export function createSession(db: DatabaseSync, trackingInput: TrackingInput): string {
  const tracking = cleanTracking(trackingInput);
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (
      id, created_at, origin, utm_source, utm_medium, utm_campaign, gclid, fbclid,
      consent_purpose_at, consent_data_at, consent_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    now,
    resolveOrigin(tracking),
    tracking.utmSource,
    tracking.utmMedium,
    tracking.utmCampaign,
    tracking.gclid,
    tracking.fbclid,
    now,
    now,
    CONSENT_VERSION,
  );
  return id;
}

function sessionRow(db: DatabaseSync, id: string): SessionRow | undefined {
  return as<SessionRow>(db.prepare("SELECT * FROM sessions WHERE id = ?").get(id));
}

function answerRows(db: DatabaseSync, sessionId: string): AnswerRow[] {
  return db.prepare("SELECT question_id, value FROM answers WHERE session_id = ? ORDER BY question_id").all(sessionId) as AnswerRow[];
}

export function saveAnswer(db: DatabaseSync, sessionId: string, questionId: number, value: AnswerValue): void {
  const session = sessionRow(db, sessionId);
  if (!session) throw new DbError(404, "Teste não encontrado.");
  if (session.finished_at) throw new DbError(409, "Este teste já foi concluído.");
  if (!Number.isInteger(questionId) || questionId < 1 || questionId > 10) {
    throw new DbError(400, "Pergunta inválida.");
  }
  if (!ANSWER_VALUES.includes(value)) throw new DbError(400, "Resposta inválida.");
  db.prepare(
    `INSERT INTO answers (session_id, question_id, value) VALUES (?, ?, ?)
     ON CONFLICT(session_id, question_id) DO UPDATE SET value = excluded.value`,
  ).run(sessionId, questionId, value);
}

export function resultForLevel(level: Level): { title: string; body: string; reminder: string } {
  return {
    title: RESULT_COPY[level].title,
    body: RESULT_COPY[level].body,
    reminder: REMINDER,
  };
}

export function finishSession(db: DatabaseSync, sessionId: string): { title: string; body: string; reminder: string } {
  const session = sessionRow(db, sessionId);
  if (!session) throw new DbError(404, "Teste não encontrado.");
  if (session.finished_at && session.level) return resultForLevel(session.level);
  const answers = answerRows(db, sessionId);
  if (answers.length !== 10) throw new DbError(400, "Responda as 10 perguntas antes de ver o resultado.");
  const score = scoreAnswers(answers.map((answer) => answer.value));
  const level = levelForScore(score);
  db.prepare("UPDATE sessions SET finished_at = ?, score = ?, level = ? WHERE id = ?").run(
    new Date().toISOString(),
    score,
    level,
    sessionId,
  );
  return resultForLevel(level);
}

export function readPublicSession(db: DatabaseSync, sessionId: string): PublicSession {
  const session = sessionRow(db, sessionId);
  if (!session) throw new DbError(404, "Teste não encontrado.");
  const answers = answerRows(db, sessionId).map((answer) => ({
    questionId: answer.question_id,
    value: answer.value,
  }));
  if (!session.finished_at || !session.level) {
    return { id: session.id, phase: "question", answers };
  }
  const result = resultForLevel(session.level);
  if (!session.lead_choice) {
    return { id: session.id, phase: "result", answers, result };
  }
  const thanks = session.lead_choice === "sim" ? THANKS_LEAD : THANKS_DONE;
  return { id: session.id, phase: "thanks", answers, result, thanks };
}

export function createLead(
  db: DatabaseSync,
  sessionId: string,
  rawName: string,
  rawPhone: string,
): { id: string; origin: Origin } {
  const session = sessionRow(db, sessionId);
  if (!session) throw new DbError(404, "Teste não encontrado.");
  if (!session.finished_at || session.score == null || !session.level) {
    throw new DbError(400, "Veja o resultado antes de pedir contato.");
  }
  const existing = as<{ id: string }>(db.prepare("SELECT id FROM leads WHERE session_id = ?").get(sessionId));
  if (existing) return { id: existing.id, origin: session.origin };
  const name = normalizeName(rawName);
  const whatsapp = normalizeWhatsapp(rawPhone);
  if (!name || !whatsapp) throw new DbError(400, "Informe nome e WhatsApp válidos.");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO leads (
      id, session_id, name, whatsapp, score, level, origin, campaign, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'novo', ?, ?)`,
  ).run(id, sessionId, name, whatsapp, session.score, session.level, session.origin, session.utm_campaign, now, now);
  db.prepare("UPDATE sessions SET lead_choice = 'sim' WHERE id = ?").run(sessionId);
  return { id, origin: session.origin };
}

export function declineLead(db: DatabaseSync, sessionId: string): void {
  const session = sessionRow(db, sessionId);
  if (!session) throw new DbError(404, "Teste não encontrado.");
  if (!session.finished_at) throw new DbError(400, "Veja o resultado antes de encerrar.");
  if (session.lead_choice === "sim") return;
  db.prepare("UPDATE sessions SET lead_choice = 'nao' WHERE id = ?").run(sessionId);
}

export function authenticate(db: DatabaseSync, email: string, password: string): StaffUser | undefined {
  const row = as<{ id: string; email: string; name: string; role: Role; password_salt: string; password_hash: string }>(
    db.prepare("SELECT id, email, name, role, password_salt, password_hash FROM users WHERE email = ?").get(email.trim().toLowerCase()),
  );
  if (!row || !passwordMatches(password, row.password_salt, row.password_hash)) return undefined;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function createAdminSession(db: DatabaseSync, userId: string): string {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO admin_sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    new Date().toISOString(),
  );
  return token;
}

export function userForToken(db: DatabaseSync, token: string): StaffUser | undefined {
  return as<StaffUser>(
    db.prepare(
      `SELECT users.id, users.email, users.name, users.role
       FROM admin_sessions
       JOIN users ON users.id = admin_sessions.user_id
       WHERE admin_sessions.token = ?`,
    ).get(token),
  );
}

export function deleteAdminSession(db: DatabaseSync, token: string): void {
  db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
}

export type LeadFilter = {
  status?: LeadStatus;
  origin?: Origin;
  level?: Level;
  days?: number;
};

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function leadWhere(filter: LeadFilter): { sql: string; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter.origin) {
    clauses.push("origin = ?");
    params.push(filter.origin);
  }
  if (filter.level) {
    clauses.push("level = ?");
    params.push(filter.level);
  }
  if (filter.days) {
    clauses.push("created_at >= ?");
    params.push(sinceIso(filter.days));
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function presentLead(row: LeadRow, role: Role): LeadListItem {
  const item: LeadListItem = {
    id: row.id,
    name: row.name,
    whatsapp: row.whatsapp,
    whatsappDisplay: formatWhatsapp(row.whatsapp),
    level: row.level,
    levelLabel: LEVEL_LABEL[row.level],
    origin: row.origin,
    originLabel: ORIGIN_LABEL[row.origin],
    campaign: row.campaign,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status],
    createdAt: row.created_at,
  };
  if (role === "avaliacao") item.score = row.score;
  return item;
}

export function listLeads(db: DatabaseSync, filter: LeadFilter, role: Role): LeadListItem[] {
  const where = leadWhere(filter);
  const rows = db.prepare(`SELECT * FROM leads ${where.sql} ORDER BY created_at DESC`).all(...where.params) as LeadRow[];
  return rows.map((row) => presentLead(row, role));
}

export function getLead(db: DatabaseSync, id: string, role: Role): LeadDetail | undefined {
  const row = as<LeadRow>(db.prepare("SELECT * FROM leads WHERE id = ?").get(id));
  if (!row) return undefined;
  const message = contactMessage(row.name);
  const detail: LeadDetail = {
    ...presentLead(row, role),
    message,
    waUrl: whatsappLink(row.whatsapp, message),
  };
  if (role === "avaliacao") {
    const answers = answerRows(db, row.session_id);
    detail.answers = QUESTIONS.map((question) => {
      const saved = answers.find((answer) => answer.question_id === question.id);
      const value = saved?.value ?? "nao";
      return {
        questionId: question.id,
        text: question.text,
        value,
        label: ANSWER_LABEL[value],
      };
    });
  }
  return detail;
}

export function updateLeadStatus(db: DatabaseSync, id: string, status: LeadStatus, role: Role): LeadDetail {
  if (!LEAD_STATUSES.includes(status)) throw new DbError(400, "Status inválido.");
  const updated = db.prepare("UPDATE leads SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  if (updated.changes !== 1) throw new DbError(404, "Lead não encontrado.");
  const lead = getLead(db, id, role);
  if (!lead) throw new DbError(404, "Lead não encontrado.");
  return lead;
}

export function openContact(db: DatabaseSync, id: string) {
  const row = as<LeadRow>(db.prepare("SELECT * FROM leads WHERE id = ?").get(id));
  if (!row) return undefined;
  const message = contactMessage(row.name);
  return {
    leadId: row.id,
    name: row.name,
    whatsapp: row.whatsapp,
    whatsappDisplay: formatWhatsapp(row.whatsapp),
    waUrl: whatsappLink(row.whatsapp, message),
    message,
    levelLabel: LEVEL_LABEL[row.level],
    originLabel: ORIGIN_LABEL[row.origin],
    status: row.status,
    statusLabel: STATUS_LABEL[row.status],
  };
}

export function summarize(db: DatabaseSync, days: number): Summary {
  const since = sinceIso(days);
  const originRows = db.prepare(
    "SELECT origin, COUNT(*) AS n FROM leads WHERE created_at >= ? GROUP BY origin",
  ).all(since) as Array<{ origin: Origin; n: number }>;
  const levelRows = db.prepare(
    "SELECT level, COUNT(*) AS n FROM leads WHERE created_at >= ? GROUP BY level",
  ).all(since) as Array<{ level: Level; n: number }>;
  const statusRows = db.prepare(
    "SELECT status, COUNT(*) AS n FROM leads WHERE created_at >= ? GROUP BY status",
  ).all(since) as Array<{ status: LeadStatus; n: number }>;
  const sessions = as<{ started: number; finished: number }>(
    db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM sessions WHERE created_at >= ?) AS started,
         (SELECT COUNT(*) FROM sessions WHERE finished_at IS NOT NULL AND finished_at >= ?) AS finished`,
    ).get(since, since),
  );
  const originCount = new Map(originRows.map((row) => [row.origin, row.n]));
  const levelCount = new Map(levelRows.map((row) => [row.level, row.n]));
  const statusCount = new Map(statusRows.map((row) => [row.status, row.n]));
  const byOrigin = ORIGINS.map((origin) => ({
    origin,
    label: ORIGIN_LABEL[origin],
    count: originCount.get(origin) ?? 0,
  }));
  const byLevel = ([1, 2, 3] as Level[]).map((level) => ({
    level,
    label: LEVEL_LABEL[level],
    count: levelCount.get(level) ?? 0,
  }));
  const byStatus = LEAD_STATUSES.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: statusCount.get(status) ?? 0,
  }));
  return {
    days,
    since,
    leads: byOrigin.reduce((total, item) => total + item.count, 0),
    byOrigin,
    byLevel,
    byStatus,
    sessionsStarted: sessions?.started ?? 0,
    sessionsFinished: sessions?.finished ?? 0,
  };
}

export class DbError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && LEAD_STATUSES.includes(value as LeadStatus);
}

export function isOrigin(value: unknown): value is Origin {
  return typeof value === "string" && ORIGINS.includes(value as Origin);
}

export function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3;
}

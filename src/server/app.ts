import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { THANKS_DONE, THANKS_LEAD } from "../shared/copy.js";
import type { AnswerValue, TrackingInput } from "../shared/types.js";
import { ANSWER_VALUES } from "../shared/types.js";
import {
  authenticate,
  createAdminSession,
  createLead,
  createSession,
  DbError,
  declineLead,
  deleteAdminSession,
  finishSession,
  getLead,
  isLeadStatus,
  isLevel,
  isOrigin,
  listLeads,
  readPublicSession,
  saveAnswer,
  summarize,
  updateLeadStatus,
  userForToken,
  type StaffUser,
} from "./db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const indexHtml = path.join(root, "dist", "index.html");

type AuthedRequest = Request & { staff?: StaffUser };

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function routeId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) throw new DbError(404, "Não encontrado.");
  return id;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof DbError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Não foi possível concluir agora." });
}

function asyncRoute(handler: (req: AuthedRequest, res: Response) => Promise<void>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    handler(req, res).catch((error: unknown) => {
      if (res.headersSent) {
        next(error);
        return;
      }
      sendError(res, error);
    });
  };
}

export function createApp(db: DatabaseSync) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  function requireStaff(req: AuthedRequest): StaffUser {
    const token = cookieValue(req.header("cookie"), "hc_admin");
    if (!token) throw new DbError(401, "Sessão expirada.");
    const staff = userForToken(db, token);
    if (!staff) throw new DbError(401, "Sessão expirada.");
    return staff;
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "hearingcheck" });
  });

  app.post(
    "/api/sessions",
    asyncRoute(async (req, res) => {
      const body = req.body ?? {};
      if (body.purposeAccepted !== true || body.dataAccepted !== true) {
        throw new DbError(400, "Aceite os dois termos para iniciar.");
      }
      const tracking = (body.tracking ?? {}) as TrackingInput;
      if (typeof tracking !== "object") throw new DbError(400, "Origem inválida.");
      const id = createSession(db, tracking);
      res.status(201).json({ id });
    }),
  );

  app.get(
    "/api/sessions/:id",
    asyncRoute(async (req, res) => {
      res.json(readPublicSession(db, routeId(req.params.id)));
    }),
  );

  app.post(
    "/api/sessions/:id/answers",
    asyncRoute(async (req, res) => {
      const value = req.body?.value as AnswerValue;
      if (!ANSWER_VALUES.includes(value)) throw new DbError(400, "Resposta inválida.");
      saveAnswer(db, routeId(req.params.id), Number(req.body?.questionId), value);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/sessions/:id/finish",
    asyncRoute(async (req, res) => {
      res.json(finishSession(db, routeId(req.params.id)));
    }),
  );

  app.post(
    "/api/sessions/:id/lead",
    asyncRoute(async (req, res) => {
      const lead = createLead(db, routeId(req.params.id), String(req.body?.name ?? ""), String(req.body?.whatsapp ?? ""));
      res.status(201).json({
        message: THANKS_LEAD,
        conversion: "Lead",
        origin: lead.origin,
      });
    }),
  );

  app.post(
    "/api/sessions/:id/decline",
    asyncRoute(async (req, res) => {
      declineLead(db, routeId(req.params.id));
      res.json({ message: THANKS_DONE });
    }),
  );

  app.post(
    "/api/admin/login",
    asyncRoute(async (req, res) => {
      const email = String(req.body?.email ?? "");
      const password = String(req.body?.password ?? "");
      const staff = authenticate(db, email, password);
      if (!staff) throw new DbError(401, "E-mail ou senha incorretos.");
      const token = createAdminSession(db, staff.id);
      res.setHeader("Set-Cookie", `hc_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
      res.json({ email: staff.email, name: staff.name, role: staff.role });
    }),
  );

  app.post(
    "/api/admin/logout",
    asyncRoute(async (req, res) => {
      const token = cookieValue(req.header("cookie"), "hc_admin");
      if (token) deleteAdminSession(db, token);
      res.setHeader("Set-Cookie", "hc_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/admin/me",
    asyncRoute(async (req, res) => {
      const staff = requireStaff(req);
      res.json({ email: staff.email, name: staff.name, role: staff.role });
    }),
  );

  app.get(
    "/api/admin/summary",
    asyncRoute(async (req, res) => {
      requireStaff(req);
      const days = Number(req.query.days ?? 30);
      if (!Number.isInteger(days) || days < 1 || days > 365) throw new DbError(400, "Período inválido.");
      res.json(summarize(db, days));
    }),
  );

  app.get(
    "/api/admin/leads",
    asyncRoute(async (req, res) => {
      const staff = requireStaff(req);
      const status = req.query.status;
      const origin = req.query.origin;
      const level = req.query.level === undefined ? undefined : Number(req.query.level);
      if (status !== undefined && !isLeadStatus(status)) throw new DbError(400, "Status inválido.");
      if (origin !== undefined && !isOrigin(origin)) throw new DbError(400, "Origem inválida.");
      if (level !== undefined && !isLevel(level)) throw new DbError(400, "Nível inválido.");
      const days = req.query.days === undefined ? undefined : Number(req.query.days);
      if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 365)) {
        throw new DbError(400, "Período inválido.");
      }
      res.json({
        leads: listLeads(db, {
          status: isLeadStatus(status) ? status : undefined,
          origin: isOrigin(origin) ? origin : undefined,
          level: isLevel(level) ? level : undefined,
          days,
        }, staff.role),
      });
    }),
  );

  app.get(
    "/api/admin/leads/:id",
    asyncRoute(async (req, res) => {
      const staff = requireStaff(req);
      const lead = getLead(db, routeId(req.params.id), staff.role);
      if (!lead) throw new DbError(404, "Lead não encontrado.");
      res.json(lead);
    }),
  );

  app.patch(
    "/api/admin/leads/:id",
    asyncRoute(async (req, res) => {
      const staff = requireStaff(req);
      if (!isLeadStatus(req.body?.status)) throw new DbError(400, "Status inválido.");
      res.json(updateLeadStatus(db, routeId(req.params.id), req.body.status, staff.role));
    }),
  );

  if (existsSync(indexHtml)) {
    app.use(express.static(path.dirname(indexHtml), { index: false }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Não encontrado." });
  });

  return app;
}

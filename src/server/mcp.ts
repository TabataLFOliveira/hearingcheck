import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { isLeadStatus, isLevel, isOrigin, listLeads, openContact, openDatabase, summarize, updateLeadStatus } from "./db.js";

const dbPath = process.env.HEARINGCHECK_DB ?? path.join(process.cwd(), "data", "hearingcheck.sqlite");
const db = openDatabase(dbPath, { seedDemo: process.env.HEARINGCHECK_SEED !== "0" });

const server = new McpServer({ name: "hearingcheck", version: "0.1.0" });

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

server.registerTool(
  "resumo_leads",
  {
    title: "Lead summary",
    description:
      "Count Ouvix pre-screening leads by origin, level, and status. Returns aggregates only, with no patient names or scores.",
    inputSchema: {
      days: z.number().int().min(1).max(365).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ days }) => text(summarize(db, days ?? 30)),
);

server.registerTool(
  "listar_leads",
  {
    title: "List leads",
    description:
      "List the clinic queue: name, WhatsApp, level label, origin, campaign, and status. Does not include the numeric score or questionnaire answers.",
    inputSchema: {
      status: z.enum(["novo", "em_contato", "agendado", "sem_retorno"]).optional(),
      origin: z.enum(["site", "google", "meta", "totem", "direto"]).optional(),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      days: z.number().int().min(1).max(365).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ status, origin, level, days }) => {
    if (status !== undefined && !isLeadStatus(status)) {
      return { isError: true, content: [{ type: "text" as const, text: "Invalid status" }] };
    }
    if (origin !== undefined && !isOrigin(origin)) {
      return { isError: true, content: [{ type: "text" as const, text: "Invalid origin" }] };
    }
    if (level !== undefined && !isLevel(level)) {
      return { isError: true, content: [{ type: "text" as const, text: "Invalid level" }] };
    }
    return text(
      listLeads(db, {
        status: isLeadStatus(status) ? status : undefined,
        origin: isOrigin(origin) ? origin : undefined,
        level: isLevel(level) ? level : undefined,
        days,
      }, "recepcao"),
    );
  },
);

server.registerTool(
  "atualizar_status",
  {
    title: "Update lead status",
    description: "Move a lead to novo, em_contato, agendado, or sem_retorno.",
    inputSchema: {
      leadId: z.string().min(1),
      status: z.enum(["novo", "em_contato", "agendado", "sem_retorno"]),
    },
  },
  async ({ leadId, status }) => {
    try {
      const lead = updateLeadStatus(db, leadId, status, "recepcao");
      return text({ id: lead.id, status: lead.status, statusLabel: lead.statusLabel });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update the lead";
      return { isError: true, content: [{ type: "text" as const, text: message }] };
    }
  },
);

server.registerTool(
  "abrir_contato",
  {
    title: "Open contact",
    description:
      "Return the WhatsApp link and a scheduling message for one lead. The message invites an evaluation and does not include the score.",
    inputSchema: { leadId: z.string().min(1) },
    annotations: { readOnlyHint: true },
  },
  async ({ leadId }) => {
    const contact = openContact(db, leadId);
    if (!contact) {
      return { isError: true, content: [{ type: "text" as const, text: "Lead não encontrado." }] };
    }
    return text(contact);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

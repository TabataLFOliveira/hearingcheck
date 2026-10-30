import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { AnswerValue } from "../shared/types.js";
import { createLead, createSession, finishSession, openDatabase, saveAnswer } from "./db.js";

test("MCP tools read and update the same lead database", async () => {
  const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "hearingcheck-")), "test.sqlite");
  const db = openDatabase(dbPath, { seedDemo: false });
  const sessionId = createSession(db, { utmSource: "meta", utmCampaign: "reels-familia" });
  const answers = ["sim", "sim", "sim", "sim", "sim", "sim", "sim", "nao", "nao", "nao"] as AnswerValue[];
  answers.forEach((value, index) => saveAnswer(db, sessionId, index + 1, value));
  finishSession(db, sessionId);
  const lead = createLead(db, sessionId, "Paulo Demo", "11900000004");
  db.close();

  const transport = new StdioClientTransport({
    command: path.join(process.cwd(), "node_modules", ".bin", "tsx"),
    args: ["src/server/mcp.ts"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      HEARINGCHECK_DB: dbPath,
      HEARINGCHECK_SEED: "0",
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "hearingcheck-test", version: "0.0.0" });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ["abrir_contato", "atualizar_status", "listar_leads", "resumo_leads"]);

    const summary = await client.callTool({ name: "resumo_leads", arguments: { days: 30 } });
    const summaryText = textOf(summary);
    assert.match(summaryText, /"leads": 1/);
    assert.equal(summaryText.includes("Paulo"), false);

    const list = await client.callTool({ name: "listar_leads", arguments: { origin: "meta" } });
    const leads = JSON.parse(textOf(list)) as Array<Record<string, unknown>>;
    assert.equal(leads.length, 1);
    assert.equal(leads[0].name, "Paulo Demo");
    assert.equal("score" in leads[0], false);
    assert.equal("answers" in leads[0], false);

    const contact = await client.callTool({ name: "abrir_contato", arguments: { leadId: lead.id } });
    const opened = JSON.parse(textOf(contact)) as { waUrl: string; message: string; score?: number };
    assert.match(opened.waUrl, /^https:\/\/wa\.me\/5511900000004/);
    assert.match(opened.message, /não é um diagnóstico/);
    assert.equal("score" in opened, false);
    assert.equal(opened.message.includes("28"), false);

    const updated = await client.callTool({
      name: "atualizar_status",
      arguments: { leadId: lead.id, status: "agendado" },
    });
    assert.match(textOf(updated), /agendado/);
  } finally {
    await client.close();
  }

  const check = openDatabase(dbPath, { seedDemo: false });
  const row = check.prepare("SELECT status FROM leads WHERE id = ?").get(lead.id) as { status: string };
  assert.equal(row.status, "agendado");
  check.close();
});

function textOf(result: unknown): string {
  assert.ok(result && typeof result === "object" && "content" in result);
  const content = (result as { content: unknown }).content;
  assert.ok(Array.isArray(content));
  const block = content.find((item) => item && typeof item === "object" && "type" in item && item.type === "text") as
    | { text?: string }
    | undefined;
  assert.ok(block?.text);
  return block.text;
}

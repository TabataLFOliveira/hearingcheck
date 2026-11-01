import path from "node:path";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";

const dbPath = process.env.HEARINGCHECK_DB ?? path.join(process.cwd(), "data", "hearingcheck.sqlite");
const db = openDatabase(dbPath, { seedDemo: process.env.HEARINGCHECK_SEED !== "0" });
const app = createApp(db);
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

app.listen(port, host, () => {
  console.log(`HearingCheck em http://${host}:${port}`);
});

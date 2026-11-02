#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawnSync, execFileSync } from "node:child_process";
import { z } from "zod";

const server = new McpServer({ name: "bootcamp-mcp", version: "1.0.0" });

const text = (t, isError = false) => ({
  content: [{ type: "text", text: t }],
  ...(isError ? { isError: true } : {}),
});

server.tool(
  "get_docker_logs",
  "Read logs from a Docker container (e.g. auth-service). Optional case-insensitive text filter.",
  {
    container: z.string().default("auth-service"),
    tail: z.number().int().positive().default(100),
    filter: z.string().optional(),
  },
  async ({ container, tail, filter }) => {
    if (!/^[a-zA-Z0-9_.-]+$/.test(container)) return text("Invalid container name", true);
    const r = spawnSync("docker", ["logs", "--tail", String(tail), container], { encoding: "utf-8" });
    if (r.error) return text(`docker error: ${r.error.message}`, true);
    let out = `${r.stdout || ""}${r.stderr || ""}`;
    if (filter) {
      const f = filter.toLowerCase();
      out = out.split("\n").filter((l) => l.toLowerCase().includes(f)).join("\n");
    }
    return text(out.trim() || "(no matching log lines)");
  }
);

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|PRAGMA|ATTACH|DETACH|VACUUM)\b/i;

server.tool(
  "query_database",
  "Run a read-only SELECT against the SQLite database inside the auth-service container.",
  { sql: z.string() },
  async ({ sql }) => {
    const q = sql.trim().replace(/;+\s*$/, "");
    if (!/^SELECT\b/i.test(q)) return text("Rejected: only SELECT queries are allowed (read-only).", true);
    if (q.includes(";")) return text("Rejected: multiple statements are not allowed.", true);
    if (FORBIDDEN.test(q)) return text("Rejected: query contains a forbidden keyword (read-only).", true);
    const code =
      "const s=require('sqlite3');" +
      "const db=new s.Database('/app/database.sqlite',s.OPEN_READONLY);" +
      "db.all(process.argv[1],(e,r)=>{if(e){console.error(e.message);process.exit(1)}" +
      "console.log(JSON.stringify(r));db.close()})";
    try {
      const out = execFileSync("docker", ["exec", "auth-service", "node", "-e", code, q], { encoding: "utf-8" });
      return text(out.trim());
    } catch (e) {
      return text(`Database error: ${e.stderr || e.message}`, true);
    }
  }
);

server.tool(
  "get_app_log",
  "Read JSON logs from /app/logs/app.log inside the auth-service container. Optional case-insensitive text filter.",
  {
    tail: z.number().int().positive().default(100),
    filter: z.string().optional(),
  },
  async ({ tail, filter }) => {
    try {
      const r = spawnSync("docker", ["exec", "auth-service", "tail", "-n", String(tail), "/app/logs/app.log"], { encoding: "utf-8" });
      if (r.error) return text(`docker error: ${r.error.message}`, true);
      let out = `${r.stdout || ""}${r.stderr || ""}`;
      if (filter) {
        const f = filter.toLowerCase();
        out = out.split("\n").filter((l) => l.toLowerCase().includes(f)).join("\n");
      }
      return text(out.trim() || "(no matching log lines)");
    } catch (e) {
      return text(`Error reading app log: ${e.message}`, true);
    }
  }
);

await server.connect(new StdioServerTransport());

#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// MCP server for Dough (https://github.com/rollecode/dough). A thin, read-only client of Dough's
// key-authenticated /api/v1 API: it holds no database access and no logic of its own, it just maps
// each endpoint to an MCP tool so an assistant can read the household's finances.
//
// Configure via environment:
//   DOUGH_API_URL  base URL of the Dough instance, e.g. https://dough.example.com
//   DOUGH_API_KEY  an API key minted with scripts/create-api-key.ts in the Dough repo

const API_URL = (process.env.DOUGH_API_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.DOUGH_API_KEY || "";

if (!API_URL || !API_KEY) {
  console.error("dough-mcp: DOUGH_API_URL and DOUGH_API_KEY environment variables are required");
  process.exit(1);
}

// Call a v1 endpoint and return its raw JSON text. Throws with a trimmed body on any non-2xx so the
// tool wrapper can surface it as an MCP error.
async function doughGet(path: string, params: Record<string, string | number | undefined> = {}): Promise<string> {
  const url = new URL(`${API_URL}/api/v1/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Dough API returned ${res.status} for /api/v1/${path}: ${body.slice(0, 300)}`);
  }
  return body;
}

// Await a doughGet and wrap the JSON (or the error) as an MCP tool result.
async function reply(p: Promise<string>) {
  try {
    return { content: [{ type: "text" as const, text: await p }] };
  } catch (e) {
    return {
      content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
      isError: true,
    };
  }
}

const server = new McpServer({ name: "dough-mcp", version: "0.1.0" });

const MONTH = z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Month as YYYY-MM; defaults to the current month");

server.registerTool(
  "dough_summary",
  {
    description: "Compact financial snapshot: total balance and this month's income, spending, budgeted and Ready to Assign.",
    inputSchema: { month: MONTH },
  },
  ({ month }) => reply(doughGet("summary", { month }))
);

server.registerTool(
  "dough_accounts",
  {
    description: "All accounts with balances. Set include_closed to also return closed accounts.",
    inputSchema: { include_closed: z.boolean().optional().describe("Include closed accounts (default false)") },
  },
  ({ include_closed }) => reply(doughGet("accounts", { include_closed: include_closed ? 1 : undefined }))
);

server.registerTool(
  "dough_transactions",
  {
    description: "Transactions newest first, with optional filters.",
    inputSchema: {
      month: MONTH,
      account_id: z.string().optional().describe("Only this account's transactions"),
      category: z.string().optional().describe("Only this category name"),
      q: z.string().optional().describe("Search payee and memo"),
      limit: z.number().int().min(1).max(500).optional().describe("Max rows, 1-500 (default 50)"),
    },
  },
  ({ month, account_id, category, q, limit }) => reply(doughGet("transactions", { month, account_id, category, q, limit }))
);

server.registerTool(
  "dough_budget",
  {
    description: "The month's budget: income, total budgeted, Ready to Assign, age of money and every active category's budgeted / activity / available.",
    inputSchema: { month: MONTH },
  },
  ({ month }) => reply(doughGet("budget", { month }))
);

server.registerTool(
  "dough_net_worth",
  { description: "Current net worth by kind (checking, savings, investments, debts) plus the snapshot history.", inputSchema: {} },
  () => reply(doughGet("net-worth"))
);

server.registerTool(
  "dough_bills",
  { description: "Recurring bills with amount and due day of month.", inputSchema: {} },
  () => reply(doughGet("bills"))
);

server.registerTool(
  "dough_subscriptions",
  { description: "Subscriptions with amount and due day of month.", inputSchema: {} },
  () => reply(doughGet("subscriptions"))
);

server.registerTool(
  "dough_savings_goals",
  {
    description: "Active savings goals with target and derived saved amount.",
    inputSchema: { month: MONTH },
  },
  ({ month }) => reply(doughGet("savings-goals", { month }))
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("dough-mcp: connected via stdio, serving", API_URL);

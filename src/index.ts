#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// MCP server for Dough (https://github.com/rollecode/dough). A thin client of Dough's
// key-authenticated /api/v1 API: it holds no database access and no logic of its own, it just maps
// each endpoint to an MCP tool so an assistant can read (and, with a write-scoped key, edit) the
// household's finances. Dough is a standalone self-hosted budget app with its own ledger; it is
// NOT a YNAB frontend, so Dough data is fixed through these tools, not in YNAB.
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

// Call a v1 endpoint with a JSON body (POST) and return its raw JSON text. Throws on non-2xx.
async function doughPost(path: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Dough API returned ${res.status} for POST /api/v1/${path}: ${text.slice(0, 300)}`);
  }
  return text;
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

const server = new McpServer({ name: "dough-mcp", version: "0.4.1" });

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
    description: "Transactions newest first, with optional filters. Each row carries an `excluded` flag (true when it is hidden from spending reports via budget_excluded).",
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

server.registerTool(
  "dough_auto_assign_preview",
  {
    description: "Preview auto-assign for a month without writing. Without mode: the total each mode (underfunded, last_assigned, last_spent) would assign. With mode: the full per-category plan. Read-only.",
    inputSchema: {
      month: MONTH,
      mode: z.enum(["underfunded", "last_assigned", "last_spent"]).optional().describe("Show the full plan for this mode"),
    },
  },
  ({ month, mode }) => reply(doughGet("budget/auto-assign", { month, mode }))
);

server.registerTool(
  "dough_auto_assign_apply",
  {
    description: "Apply auto-assign for a month (writes budget). Funds category targets from Ready to Assign, capped so it never overbudgets. Modes: underfunded (fund manual targets), last_assigned (mirror last month's assignments), last_spent (match last month's spending). Requires a write-scoped key.",
    inputSchema: {
      month: MONTH,
      mode: z.enum(["underfunded", "last_assigned", "last_spent"]).describe("Assignment strategy"),
    },
  },
  ({ month, mode }) => reply(doughPost("budget/auto-assign", { month, mode }))
);

server.registerTool(
  "dough_budget_assign",
  {
    description: "Set one category's budgeted amount for a month (writes budget). Identify the category by category_id or category_name. Requires a write-scoped key.",
    inputSchema: {
      month: MONTH,
      category_id: z.number().int().optional().describe("Category id (from dough_budget)"),
      category_name: z.string().optional().describe("Category name, if id is unknown"),
      budgeted: z.number().describe("The amount to set as budgeted this month"),
    },
  },
  ({ month, category_id, category_name, budgeted }) =>
    reply(doughPost("budget/assign", { month, category_id, category_name, budgeted }))
);

server.registerTool(
  "dough_create_transaction",
  {
    description: "Add a NEW transaction to Dough's own ledger and apply its balance effect. Use for rows Synci has not imported yet - most importantly pending card holds (varaukset): add each hold as an outflow so Dough matches the bank's available balance to the cent. amount is the absolute value; inflow defaults to false (money out). category is a category name (from dough_budget); leave blank to keep it uncategorized. Set cleared to 'uncleared' to mark a pending hold, or leave it 'cleared'. For a transfer, set category to 'Internal transfer' and transfer_account_id to the counterpart account. Set budget_excluded to true to hide the row from spending reports (cash flow, trends, burn rate, today's spent, month expenses) so a one-off does not skew the stats. It does NOT change the budget's accounting: the category it is filed under still absorbs the cost and Ready to Assign is untouched, so the budget keeps reconciling with the accounts. Dough is a standalone budget app (not a YNAB frontend); its data is fixed here, never in YNAB. Requires a write-scoped key.",
    inputSchema: {
      account_id: z.string().describe("Account the transaction posts to (from dough_accounts)"),
      amount: z.number().positive().describe("Absolute amount; sign comes from inflow"),
      inflow: z.boolean().optional().describe("true = money in (stored positive), false/omitted = money out"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Date as YYYY-MM-DD; defaults to today"),
      payee_name: z.string().optional().describe("Payee, e.g. 'Grocery store', 'Coffee shop'"),
      memo: z.string().optional().describe("Description, e.g. 'Pending hold (varaus)'"),
      category: z.string().optional().describe("Category name from dough_budget, or 'Internal transfer' for a transfer leg"),
      cleared: z.string().optional().describe("Ledger state; 'cleared' (default) or 'uncleared' for a pending hold"),
      transfer_account_id: z.string().optional().describe("Counterpart account id when category is 'Internal transfer'"),
      budget_excluded: z.boolean().optional().describe("true = hide from spending reports; category and balance still account for it"),
    },
  },
  (args) => reply(doughPost("transactions/create", args))
);

server.registerTool(
  "dough_update_transaction",
  {
    description: "Edit one transaction in Dough's own ledger by the id dough_transactions returns. Only the fields you pass change. To fix a misrouted internal transfer, set category to 'Internal transfer' and transfer_account_id to the correct counterpart account: Dough relabels the payee and maintains the opposite leg. Set budget_excluded to true to hide the row from spending reports (cash flow, trends, burn rate, today's spent, month expenses), or false to show it again. It does NOT change the budget's accounting: the category still absorbs the cost and Ready to Assign is untouched. Dough is a standalone budget app (not a YNAB frontend), so its data is fixed here, never in YNAB. Requires a write-scoped key.",
    inputSchema: {
      transaction_id: z.string().describe("Transaction id from dough_transactions"),
      amount: z.number().positive().optional().describe("Absolute amount; sign comes from inflow"),
      inflow: z.boolean().optional().describe("true = money in (stored positive), false = money out"),
      payee_name: z.string().optional().describe("New payee"),
      memo: z.string().optional().describe("New description"),
      account_id: z.string().optional().describe("Move the transaction to this account (from dough_accounts)"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("New date as YYYY-MM-DD"),
      category: z.string().optional().describe("New category name, or 'Internal transfer' for a transfer leg"),
      transfer_account_id: z.string().optional().describe("Counterpart account id when category is 'Internal transfer'"),
      budget_excluded: z.boolean().optional().describe("true = hide from spending reports, false = show again; category and balance unaffected either way"),
    },
  },
  (args) => reply(doughPost("transactions/update", args))
);

server.registerTool(
  "dough_delete_transaction",
  {
    description: "Delete one transaction from Dough's ledger by id (split siblings go with it) and reverse its balance effect. Requires a write-scoped key.",
    inputSchema: {
      transaction_id: z.string().describe("Transaction id from dough_transactions"),
    },
  },
  ({ transaction_id }) => reply(doughPost("transactions/delete", { transaction_id }))
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("dough-mcp: connected via stdio, serving", API_URL);

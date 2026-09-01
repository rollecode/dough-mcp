<center align="center" style="text-align: center;justify-content:center;">
<div align="center" style="text-align: center;justify-content:center;">
<h1 align="center" style="text-align: center;justify-content:center;">

Dough MCP server

<img style="justify-content:center;text-align: center;width: 95px; height: auto;" width="793" height="411" alt="Claude Code" src="https://github.com/user-attachments/assets/abed1a04-d69b-4ab4-a490-d606064df72d" />
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/dough-logo-dark.png" />
  <img style="justify-content:center;text-align: center;width: 190px; height: auto;" alt="Dough" src="assets/dough-logo-light.png" />
</picture>
</h1>

![Version](https://img.shields.io/badge/version-1.3.0-6366f1.svg?style=for-the-badge) ![Node](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![OAuth](https://img.shields.io/badge/OAuth_2.1-EB5424?style=for-the-badge&logo=auth0&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-000000?style=for-the-badge)

</div>
</center>

<hr>

Read and write your [Dough](https://github.com/rollecode/dough) finances from Claude.ai and Claude Code. Covers every part of Dough: accounts, transactions, budget, bills, subscriptions, savings goals, debts, investments and income, all read and write. It runs over stdio for Claude Code, or behind an OAuth 2.1 login so it can be added to Claude.ai as a custom connector.

Dough is a standalone self-hosted budget app with its own ledger (bank-synced or manual). It is not a YNAB frontend: Dough's data is corrected through these tools or Dough's own UI, never in YNAB.

<hr>

## How it fits together

```
dough (web app)  ──  /api/v1/*  (API-key auth)
                          ▲  HTTPS + Bearer key
dough-mcp  ──  stdio (Claude Code)  ──or──  HTTP + OAuth 2.1 (Claude.ai connector)
```

The server never sees your database. It calls the Dough HTTP API with an API key you supply through the environment, so the key stays on your machine and nothing about your ledger is exposed on the internet.

## Tools

43 tools across every part of Dough. Read tools work with any key; write tools need a key minted with `--scopes write` and return 403 otherwise.

**Read** — `dough_summary`, `dough_accounts`, `dough_transactions`, `dough_budget`, `dough_net_worth`, `dough_bills`, `dough_subscriptions`, `dough_savings_goals`, `dough_debts`, `dough_investments`, `dough_income`

**Transactions** — create, update and delete, including pending card holds and per-transaction budget exclusion

**Budget** — auto-assign preview and apply, assign a category, move money, snooze / unsnooze, set targets

**Manage** — create / update / delete for bills, subscriptions, savings goals, accounts, categories and income, plus update and reorder for debts and investments

## Add to Claude.ai

Settings, Connectors, Add custom connector, and paste the MCP URL of your deployment, for example:

```
https://dough-mcp.example.com/mcp
```

Leave client ID and secret blank. The OAuth 2.1 login in front (`auth-server.cjs`) handles registration and sign-in, and issues the token.

## Claude Code

Over HTTP, with the fixed token the login also accepts:

```bash
claude mcp add --transport http dough https://dough-mcp.example.com/mcp \
  --header "Authorization: Bearer $(cat ~/.config/dough-mcp/token)" --scope user
```

Or over stdio, with `DOUGH_API_URL` and `DOUGH_API_KEY` set in the environment.

## Install

```bash
git clone git@github.com:rollecode/dough-mcp.git
cd dough-mcp
npm install && npm run build   # dist/ is committed; rebuild only when changing src/
```

Configure via environment:

- `DOUGH_API_URL` — base URL of the Dough instance, e.g. `https://dough.example.com`
- `DOUGH_API_KEY` — an API key minted in the Dough repo (see below)

## Get an API key

In the Dough repo, on the host that owns the database:

```bash
npx tsx scripts/create-api-key.ts --name "dough-mcp" --scopes write
```

The key is printed once. Use `--scopes read` for a query-only key. See Dough's `docs/public-api.md` for details.

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

![Version](https://img.shields.io/badge/version-2.0.0-6366f1.svg?style=for-the-badge) ![Node](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![OAuth](https://img.shields.io/badge/OAuth_2.1-EB5424?style=for-the-badge&logo=auth0&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-000000?style=for-the-badge)

</div>
</center>

<hr>

Read and write your [Dough](https://github.com/rollecode/dough) finances from Claude.ai and Claude Code. It offers every tool the Dough instance it points at has, because it takes them from that instance. It runs over stdio for Claude Code, or behind an OAuth 2.1 login so it can be added to Claude.ai as a custom connector.

Since Dough 4.4.0 every instance is an MCP server itself at `/mcp`, and a client that can connect to a remote MCP server with OAuth can use that directly. dough-mcp is for the rest: a local process over stdio, or a separately hosted endpoint.

Dough is a standalone self-hosted budget app with its own ledger (bank-synced or manual). It is not a YNAB frontend: Dough's data is corrected through these tools or Dough's own UI, never in YNAB.

<hr>

## How it fits together

```
dough (web app)  ──  /mcp  (the instance's own tools, API-key auth)
                       ▲  HTTPS + Bearer key
dough-mcp  ──  stdio (Claude Code)  ──or──  HTTP + OAuth 2.1 (Claude.ai connector)
```

The server never sees your database. It passes each tool call to the instance's `/mcp` with an API key you supply through the environment, so the key stays on your machine and nothing about your ledger is exposed on the internet. Needs Dough 4.4.0 or later.

## Tools

Whatever the instance offers, which is one tool for every part of its API: accounts, transactions and splits, budget and targets, categories, bills, subscriptions, income, savings goals, debts, investments, payees, budget links, settings, Dougie and more. An instance that gains a tool gains it here without a new dough-mcp. Read tools work with any key; write tools need a key minted with `--scopes write` and return 403 otherwise.

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

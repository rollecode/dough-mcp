# dough-mcp

An MCP (Model Context Protocol) server for [Dough](https://github.com/rollecode/dough), the personal
finance app. It is a thin client of Dough's `/api/v1` API: it holds no database access and no logic
of its own, it just exposes each endpoint as an MCP tool so an assistant (Claude Code, Claude
Desktop) can read your finances and, with a write-scoped key, do the budgeting and fix transactions.

Dough is a standalone self-hosted budget app with its own ledger (bank-synced or manual). It is not
a YNAB frontend: Dough's data is corrected through these tools or Dough's own UI, never in YNAB.

## How it fits together

```
dough (web app)  ──  /api/v1/*  (API-key auth)
                          ▲  HTTPS + Bearer key
dough-mcp (this repo)  ── stdio ──  Claude Code / Claude Desktop
```

The server never sees your database. It calls the Dough HTTP API with an API key you supply through
the environment, so the key stays on your machine and nothing is exposed on the internet.

## Tools

- `dough_summary` - total balance and this month's income, spending, budgeted and Ready to Assign
- `dough_accounts` - all accounts with balances
- `dough_transactions` - transactions newest first, with month / account / category / search filters
- `dough_budget` - the month's budget, Ready to Assign, age of money and per-category available
- `dough_net_worth` - current net worth by kind plus snapshot history
- `dough_bills` - recurring bills
- `dough_subscriptions` - subscriptions
- `dough_savings_goals` - active goals with target and derived saved amount

Write tools (require a key minted with `--scopes read,write`):

- `dough_auto_assign_preview` - preview target funding for a month (read-only)
- `dough_auto_assign_apply` - apply auto-assign for a month (underfunded / last_assigned / last_spent)
- `dough_budget_assign` - set one category's budgeted amount for a month
- `dough_update_transaction` - edit one transaction (partial: only passed fields change); setting category `Internal transfer` with a counterpart account fixes a misrouted transfer and maintains the opposite leg
- `dough_delete_transaction` - delete one transaction and reverse its balance effect

The read tools work with any key. The write tools return 403 unless the configured `DOUGH_API_KEY`
has the `write` scope, so a read-only key is safe to leave configured for query-only use.

## Install

```bash
git clone git@github.com:rollecode/dough-mcp.git
cd dough-mcp
npm install && npm run build   # dist/ is committed; rebuild only when changing src/
```

## Get an API key

In the Dough repo, on the host that owns the database:

```bash
npx tsx scripts/create-api-key.ts --name "dough-mcp" --scopes read
```

The key is printed once. See Dough's `docs/public-api.md` for details.

## Configuration

The server reads two environment variables:

- `DOUGH_API_URL` - base URL of your Dough instance, e.g. `https://dough.example.com`
- `DOUGH_API_KEY` - the API key you minted

### Claude Code

```bash
claude mcp add dough \
  --env DOUGH_API_URL=https://dough.example.com \
  --env DOUGH_API_KEY=dough_your_key_here \
  -- node /absolute/path/to/dough-mcp/dist/index.js
```

Or add it to a project `.mcp.json` / your user settings:

```json
{
  "mcpServers": {
    "dough": {
      "command": "node",
      "args": ["/absolute/path/to/dough-mcp/dist/index.js"],
      "env": {
        "DOUGH_API_URL": "https://dough.example.com",
        "DOUGH_API_KEY": "dough_your_key_here"
      }
    }
  }
}
```

### Claude Desktop

Add the same block to `mcpServers` in `claude_desktop_config.json`, then restart Claude Desktop.

## Development

```bash
npm run build      # compile TypeScript to dist/
npm start          # run the server (expects the two env vars)
```

## Security

- The key grants read access to your financial data. Keep it in the client config's `env`, never in
  source or a committed file.
- Revoke a key from the Dough host: `sqlite3 data/dough.db "UPDATE api_keys SET revoked_at = datetime('now') WHERE name = 'dough-mcp';"`

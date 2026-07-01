# dough-mcp

An MCP (Model Context Protocol) server for [Dough](https://github.com/rollecode/dough), the personal
finance app. It is a thin, read-only client of Dough's `/api/v1` API: it holds no database access and
no logic of its own, it just exposes each endpoint as an MCP tool so an assistant (Claude Code,
Claude Desktop) can read your finances.

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

All tools are read-only.

## Install

```bash
git clone git@github.com:rollecode/dough-mcp.git
cd dough-mcp
npm install   # builds dist/ via the prepare script
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

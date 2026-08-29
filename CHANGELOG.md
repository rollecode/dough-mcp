# Changelog

### 1.3.0: 2026-08-29

* Add a remote HTTP transport (`--transport http`) so Dough can be added to claude.ai on web, desktop and mobile as a custom connector, not just used over stdio in Claude Code
* Ship the OAuth 2.1 login layer (`auth-server.cjs`) with dynamic client registration, PKCE and a branded Dough sign-in page, plus the nginx/systemd/tunnel config, matching the other remote MCPs
* stdio stays the default; the same 42 tools are served either way

### 1.2.0: 2026-08-24

* `dough_update_category` takes `budget_excluded`: leave a whole category's transactions out of the spending reports, for money that belongs to someone else but runs through the household accounts. Requires Dough 3.19.0+
* `dough_budget` reports `budget_excluded` per category and `dough_accounts` reports it per account, so an excluded account is no longer indistinguishable from an included one
* `dough_summary` describes that its month figures follow the month asked for

### 1.1.0: 2026-08-20

* Add income tools: `dough_income` (list income sources with this month's received/upcoming status, so future income is listable) plus `dough_create_income`/`dough_update_income`/`dough_delete_income`. Requires Dough 3.18.0+

### 1.0.0: 2026-08-19

* Full write coverage: the MCP can now create, edit and delete every entity Dough has, not just transactions and budget assignments. New tools for bills, subscriptions, savings goals, accounts, categories (and their targets), debts/loans and investments, plus move-money and snooze/unsnooze for the budget
* Add `dough_debts` and `dough_investments` read tools (accounts joined with their overrides) so you can see current terms/values before editing
* Requires Dough 3.17.0+ (the matching `/api/v1` write endpoints)

### 0.4.1: 2026-07-11

* Correct what `budget_excluded` promises: it hides a transaction from spending reports, it does not remove it from the budget's accounting. The category still absorbs the cost and Ready to Assign is untouched (dough 3.15.2)

### 0.4.0: 2026-07-11

* Add `budget_excluded` to `dough_create_transaction` and `dough_update_transaction`: set it true to keep a transaction out of every budget figure (daily budget, categories, cash flow, income, Ready to Assign) while it still moves the account balance, or false to include it again. Needs Dough 3.15.0+
* `dough_transactions` rows now carry an `excluded` flag

### 0.3.0: 2026-07-07

* Add `dough_create_transaction` tool: add a new transaction to Dough's ledger, most importantly a pending card hold (varaus), so an assistant can make Dough match the bank's available balance to the cent. Wraps `POST /api/v1/transactions/create`; needs a write-scoped key and Dough 3.13.0+

### 0.2.0: 2026-07-06

* Add `dough_update_transaction` and `dough_delete_transaction` write tools, and state that Dough is a standalone budget app, not a YNAB frontend
* Add budgeting write tools: auto-assign preview/apply and category assign
* Commit `dist` and drop the prepare script so npm can install straight from the git URL

### 0.1.0: 2026-07-06

* Read-only MCP server over the Dough v1 API (summary, accounts, transactions, budget, net worth, bills, subscriptions, savings goals)

# Changelog

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

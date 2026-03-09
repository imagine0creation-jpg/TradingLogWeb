# All-around Trading Log Website

This starter includes:

- `database/schema.sql`: PostgreSQL schema for users, accounts, trades, diary, cashflow, goals, and reporting views.
- `backend/`: Node.js (Express) API with real-time price updates via Server-Sent Events.
- `frontend/`: React + Tailwind app with `RiskCalculatorEntryForm` component.

## Database schema outline

1. `users`, `accounts`: trader identity + trading accounts.
2. `instruments`: symbol metadata (tick size, contract size, asset class).
3. `trades`: entry/exit, SL/TP, risk config, fees, realized R, auto day-of-week.
4. `trade_diaries`: per-trade emotion tags and mental notes.
5. `account_transactions`: deposits/withdrawals/fee adjustments.
6. `trading_goals`, `goal_progress_snapshots`: goal definition + progression history.
7. `price_ticks`: optional historical tick capture.
8. `v_trade_stats_daily`, `v_trade_stats_weekly`, `v_trade_stats_monthly`: win rate, net P/L, average RR by period.

## Quick run

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Optional frontend env:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

# All-around Trading Log Website

This starter includes:

- `database/schema.sql`: PostgreSQL schema for users, accounts, trades, diary, cashflow, goals, and reporting views.
- `backend/`: Node.js (Express) API with real-time price updates via Server-Sent Events.
- `frontend/`: React + Tailwind app with `RiskCalculatorEntryForm` component.
- `.github/workflows/deploy-frontend.yml`: auto-deploy frontend to GitHub Pages on push to `main`.
- `render.yaml`: Render Blueprint for deploying the backend web service.

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

## GitHub Pages (live frontend)

After the GitHub Actions workflow succeeds, your frontend is available at:

`https://imagine0creation-jpg.github.io/TradingLogWeb/`

If your backend is hosted elsewhere, set repository variable:

- `Settings -> Secrets and variables -> Actions -> Variables`
- Name: `VITE_API_BASE_URL`
- Value: your backend base URL (for example `https://your-backend.onrender.com`)

## Render backend deployment

Backend blueprint config lives in `render.yaml`.

1. In Render, choose `New +` -> `Blueprint`.
2. Connect the GitHub repo `imagine0creation-jpg/TradingLogWeb`.
3. Render will detect `render.yaml` and create `tradinglogweb-backend`.
4. After deploy, copy the service URL, for example `https://tradinglogweb-backend.onrender.com`.
5. In GitHub repo `Settings -> Secrets and variables -> Actions -> Variables`, set:
   - `VITE_API_BASE_URL=https://tradinglogweb-backend.onrender.com`
6. Re-run the GitHub Pages workflow so the frontend points to the live backend.

The backend currently allows requests from `https://imagine0creation-jpg.github.io` via `ALLOWED_ORIGINS`.

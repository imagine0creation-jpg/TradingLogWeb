-- PostgreSQL schema for an all-around trading log platform
-- Focus: risk planning, trade journaling, cashflow tracking, and performance reporting

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  base_currency CHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('FOREX', 'STOCK', 'CRYPTO', 'FUTURES', 'CFD', 'OTHER')),
  tick_size NUMERIC(18, 8) NOT NULL,
  contract_size NUMERIC(18, 8) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  entry_price NUMERIC(18, 8) NOT NULL,
  stop_loss NUMERIC(18, 8) NOT NULL,
  take_profit NUMERIC(18, 8),
  exit_price NUMERIC(18, 8),
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  entry_day_of_week SMALLINT GENERATED ALWAYS AS (EXTRACT(DOW FROM entry_time)) STORED,
  risk_percent NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
  risk_amount NUMERIC(18, 2) NOT NULL,
  planned_position_size NUMERIC(18, 4) NOT NULL,
  executed_position_size NUMERIC(18, 4) NOT NULL,
  fees NUMERIC(18, 2) NOT NULL DEFAULT 0,
  gross_pnl NUMERIC(18, 2),
  net_pnl NUMERIC(18, 2),
  rr_planned NUMERIC(10, 4),
  rr_realized NUMERIC(10, 4),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_exit_for_closed_trade
    CHECK (
      (status = 'CLOSED' AND exit_price IS NOT NULL AND exit_time IS NOT NULL)
      OR
      (status <> 'CLOSED')
    )
);

CREATE INDEX idx_trades_account_entry_time ON trades(account_id, entry_time DESC);
CREATE INDEX idx_trades_status ON trades(status);

CREATE TABLE trade_diaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID UNIQUE NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  emotion_tags TEXT[] NOT NULL DEFAULT '{}',
  mindset_label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('DEPOSIT', 'WITHDRAWAL', 'FEE_ADJUSTMENT')),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  tx_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_account_transactions_account_time ON account_transactions(account_id, tx_time DESC);

CREATE TABLE trading_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('EQUITY_TARGET', 'MONTHLY_NET_PNL', 'MAX_DRAWDOWN_LIMIT')),
  target_value NUMERIC(18, 2) NOT NULL,
  start_date DATE NOT NULL,
  target_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goal_progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES trading_goals(id) ON DELETE CASCADE,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_value NUMERIC(18, 2) NOT NULL,
  progress_percent NUMERIC(6, 2) NOT NULL
);

CREATE INDEX idx_goal_progress_goal_time ON goal_progress_snapshots(goal_id, snapshot_time DESC);

CREATE TABLE price_ticks (
  id BIGSERIAL PRIMARY KEY,
  instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'demo-feed',
  price NUMERIC(18, 8) NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_ticks_instrument_time ON price_ticks(instrument_id, event_time DESC);

-- Reporting views for dashboard cards/charts
CREATE VIEW v_trade_stats_daily AS
SELECT
  account_id,
  DATE_TRUNC('day', entry_time) AS period_start,
  COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_trades,
  COUNT(*) FILTER (WHERE status = 'CLOSED' AND net_pnl > 0) AS wins,
  COALESCE(
    ROUND(
      (
        COUNT(*) FILTER (WHERE status = 'CLOSED' AND net_pnl > 0)::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0)
      ) * 100,
      2
    ),
    0
  ) AS win_rate_pct,
  COALESCE(SUM(net_pnl) FILTER (WHERE status = 'CLOSED'), 0) AS net_pnl,
  COALESCE(AVG(rr_realized) FILTER (WHERE status = 'CLOSED'), 0) AS avg_rr
FROM trades
GROUP BY account_id, DATE_TRUNC('day', entry_time);

CREATE VIEW v_trade_stats_weekly AS
SELECT
  account_id,
  DATE_TRUNC('week', entry_time) AS period_start,
  COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_trades,
  COUNT(*) FILTER (WHERE status = 'CLOSED' AND net_pnl > 0) AS wins,
  COALESCE(
    ROUND(
      (
        COUNT(*) FILTER (WHERE status = 'CLOSED' AND net_pnl > 0)::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0)
      ) * 100,
      2
    ),
    0
  ) AS win_rate_pct,
  COALESCE(SUM(net_pnl) FILTER (WHERE status = 'CLOSED'), 0) AS net_pnl,
  COALESCE(AVG(rr_realized) FILTER (WHERE status = 'CLOSED'), 0) AS avg_rr
FROM trades
GROUP BY account_id, DATE_TRUNC('week', entry_time);

CREATE VIEW v_trade_stats_monthly AS
SELECT
  account_id,
  DATE_TRUNC('month', entry_time) AS period_start,
  COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_trades,
  COUNT(*) FILTER (WHERE status = 'CLOSED' AND net_pnl > 0) AS wins,
  COALESCE(
    ROUND(
      (
        COUNT(*) FILTER (WHERE status = 'CLOSED' AND net_pnl > 0)::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0)
      ) * 100,
      2
    ),
    0
  ) AS win_rate_pct,
  COALESCE(SUM(net_pnl) FILTER (WHERE status = 'CLOSED'), 0) AS net_pnl,
  COALESCE(AVG(rr_realized) FILTER (WHERE status = 'CLOSED'), 0) AS avg_rr
FROM trades
GROUP BY account_id, DATE_TRUNC('month', entry_time);

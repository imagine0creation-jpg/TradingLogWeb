import express from "express";
import cors from "cors";
import crypto from "node:crypto";

const app = express();
const port = process.env.PORT || 4000;

const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY || "";
const hasTwelveDataCredentials = Boolean(TWELVEDATA_API_KEY);
const TWELVEDATA_BASE_URL = "https://api.twelvedata.com";

const SYMBOL_MAP = {
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  BTCUSD: "BTC/USD"
};

const TIMEFRAME_MAP = {
  "1m": { interval: "1min", seconds: 60 },
  "5m": { interval: "5min", seconds: 300 },
  "15m": { interval: "15min", seconds: 900 },
  "30m": { interval: "30min", seconds: 1800 },
  "1h": { interval: "1h", seconds: 3600 },
  "4h": { interval: "4h", seconds: 14400 },
  "1d": { interval: "1day", seconds: 86400 },
  "1w": { interval: "1week", seconds: 604800 }
};

const DEMO_BASE = {
  EURUSD: 1.0894,
  GBPUSD: 1.2741,
  USDJPY: 149.28,
  BTCUSD: 63850.22
};

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed: ${origin}`));
  }
};

app.use(cors(corsOptions));
app.use(express.json());

const latestPrices = new Map(Object.entries(DEMO_BASE));
const subscribersBySymbol = new Map();

const ensureSymbol = (symbol) => symbol && Object.prototype.hasOwnProperty.call(SYMBOL_MAP, symbol);

const toTickPayload = (symbol, price, timestamp = new Date().toISOString()) => ({
  symbol,
  price: Number(price.toFixed(5)),
  timestamp
});

const notifySubscribers = (symbol, price, timestamp = new Date().toISOString()) => {
  const symbolSubscribers = subscribersBySymbol.get(symbol);
  if (!symbolSubscribers || symbolSubscribers.size === 0) {
    return;
  }

  const payload = toTickPayload(symbol, price, timestamp);
  for (const response of symbolSubscribers) {
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
};

const clampCount = (value, min = 10, max = 2000, fallback = 600) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(parsed, max));
};

const parseTimeToEpoch = (value) => {
  if (!value) {
    return NaN;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withUtc = Number(new Date(`${normalized}Z`));
  if (Number.isFinite(withUtc)) {
    return Math.floor(withUtc / 1000);
  }

  const local = Number(new Date(normalized));
  if (Number.isFinite(local)) {
    return Math.floor(local / 1000);
  }

  return NaN;
};

const twelveDataRequest = async (path, params = {}) => {
  const url = new URL(`${TWELVEDATA_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  url.searchParams.set("apikey", TWELVEDATA_API_KEY);

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TwelveData request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  if (payload.status === "error") {
    throw new Error(`TwelveData error: ${payload.message || "unknown error"}`);
  }

  return payload;
};

const generateDemoBars = (symbol, timeframe, count) => {
  const timeframeConfig = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP["1m"];
  const now = Math.floor(Date.now() / 1000);
  const bars = [];
  let price = latestPrices.get(symbol) ?? DEMO_BASE[symbol] ?? 1;
  let cursor = now - count * timeframeConfig.seconds;

  for (let i = 0; i < count; i += 1) {
    const open = price;
    const moveA = (Math.random() - 0.5) * 0.01;
    const moveB = (Math.random() - 0.5) * 0.01;
    const high = Math.max(open * (1 + moveA), open * (1 + moveB), open);
    const low = Math.min(open * (1 + moveA), open * (1 + moveB), open);
    const close = Math.max(low, Math.min(high, open * (1 + (Math.random() - 0.5) * 0.01)));

    bars.push({
      time: cursor,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5))
    });

    price = close;
    cursor += timeframeConfig.seconds;
  }

  latestPrices.set(symbol, price);
  return bars;
};

const fetchTwelveDataPrice = async (symbol) => {
  const providerSymbol = SYMBOL_MAP[symbol];
  const payload = await twelveDataRequest("/price", { symbol: providerSymbol });
  const nextPrice = Number(payload.price);
  if (!Number.isFinite(nextPrice)) {
    throw new Error(`Invalid price payload for ${symbol}`);
  }

  latestPrices.set(symbol, nextPrice);
  notifySubscribers(symbol, nextPrice);
  return nextPrice;
};

const refreshDemoPrices = () => {
  for (const [symbol, currentPrice] of latestPrices.entries()) {
    const randomMove = (Math.random() - 0.5) * 0.004;
    const updated = Math.max(currentPrice * (1 + randomMove), 0.00001);
    latestPrices.set(symbol, updated);
    notifySubscribers(symbol, updated);
  }
};

const refreshTwelveDataTrackedPrices = async () => {
  if (!hasTwelveDataCredentials) {
    return;
  }

  const activeSymbols = Array.from(subscribersBySymbol.entries())
    .filter(([, set]) => set.size > 0)
    .map(([symbol]) => symbol);

  for (const symbol of activeSymbols) {
    try {
      await fetchTwelveDataPrice(symbol);
    } catch (error) {
      console.error(`TwelveData price refresh failed for ${symbol}:`, error.message);
    }
  }
};

setInterval(() => {
  if (hasTwelveDataCredentials) {
    refreshTwelveDataTrackedPrices();
  } else {
    refreshDemoPrices();
  }
}, 10000);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "trading-log-backend",
    priceSource: hasTwelveDataCredentials ? "twelvedata" : "demo"
  });
});

app.get("/api/prices/latest", async (req, res) => {
  const symbol = (req.query.symbol || "EURUSD").toUpperCase();
  if (!ensureSymbol(symbol)) {
    return res.status(400).json({ error: `Unsupported symbol: ${symbol}` });
  }

  if (hasTwelveDataCredentials) {
    try {
      const price = await fetchTwelveDataPrice(symbol);
      return res.json({ ...toTickPayload(symbol, price), source: "twelvedata" });
    } catch (error) {
      console.error("Latest price fetch failed, using cached/demo value:", error.message);
    }
  }

  return res.json({
    ...toTickPayload(symbol, latestPrices.get(symbol) ?? DEMO_BASE[symbol] ?? 1),
    source: hasTwelveDataCredentials ? "twelvedata-fallback" : "demo"
  });
});

app.get("/api/prices/stream", async (req, res) => {
  const symbol = (req.query.symbol || "EURUSD").toUpperCase();
  if (!ensureSymbol(symbol)) {
    return res.status(400).json({ error: `Unsupported symbol: ${symbol}` });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  if (!subscribersBySymbol.has(symbol)) {
    subscribersBySymbol.set(symbol, new Set());
  }
  const symbolSubscribers = subscribersBySymbol.get(symbol);
  symbolSubscribers.add(res);

  if (hasTwelveDataCredentials) {
    try {
      await fetchTwelveDataPrice(symbol);
    } catch (error) {
      console.error("Initial stream price fetch failed:", error.message);
      res.write(
        `data: ${JSON.stringify(
          toTickPayload(symbol, latestPrices.get(symbol) ?? DEMO_BASE[symbol] ?? 1)
        )}\n\n`
      );
    }
  } else {
    res.write(
      `data: ${JSON.stringify(
        toTickPayload(symbol, latestPrices.get(symbol) ?? DEMO_BASE[symbol] ?? 1)
      )}\n\n`
    );
  }

  const keepAlive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    symbolSubscribers.delete(res);
  });
});

app.get("/api/history", async (req, res) => {
  const symbol = (req.query.symbol || "EURUSD").toUpperCase();
  const timeframe = (req.query.timeframe || "1m").toLowerCase();
  const count = clampCount(req.query.count, 10, 2000, 600);

  if (!ensureSymbol(symbol)) {
    return res.status(400).json({ error: `Unsupported symbol: ${symbol}` });
  }
  if (!TIMEFRAME_MAP[timeframe]) {
    return res.status(400).json({ error: `Unsupported timeframe: ${timeframe}` });
  }

  if (!hasTwelveDataCredentials) {
    const bars = generateDemoBars(symbol, timeframe, count);
    return res.json({ symbol, timeframe, source: "demo", bars });
  }

  try {
    const providerSymbol = SYMBOL_MAP[symbol];
    const interval = TIMEFRAME_MAP[timeframe].interval;
    const payload = await twelveDataRequest("/time_series", {
      symbol: providerSymbol,
      interval,
      outputsize: count
    });

    const bars = (payload.values || [])
      .map((bar) => {
        const epoch = parseTimeToEpoch(bar.datetime);
        return {
          time: epoch,
          open: Number(bar.open),
          high: Number(bar.high),
          low: Number(bar.low),
          close: Number(bar.close)
        };
      })
      .filter((bar) => Number.isFinite(bar.time))
      .sort((a, b) => a.time - b.time);

    if (bars.length > 0) {
      latestPrices.set(symbol, bars[bars.length - 1].close);
    }

    return res.json({ symbol, timeframe, source: "twelvedata", bars });
  } catch (error) {
    console.error("History fetch failed, falling back to demo:", error.message);
    const bars = generateDemoBars(symbol, timeframe, count);
    return res.json({ symbol, timeframe, source: "demo-fallback", bars });
  }
});

app.post("/api/trades", (req, res) => {
  const payload = req.body;
  const tradeId = crypto.randomUUID();

  return res.status(201).json({
    id: tradeId,
    status: "RECEIVED",
    trade: payload,
    createdAt: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
  console.log(`Price source mode: ${hasTwelveDataCredentials ? "TWELVEDATA" : "DEMO"}`);
});

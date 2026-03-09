import express from "express";
import cors from "cors";
import crypto from "node:crypto";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const SYMBOLS = {
  EURUSD: 1.0894,
  GBPUSD: 1.2741,
  USDJPY: 149.28,
  BTCUSD: 63850.22
};

const latestPrices = new Map(Object.entries(SYMBOLS));
const subscribersBySymbol = new Map();

const ensureSymbol = (symbol) => symbol && latestPrices.has(symbol.toUpperCase());

const toTickPayload = (symbol, price) => ({
  symbol,
  price: Number(price.toFixed(5)),
  timestamp: new Date().toISOString()
});

const nextPrice = (currentPrice) => {
  const randomMove = (Math.random() - 0.5) * 0.004;
  return Math.max(currentPrice * (1 + randomMove), 0.00001);
};

setInterval(() => {
  for (const [symbol, currentPrice] of latestPrices.entries()) {
    const updated = nextPrice(currentPrice);
    latestPrices.set(symbol, updated);

    const payload = toTickPayload(symbol, updated);
    const symbolSubscribers = subscribersBySymbol.get(symbol);
    if (!symbolSubscribers || symbolSubscribers.size === 0) {
      continue;
    }

    for (const response of symbolSubscribers) {
      response.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }
}, 1000);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "trading-log-backend" });
});

app.get("/api/prices/latest", (req, res) => {
  const symbol = (req.query.symbol || "EURUSD").toUpperCase();
  if (!ensureSymbol(symbol)) {
    return res.status(400).json({ error: `Unsupported symbol: ${symbol}` });
  }

  return res.json(toTickPayload(symbol, latestPrices.get(symbol)));
});

app.get("/api/prices/stream", (req, res) => {
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

  res.write(`data: ${JSON.stringify(toTickPayload(symbol, latestPrices.get(symbol)))}\n\n`);

  req.on("close", () => {
    symbolSubscribers.delete(res);
  });
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
});

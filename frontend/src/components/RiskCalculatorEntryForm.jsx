import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const EMOTIONS = ["Calm", "FOMO", "Fear", "Greedy", "Disciplined", "Overconfident"];
const SYMBOL_OPTIONS = ["EURUSD", "GBPUSD", "USDJPY", "BTCUSD"];
const MAX_HISTORY_POINTS = 40;

const getLocalDateTime = () => {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const defaultForm = {
  symbol: "EURUSD",
  side: "LONG",
  riskPercent: 2,
  equity: 10000,
  entryPrice: 1.0894,
  stopLoss: 1.0854,
  takeProfit: 1.0974,
  positionSize: "",
  fees: 0,
  entryTime: getLocalDateTime(),
  exitPrice: "",
  exitTime: "",
  emotionTags: ["Calm"],
  mindsetLabel: "Focused",
  diaryNotes: ""
};

function NumberField({ label, name, value, onChange, step = "any", min = "0", placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ink/70">{label}</span>
      <input
        type="number"
        name={name}
        value={value}
        step={step}
        min={min}
        onChange={onChange}
        placeholder={placeholder}
        className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-ink outline-none transition focus:border-lime/70 focus:ring-2 focus:ring-lime/30"
      />
    </label>
  );
}

function TextField({ label, name, value, onChange, type = "text", placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ink/70">{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-ink outline-none transition focus:border-lime/70 focus:ring-2 focus:ring-lime/30"
      />
    </label>
  );
}

function LiveAssetChart({ history, symbol }) {
  const chartWidth = 360;
  const chartHeight = 176;
  const innerPadding = 14;

  const series = useMemo(() => {
    if (history.length === 0) {
      return {
        linePath: "",
        areaPath: "",
        minPrice: 0,
        maxPrice: 0,
        latestPrice: null,
        change: 0,
        isUp: true
      };
    }

    const prices = history.map((point) => point.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = Math.max(maxPrice - minPrice, 0.00001);

    const points = history.map((point, index) => {
      const x =
        innerPadding +
        (index / Math.max(history.length - 1, 1)) * (chartWidth - innerPadding * 2);
      const y =
        chartHeight -
        innerPadding -
        ((point.price - minPrice) / range) * (chartHeight - innerPadding * 2);

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const linePath = `M ${points.join(" L ")}`;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const areaPath =
      `${linePath} L ${lastPoint.split(",")[0]},${chartHeight - innerPadding} ` +
      `L ${firstPoint.split(",")[0]},${chartHeight - innerPadding} Z`;

    const latestPrice = prices[prices.length - 1];
    const openingPrice = prices[0];
    const change = latestPrice - openingPrice;

    return {
      linePath,
      areaPath,
      minPrice,
      maxPrice,
      latestPrice,
      change,
      isUp: change >= 0
    };
  }, [history]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4 shadow-inner shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/65">Live Asset Diagram</p>
          <p className="mt-1 font-display text-2xl text-sand">{symbol}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl text-ink">
            {series.latestPrice !== null ? series.latestPrice.toFixed(5) : "Loading..."}
          </p>
          <p className={`text-xs ${series.isUp ? "text-lime" : "text-alert"}`}>
            {series.change >= 0 ? "+" : ""}
            {series.change.toFixed(5)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.15))]">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-44 w-full">
          <defs>
            <linearGradient id="priceArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(163,255,111,0.45)" />
              <stop offset="100%" stopColor="rgba(163,255,111,0.02)" />
            </linearGradient>
          </defs>

          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1={innerPadding}
              y1={chartHeight * ratio}
              x2={chartWidth - innerPadding}
              y2={chartHeight * ratio}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 6"
            />
          ))}

          {series.areaPath && <path d={series.areaPath} fill="url(#priceArea)" />}
          {series.linePath && (
            <path
              d={series.linePath}
              fill="none"
              stroke={series.isUp ? "#a3ff6f" : "#ff6c5f"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-ink/65">
        <span>Low {series.minPrice.toFixed(5)}</span>
        <span>Window {history.length} ticks</span>
        <span>High {series.maxPrice.toFixed(5)}</span>
      </div>
    </div>
  );
}

export default function RiskCalculatorEntryForm() {
  const [form, setForm] = useState(defaultForm);
  const [livePrice, setLivePrice] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceError, setPriceError] = useState("");
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    const streamUrl = `${API_BASE_URL}/api/prices/stream?symbol=${encodeURIComponent(form.symbol)}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const nextPrice = toNumber(payload.price);
        setLivePrice(nextPrice);
        setPriceHistory((current) => {
          const nextHistory = [...current, { price: nextPrice, timestamp: payload.timestamp }];
          return nextHistory.slice(-MAX_HISTORY_POINTS);
        });
        setPriceError("");
      } catch (_error) {
        setPriceError("Unable to parse live price payload.");
      }
    };

    eventSource.onerror = () => {
      setPriceError("Live price stream unavailable. Backend may be offline.");
    };

    return () => {
      eventSource.close();
    };
  }, [form.symbol]);

  const metrics = useMemo(() => {
    const sideFactor = form.side === "LONG" ? 1 : -1;
    const entry = toNumber(form.entryPrice);
    const stopLoss = toNumber(form.stopLoss);
    const takeProfit = toNumber(form.takeProfit);
    const equity = toNumber(form.equity);
    const riskPercent = toNumber(form.riskPercent);
    const stopDistance = Math.abs(entry - stopLoss);
    const riskAmount = (equity * riskPercent) / 100;
    const maxLot = stopDistance > 0 ? riskAmount / stopDistance : 0;
    const liveR =
      stopDistance > 0 && livePrice !== null
        ? (sideFactor * (livePrice - entry)) / stopDistance
        : 0;
    const plannedR = stopDistance > 0 ? Math.abs(takeProfit - entry) / stopDistance : 0;

    const chosenPositionSize = form.positionSize === "" ? maxLot : toNumber(form.positionSize);
    const livePnl =
      livePrice !== null ? sideFactor * (livePrice - entry) * chosenPositionSize : 0;

    return {
      riskAmount,
      maxLot,
      plannedR,
      liveR,
      livePnl,
      chosenPositionSize,
      stopDistance
    };
  }, [form, livePrice]);

  const entryWeekday = useMemo(() => {
    if (!form.entryTime) return "N/A";
    const parsed = new Date(form.entryTime);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleDateString(undefined, { weekday: "long" });
  }, [form.entryTime]);

  const onFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleEmotion = (emotion) => {
    setForm((current) => {
      const exists = current.emotionTags.includes(emotion);
      return {
        ...current,
        emotionTags: exists
          ? current.emotionTags.filter((item) => item !== emotion)
          : [...current.emotionTags, emotion]
      };
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitState("loading");
    setSubmitMessage("");

    const payload = {
      symbol: form.symbol,
      side: form.side,
      entryPrice: toNumber(form.entryPrice),
      stopLoss: toNumber(form.stopLoss),
      takeProfit: toNumber(form.takeProfit),
      exitPrice: form.exitPrice ? toNumber(form.exitPrice) : null,
      entryTime: form.entryTime ? new Date(form.entryTime).toISOString() : null,
      exitTime: form.exitTime ? new Date(form.exitTime).toISOString() : null,
      entryDayOfWeek: entryWeekday,
      riskPercent: toNumber(form.riskPercent),
      equity: toNumber(form.equity),
      riskAmount: metrics.riskAmount,
      maxLot: metrics.maxLot,
      positionSize: metrics.chosenPositionSize,
      fees: toNumber(form.fees),
      livePrice,
      liveR: metrics.liveR,
      plannedR: metrics.plannedR,
      diary: {
        emotionTags: form.emotionTags,
        mindsetLabel: form.mindsetLabel,
        notes: form.diaryNotes
      }
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Trade submission failed.");
      }

      const result = await response.json();
      setSubmitState("success");
      setSubmitMessage(`Trade submitted successfully. ID: ${result.id}`);
    } catch (_error) {
      setSubmitState("error");
      setSubmitMessage("Trade submission failed. Confirm backend is running.");
    }
  };

  const metricClass =
    "rounded-xl border border-white/10 bg-black/25 p-4 shadow-inner shadow-black/20";

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-12">
      <section className="space-y-4 lg:col-span-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-ink/70">Symbol</span>
            <select
              name="symbol"
              value={form.symbol}
              onChange={onFieldChange}
              className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-ink outline-none transition focus:border-lime/70 focus:ring-2 focus:ring-lime/30"
            >
              {SYMBOL_OPTIONS.map((symbol) => (
                <option key={symbol} value={symbol} className="bg-shell text-ink">
                  {symbol}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-ink/70">Direction</span>
            <select
              name="side"
              value={form.side}
              onChange={onFieldChange}
              className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-ink outline-none transition focus:border-lime/70 focus:ring-2 focus:ring-lime/30"
            >
              <option value="LONG" className="bg-shell text-ink">
                LONG
              </option>
              <option value="SHORT" className="bg-shell text-ink">
                SHORT
              </option>
            </select>
          </label>

          <NumberField
            label="Risk %"
            name="riskPercent"
            value={form.riskPercent}
            onChange={onFieldChange}
            step="0.1"
            min="0"
          />

          <NumberField
            label="Current Equity"
            name="equity"
            value={form.equity}
            onChange={onFieldChange}
            step="0.01"
            min="0"
          />

          <NumberField
            label="Entry Price"
            name="entryPrice"
            value={form.entryPrice}
            onChange={onFieldChange}
            step="0.00001"
            min="0"
          />

          <NumberField
            label="Stop Loss"
            name="stopLoss"
            value={form.stopLoss}
            onChange={onFieldChange}
            step="0.00001"
            min="0"
          />

          <NumberField
            label="Take Profit"
            name="takeProfit"
            value={form.takeProfit}
            onChange={onFieldChange}
            step="0.00001"
            min="0"
          />

          <NumberField
            label="Position Size (Override)"
            name="positionSize"
            value={form.positionSize}
            onChange={onFieldChange}
            step="0.001"
            min="0"
            placeholder="Leave blank to use MaxLot"
          />

          <NumberField
            label="Fees"
            name="fees"
            value={form.fees}
            onChange={onFieldChange}
            step="0.01"
            min="0"
          />

          <TextField
            label="Entry Time"
            name="entryTime"
            type="datetime-local"
            value={form.entryTime}
            onChange={onFieldChange}
          />

          <NumberField
            label="Exit Price"
            name="exitPrice"
            value={form.exitPrice}
            onChange={onFieldChange}
            step="0.00001"
            min="0"
            placeholder="Optional"
          />

          <TextField
            label="Exit Time"
            name="exitTime"
            type="datetime-local"
            value={form.exitTime}
            onChange={onFieldChange}
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/15 p-4">
          <h2 className="font-display text-lg uppercase tracking-wide text-sand">
            Trading Diary
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Auto-detected day: <span className="font-semibold text-ink">{entryWeekday}</span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {EMOTIONS.map((emotion) => {
              const selected = form.emotionTags.includes(emotion);
              return (
                <button
                  key={emotion}
                  type="button"
                  onClick={() => toggleEmotion(emotion)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                    selected
                      ? "border-lime/80 bg-lime/20 text-lime"
                      : "border-white/25 bg-black/25 text-ink/75 hover:border-white/45"
                  }`}
                >
                  {emotion}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3">
            <TextField
              label="Mindset Label"
              name="mindsetLabel"
              value={form.mindsetLabel}
              onChange={onFieldChange}
              placeholder="Ex: Patient, Reactive, Distracted"
            />
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-ink/70">Mental Notes</span>
              <textarea
                name="diaryNotes"
                value={form.diaryNotes}
                onChange={onFieldChange}
                rows={4}
                placeholder="Why did you take this setup? Were you disciplined with plan execution?"
                className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-ink outline-none transition focus:border-lime/70 focus:ring-2 focus:ring-lime/30"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitState === "loading"}
          className="w-full rounded-xl border border-lime/60 bg-lime/20 px-4 py-3 font-display text-sm uppercase tracking-wide text-lime transition hover:bg-lime/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitState === "loading" ? "Submitting..." : "Save Trade Entry"}
        </button>

        {submitMessage && (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              submitState === "success"
                ? "border-lime/60 bg-lime/10 text-lime"
                : "border-alert/60 bg-alert/10 text-alert"
            }`}
          >
            {submitMessage}
          </p>
        )}
      </section>

      <aside className="space-y-3 lg:col-span-4">
        <LiveAssetChart history={priceHistory} symbol={form.symbol} />

        <div className={metricClass}>
          <p className="text-xs uppercase tracking-wide text-ink/65">Live Price</p>
          <p className="mt-1 font-display text-2xl text-sand">
            {livePrice !== null ? livePrice.toFixed(5) : "Loading..."}
          </p>
          {priceError && <p className="mt-2 text-xs text-alert">{priceError}</p>}
        </div>

        <div className={metricClass}>
          <p className="text-xs uppercase tracking-wide text-ink/65">Risk Amount</p>
          <p className="mt-1 font-display text-2xl text-lime">${metrics.riskAmount.toFixed(2)}</p>
        </div>

        <div className={metricClass}>
          <p className="text-xs uppercase tracking-wide text-ink/65">MaxLot</p>
          <p className="mt-1 font-display text-2xl text-ink">{metrics.maxLot.toFixed(3)}</p>
          <p className="mt-1 text-xs text-ink/65">
            Stop distance: {metrics.stopDistance.toFixed(5)}
          </p>
        </div>

        <div className={metricClass}>
          <p className="text-xs uppercase tracking-wide text-ink/65">Planned RR</p>
          <p className="mt-1 font-display text-2xl text-ink">{metrics.plannedR.toFixed(2)}R</p>
        </div>

        <div className={metricClass}>
          <p className="text-xs uppercase tracking-wide text-ink/65">Live P/L Ratio</p>
          <p
            className={`mt-1 font-display text-2xl ${
              metrics.liveR >= 0 ? "text-lime" : "text-alert"
            }`}
          >
            {metrics.liveR.toFixed(2)}R
          </p>
        </div>

        <div className={metricClass}>
          <p className="text-xs uppercase tracking-wide text-ink/65">Unrealized P/L</p>
          <p
            className={`mt-1 font-display text-2xl ${
              metrics.livePnl >= 0 ? "text-lime" : "text-alert"
            }`}
          >
            ${metrics.livePnl.toFixed(2)}
          </p>
        </div>
      </aside>
    </form>
  );
}

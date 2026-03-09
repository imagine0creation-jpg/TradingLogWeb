import { AreaSeries, createChart } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const EMOTIONS = ["Calm", "FOMO", "Fear", "Greedy", "Disciplined", "Overconfident"];
const SYMBOL_OPTIONS = ["EURUSD", "GBPUSD", "USDJPY", "BTCUSD"];
const MAX_HISTORY_POINTS = 120;

const getLocalDateTime = () => {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatLivePrice = (value) => (value === null ? "" : value.toFixed(5));

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

function NumberField({
  label,
  name,
  value,
  onChange,
  step = "any",
  min = "0",
  placeholder,
  actionLabel,
  onAction
}) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-ink/70">{label}</span>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-full border border-lime/50 bg-lime/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime transition hover:bg-lime/20"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
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

function TradingViewStyleChart({ history, symbol }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const stats = useMemo(() => {
    if (history.length === 0) {
      return { last: null, change: 0, low: 0, high: 0, isUp: true };
    }

    const prices = history.map((point) => point.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = last - first;

    return {
      last,
      change,
      low: Math.min(...prices),
      high: Math.max(...prices),
      isUp: change >= 0
    };
  }, [history]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 260,
      layout: {
        background: { color: "#0d1219" },
        textColor: "rgba(239,243,248,0.75)",
        fontFamily: "Manrope, sans-serif"
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.06)" }
      },
      crosshair: {
        vertLine: { color: "rgba(163,255,111,0.35)", labelBackgroundColor: "#11161d" },
        horzLine: { color: "rgba(163,255,111,0.35)", labelBackgroundColor: "#11161d" }
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)"
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: true
      }
    });

    const series = chart.addSeries(AreaSeries, {
      topColor: "rgba(163, 255, 111, 0.28)",
      bottomColor: "rgba(163, 255, 111, 0.02)",
      lineColor: "#a3ff6f",
      lineWidth: 2,
      priceLineColor: "#f4e5b3",
      lastValueVisible: true,
      crosshairMarkerBorderColor: "#a3ff6f",
      crosshairMarkerBackgroundColor: "#0d1219"
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    const data = history.map((point) => ({
      time: Math.floor(new Date(point.timestamp).getTime() / 1000),
      value: point.price
    }));

    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [history]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4 shadow-inner shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/65">Live Market Chart</p>
          <p className="mt-1 font-display text-2xl text-sand">{symbol}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-ink">
            {stats.last !== null ? stats.last.toFixed(5) : "Loading..."}
          </p>
          <p className={`text-xs ${stats.isUp ? "text-lime" : "text-alert"}`}>
            {stats.change >= 0 ? "+" : ""}
            {stats.change.toFixed(5)}
          </p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="mt-4 min-h-[260px] overflow-hidden rounded-xl border border-white/10"
      />

      <div className="mt-3 flex items-center justify-between text-xs text-ink/65">
        <span>Low {stats.low.toFixed(5)}</span>
        <span>{history.length} live ticks</span>
        <span>High {stats.high.toFixed(5)}</span>
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

    setPriceHistory([]);

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

  const applyLivePrice = (fieldName) => {
    if (livePrice === null) {
      return;
    }

    setForm((current) => ({
      ...current,
      [fieldName]: formatLivePrice(livePrice)
    }));
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
        <TradingViewStyleChart history={priceHistory} symbol={form.symbol} />

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
            actionLabel="Use Live"
            onAction={() => applyLivePrice("entryPrice")}
          />

          <NumberField
            label="Stop Loss"
            name="stopLoss"
            value={form.stopLoss}
            onChange={onFieldChange}
            step="0.00001"
            min="0"
            actionLabel="Use Live"
            onAction={() => applyLivePrice("stopLoss")}
          />

          <NumberField
            label="Take Profit"
            name="takeProfit"
            value={form.takeProfit}
            onChange={onFieldChange}
            step="0.00001"
            min="0"
            actionLabel="Use Live"
            onAction={() => applyLivePrice("takeProfit")}
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
            actionLabel="Use Live"
            onAction={() => applyLivePrice("exitPrice")}
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
        <div className={metricClass}>
          <p className="text-xs uppercase tracking-wide text-ink/65">Live Price</p>
          <p className="mt-1 font-display text-2xl text-sand">
            {livePrice !== null ? livePrice.toFixed(5) : "Loading..."}
          </p>
          <p className="mt-2 text-xs text-ink/65">
            Use the `Use Live` button on Entry, SL, TP, or Exit to copy the market price.
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

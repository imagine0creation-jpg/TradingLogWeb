import { AreaSeries, createChart } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const SYMBOL_OPTIONS = ["EURUSD", "GBPUSD", "USDJPY", "BTCUSD"];
const MAX_HISTORY_POINTS = 240;
const STORAGE_PREFIX = "trading-chart-drawings";

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPrice = (value) => (value === null ? "Loading..." : value.toFixed(5));

function ToolbarButton({ active = false, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
        active
          ? "border-lime/70 bg-lime/20 text-lime"
          : "border-white/15 bg-black/20 text-ink/80 hover:border-white/35"
      }`}
    >
      {children}
    </button>
  );
}

function ChartOverlay({
  width,
  height,
  mode,
  drawings,
  draft,
  disabled,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  projectDrawing
}) {
  const projectedDrawings = drawings
    .map(projectDrawing)
    .filter(Boolean);

  const projectedDraft = draft ? projectDrawing(draft) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`absolute inset-0 z-20 ${disabled ? "pointer-events-none" : "pointer-events-auto"}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {projectedDrawings.map((shape) => {
        if (shape.type === "trend") {
          return (
            <line
              key={shape.id}
              x1={shape.start.x}
              y1={shape.start.y}
              x2={shape.end.x}
              y2={shape.end.y}
              stroke={shape.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#glow)"
            />
          );
        }

        if (shape.type === "horizontal") {
          return (
            <line
              key={shape.id}
              x1="0"
              y1={shape.y}
              x2={width}
              y2={shape.y}
              stroke={shape.color}
              strokeWidth="2"
              strokeDasharray="8 6"
            />
          );
        }

        return (
          <polyline
            key={shape.id}
            points={shape.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={shape.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
        );
      })}

      {projectedDraft ? (
        projectedDraft.type === "trend" ? (
          <line
            x1={projectedDraft.start.x}
            y1={projectedDraft.start.y}
            x2={projectedDraft.end.x}
            y2={projectedDraft.end.y}
            stroke={projectedDraft.color}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        ) : projectedDraft.type === "horizontal" ? (
          <line
            x1="0"
            y1={projectedDraft.y}
            x2={width}
            y2={projectedDraft.y}
            stroke={projectedDraft.color}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        ) : (
          <polyline
            points={projectedDraft.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={projectedDraft.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 4"
          />
        )
      ) : null}

      {mode !== "none" ? (
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
      ) : null}
    </svg>
  );
}

export default function RiskCalculatorEntryForm() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [livePrice, setLivePrice] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceError, setPriceError] = useState("");
  const [mode, setMode] = useState("none");
  const [drawings, setDrawings] = useState([]);
  const [draft, setDraft] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Drawings save automatically on this device.");
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const drawingStartRef = useRef(null);

  const storageKey = `${STORAGE_PREFIX}:${symbol}`;

  const stats = useMemo(() => {
    if (priceHistory.length === 0) {
      return { low: 0, high: 0, change: 0, isUp: true };
    }

    const prices = priceHistory.map((point) => point.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = last - first;

    return {
      low: Math.min(...prices),
      high: Math.max(...prices),
      change,
      isUp: change >= 0
    };
  }, [priceHistory]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setDrawings([]);
      setStatusMessage("No saved drawings for this symbol yet.");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setDrawings(Array.isArray(parsed) ? parsed : []);
      setStatusMessage("Saved drawings loaded.");
    } catch (_error) {
      setDrawings([]);
      setStatusMessage("Saved drawing data could not be read.");
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(drawings));
  }, [drawings, storageKey]);

  useEffect(() => {
    if (!chartHostRef.current) {
      return undefined;
    }

    const chart = createChart(chartHostRef.current, {
      autoSize: true,
      height: 560,
      layout: {
        background: { color: "#0c1117" },
        textColor: "rgba(239,243,248,0.72)",
        fontFamily: "Manrope, sans-serif"
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.06)" }
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)"
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: true
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(244,229,179,0.35)", labelBackgroundColor: "#131a22" },
        horzLine: { color: "rgba(244,229,179,0.35)", labelBackgroundColor: "#131a22" }
      }
    });

    const series = chart.addSeries(AreaSeries, {
      topColor: "rgba(163,255,111,0.24)",
      bottomColor: "rgba(163,255,111,0.02)",
      lineColor: "#a3ff6f",
      lineWidth: 2,
      priceLineColor: "#f4e5b3",
      crosshairMarkerBorderColor: "#a3ff6f",
      crosshairMarkerBackgroundColor: "#0c1117",
      lastValueVisible: true
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setChartSize({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height)
        });
      }
      chart.timeScale().fitContent();
    });

    resizeObserver.observe(chartHostRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const streamUrl = `${API_BASE_URL}/api/prices/stream?symbol=${encodeURIComponent(symbol)}`;
    const eventSource = new EventSource(streamUrl);

    setPriceHistory([]);
    setLivePrice(null);
    setPriceError("");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const nextPrice = toNumber(payload.price);
        setLivePrice(nextPrice);
        setPriceHistory((current) => {
          const nextHistory = [...current, { price: nextPrice, timestamp: payload.timestamp }];
          return nextHistory.slice(-MAX_HISTORY_POINTS);
        });
      } catch (_error) {
        setPriceError("Unable to parse live price payload.");
      }
    };

    eventSource.onerror = () => {
      setPriceError("Live stream unavailable. Confirm the backend is running.");
    };

    return () => {
      eventSource.close();
    };
  }, [symbol]);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    const data = priceHistory.map((point) => ({
      time: Math.floor(new Date(point.timestamp).getTime() / 1000),
      value: point.price
    }));

    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [priceHistory]);

  const toChartPoint = (event) => {
    if (!chartHostRef.current || !chartRef.current || !seriesRef.current) {
      return null;
    }

    const bounds = chartHostRef.current.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const time = chartRef.current.timeScale().coordinateToTime(x);
    const price = seriesRef.current.coordinateToPrice(y);

    if (time === null || price === null) {
      return null;
    }

    return {
      x,
      y,
      time: Number(time),
      price: Number(price)
    };
  };

  const projectDrawing = (drawing) => {
    if (!chartRef.current || !seriesRef.current) {
      return null;
    }

    if (drawing.type === "trend") {
      const startX = chartRef.current.timeScale().timeToCoordinate(drawing.start.time);
      const endX = chartRef.current.timeScale().timeToCoordinate(drawing.end.time);
      const startY = seriesRef.current.priceToCoordinate(drawing.start.price);
      const endY = seriesRef.current.priceToCoordinate(drawing.end.price);

      if ([startX, endX, startY, endY].some((value) => value === null)) {
        return null;
      }

      return {
        id: drawing.id,
        type: "trend",
        color: drawing.color,
        start: { x: startX, y: startY },
        end: { x: endX, y: endY }
      };
    }

    if (drawing.type === "horizontal") {
      const y = seriesRef.current.priceToCoordinate(drawing.price);
      if (y === null) {
        return null;
      }

      return {
        id: drawing.id,
        type: "horizontal",
        color: drawing.color,
        y
      };
    }

    const points = drawing.points
      .map((point) => {
        const x = chartRef.current.timeScale().timeToCoordinate(point.time);
        const y = seriesRef.current.priceToCoordinate(point.price);
        if (x === null || y === null) {
          return null;
        }

        return { x, y };
      })
      .filter(Boolean);

    if (points.length < 2) {
      return null;
    }

    return {
      id: drawing.id,
      type: "freehand",
      color: drawing.color,
      points
    };
  };

  const startDrawing = (point) => {
    if (mode === "trend") {
      const nextDraft = {
        id: createId(),
        type: "trend",
        color: "#f4e5b3",
        start: point,
        end: point
      };
      drawingStartRef.current = point;
      setDraft(nextDraft);
      return;
    }

    if (mode === "horizontal") {
      const nextDrawing = {
        id: createId(),
        type: "horizontal",
        color: "#7dd3fc",
        price: point.price
      };
      setDrawings((current) => [...current, nextDrawing]);
      setStatusMessage("Horizontal line saved.");
      return;
    }

    if (mode === "freehand") {
      const nextDraft = {
        id: createId(),
        type: "freehand",
        color: "#ff8b7d",
        points: [point]
      };
      setDraft(nextDraft);
    }
  };

  const updateDrawing = (point) => {
    if (!draft) {
      return;
    }

    if (draft.type === "trend") {
      setDraft((current) => ({ ...current, end: point }));
      return;
    }

    if (draft.type === "freehand") {
      setDraft((current) => ({
        ...current,
        points: [...current.points, point]
      }));
    }
  };

  const commitDrawing = () => {
    if (!draft) {
      return;
    }

    if (draft.type === "trend") {
      const finalized = {
        ...draft,
        start: drawingStartRef.current || draft.start
      };
      setDrawings((current) => [...current, finalized]);
      setStatusMessage("Trend line saved.");
    }

    if (draft.type === "freehand" && draft.points.length > 1) {
      setDrawings((current) => [...current, draft]);
      setStatusMessage("Freehand drawing saved.");
    }

    drawingStartRef.current = null;
    setDraft(null);
  };

  const onPointerDown = (event) => {
    if (mode === "none") {
      return;
    }

    const point = toChartPoint(event);
    if (!point) {
      return;
    }

    event.preventDefault();
    startDrawing(point);
  };

  const onPointerMove = (event) => {
    if (!draft) {
      return;
    }

    const point = toChartPoint(event);
    if (!point) {
      return;
    }

    event.preventDefault();
    updateDrawing(point);
  };

  const onPointerUp = () => {
    commitDrawing();
  };

  const clearDrawings = () => {
    setDrawings([]);
    setDraft(null);
    setStatusMessage("Drawings cleared.");
  };

  const undoLast = () => {
    setDrawings((current) => current.slice(0, -1));
    setStatusMessage("Last drawing removed.");
  };

  const saveDrawings = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(drawings));
    setStatusMessage("Drawings saved to this device.");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <section className="rounded-[28px] border border-white/10 bg-panel/90 p-4 shadow-card backdrop-blur md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/55">Live Workspace</p>
            <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-sand">
              Draw On The Market
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/70">
              Pick a symbol, watch the live stream, draw directly on the chart, and keep your
              annotations saved on this device.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-ink/65">Asset</span>
              <select
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                className="rounded-xl border border-white/15 bg-black/25 px-4 py-2 text-sm text-ink outline-none transition focus:border-lime/70 focus:ring-2 focus:ring-lime/30"
              >
                {SYMBOL_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-shell text-ink">
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink/55">Live Price</p>
              <p className="font-display text-2xl text-lime">{formatPrice(livePrice)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <ToolbarButton active={mode === "none"} onClick={() => setMode("none")}>
            Pan
          </ToolbarButton>
          <ToolbarButton active={mode === "trend"} onClick={() => setMode("trend")}>
            Trend Line
          </ToolbarButton>
          <ToolbarButton active={mode === "horizontal"} onClick={() => setMode("horizontal")}>
            Horizontal
          </ToolbarButton>
          <ToolbarButton active={mode === "freehand"} onClick={() => setMode("freehand")}>
            Freehand
          </ToolbarButton>
          <ToolbarButton onClick={undoLast}>Undo</ToolbarButton>
          <ToolbarButton onClick={clearDrawings}>Clear</ToolbarButton>
          <ToolbarButton onClick={saveDrawings}>Save</ToolbarButton>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-[#0c1117]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-ink/60">
            <span>{symbol}</span>
            <span>{mode === "none" ? "Chart navigation mode" : `Drawing mode: ${mode}`}</span>
          </div>

          <div className="relative">
            <div ref={chartHostRef} className="min-h-[560px] w-full" />
            {chartSize.width > 0 && chartSize.height > 0 ? (
              <ChartOverlay
                width={chartSize.width}
                height={chartSize.height}
                mode={mode}
                drawings={drawings}
                draft={draft}
                disabled={mode === "none"}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                projectDrawing={projectDrawing}
              />
            ) : null}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-panel/90 p-5 shadow-card backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/55">Session</p>
          <p className="mt-3 font-display text-4xl text-ink">{formatPrice(livePrice)}</p>
          <p className={`mt-2 text-sm ${stats.isUp ? "text-lime" : "text-alert"}`}>
            {stats.change >= 0 ? "+" : ""}
            {stats.change.toFixed(5)} in current window
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-ink/55">Low</p>
              <p className="mt-1 font-display text-xl text-ink">{stats.low.toFixed(5)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-ink/55">High</p>
              <p className="mt-1 font-display text-xl text-ink">{stats.high.toFixed(5)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-panel/90 p-5 shadow-card backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/55">Drawing Guide</p>
          <div className="mt-4 space-y-3 text-sm text-ink/72">
            <p>`Trend Line`: press, drag, release.</p>
            <p>`Horizontal`: click once at the price level.</p>
            <p>`Freehand`: press, draw, release.</p>
            <p>`Save`: stores drawings in your browser for the current symbol.</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-panel/90 p-5 shadow-card backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/55">Status</p>
          <p className="mt-3 text-sm text-ink/75">{statusMessage}</p>
          {priceError ? <p className="mt-3 text-sm text-alert">{priceError}</p> : null}
          <p className="mt-4 text-xs text-ink/50">{drawings.length} saved drawings on {symbol}</p>
        </div>
      </aside>
    </div>
  );
}

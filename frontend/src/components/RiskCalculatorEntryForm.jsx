import { AreaSeries, createChart } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const SYMBOL_OPTIONS = ["EURUSD", "GBPUSD", "USDJPY", "BTCUSD"];
const STORAGE_PREFIX = "trading-chart-drawings";
const MAX_BAR_POINTS = 1200;
const TIMEFRAME_OPTIONS = [
  { id: "1m", label: "1m", seconds: 60 },
  { id: "5m", label: "5m", seconds: 300 },
  { id: "15m", label: "15m", seconds: 900 },
  { id: "30m", label: "30m", seconds: 1800 },
  { id: "1h", label: "1h", seconds: 3600 },
  { id: "4h", label: "4h", seconds: 14400 },
  { id: "1d", label: "1d", seconds: 86400 },
  { id: "1w", label: "1w", seconds: 604800 }
];
const DEMO_SYMBOLS = {
  EURUSD: 1.0894,
  GBPUSD: 1.2741,
  USDJPY: 149.28,
  BTCUSD: 63850.22
};

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPrice = (value) => (value === null ? "Loading..." : value.toFixed(5));

const formatBarTime = (epochSeconds, timeframeLabel) => {
  if (!Number.isFinite(epochSeconds)) {
    return "--";
  }

  const date = new Date(epochSeconds * 1000);
  if (timeframeLabel === "1d" || timeframeLabel === "1w") {
    return date.toLocaleDateString();
  }

  return date.toLocaleString();
};

const makeDemoBars = (symbol, timeframeSeconds, count = 400) => {
  const now = Math.floor(Date.now() / 1000);
  const bars = [];
  let price = DEMO_SYMBOLS[symbol] ?? 1;
  let cursor = now - count * timeframeSeconds;

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
    cursor += timeframeSeconds;
  }

  return bars;
};

const upsertBarFromTick = (bars, price, epochSeconds, timeframeSeconds) => {
  const bucketTime = Math.floor(epochSeconds / timeframeSeconds) * timeframeSeconds;
  const nextBars = [...bars];
  const lastBar = nextBars[nextBars.length - 1];

  if (!lastBar) {
    return [
      {
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price
      }
    ];
  }

  if (lastBar.time === bucketTime) {
    lastBar.high = Math.max(lastBar.high, price);
    lastBar.low = Math.min(lastBar.low, price);
    lastBar.close = price;
    return nextBars.slice(-MAX_BAR_POINTS);
  }

  nextBars.push({
    time: bucketTime,
    open: lastBar.close,
    high: price,
    low: price,
    close: price
  });

  return nextBars.slice(-MAX_BAR_POINTS);
};

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
  const projectedDrawings = drawings.map(projectDrawing).filter(Boolean);
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

      {mode !== "none" ? <rect x="0" y="0" width={width} height={height} fill="transparent" /> : null}
    </svg>
  );
}

export default function RiskCalculatorEntryForm() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState("1m");
  const [livePrice, setLivePrice] = useState(null);
  const [bars, setBars] = useState([]);
  const [historySource, setHistorySource] = useState("backend");
  const [historyError, setHistoryError] = useState("");
  const [priceError, setPriceError] = useState("");
  const [mode, setMode] = useState("trend");
  const [drawings, setDrawings] = useState([]);
  const [draft, setDraft] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Drawings save automatically on this device.");
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [feedMode, setFeedMode] = useState("live");

  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const drawingStartRef = useRef(null);
  const demoTimerRef = useRef(null);
  const livePriceRef = useRef(null);
  const barsRef = useRef([]);

  const storageKey = `${STORAGE_PREFIX}:${symbol}`;
  const selectedTimeframe = useMemo(
    () => TIMEFRAME_OPTIONS.find((option) => option.id === timeframe) || TIMEFRAME_OPTIONS[0],
    [timeframe]
  );

  const displaySeries = useMemo(
    () => bars.map((bar) => ({ time: bar.time, value: bar.close })),
    [bars]
  );
  const recentHistoryBars = useMemo(() => bars.slice(-24).reverse(), [bars]);

  const stats = useMemo(() => {
    if (bars.length === 0) {
      return { low: 0, high: 0, change: 0, isUp: true };
    }

    const closes = bars.map((bar) => bar.close);
    return {
      low: Math.min(...bars.map((bar) => bar.low)),
      high: Math.max(...bars.map((bar) => bar.high)),
      change: closes[closes.length - 1] - closes[0],
      isUp: closes[closes.length - 1] - closes[0] >= 0
    };
  }, [bars]);

  useEffect(() => {
    livePriceRef.current = livePrice;
  }, [livePrice]);

  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

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
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false
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
    if (!chartRef.current) {
      return;
    }

    chartRef.current.applyOptions({
      timeScale: {
        timeVisible: true,
        secondsVisible: selectedTimeframe.seconds < 3600
      }
    });
  }, [selectedTimeframe.seconds]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setHistoryError("");
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/history?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(
            timeframe
          )}&count=600`
        );

        if (!response.ok) {
          throw new Error("history fetch failed");
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        const nextBars = Array.isArray(payload.bars)
          ? payload.bars
              .map((bar) => ({
                time: toNumber(bar.time),
                open: toNumber(bar.open),
                high: toNumber(bar.high),
                low: toNumber(bar.low),
                close: toNumber(bar.close)
              }))
              .filter((bar) => Number.isFinite(bar.time))
          : [];

        if (nextBars.length === 0) {
          throw new Error("empty bars");
        }

        setBars(nextBars.slice(-MAX_BAR_POINTS));
        setHistorySource(payload.source || "backend");
        setLivePrice(nextBars[nextBars.length - 1].close);
      } catch (_error) {
        if (cancelled) {
          return;
        }

        const demoBars = makeDemoBars(symbol, selectedTimeframe.seconds, 400);
        setBars(demoBars);
        setHistorySource("demo");
        setLivePrice(demoBars[demoBars.length - 1]?.close ?? null);
        setHistoryError("History API unavailable. Showing demo history.");
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, selectedTimeframe.seconds]);

  useEffect(() => {
    const streamUrl = `${API_BASE_URL}/api/prices/stream?symbol=${encodeURIComponent(symbol)}`;
    const eventSource = new EventSource(streamUrl);
    let hasReceivedLiveTick = false;
    let fallbackTimer = null;

    setPriceError("");
    setFeedMode("live");

    const applyTick = (nextPrice, timestamp = new Date().toISOString()) => {
      const epochSeconds = Math.floor(new Date(timestamp).getTime() / 1000) || Math.floor(Date.now() / 1000);
      setLivePrice(nextPrice);
      setBars((current) =>
        upsertBarFromTick(current, nextPrice, epochSeconds, selectedTimeframe.seconds)
      );
    };

    const stopDemoFeed = () => {
      if (demoTimerRef.current) {
        window.clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
      }
    };

    const startDemoFeed = () => {
      if (demoTimerRef.current) {
        return;
      }

      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      setFeedMode("demo");
      setPriceError("Live stream unavailable. Using demo live ticks.");

      let lastPrice =
        livePriceRef.current ?? barsRef.current[barsRef.current.length - 1]?.close ?? DEMO_SYMBOLS[symbol] ?? 1;
      demoTimerRef.current = window.setInterval(() => {
        const drift = (Math.random() - 0.5) * 0.004;
        lastPrice = Math.max(lastPrice * (1 + drift), 0.00001);
        applyTick(Number(lastPrice.toFixed(5)));
      }, 1000);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const nextPrice = toNumber(payload.price);
        hasReceivedLiveTick = true;
        stopDemoFeed();
        setFeedMode("live");
        setPriceError("");
        applyTick(nextPrice, payload.timestamp);
      } catch (_error) {
        setPriceError("Unable to parse live price payload.");
      }
    };

    fallbackTimer = window.setTimeout(() => {
      if (!hasReceivedLiveTick) {
        startDemoFeed();
      }
    }, 2500);

    eventSource.onerror = () => {
      if (!hasReceivedLiveTick) {
        startDemoFeed();
      } else {
        setPriceError("Live stream interrupted.");
      }
    };

    return () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
      eventSource.close();
      stopDemoFeed();
    };
  }, [symbol, selectedTimeframe.seconds]);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    seriesRef.current.setData(displaySeries);
    chartRef.current?.timeScale().fitContent();
  }, [displaySeries]);

  const toChartPoint = (event) => {
    if (!chartHostRef.current || !chartRef.current || !seriesRef.current) {
      return null;
    }

    const bounds = chartHostRef.current.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const logical = chartRef.current.timeScale().coordinateToLogical(x);
    const time = chartRef.current.timeScale().coordinateToTime(x);
    const price = seriesRef.current.coordinateToPrice(y);

    if (logical === null || time === null || price === null) {
      return null;
    }

    return {
      x,
      y,
      logical: Number(logical),
      time: Number(time),
      price: Number(price)
    };
  };

  const projectDrawing = (drawing) => {
    if (!chartRef.current || !seriesRef.current) {
      return null;
    }

    if (drawing.type === "trend") {
      const startX =
        Number.isFinite(drawing.start.logical)
          ? chartRef.current.timeScale().logicalToCoordinate(drawing.start.logical)
          : chartRef.current.timeScale().timeToCoordinate(drawing.start.time);
      const endX =
        Number.isFinite(drawing.end.logical)
          ? chartRef.current.timeScale().logicalToCoordinate(drawing.end.logical)
          : chartRef.current.timeScale().timeToCoordinate(drawing.end.time);
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
      return { id: drawing.id, type: "horizontal", color: drawing.color, y };
    }

    const points = drawing.points
      .map((point) => {
        const x = Number.isFinite(point.logical)
          ? chartRef.current.timeScale().logicalToCoordinate(point.logical)
          : chartRef.current.timeScale().timeToCoordinate(point.time);
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

    return { id: drawing.id, type: "freehand", color: drawing.color, points };
  };

  const startDrawing = (point) => {
    if (mode === "trend") {
      const nextDraft = { id: createId(), type: "trend", color: "#f4e5b3", start: point, end: point };
      drawingStartRef.current = point;
      setDraft(nextDraft);
      return;
    }

    if (mode === "horizontal") {
      setDrawings((current) => [
        ...current,
        { id: createId(), type: "horizontal", color: "#7dd3fc", price: point.price }
      ]);
      setStatusMessage("Horizontal line saved.");
      return;
    }

    if (mode === "freehand") {
      setDraft({ id: createId(), type: "freehand", color: "#ff8b7d", points: [point] });
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
      setDraft((current) => ({ ...current, points: [...current.points, point] }));
    }
  };

  const commitDrawing = () => {
    if (!draft) {
      return;
    }

    if (draft.type === "trend") {
      setDrawings((current) => [...current, { ...draft, start: drawingStartRef.current || draft.start }]);
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

  const onPointerUp = () => commitDrawing();
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
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="rounded-[28px] border border-white/10 bg-panel/90 p-4 shadow-card backdrop-blur md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/55">Live Workspace</p>
            <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-sand">Draw On The Market</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/70">
              OANDA history + live stream when available, with drawing tools that stay usable across all timeframes.
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

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-ink/65">Timeframe</span>
              <select
                value={timeframe}
                onChange={(event) => setTimeframe(event.target.value)}
                className="rounded-xl border border-white/15 bg-black/25 px-4 py-2 text-sm text-ink outline-none transition focus:border-lime/70 focus:ring-2 focus:ring-lime/30"
              >
                {TIMEFRAME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id} className="bg-shell text-ink">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink/55">Live Price</p>
              <p className="font-display text-2xl text-lime">{formatPrice(livePrice)}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-ink/45">
                {feedMode === "live" ? "Backend feed" : "Demo feed"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <ToolbarButton active={mode === "none"} onClick={() => setMode("none")}>Pan</ToolbarButton>
          <ToolbarButton active={mode === "trend"} onClick={() => setMode("trend")}>Trend Line</ToolbarButton>
          <ToolbarButton active={mode === "horizontal"} onClick={() => setMode("horizontal")}>Horizontal</ToolbarButton>
          <ToolbarButton active={mode === "freehand"} onClick={() => setMode("freehand")}>Freehand</ToolbarButton>
          <ToolbarButton onClick={undoLast}>Undo</ToolbarButton>
          <ToolbarButton onClick={clearDrawings}>Clear</ToolbarButton>
          <ToolbarButton onClick={saveDrawings}>Save</ToolbarButton>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-[#0c1117]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-ink/60">
            <span>{symbol}</span>
            <span>{selectedTimeframe.label}</span>
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
          <p className="text-xs uppercase tracking-[0.3em] text-ink/55">History Record</p>
          <p className="mt-2 text-xs text-ink/60">Source: {historySource}</p>
          <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/25">
            <table className="w-full border-collapse text-xs text-ink/80">
              <thead className="sticky top-0 bg-[#121820] text-ink/65">
                <tr>
                  <th className="px-2 py-2 text-left">Time</th>
                  <th className="px-2 py-2 text-right">O</th>
                  <th className="px-2 py-2 text-right">H</th>
                  <th className="px-2 py-2 text-right">L</th>
                  <th className="px-2 py-2 text-right">C</th>
                </tr>
              </thead>
              <tbody>
                {recentHistoryBars.map((bar) => (
                  <tr key={bar.time} className="border-t border-white/5">
                    <td className="px-2 py-1.5 text-left text-ink/70">
                      {formatBarTime(bar.time, selectedTimeframe.label)}
                    </td>
                    <td className="px-2 py-1.5 text-right">{bar.open.toFixed(5)}</td>
                    <td className="px-2 py-1.5 text-right">{bar.high.toFixed(5)}</td>
                    <td className="px-2 py-1.5 text-right">{bar.low.toFixed(5)}</td>
                    <td className="px-2 py-1.5 text-right">{bar.close.toFixed(5)}</td>
                  </tr>
                ))}
                {recentHistoryBars.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-center text-ink/60">
                      Waiting for history bars...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-panel/90 p-5 shadow-card backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/55">Status</p>
          <p className="mt-3 text-sm text-ink/75">{statusMessage}</p>
          {historyError ? <p className="mt-3 text-sm text-alert">{historyError}</p> : null}
          {priceError ? <p className="mt-3 text-sm text-alert">{priceError}</p> : null}
          <p className="mt-3 text-xs text-ink/55">
            Current source: {feedMode === "live" ? "backend stream" : "browser demo simulation"}
          </p>
          <p className="mt-2 text-xs text-ink/55">Active timeframe: {selectedTimeframe.label}</p>
          <p className="mt-4 text-xs text-ink/50">{drawings.length} saved drawings on {symbol}</p>
        </div>
      </aside>
    </div>
  );
}

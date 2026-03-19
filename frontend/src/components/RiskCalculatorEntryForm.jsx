import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const WIDGET_CONTAINER_ID = "tradingview_widget_container";

const ASSET_OPTIONS = [
  { id: "EURUSD", label: "EUR/USD", tvSymbol: "OANDA:EURUSD", precision: 5 },
  { id: "GBPUSD", label: "GBP/USD", tvSymbol: "OANDA:GBPUSD", precision: 5 },
  { id: "USDJPY", label: "USD/JPY", tvSymbol: "OANDA:USDJPY", precision: 3 },
  { id: "BTCUSD", label: "BTC/USD", tvSymbol: "BITSTAMP:BTCUSD", precision: 2 }
];

const TIMEFRAME_OPTIONS = [
  { id: "1m", label: "1m", tvInterval: "1" },
  { id: "5m", label: "5m", tvInterval: "5" },
  { id: "15m", label: "15m", tvInterval: "15" },
  { id: "30m", label: "30m", tvInterval: "30" },
  { id: "1h", label: "1h", tvInterval: "60" },
  { id: "4h", label: "4h", tvInterval: "240" },
  { id: "1d", label: "1D", tvInterval: "D" },
  { id: "1w", label: "1W", tvInterval: "W" }
];

let tradingViewScriptPromise = null;

const loadTradingViewScript = () => {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (window.TradingView) {
    return Promise.resolve(window.TradingView);
  }

  if (tradingViewScriptPromise) {
    return tradingViewScriptPromise;
  }

  tradingViewScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById("tradingview-widget-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.TradingView), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("TradingView script failed to load.")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "tradingview-widget-script";
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve(window.TradingView);
    script.onerror = () => reject(new Error("TradingView script failed to load."));
    document.head.appendChild(script);
  });

  return tradingViewScriptPromise;
};

const formatPrice = (value, precision) =>
  value === null || Number.isNaN(value) ? "Loading..." : Number(value).toFixed(precision);

export default function RiskCalculatorEntryForm() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState("15m");
  const [livePrice, setLivePrice] = useState(null);
  const [priceSource, setPriceSource] = useState("waiting");
  const [priceError, setPriceError] = useState("");
  const [chartStatus, setChartStatus] = useState("Loading TradingView chart...");
  const [chartError, setChartError] = useState("");
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMessage, setCaptureMessage] = useState("");
  const chartHostRef = useRef(null);
  const widgetRef = useRef(null);

  const selectedAsset = useMemo(
    () => ASSET_OPTIONS.find((option) => option.id === symbol) || ASSET_OPTIONS[0],
    [symbol]
  );
  const selectedTimeframe = useMemo(
    () => TIMEFRAME_OPTIONS.find((option) => option.id === timeframe) || TIMEFRAME_OPTIONS[0],
    [timeframe]
  );

  useEffect(() => {
    let isCancelled = false;

    const createWidget = async () => {
      setChartError("");
      setChartStatus("Loading TradingView chart...");

      try {
        const TradingView = await loadTradingViewScript();
        if (isCancelled || !chartHostRef.current) {
          return;
        }

        if (!TradingView || typeof TradingView.widget !== "function") {
          throw new Error("TradingView widget is unavailable.");
        }

        const widgetContainer = document.createElement("div");
        widgetContainer.id = WIDGET_CONTAINER_ID;
        widgetContainer.className = "h-[620px] w-full";
        chartHostRef.current.replaceChildren(widgetContainer);

        widgetRef.current = new TradingView.widget({
          autosize: true,
          container_id: WIDGET_CONTAINER_ID,
          symbol: selectedAsset.tvSymbol,
          interval: selectedTimeframe.tvInterval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          hide_top_toolbar: false,
          hide_legend: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          withdateranges: true,
          save_image: true,
          enable_publishing: false,
          details: true,
          hotlist: false,
          calendar: false
        });

        setChartStatus("TradingView chart ready. Use the left toolbar for drawing.");
      } catch (error) {
        if (!isCancelled) {
          setChartError(error instanceof Error ? error.message : "Unable to load TradingView chart.");
          setChartStatus("Chart unavailable.");
        }
      }
    };

    createWidget();

    return () => {
      isCancelled = true;
      widgetRef.current = null;
      if (chartHostRef.current) {
        chartHostRef.current.replaceChildren();
      }
    };
  }, [selectedAsset.tvSymbol, selectedTimeframe.tvInterval]);

  const fetchLivePrice = async (silent = false) => {
    if (!silent) {
      setIsFetchingPrice(true);
    }

    setPriceError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/prices/latest?symbol=${encodeURIComponent(selectedAsset.id)}`
      );
      if (!response.ok) {
        throw new Error("Live price request failed.");
      }

      const payload = await response.json();
      const nextPrice = Number(payload.price);
      if (!Number.isFinite(nextPrice)) {
        throw new Error("Price payload is invalid.");
      }

      setLivePrice(nextPrice);
      setPriceSource(payload.source || "backend");
    } catch (error) {
      setPriceError(error instanceof Error ? error.message : "Could not fetch live price.");
    } finally {
      if (!silent) {
        setIsFetchingPrice(false);
      }
    }
  };

  useEffect(() => {
    fetchLivePrice(true);
    const timerId = window.setInterval(() => {
      fetchLivePrice(true);
    }, 15000);

    return () => window.clearInterval(timerId);
  }, [selectedAsset.id]);

  const captureChart = async () => {
    setIsCapturing(true);
    setCaptureMessage("");

    try {
      const widget = widgetRef.current;
      if (!widget) {
        throw new Error("Chart is still loading. Please wait and try again.");
      }

      if (typeof widget.takeClientScreenshot !== "function") {
        throw new Error(
          "Direct screenshot API is not available. Use the camera icon on the chart toolbar."
        );
      }

      const screenshotCanvas = await widget.takeClientScreenshot();
      const fileName = `chart-${selectedAsset.id}-${timeframe}-${Date.now()}.png`;
      const blob = await new Promise((resolve, reject) => {
        screenshotCanvas.toBlob((nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob);
            return;
          }
          reject(new Error("Unable to create image file."));
        }, "image/png");
      });

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

      setCaptureMessage("Chart screenshot downloaded.");
    } catch (error) {
      setCaptureMessage(error instanceof Error ? error.message : "Screenshot failed.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="rounded-[28px] border border-white/10 bg-panel/90 p-4 shadow-card backdrop-blur md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/55">TradingView Widget</p>
            <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-sand">Live Market Chart</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/70">
              Smooth TradingView chart with built-in drawing tools and timeframe switching.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-ink/65">Asset</span>
              <select
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                className="rounded-xl border border-white/15 bg-black/25 px-4 py-2 text-sm text-ink outline-none transition focus:border-lime/70 focus:ring-2 focus:ring-lime/30"
              >
                {ASSET_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id} className="bg-shell text-ink">
                    {option.label}
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

            <button
              type="button"
              onClick={() => fetchLivePrice(false)}
              disabled={isFetchingPrice}
              className="rounded-xl border border-lime/70 bg-lime/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-lime transition hover:bg-lime/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetchingPrice ? "Loading..." : "Get Live Price"}
            </button>

            <button
              type="button"
              onClick={captureChart}
              disabled={isCapturing}
              className="rounded-xl border border-sand/60 bg-sand/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sand transition hover:bg-sand/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCapturing ? "Capturing..." : "Capture PNG"}
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-[#0c1117]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-ink/60">
            <span>{selectedAsset.tvSymbol}</span>
            <span>{selectedTimeframe.label}</span>
            <span>{chartStatus}</span>
          </div>
          <div ref={chartHostRef} className="h-[620px] w-full p-0" />
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-panel/90 p-5 shadow-card backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/55">Live Price</p>
          <p className="mt-3 font-display text-4xl text-lime">
            {formatPrice(livePrice, selectedAsset.precision)}
          </p>
          <p className="mt-2 text-xs text-ink/60">Source: {priceSource}</p>
          <p className="mt-2 text-xs text-ink/60">Backend symbol: {selectedAsset.id}</p>
          {priceError ? <p className="mt-3 text-sm text-alert">{priceError}</p> : null}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-panel/90 p-5 shadow-card backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/55">Drawing Notes</p>
          <p className="mt-3 text-sm text-ink/75">
            Use TradingView left toolbar to draw trend lines and annotations.
          </p>
          <p className="mt-2 text-xs text-ink/55">
            Widget drawings are handled by TradingView UI, not by local backend storage.
          </p>
          {captureMessage ? <p className="mt-3 text-sm text-ink/75">{captureMessage}</p> : null}
          {chartError ? <p className="mt-3 text-sm text-alert">{chartError}</p> : null}
        </div>
      </aside>
    </div>
  );
}

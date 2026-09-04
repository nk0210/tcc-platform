"use client";
import { useEffect, useRef, useState } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  height?: number | string;
  theme?: "dark" | "light";
}

// Module-level script loader — only loads once.
//
// This loads TradingView's widget from their public CDN — a real external
// dependency the browser has to reach. There was previously no
// `onerror` handler and no timeout: if that request was blocked (firewall,
// ad-blocker, DNS, offline), `scriptLoading` stayed true forever,
// `pendingCallbacks` never ran, and the chart just showed TradingView's own
// loading spinner indefinitely with no way to tell whether it was still
// working or permanently stuck. Now failures are tracked and callers get a
// definite yes/no instead of silence, and `resetTVScriptLoader()` lets a
// user-triggered retry actually try again instead of being stuck on the
// first failed attempt forever (module state otherwise never resets).
let scriptLoaded = false;
let scriptLoading = false;
let scriptFailed = false;
const pendingCallbacks: ((ok: boolean) => void)[] = [];

function resetTVScriptLoader(): void {
  scriptLoaded = false;
  scriptLoading = false;
  scriptFailed = false;
}

function loadTVScript(cb: (ok: boolean) => void) {
  if (scriptLoaded && typeof window !== "undefined" && window.TradingView) {
    cb(true);
    return;
  }
  if (scriptFailed) {
    cb(false);
    return;
  }
  pendingCallbacks.push(cb);
  if (scriptLoading) return;
  scriptLoading = true;
  const s = document.createElement("script");
  s.src = "https://s3.tradingview.com/tv.js";
  s.async = true;
  s.onload = () => {
    scriptLoaded = true;
    scriptLoading = false;
    pendingCallbacks.forEach(fn => fn(true));
    pendingCallbacks.length = 0;
  };
  s.onerror = () => {
    scriptLoading = false;
    scriptFailed = true;
    pendingCallbacks.forEach(fn => fn(false));
    pendingCallbacks.length = 0;
  };
  document.head.appendChild(s);
}

export default function TradingViewChart({
  symbol,
  interval = "60",
  height = "100%",
  theme = "dark",
}: TradingViewChartProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const prevSymbol = useRef<string>("");
  // Stable container ID — created once per mount
  const containerId = useRef(`tv_${Math.random().toString(36).slice(2, 9)}`);

  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    // Only recreate widget when symbol actually changes
    if (prevSymbol.current === symbol && widgetRef.current && !loadFailed) return;
    prevSymbol.current = symbol;
    setLoadFailed(false);

    // Destroy old widget
    if (widgetRef.current) {
      try { widgetRef.current.remove(); } catch {}
      widgetRef.current = null;
    }
    if (outerRef.current) outerRef.current.innerHTML = "";

    // Create inner container with stable ID
    const inner = document.createElement("div");
    inner.id = containerId.current;
    inner.style.cssText = "height:100%;width:100%;";
    outerRef.current?.appendChild(inner);

    const createWidget = () => {
      if (!document.getElementById(containerId.current) || !window.TradingView) return;
      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        timezone: "Etc/UTC",
        theme,
        style: "1",
        locale: "en",
        toolbar_bg: "#0d0d14",
        enable_publishing: false,
        withdateranges: true,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        container_id: containerId.current,
        backgroundColor: "rgba(10,10,15,1)",
        gridColor: "rgba(255,255,255,0.03)",
        save_image: true,
        show_popup_button: false,
        overrides: {
          "paneProperties.background": "#0a0a0f",
          "paneProperties.backgroundType": "solid",
          "paneProperties.vertGridProperties.color": "rgba(255,255,255,0.03)",
          "paneProperties.horzGridProperties.color": "rgba(255,255,255,0.03)",
          "scalesProperties.textColor": "rgba(255,255,255,0.5)",
          "mainSeriesProperties.candleStyle.upColor": "#00ff88",
          "mainSeriesProperties.candleStyle.downColor": "#ff4466",
          "mainSeriesProperties.candleStyle.borderUpColor": "#00ff88",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ff4466",
          "mainSeriesProperties.candleStyle.wickUpColor": "#00ff88",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ff4466",
        },
        enabled_features: [
          "study_templates",
          "use_localstorage_for_settings",
          "items_favoriting",
          "save_chart_properties_to_local_storage",
          "header_indicators",
          "header_chart_type",
          "header_settings",
          "header_resolutions",
          "header_undo_redo",
          "header_screenshot",
          "header_fullscreen_button",
          "create_volume_indicator_by_default",
          "display_market_status",
          "go_to_date",
          "side_toolbar_in_fullscreen_mode",
          "chart_zoom",
          "timeframes_toolbar",
        ],
        disabled_features: [
          "symbol_search_hot_key",
          "header_symbol_search",
          "header_compare",
        ],
      });
    };

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) { settled = true; setLoadFailed(true); }
    }, 12_000);

    loadTVScript((ok) => {
      if (settled) return; // timeout already fired — don't also build on a late success
      settled = true;
      clearTimeout(timeoutId);
      if (ok) createWidget();
      else setLoadFailed(true);
    });

    return () => {
      settled = true;
      clearTimeout(timeoutId);
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
      }
    };
  }, [symbol, retryToken]); // Only re-run when symbol changes — interval/theme changes don't reload

  if (loadFailed) {
    return (
      <div
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          width: "100%",
          minHeight: "500px",
        }}
        className="flex flex-col items-center justify-center gap-3 bg-[#0a0a0f]"
      >
        <p className="text-fg-dim text-sm">Chart failed to load.</p>
        <p className="text-fg-dim text-xs max-w-xs text-center">
          TradingView's chart widget couldn't load — check your connection, or an ad-blocker/firewall may be blocking s3.tradingview.com.
        </p>
        <button
          type="button"
          onClick={() => { resetTVScriptLoader(); setLoadFailed(false); setRetryToken((n) => n + 1); }}
          className="text-fg-dim text-xs border border-border px-3 py-1 rounded hover:text-fg-muted hover:border-border-strong transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      style={{
        position: "relative",
        height: typeof height === "number" ? `${height}px` : height,
        width: "100%",
        minHeight: "500px",
      }}
    />
  );
}

declare global {
  interface Window { TradingView: any; }
}
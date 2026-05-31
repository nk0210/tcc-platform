"use client";
import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  height?: number | string;
  theme?: "dark" | "light";
}

// Module-level script loader — only loads once
let scriptLoaded = false;
let scriptLoading = false;
const pendingCallbacks: (() => void)[] = [];

function loadTVScript(cb: () => void) {
  if (scriptLoaded && typeof window !== "undefined" && window.TradingView) {
    cb();
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
    pendingCallbacks.forEach(fn => fn());
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

  useEffect(() => {
    // Only recreate widget when symbol actually changes
    if (prevSymbol.current === symbol && widgetRef.current) return;
    prevSymbol.current = symbol;

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

    loadTVScript(createWidget);

    return () => {
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
      }
    };
  }, [symbol]); // Only re-run when symbol changes — interval/theme changes don't reload

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
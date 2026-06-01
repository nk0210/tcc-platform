/**
 * TCC Central Symbol Configuration — Single source of truth.
 *
 * livePriceSupported = true  → Binance WebSocket/REST live price.
 * livePriceSupported = false → statusLabel shown, chart available via TradingView.
 *
 * contractSize is used for paper P&L calculation only.
 * Not broker-accurate. Labeled as internal paper calculation model.
 */

export type SymbolCategory = "crypto" | "forex" | "commodity" | "index";

export interface TCCSymbol {
  id: string;
  symbol: string;
  displayName: string;
  description: string;
  category: SymbolCategory;
  tradingViewSymbol: string;
  binanceSymbol?: string;
  baseCurrency: string;
  quoteCurrency: string;
  livePriceSupported: boolean;
  chartSupported: boolean;
  emoji: string;
  statusLabel?: string;
  /** Paper trading contract size (internal paper model) */
  contractSize: number;
  /** Minimum lot size for paper trading */
  minLotSize: number;
  /** Maximum lot size for paper trading */
  maxLotSize: number;
}

export const TCC_SYMBOLS: TCCSymbol[] = [
  // ── CRYPTO — Binance WebSocket live prices ──────────────────────────────
  { id: "BTCUSDT", symbol: "BTCUSDT", displayName: "BTC/USDT", description: "Bitcoin", category: "crypto", tradingViewSymbol: "BINANCE:BTCUSDT", binanceSymbol: "BTCUSDT", baseCurrency: "BTC", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "₿", contractSize: 1, minLotSize: 0.001, maxLotSize: 10 },
  { id: "ETHUSDT", symbol: "ETHUSDT", displayName: "ETH/USDT", description: "Ethereum", category: "crypto", tradingViewSymbol: "BINANCE:ETHUSDT", binanceSymbol: "ETHUSDT", baseCurrency: "ETH", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "Ξ", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "SOLUSDT", symbol: "SOLUSDT", displayName: "SOL/USDT", description: "Solana", category: "crypto", tradingViewSymbol: "BINANCE:SOLUSDT", binanceSymbol: "SOLUSDT", baseCurrency: "SOL", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "◎", contractSize: 1, minLotSize: 0.01, maxLotSize: 1000 },
  { id: "BNBUSDT", symbol: "BNBUSDT", displayName: "BNB/USDT", description: "BNB", category: "crypto", tradingViewSymbol: "BINANCE:BNBUSDT", binanceSymbol: "BNBUSDT", baseCurrency: "BNB", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "🔶", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "XRPUSDT", symbol: "XRPUSDT", displayName: "XRP/USDT", description: "Ripple", category: "crypto", tradingViewSymbol: "BINANCE:XRPUSDT", binanceSymbol: "XRPUSDT", baseCurrency: "XRP", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "✕", contractSize: 1, minLotSize: 1, maxLotSize: 100000 },
  { id: "DOGEUSDT", symbol: "DOGEUSDT", displayName: "DOGE/USDT", description: "Dogecoin", category: "crypto", tradingViewSymbol: "BINANCE:DOGEUSDT", binanceSymbol: "DOGEUSDT", baseCurrency: "DOGE", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "🐕", contractSize: 1, minLotSize: 1, maxLotSize: 100000 },
  { id: "ADAUSDT", symbol: "ADAUSDT", displayName: "ADA/USDT", description: "Cardano", category: "crypto", tradingViewSymbol: "BINANCE:ADAUSDT", binanceSymbol: "ADAUSDT", baseCurrency: "ADA", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "₳", contractSize: 1, minLotSize: 1, maxLotSize: 100000 },
  { id: "AVAXUSDT", symbol: "AVAXUSDT", displayName: "AVAX/USDT", description: "Avalanche", category: "crypto", tradingViewSymbol: "BINANCE:AVAXUSDT", binanceSymbol: "AVAXUSDT", baseCurrency: "AVAX", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "🔺", contractSize: 1, minLotSize: 0.1, maxLotSize: 10000 },
  { id: "DOTUSDT", symbol: "DOTUSDT", displayName: "DOT/USDT", description: "Polkadot", category: "crypto", tradingViewSymbol: "BINANCE:DOTUSDT", binanceSymbol: "DOTUSDT", baseCurrency: "DOT", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "●", contractSize: 1, minLotSize: 0.1, maxLotSize: 10000 },
  { id: "LINKUSDT", symbol: "LINKUSDT", displayName: "LINK/USDT", description: "Chainlink", category: "crypto", tradingViewSymbol: "BINANCE:LINKUSDT", binanceSymbol: "LINKUSDT", baseCurrency: "LINK", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "⬡", contractSize: 1, minLotSize: 0.1, maxLotSize: 10000 },
  { id: "MATICUSDT", symbol: "MATICUSDT", displayName: "MATIC/USDT", description: "Polygon", category: "crypto", tradingViewSymbol: "BINANCE:MATICUSDT", binanceSymbol: "MATICUSDT", baseCurrency: "MATIC", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "Ⓟ", contractSize: 1, minLotSize: 1, maxLotSize: 100000 },
  { id: "LTCUSDT", symbol: "LTCUSDT", displayName: "LTC/USDT", description: "Litecoin", category: "crypto", tradingViewSymbol: "BINANCE:LTCUSDT", binanceSymbol: "LTCUSDT", baseCurrency: "LTC", quoteCurrency: "USDT", livePriceSupported: true, chartSupported: true, emoji: "Ł", contractSize: 1, minLotSize: 0.01, maxLotSize: 1000 },

  // ── FOREX — TradingView chart only ──────────────────────────────────────
  { id: "EURUSD", symbol: "EURUSD", displayName: "EUR/USD", description: "Euro / US Dollar", category: "forex", tradingViewSymbol: "FX:EURUSD", baseCurrency: "EUR", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "€", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "GBPUSD", symbol: "GBPUSD", displayName: "GBP/USD", description: "Pound / US Dollar", category: "forex", tradingViewSymbol: "FX:GBPUSD", baseCurrency: "GBP", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "£", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "USDJPY", symbol: "USDJPY", displayName: "USD/JPY", description: "Dollar / Yen", category: "forex", tradingViewSymbol: "FX:USDJPY", baseCurrency: "USD", quoteCurrency: "JPY", livePriceSupported: false, chartSupported: true, emoji: "¥", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "USDCHF", symbol: "USDCHF", displayName: "USD/CHF", description: "Dollar / Swiss Franc", category: "forex", tradingViewSymbol: "FX:USDCHF", baseCurrency: "USD", quoteCurrency: "CHF", livePriceSupported: false, chartSupported: true, emoji: "₣", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "USDCAD", symbol: "USDCAD", displayName: "USD/CAD", description: "Dollar / Canadian Dollar", category: "forex", tradingViewSymbol: "FX:USDCAD", baseCurrency: "USD", quoteCurrency: "CAD", livePriceSupported: false, chartSupported: true, emoji: "C$", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "AUDUSD", symbol: "AUDUSD", displayName: "AUD/USD", description: "Australian / US Dollar", category: "forex", tradingViewSymbol: "FX:AUDUSD", baseCurrency: "AUD", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "A$", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "NZDUSD", symbol: "NZDUSD", displayName: "NZD/USD", description: "New Zealand / US Dollar", category: "forex", tradingViewSymbol: "FX:NZDUSD", baseCurrency: "NZD", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "N$", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "EURGBP", symbol: "EURGBP", displayName: "EUR/GBP", description: "Euro / British Pound", category: "forex", tradingViewSymbol: "FX:EURGBP", baseCurrency: "EUR", quoteCurrency: "GBP", livePriceSupported: false, chartSupported: true, emoji: "€£", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "EURJPY", symbol: "EURJPY", displayName: "EUR/JPY", description: "Euro / Yen", category: "forex", tradingViewSymbol: "FX:EURJPY", baseCurrency: "EUR", quoteCurrency: "JPY", livePriceSupported: false, chartSupported: true, emoji: "€¥", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "GBPJPY", symbol: "GBPJPY", displayName: "GBP/JPY", description: "Pound / Yen", category: "forex", tradingViewSymbol: "FX:GBPJPY", baseCurrency: "GBP", quoteCurrency: "JPY", livePriceSupported: false, chartSupported: true, emoji: "£¥", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "AUDJPY", symbol: "AUDJPY", displayName: "AUD/JPY", description: "Australian / Yen", category: "forex", tradingViewSymbol: "FX:AUDJPY", baseCurrency: "AUD", quoteCurrency: "JPY", livePriceSupported: false, chartSupported: true, emoji: "A¥", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },
  { id: "CADJPY", symbol: "CADJPY", displayName: "CAD/JPY", description: "Canadian / Yen", category: "forex", tradingViewSymbol: "FX:CADJPY", baseCurrency: "CAD", quoteCurrency: "JPY", livePriceSupported: false, chartSupported: true, emoji: "C¥", statusLabel: "Chart available", contractSize: 1000, minLotSize: 0.01, maxLotSize: 100 },

  // ── COMMODITIES — TradingView chart only ────────────────────────────────
  { id: "XAUUSD", symbol: "XAUUSD", displayName: "XAU/USD", description: "Gold", category: "commodity", tradingViewSymbol: "OANDA:XAUUSD", baseCurrency: "XAU", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "🥇", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "XAGUSD", symbol: "XAGUSD", displayName: "XAG/USD", description: "Silver", category: "commodity", tradingViewSymbol: "OANDA:XAGUSD", baseCurrency: "XAG", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "🥈", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.1, maxLotSize: 1000 },
  { id: "USOIL", symbol: "USOIL", displayName: "WTI Oil", description: "US Crude Oil", category: "commodity", tradingViewSymbol: "TVC:USOIL", baseCurrency: "OIL", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "🛢", statusLabel: "Chart available", contractSize: 10, minLotSize: 0.1, maxLotSize: 100 },
  { id: "UKOIL", symbol: "UKOIL", displayName: "Brent Oil", description: "UK Crude Oil", category: "commodity", tradingViewSymbol: "TVC:UKOIL", baseCurrency: "OIL", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "🛢", statusLabel: "Chart available", contractSize: 10, minLotSize: 0.1, maxLotSize: 100 },
  { id: "NATGAS", symbol: "NATGAS", displayName: "Nat Gas", description: "Natural Gas", category: "commodity", tradingViewSymbol: "NYMEX:NG1!", baseCurrency: "GAS", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "🔥", statusLabel: "Chart available", contractSize: 10, minLotSize: 0.1, maxLotSize: 100 },

  // ── INDICES — TradingView chart only ────────────────────────────────────
  { id: "US30", symbol: "US30", displayName: "US30", description: "Dow Jones", category: "index", tradingViewSymbol: "TVC:DJI", baseCurrency: "US30", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "🏛", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "SPX500", symbol: "SPX500", displayName: "SPX500", description: "S&P 500", category: "index", tradingViewSymbol: "SP:SPX", baseCurrency: "SPX", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "📊", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "NAS100", symbol: "NAS100", displayName: "NAS100", description: "NASDAQ 100", category: "index", tradingViewSymbol: "NASDAQ:NDX", baseCurrency: "NAS", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "💻", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "DXY", symbol: "DXY", displayName: "DXY", description: "US Dollar Index", category: "index", tradingViewSymbol: "TVC:DXY", baseCurrency: "DXY", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "💵", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "VIX", symbol: "VIX", displayName: "VIX", description: "Volatility Index", category: "index", tradingViewSymbol: "TVC:VIX", baseCurrency: "VIX", quoteCurrency: "USD", livePriceSupported: false, chartSupported: true, emoji: "📉", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "GER40", symbol: "GER40", displayName: "GER40", description: "DAX 40", category: "index", tradingViewSymbol: "XETR:DAX", baseCurrency: "GER", quoteCurrency: "EUR", livePriceSupported: false, chartSupported: true, emoji: "🇩🇪", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "UK100", symbol: "UK100", displayName: "UK100", description: "FTSE 100", category: "index", tradingViewSymbol: "TVC:UKX", baseCurrency: "UK", quoteCurrency: "GBP", livePriceSupported: false, chartSupported: true, emoji: "🇬🇧", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "NIFTY50", symbol: "NIFTY50", displayName: "NIFTY50", description: "Nifty 50", category: "index", tradingViewSymbol: "NSE:NIFTY", baseCurrency: "NIFTY", quoteCurrency: "INR", livePriceSupported: false, chartSupported: true, emoji: "🇮🇳", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
  { id: "BANKNIFTY", symbol: "BANKNIFTY", displayName: "BANKNIFTY", description: "Bank Nifty", category: "index", tradingViewSymbol: "NSE:BANKNIFTY", baseCurrency: "BANKNIFTY", quoteCurrency: "INR", livePriceSupported: false, chartSupported: true, emoji: "🏦", statusLabel: "Chart available", contractSize: 1, minLotSize: 0.01, maxLotSize: 100 },
];

export const TCC_SYMBOL_MAP: Record<string, TCCSymbol> = Object.fromEntries(
  TCC_SYMBOLS.map(s => [s.id, s])
);

export const CRYPTO_SYMBOLS = TCC_SYMBOLS.filter(s => s.category === "crypto");
export const FOREX_SYMBOLS = TCC_SYMBOLS.filter(s => s.category === "forex");
export const COMMODITY_SYMBOLS = TCC_SYMBOLS.filter(s => s.category === "commodity");
export const INDEX_SYMBOLS = TCC_SYMBOLS.filter(s => s.category === "index");
export const LIVE_PRICE_SYMBOLS = TCC_SYMBOLS.filter(s => s.livePriceSupported);
export const BINANCE_STREAM_SYMBOLS: string[] = TCC_SYMBOLS
  .filter(s => s.binanceSymbol)
  .map(s => s.binanceSymbol!);

export function getSymbolById(id: string): TCCSymbol | undefined {
  return TCC_SYMBOL_MAP[id];
}

export function getSymbolsByCategory(category: SymbolCategory): TCCSymbol[] {
  return TCC_SYMBOLS.filter(s => s.category === category);
}
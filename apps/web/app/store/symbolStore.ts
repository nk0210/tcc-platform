import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

export interface Symbol {
  id: string;
  label: string;
  description: string;
  assetClass: "crypto" | "forex" | "commodity" | "index";
  tradingViewSymbol: string;
  binanceSymbol?: string;
  emoji: string;
  category: string;
}

export const SYMBOLS: Symbol[] = [
  // Crypto
  { id: "BTCUSDT", label: "BTC/USDT", description: "Bitcoin", assetClass: "crypto", tradingViewSymbol: "BINANCE:BTCUSDT", binanceSymbol: "BTCUSDT", emoji: "₿", category: "Crypto" },
  { id: "ETHUSDT", label: "ETH/USDT", description: "Ethereum", assetClass: "crypto", tradingViewSymbol: "BINANCE:ETHUSDT", binanceSymbol: "ETHUSDT", emoji: "Ξ", category: "Crypto" },
  { id: "SOLUSDT", label: "SOL/USDT", description: "Solana", assetClass: "crypto", tradingViewSymbol: "BINANCE:SOLUSDT", binanceSymbol: "SOLUSDT", emoji: "◎", category: "Crypto" },
  { id: "BNBUSDT", label: "BNB/USDT", description: "BNB", assetClass: "crypto", tradingViewSymbol: "BINANCE:BNBUSDT", binanceSymbol: "BNBUSDT", emoji: "🔶", category: "Crypto" },
  { id: "XRPUSDT", label: "XRP/USDT", description: "Ripple", assetClass: "crypto", tradingViewSymbol: "BINANCE:XRPUSDT", binanceSymbol: "XRPUSDT", emoji: "✕", category: "Crypto" },
  // Forex
  { id: "EURUSD", label: "EUR/USD", description: "Euro / US Dollar", assetClass: "forex", tradingViewSymbol: "FX:EURUSD", emoji: "€", category: "Forex" },
  { id: "GBPUSD", label: "GBP/USD", description: "Pound / US Dollar", assetClass: "forex", tradingViewSymbol: "FX:GBPUSD", emoji: "£", category: "Forex" },
  { id: "USDJPY", label: "USD/JPY", description: "Dollar / Yen", assetClass: "forex", tradingViewSymbol: "FX:USDJPY", emoji: "¥", category: "Forex" },
  { id: "USDCHF", label: "USD/CHF", description: "Dollar / Swiss Franc", assetClass: "forex", tradingViewSymbol: "FX:USDCHF", emoji: "₣", category: "Forex" },
  { id: "USDCAD", label: "USD/CAD", description: "Dollar / Canadian", assetClass: "forex", tradingViewSymbol: "FX:USDCAD", emoji: "C$", category: "Forex" },
  { id: "AUDUSD", label: "AUD/USD", description: "Australian / US Dollar", assetClass: "forex", tradingViewSymbol: "FX:AUDUSD", emoji: "A$", category: "Forex" },
  { id: "NZDUSD", label: "NZD/USD", description: "New Zealand / US Dollar", assetClass: "forex", tradingViewSymbol: "FX:NZDUSD", emoji: "N$", category: "Forex" },
  { id: "EURGBP", label: "EUR/GBP", description: "Euro / British Pound", assetClass: "forex", tradingViewSymbol: "FX:EURGBP", emoji: "€£", category: "Forex" },
  { id: "EURJPY", label: "EUR/JPY", description: "Euro / Yen", assetClass: "forex", tradingViewSymbol: "FX:EURJPY", emoji: "€¥", category: "Forex" },
  { id: "GBPJPY", label: "GBP/JPY", description: "Pound / Yen", assetClass: "forex", tradingViewSymbol: "FX:GBPJPY", emoji: "£¥", category: "Forex" },
  { id: "AUDJPY", label: "AUD/JPY", description: "Australian / Yen", assetClass: "forex", tradingViewSymbol: "FX:AUDJPY", emoji: "A¥", category: "Forex" },
  { id: "CADJPY", label: "CAD/JPY", description: "Canadian / Yen", assetClass: "forex", tradingViewSymbol: "FX:CADJPY", emoji: "C¥", category: "Forex" },
  // Commodities
  { id: "XAUUSD", label: "XAU/USD", description: "Gold", assetClass: "commodity", tradingViewSymbol: "OANDA:XAUUSD", emoji: "🥇", category: "Commodities" },
  { id: "XAGUSD", label: "XAG/USD", description: "Silver", assetClass: "commodity", tradingViewSymbol: "OANDA:XAGUSD", emoji: "🥈", category: "Commodities" },
  { id: "USOIL", label: "WTI Oil", description: "US Crude Oil", assetClass: "commodity", tradingViewSymbol: "TVC:USOIL", emoji: "🛢", category: "Commodities" },
  { id: "UKOIL", label: "Brent Oil", description: "UK Crude Oil", assetClass: "commodity", tradingViewSymbol: "TVC:UKOIL", emoji: "🛢", category: "Commodities" },
  { id: "NATGAS", label: "Nat Gas", description: "Natural Gas", assetClass: "commodity", tradingViewSymbol: "NYMEX:NG1!", emoji: "🔥", category: "Commodities" },
  // Indices
  { id: "US30", label: "US30", description: "Dow Jones", assetClass: "index", tradingViewSymbol: "TVC:DJI", emoji: "🏛", category: "Indices" },
  { id: "SPX500", label: "SPX500", description: "S&P 500", assetClass: "index", tradingViewSymbol: "SP:SPX", emoji: "📊", category: "Indices" },
  { id: "NAS100", label: "NAS100", description: "NASDAQ 100", assetClass: "index", tradingViewSymbol: "NASDAQ:NDX", emoji: "💻", category: "Indices" },
  { id: "DXY", label: "DXY", description: "US Dollar Index", assetClass: "index", tradingViewSymbol: "TVC:DXY", emoji: "💵", category: "Indices" },
  { id: "VIX", label: "VIX", description: "Volatility Index", assetClass: "index", tradingViewSymbol: "TVC:VIX", emoji: "📉", category: "Indices" },
  { id: "GER40", label: "GER40", description: "DAX 40", assetClass: "index", tradingViewSymbol: "XETR:DAX", emoji: "🇩🇪", category: "Indices" },
  { id: "UK100", label: "UK100", description: "FTSE 100", assetClass: "index", tradingViewSymbol: "TVC:UKX", emoji: "🇬🇧", category: "Indices" },
  { id: "NIFTY50", label: "NIFTY50", description: "Nifty 50", assetClass: "index", tradingViewSymbol: "NSE:NIFTY", emoji: "🇮🇳", category: "Indices" },
  { id: "BANKNIFTY", label: "BANKNIFTY", description: "Bank Nifty", assetClass: "index", tradingViewSymbol: "NSE:BANKNIFTY", emoji: "🏦", category: "Indices" },
];

export const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));

interface SymbolStore {
  activeSymbol: Symbol;
  lastInterval: string;
  setActiveSymbol: (symbol: Symbol) => void;
  setLastInterval: (interval: string) => void;
}

export const useSymbolStore = create<SymbolStore>()(
  persist(
    (set) => ({
      activeSymbol: SYMBOLS[0],
      lastInterval: "60",
      setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
      setLastInterval: (interval) => set({ lastInterval: interval }),
    }),
    {
      name: "symbol",
      storage: createJSONStorage(() => getUserScopedStorage("symbol")),
    }
  )
);
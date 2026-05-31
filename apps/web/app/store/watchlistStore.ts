import { create } from "zustand";

export interface PriceAlert {
  id: string;
  type: "above" | "below";
  price: number;
  triggered: boolean;
  createdAt: Date;
}

export interface WatchlistItem {
  symbol: string;
  label: string;
  category: "crypto" | "forex" | "commodity";
  currentPrice: number;
  change24h: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  alerts: PriceAlert[];
}

const defaultWatchlist: WatchlistItem[] = [
  { symbol: "BTCUSDT", label: "BTC/USDT", category: "crypto", currentPrice: 0, change24h: 0, changePct24h: 0, high24h: 0, low24h: 0, volume24h: 0, alerts: [] },
  { symbol: "ETHUSDT", label: "ETH/USDT", category: "crypto", currentPrice: 0, change24h: 0, changePct24h: 0, high24h: 0, low24h: 0, volume24h: 0, alerts: [] },
  { symbol: "SOLUSDT", label: "SOL/USDT", category: "crypto", currentPrice: 0, change24h: 0, changePct24h: 0, high24h: 0, low24h: 0, volume24h: 0, alerts: [] },
  { symbol: "BNBUSDT", label: "BNB/USDT", category: "crypto", currentPrice: 0, change24h: 0, changePct24h: 0, high24h: 0, low24h: 0, volume24h: 0, alerts: [] },
  { symbol: "XRPUSDT", label: "XRP/USDT", category: "crypto", currentPrice: 0, change24h: 0, changePct24h: 0, high24h: 0, low24h: 0, volume24h: 0, alerts: [] },
];

const availableSymbols = [
  { symbol: "BTCUSDT", label: "BTC/USDT" },
  { symbol: "ETHUSDT", label: "ETH/USDT" },
  { symbol: "SOLUSDT", label: "SOL/USDT" },
  { symbol: "BNBUSDT", label: "BNB/USDT" },
  { symbol: "XRPUSDT", label: "XRP/USDT" },
  { symbol: "DOGEUSDT", label: "DOGE/USDT" },
  { symbol: "ADAUSDT", label: "ADA/USDT" },
  { symbol: "AVAXUSDT", label: "AVAX/USDT" },
  { symbol: "DOTUSDT", label: "DOT/USDT" },
  { symbol: "LINKUSDT", label: "LINK/USDT" },
  { symbol: "MATICUSDT", label: "MATIC/USDT" },
  { symbol: "LTCUSDT", label: "LTC/USDT" },
];

interface WatchlistStore {
  items: WatchlistItem[];
  availableSymbols: { symbol: string; label: string }[];
  updatePrice: (symbol: string, data: Partial<WatchlistItem>) => void;
  addSymbol: (symbol: string, label: string) => void;
  removeSymbol: (symbol: string) => void;
  addAlert: (symbol: string, type: "above" | "below", price: number) => void;
  removeAlert: (symbol: string, alertId: string) => void;
  triggerAlert: (symbol: string, alertId: string) => void;
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  items: defaultWatchlist,
  availableSymbols,

  updatePrice: (symbol, data) =>
    set((state) => ({
      items: state.items.map(item => item.symbol === symbol ? { ...item, ...data } : item),
    })),

  addSymbol: (symbol, label) => {
    if (get().items.find(i => i.symbol === symbol)) return;
    set((state) => ({
      items: [...state.items, { symbol, label, category: "crypto", currentPrice: 0, change24h: 0, changePct24h: 0, high24h: 0, low24h: 0, volume24h: 0, alerts: [] }],
    }));
  },

  removeSymbol: (symbol) =>
    set((state) => ({ items: state.items.filter(i => i.symbol !== symbol) })),

  addAlert: (symbol, type, price) =>
    set((state) => ({
      items: state.items.map(item =>
        item.symbol === symbol ? {
          ...item,
          alerts: [...item.alerts, { id: Date.now().toString(), type, price, triggered: false, createdAt: new Date() }],
        } : item
      ),
    })),

  removeAlert: (symbol, alertId) =>
    set((state) => ({
      items: state.items.map(item =>
        item.symbol === symbol ? { ...item, alerts: item.alerts.filter(a => a.id !== alertId) } : item
      ),
    })),

  triggerAlert: (symbol, alertId) =>
    set((state) => ({
      items: state.items.map(item =>
        item.symbol === symbol ? {
          ...item,
          alerts: item.alerts.map(a => a.id === alertId ? { ...a, triggered: true } : a),
        } : item
      ),
    })),
}));
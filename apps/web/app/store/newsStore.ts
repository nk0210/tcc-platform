import { create } from "zustand";

export type NewsImpact = "LOW" | "MEDIUM" | "HIGH";
export type NewsCategory = "forex" | "crypto" | "commodity" | "stocks" | "macro";
export type EventStatus = "upcoming" | "live" | "released";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: NewsCategory;
  asset: string;
  sentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number;
  timestamp: Date;
  url: string;
  aiExplanation: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  countryFlag: string;
  impact: NewsImpact;
  category: string;
  scheduledAt: Date;
  status: EventStatus;
  forecast?: string;
  previous?: string;
  actual?: string;
  aiExplanation: string;
  affectedAssets: string[];
}

const now = new Date();
const today = (h: number, m: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);

const mockNews: NewsItem[] = [
  {
    id: "n1",
    title: "Gold surges to 3-month high as dollar weakens on Fed dovish signals",
    summary: "XAUUSD climbed above $2,380 as Federal Reserve officials signaled a potential rate cut timeline, weakening the US dollar index significantly.",
    source: "Reuters",
    category: "commodity",
    asset: "XAUUSD",
    sentiment: "bullish",
    sentimentScore: 78,
    timestamp: new Date(Date.now() - 3600000),
    url: "#",
    aiExplanation: "Weak dollar directly boosts gold prices since gold is priced in USD. Fed rate cut expectations reduce the opportunity cost of holding non-yielding gold, creating strong bullish pressure.",
  },
  {
    id: "n2",
    title: "Bitcoin consolidates near $77k ahead of US CPI data release",
    summary: "BTC/USD remains range-bound between $76,000 and $78,500 as traders await the crucial US Consumer Price Index data that could dictate Fed policy direction.",
    source: "CoinDesk",
    category: "crypto",
    asset: "BTCUSDT",
    sentiment: "neutral",
    sentimentScore: 50,
    timestamp: new Date(Date.now() - 7200000),
    url: "#",
    aiExplanation: "Crypto markets are risk assets sensitive to macro data. High CPI = more rate hikes = dollar strength = risk-off = BTC sell pressure. Low CPI = rate cut hopes = risk-on = BTC rally.",
  },
  {
    id: "n3",
    title: "EURUSD falls as ECB minutes reveal divided stance on rate cuts",
    summary: "The Euro weakened against the dollar after ECB meeting minutes showed policymakers were split on the timing of interest rate reductions in 2026.",
    source: "FX Street",
    category: "forex",
    asset: "EURUSD",
    sentiment: "bearish",
    sentimentScore: 28,
    timestamp: new Date(Date.now() - 10800000),
    url: "#",
    aiExplanation: "ECB division on rate cuts creates policy uncertainty, which weighs on EUR. If the ECB cuts before the Fed, the interest rate differential favors USD, pushing EURUSD lower.",
  },
  {
    id: "n4",
    title: "Oil prices drop 2% on surprise inventory build reported by EIA",
    summary: "Crude oil prices fell sharply after the Energy Information Administration reported a larger-than-expected build in US crude inventories, signaling weak demand.",
    source: "Bloomberg",
    category: "commodity",
    asset: "USOIL",
    sentiment: "bearish",
    sentimentScore: 22,
    timestamp: new Date(Date.now() - 14400000),
    url: "#",
    aiExplanation: "Higher-than-expected oil inventories signal that supply is exceeding demand. This bearish signal typically triggers immediate selling pressure in crude oil markets.",
  },
  {
    id: "n5",
    title: "UK GDP growth beats expectations, GBP/USD rises to 2-week high",
    summary: "Britain's economy grew 0.4% in the latest quarter, exceeding the 0.2% forecast, boosting the British Pound and reducing expectations for near-term BOE rate cuts.",
    source: "FT",
    category: "forex",
    asset: "GBPUSD",
    sentiment: "bullish",
    sentimentScore: 72,
    timestamp: new Date(Date.now() - 18000000),
    url: "#",
    aiExplanation: "Strong GDP growth reduces the urgency for BOE to cut rates. Higher rates = stronger currency. Positive surprise vs forecast amplifies the bullish GBP reaction.",
  },
  {
    id: "n6",
    title: "Ethereum ETF sees record inflows of $280M in a single day",
    summary: "Spot Ethereum ETFs recorded their highest single-day inflows since launch, suggesting growing institutional interest in the second-largest cryptocurrency.",
    source: "CoinTelegraph",
    category: "crypto",
    asset: "ETHUSDT",
    sentiment: "bullish",
    sentimentScore: 81,
    timestamp: new Date(Date.now() - 21600000),
    url: "#",
    aiExplanation: "ETF inflows represent real institutional buying pressure. When ETFs accumulate, they must purchase the underlying asset, creating consistent buy pressure that tends to support price.",
  },
];

const mockCalendarEvents: CalendarEvent[] = [
  {
    id: "e1",
    title: "US Consumer Price Index (CPI)",
    country: "United States",
    countryFlag: "🇺🇸",
    impact: "HIGH",
    category: "Inflation",
    scheduledAt: today(14, 30),
    status: "upcoming",
    forecast: "3.2%",
    previous: "3.4%",
    aiExplanation: "CPI is the most watched inflation indicator. Higher than forecast = Fed keeps rates high longer = USD bullish, Gold/stocks bearish. Lower than forecast = rate cut hopes = USD bearish, Gold bullish.",
    affectedAssets: ["XAUUSD", "EURUSD", "GBPUSD", "BTCUSDT", "SPX500"],
  },
  {
    id: "e2",
    title: "Federal Reserve Chair Speech",
    country: "United States",
    countryFlag: "🇺🇸",
    impact: "HIGH",
    category: "Central Bank",
    scheduledAt: today(16, 0),
    status: "upcoming",
    aiExplanation: "Fed Chair speeches can move all markets simultaneously. Hawkish tone (rate hikes) = USD up, Gold/stocks down. Dovish tone (rate cuts) = USD down, Gold/stocks up. Watch for key phrases.",
    affectedAssets: ["XAUUSD", "EURUSD", "GBPUSD", "BTCUSDT", "USDJPY"],
  },
  {
    id: "e3",
    title: "EIA Crude Oil Inventories",
    country: "United States",
    countryFlag: "🇺🇸",
    impact: "MEDIUM",
    category: "Energy",
    scheduledAt: today(15, 30),
    status: "upcoming",
    forecast: "-1.2M",
    previous: "+2.3M",
    aiExplanation: "Weekly oil stock data measures supply-demand balance. Draw (negative) = bullish oil. Build (positive) = bearish oil. Larger-than-expected moves create stronger price reactions.",
    affectedAssets: ["USOIL", "USDCAD", "XAUUSD"],
  },
  {
    id: "e4",
    title: "UK Employment Change",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    impact: "MEDIUM",
    category: "Employment",
    scheduledAt: today(9, 0),
    status: "released",
    forecast: "45K",
    previous: "38K",
    actual: "52K",
    aiExplanation: "Strong employment = economy healthy = BOE less likely to cut rates = GBP bullish. The actual beat forecast here suggests BOE may maintain rates longer, supporting GBP.",
    affectedAssets: ["GBPUSD", "GBPJPY", "EURGBP"],
  },
  {
    id: "e5",
    title: "ECB Interest Rate Decision",
    country: "European Union",
    countryFlag: "🇪🇺",
    impact: "HIGH",
    category: "Central Bank",
    scheduledAt: new Date(now.getTime() + 86400000 * 2),
    status: "upcoming",
    forecast: "3.75%",
    previous: "4.00%",
    aiExplanation: "ECB rate decisions directly impact EUR pairs. If ECB cuts as expected, the EUR may sell off as traders buy the rumor and sell the news. Surprise hold would cause sharp EUR rally.",
    affectedAssets: ["EURUSD", "EURGBP", "EURJPY", "XAUUSD"],
  },
  {
    id: "e6",
    title: "US Non-Farm Payrolls (NFP)",
    country: "United States",
    countryFlag: "🇺🇸",
    impact: "HIGH",
    category: "Employment",
    scheduledAt: new Date(now.getTime() + 86400000 * 5),
    status: "upcoming",
    forecast: "185K",
    previous: "175K",
    aiExplanation: "NFP is the most volatile monthly event. Strong jobs = Fed delays cuts = USD bullish. Weak jobs = Fed cuts sooner = USD bearish. The first Friday of each month — avoid trading 30 min before.",
    affectedAssets: ["XAUUSD", "EURUSD", "GBPUSD", "BTCUSDT", "SPX500", "USDJPY"],
  },
  {
    id: "e7",
    title: "Bank of Japan Policy Rate",
    country: "Japan",
    countryFlag: "🇯🇵",
    impact: "HIGH",
    category: "Central Bank",
    scheduledAt: new Date(now.getTime() + 86400000 * 3),
    status: "upcoming",
    forecast: "0.25%",
    previous: "0.10%",
    aiExplanation: "BOJ rate hikes are rare and have massive impact on JPY pairs. If BOJ hikes, expect sharp JPY strengthening (USDJPY drop). Surprise decisions create the largest moves.",
    affectedAssets: ["USDJPY", "EURJPY", "GBPJPY", "XAUUSD"],
  },
  {
    id: "e8",
    title: "Canada GDP (Monthly)",
    country: "Canada",
    countryFlag: "🇨🇦",
    impact: "LOW",
    category: "GDP",
    scheduledAt: today(13, 30),
    status: "released",
    forecast: "0.2%",
    previous: "0.1%",
    actual: "0.2%",
    aiExplanation: "In-line GDP print has limited market impact. As expected = minimal reaction. CAD pairs and oil correlations remain the primary movers for Canadian data.",
    affectedAssets: ["USDCAD", "USOIL"],
  },
];

interface NewsStore {
  news: NewsItem[];
  calendarEvents: CalendarEvent[];
  selectedAssetFilter: string;
  setAssetFilter: (asset: string) => void;
}

export const useNewsStore = create<NewsStore>((set) => ({
  news: mockNews,
  calendarEvents: mockCalendarEvents,
  selectedAssetFilter: "ALL",
  setAssetFilter: (asset) => set({ selectedAssetFilter: asset }),
}));
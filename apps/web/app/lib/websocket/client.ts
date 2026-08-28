/**
 * TCC WebSocket Client — Phase Alpha
 * Connects to the API's /ws endpoint and dispatches incoming messages to the
 * relevant Zustand stores. A module-level singleton — safe to call connect()
 * multiple times (no-ops if already open/connecting).
 */
import { getAccessToken }  from "@/lib/api/client";
import { useTradeStore }   from "@/store/tradeStore";
import { useNotificationStore, type NotificationType, type NotificationPriority } from "@/store/notificationStore";
import { recalcAccount }   from "@/lib/trading/calculations";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS     = 3000;
const AUTH_ERROR_RETRY_MS    = 5000;

// ── Module-level connection state ───────────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manuallyClosed = false;

function wsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(delayMs: number): void {
  if (manuallyClosed) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  clearReconnectTimer();

  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delayMs);
}

// ── Public API ───────────────────────────────────────────────────────────

export function connect(): void {
  if (typeof window === "undefined") return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  manuallyClosed = false;

  try {
    ws = new WebSocket(wsUrl());
  } catch (err) {
    console.error("[ws] failed to open connection:", err);
    scheduleReconnect(RECONNECT_DELAY_MS);
    return;
  }

  ws.onopen = () => {
    const token = getAccessToken();
    if (token) send({ type: "AUTHENTICATE", payload: { token } });
  };

  ws.onmessage = (event) => {
    let message: unknown;
    try {
      message = JSON.parse(event.data as string);
    } catch {
      return;
    }
    handleMessage(message);
  };

  ws.onerror = () => {
    // onclose fires immediately after — reconnect handled there.
  };

  ws.onclose = () => {
    ws = null;
    if (manuallyClosed) return;
    scheduleReconnect(RECONNECT_DELAY_MS);
  };
}

export function disconnect(): void {
  manuallyClosed = true;
  clearReconnectTimer();
  reconnectAttempts = 0;

  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}

export function send(message: object): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(message));
  } catch (err) {
    console.error("[ws] send() failed:", err);
  }
}

export function subscribeToSymbols(symbols: string[]): void {
  send({ type: "SUBSCRIBE_PRICES", payload: { symbols } });
}

export function unsubscribeFromSymbols(symbols: string[]): void {
  send({ type: "UNSUBSCRIBE_PRICES", payload: { symbols } });
}

export function subscribeToRoom(room: string): void {
  send({ type: "SUBSCRIBE_ROOM", payload: { room } });
}

// ── Incoming message dispatch ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleMessage(raw: any): void {
  if (!raw || typeof raw.type !== "string") return;

  switch (raw.type) {
    case "AUTHENTICATED": {
      reconnectAttempts = 0;
      const userId = raw.payload?.userId as string | undefined;
      if (userId) subscribeToRoom(`notifications:${userId}`);
      break;
    }

    case "AUTH_ERROR": {
      console.error("[ws] auth error:", raw.payload?.message);
      scheduleReconnect(AUTH_ERROR_RETRY_MS);
      break;
    }

    case "PRICE_UPDATE": {
      const { symbol, price } = raw.payload ?? {};
      if (typeof symbol === "string" && typeof price === "number") {
        useTradeStore.getState().updatePrices(symbol, price);
      }
      break;
    }

    case "TRADE_CLOSED": {
      const { tradeId, newBalance } = raw.payload ?? {};
      if (typeof tradeId === "string" && typeof newBalance === "number") {
        useTradeStore.setState((s) => {
          const positions = s.positions.filter((p) => p.id !== tradeId);
          return { positions, balance: newBalance, ...recalcAccount(positions, newBalance) };
        });
      }
      break;
    }

    case "NOTIFICATION": {
      const payload = raw.payload ?? {};
      useNotificationStore.getState().addNotification({
        id:          payload.id,
        type:        String(payload.type ?? "system").toLowerCase() as NotificationType,
        priority:    String(payload.priority ?? "low").toLowerCase() as NotificationPriority,
        title:       payload.title ?? "",
        message:     payload.message ?? "",
        actionLabel: payload.actionLabel ?? null,
        actionPath:  payload.actionPath  ?? null,
        createdAt:   payload.createdAt,
      });
      break;
    }

    case "PONG":
    case "ERROR":
    default:
      break;
  }
}

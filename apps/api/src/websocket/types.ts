/**
 * WebSocket Message Types
 * All client↔server WebSocket traffic is typed as discriminated unions on `type`.
 */
import type { WebSocket } from "ws";

// ── Client → Server ──────────────────────────────────────────────────────

export type ClientMessage =
  | { type: "AUTHENTICATE";       payload: { token: string } }
  | { type: "SUBSCRIBE_PRICES";   payload: { symbols: string[] } }
  | { type: "UNSUBSCRIBE_PRICES"; payload: { symbols: string[] } }
  | { type: "SUBSCRIBE_ROOM";     payload: { room: string } }
  | { type: "UNSUBSCRIBE_ROOM";   payload: { room: string } }
  | { type: "PING" };

// ── Server → Client ───────────────────────────────────────────────────────

export type ServerMessage =
  | { type: "AUTHENTICATED";         payload: { userId: string; handle: string } }
  | { type: "AUTH_ERROR";            payload: { message: string } }
  | { type: "PRICE_UPDATE";          payload: { symbol: string; price: number; change24h: number; changePercent24h: number; timestamp: number } }
  | { type: "POSITION_UPDATE";       payload: { positionId: string; currentPrice: number; floatingPnl: number; equity: number; balance: number } }
  | { type: "NOTIFICATION";          payload: { id: string; type: string; priority: string; title: string; message: string; actionLabel?: string | null; actionPath?: string | null; createdAt: string } }
  | { type: "TRADE_CLOSED";          payload: { tradeId: string; netPnl: number; result: string; newBalance: number } }
  | { type: "COMMUNITY_NEW_POST";    payload: { post: Record<string, unknown> } }
  | { type: "COMMUNITY_NEW_COMMENT"; payload: { comment: Record<string, unknown>; postId: string } }
  | { type: "COMMUNITY_LIKE";        payload: { postId: string; likeCount: number } }
  | { type: "DM_MESSAGE";            payload: { conversationId: string; message: Record<string, unknown> } }
  | { type: "PONG" }
  | { type: "ERROR";                 payload: { message: string; code: string } };

// ── Authenticated connection state ──────────────────────────────────────

export interface AuthenticatedClient {
  ws:                 WebSocket;
  userId:             string;
  handle:             string;
  roles:              string[];
  subscribedSymbols:  Set<string>;
  rooms:              Set<string>;
  isAlive:            boolean;
}

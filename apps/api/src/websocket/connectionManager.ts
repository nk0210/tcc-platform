/**
 * Connection Manager
 * Singleton registry of all active authenticated WebSocket connections.
 * Plain module with named exports — not a class — so the single Map instance
 * is shared by every importer (module state is a singleton in Node's module cache).
 */
import { WebSocket } from "ws";
import type { AuthenticatedClient, ServerMessage } from "./types";

// key = userId — one active connection per user.
const connections = new Map<string, AuthenticatedClient>();

// ── Connection registry ──────────────────────────────────────────────────

export function addConnection(userId: string, client: AuthenticatedClient): void {
  connections.set(userId, client);
}

export function removeConnection(userId: string): void {
  connections.delete(userId);
}

// ── Sending ───────────────────────────────────────────────────────────────

export function send(userId: string, message: ServerMessage): void {
  const client = connections.get(userId);
  if (!client) return;

  if (client.ws.readyState !== WebSocket.OPEN) return;

  try {
    client.ws.send(JSON.stringify(message));
  } catch (err) {
    console.error(`[WebSocket] send() failed for user ${userId}:`, err);
  }
}

export function broadcastToSubscribers(symbol: string, message: ServerMessage): void {
  // Serialize once per broadcast, not once per matching client — with N
  // symbols ticking every TICK_MS and M subscribed clients, re-stringifying
  // per client turns an O(N) payload into O(N×M) JSON work for no reason.
  let payload: string | null = null;
  for (const client of connections.values()) {
    if (!client.subscribedSymbols.has(symbol)) continue;
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    try {
      payload ??= JSON.stringify(message);
      client.ws.send(payload);
    } catch (err) {
      console.error(`[WebSocket] broadcastToSubscribers("${symbol}") failed for a client:`, err);
    }
  }
}

// ── Heartbeat ─────────────────────────────────────────────────────────────

export function startHeartbeat(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    for (const [userId, client] of connections.entries()) {
      if (!client.isAlive) {
        removeConnection(userId);
        client.ws.terminate();
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }, 30000);
}

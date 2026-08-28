/**
 * WebSocket Server
 * Main setup — ties the connection manager, message handler, and price
 * simulator together onto a single /ws upgrade path.
 */
import type { Server } from "http";
import { WebSocketServer } from "ws";
import { handleMessage } from "./messageHandler";
import { addConnection, removeConnection, startHeartbeat } from "./connectionManager";
import { startPriceSimulator, stopPriceSimulator } from "./priceSimulator";
import type { AuthenticatedClient } from "./types";

const AUTH_TIMEOUT_MS = 10000;

export function createWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    let authenticatedClient: AuthenticatedClient | null = null;

    const authTimeout = setTimeout(() => {
      if (!authenticatedClient) {
        ws.send(JSON.stringify({ type: "AUTH_ERROR", payload: { message: "Authentication timeout" } }));
        ws.close();
      }
    }, AUTH_TIMEOUT_MS);

    ws.on("message", (data) => {
      void handleMessage(ws, data, authenticatedClient, (client) => {
        authenticatedClient = client;
        addConnection(client.userId, client);
        clearTimeout(authTimeout);
      });
    });

    ws.on("pong", () => {
      if (authenticatedClient) authenticatedClient.isAlive = true;
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (authenticatedClient) removeConnection(authenticatedClient.userId);
    });

    ws.on("error", (err) => {
      console.error("[WebSocket] connection error:", err.message);
      if (authenticatedClient) removeConnection(authenticatedClient.userId);
    });
  });

  startHeartbeat();
  startPriceSimulator();

  process.on("SIGTERM", stopPriceSimulator);
  process.on("SIGINT", stopPriceSimulator);

  return wss;
}

/**
 * Message Handler
 * Processes raw incoming WebSocket messages: authentication, subscriptions,
 * room membership, and ping/pong.
 */
import type { WebSocket, RawData } from "ws";
import { verifyAccessToken } from "../lib/jwt";
import db from "../lib/prisma";
import type { AuthenticatedClient, ClientMessage, ServerMessage } from "./types";

const MAX_SUBSCRIBED_SYMBOLS = 20;

function sendMessage(ws: WebSocket, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

function isRoomAllowed(room: string, userId: string): boolean {
  if (room === "community") return true;
  return room === `notifications:${userId}`;
}

export async function handleMessage(
  ws: WebSocket,
  rawData: RawData,
  existingClient: AuthenticatedClient | null,
  onAuthenticated: (client: AuthenticatedClient) => void
): Promise<void> {
  let parsed: ClientMessage;

  try {
    parsed = JSON.parse(rawData.toString()) as ClientMessage;
  } catch {
    sendMessage(ws, { type: "ERROR", payload: { message: "Invalid JSON", code: "PARSE_ERROR" } });
    return;
  }

  switch (parsed.type) {
    case "AUTHENTICATE": {
      let payload;
      try {
        payload = verifyAccessToken(parsed.payload.token);
      } catch {
        sendMessage(ws, { type: "AUTH_ERROR", payload: { message: "Invalid or expired token" } });
        return;
      }

      const user = await db.user.findUnique({
        where:  { id: payload.sub },
        select: { id: true, handle: true, roles: true, isActive: true, isSuspended: true, status: true },
      });

      if (
        !user ||
        !user.isActive ||
        user.isSuspended ||
        user.status === "BANNED" ||
        user.status === "DEACTIVATED"
      ) {
        sendMessage(ws, { type: "AUTH_ERROR", payload: { message: "Invalid or expired token" } });
        return;
      }

      const client: AuthenticatedClient = {
        ws,
        userId:            user.id,
        handle:            user.handle,
        roles:             user.roles as string[],
        subscribedSymbols: new Set(),
        rooms:             new Set(),
        isAlive:           true,
      };

      onAuthenticated(client);
      sendMessage(ws, { type: "AUTHENTICATED", payload: { userId: user.id, handle: user.handle } });
      return;
    }

    case "SUBSCRIBE_PRICES": {
      if (!existingClient) {
        sendMessage(ws, { type: "AUTH_ERROR", payload: { message: "Not authenticated" } });
        return;
      }

      for (const symbol of parsed.payload.symbols) {
        existingClient.subscribedSymbols.add(symbol);
      }

      if (existingClient.subscribedSymbols.size > MAX_SUBSCRIBED_SYMBOLS) {
        const trimmed = Array.from(existingClient.subscribedSymbols).slice(0, MAX_SUBSCRIBED_SYMBOLS);
        existingClient.subscribedSymbols = new Set(trimmed);
      }
      return;
    }

    case "UNSUBSCRIBE_PRICES": {
      if (!existingClient) return;

      for (const symbol of parsed.payload.symbols) {
        existingClient.subscribedSymbols.delete(symbol);
      }
      return;
    }

    case "SUBSCRIBE_ROOM": {
      if (!existingClient) {
        sendMessage(ws, { type: "AUTH_ERROR", payload: { message: "Not authenticated" } });
        return;
      }

      if (isRoomAllowed(parsed.payload.room, existingClient.userId)) {
        existingClient.rooms.add(parsed.payload.room);
      }
      return;
    }

    case "UNSUBSCRIBE_ROOM": {
      if (!existingClient) return;

      existingClient.rooms.delete(parsed.payload.room);
      return;
    }

    case "PING": {
      sendMessage(ws, { type: "PONG" });
      return;
    }

    default: {
      sendMessage(ws, { type: "ERROR", payload: { message: "Unknown message type", code: "UNKNOWN_TYPE" } });
      return;
    }
  }
}

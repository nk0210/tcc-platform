import "dotenv/config";
import http                      from "http";
import { createApp }             from "./app";
import { createWebSocketServer } from "./websocket";
import { getEnv }                from "./config/env";
import db                        from "./lib/prisma";
import { warmPermissionCache }   from "./server/permissions/permissionService";

async function bootstrap() {
  const env = getEnv();
  const app = createApp();

  try {
    await db.$connect();
    console.log("✅  Database connected");
  } catch (err) {
    console.error("❌  Database connection failed:", err);
    process.exit(1);
  }

  try {
    await warmPermissionCache();
  } catch (err) {
    console.warn("⚠️  Permission cache failed (will retry on first request):", err);
  }

  const port = parseInt(env.PORT, 10);
  const server = http.createServer(app);
  createWebSocketServer(server);
  server.listen(port, () => {
    console.log(`🚀  TCC API → http://localhost:${port} [${env.NODE_ENV}]`);
    console.log(`🔌  WebSocket → ws://localhost:${port}/ws`);
  });

  process.on("SIGTERM", async () => { server.close(); await db.$disconnect(); process.exit(0); });
  process.on("SIGINT",  async () => { server.close(); await db.$disconnect(); process.exit(0); });
}

bootstrap().catch((err) => { console.error("❌ Fatal:", err); process.exit(1); });

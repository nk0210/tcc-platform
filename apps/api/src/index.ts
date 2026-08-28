import "dotenv/config";
import express      from "express";
import cors         from "cors";
import helmet       from "helmet";
import rateLimit    from "express-rate-limit";
import http                      from "http";
import { createWebSocketServer } from "./websocket";
import { getEnv }                from "./config/env";
import routes                    from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import db                        from "./lib/prisma";
import { warmPermissionCache }   from "./server/permissions/permissionService";

async function bootstrap() {
  const env = getEnv();
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true, methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
  const authLim = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
  app.use(limiter);
  app.use("/api/auth/login",    authLim);
  app.use("/api/auth/register", authLim);

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.set("trust proxy", 1);

  app.use("/api", routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

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
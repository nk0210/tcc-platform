import "dotenv/config";
import express from "express";
import cors    from "cors";
import helmet  from "helmet";
import rateLimit from "express-rate-limit";

import { getEnv }             from "./config/env";
import routes                  from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import db                      from "./lib/prisma";
import { warmPermissionCache } from "./server/permissions/permissionService";

async function bootstrap() {
  const env = getEnv();
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  app.use(cors({
    origin:      env.CORS_ORIGIN,
    credentials: true,
    methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      500,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMIT" },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      20,
    message: { success: false, error: "Too many auth attempts. Please wait 15 minutes.", code: "AUTH_RATE_LIMIT" },
  });

  app.use(globalLimiter);
  app.use("/api/auth/login",    authLimiter);
  app.use("/api/auth/register", authLimiter);

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
    console.error("⚠️  Permission cache failed to warm (will retry on first request):", err);
  }

  const port = parseInt(env.PORT);
  app.listen(port, () => {
    console.log(`🚀  TCC API running on http://localhost:${port}`);
    console.log(`📍  Environment: ${env.NODE_ENV}`);
    console.log(`🌐  CORS origin: ${env.CORS_ORIGIN}`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n⚡  Received ${signal}. Shutting down gracefully...`);
    await db.$disconnect();
    console.log("👋  Database disconnected. Goodbye.");
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("❌  Fatal bootstrap error:", err);
  process.exit(1);
});
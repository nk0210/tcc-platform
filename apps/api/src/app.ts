/**
 * Express app factory — separated from index.ts's bootstrap() so tests can
 * build a real app instance (middleware + routes + error handlers) without
 * connecting to the DB, warming caches, or binding a port. bootstrap()
 * still does all of that for the real server; this is just the pure,
 * synchronous "assemble the app" part.
 */
import express, { type Express } from "express";
import cors      from "cors";
import helmet    from "helmet";
import rateLimit from "express-rate-limit";
import { getEnv } from "./config/env";
import routes      from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp(): Express {
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

  return app;
}

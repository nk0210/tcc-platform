import { Router } from "express";
import authRouter      from "./auth";
import usersRouter     from "./users";
import tradeRouter     from "./trade";
import journalRouter   from "./journal";
import watchlistRouter from "./watchlist";
import analyticsRouter from "./analytics";
import ownerRouter     from "./owner";

const router = Router();

router.use("/auth",      authRouter);
router.use("/users",     usersRouter);
router.use("/trade",     tradeRouter);
router.use("/journal",   journalRouter);
router.use("/watchlist", watchlistRouter);
router.use("/analytics", analyticsRouter);
router.use("/owner",     ownerRouter);

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status:    "ok",
      version:   "alpha-2.0",
      timestamp: new Date().toISOString(),
      modules: ["auth", "users", "trade", "journal", "watchlist", "analytics", "owner"],
    },
  });
});

export default router;
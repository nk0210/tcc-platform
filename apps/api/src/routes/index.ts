import { Router }       from "express";
import authRouter        from "./auth";
import tradeRouter       from "./trade";
import journalRouter     from "./journal";
import watchlistRouter   from "./watchlist";
import analyticsRouter   from "./analytics";
import ownerRouter       from "./owner";
import communityRouter   from "./community";       // ← NEW Day 3
import strategyRouter    from "./strategy";        // ← NEW Day 4
import academyRouter     from "./academy";         // ← NEW Day 4
import profileRouter      from "./profile";         // ← NEW Day 5
import copyTradingRouter  from "./copyTrading";     // ← NEW Day 5
import notificationsRouter from "./notifications";  // ← NEW Day 6
import riskRouter          from "./risk";           // ← NEW Day 7
import copilotRouter       from "./copilot";        // ← NEW Day 7

const router: ReturnType<typeof Router> = Router();

router.use("/auth",          authRouter);
router.use("/trade",         tradeRouter);
router.use("/journal",       journalRouter);
router.use("/watchlist",     watchlistRouter);
router.use("/analytics",     analyticsRouter);
router.use("/owner",         ownerRouter);
router.use("/community",     communityRouter);      // ← NEW Day 3
router.use("/strategy",      strategyRouter);       // ← NEW Day 4
router.use("/academy",       academyRouter);        // ← NEW Day 4
router.use("/profile",       profileRouter);        // ← NEW Day 5
router.use("/copy-trading",  copyTradingRouter);    // ← NEW Day 5
router.use("/notifications", notificationsRouter);  // ← NEW Day 6
router.use("/risk",          riskRouter);           // ← NEW Day 7
router.use("/copilot",       copilotRouter);        // ← NEW Day 7

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status:    "ok",
      version:   "alpha-7.0",
      timestamp: new Date().toISOString(),
      modules:   ["auth","trade","journal","watchlist","analytics","owner","community","strategy","academy","profile","copy-trading","notifications","websocket","risk","copilot"],
    },
  });
});

export default router;
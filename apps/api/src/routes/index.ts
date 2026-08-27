import { Router }       from "express";
import authRouter        from "./auth";
import usersRouter       from "./user";
import tradeRouter       from "./trade";
import journalRouter     from "./journal";
import watchlistRouter   from "./watchlist";
import analyticsRouter   from "./analytics";
import ownerRouter       from "./owner";
import communityRouter   from "./community";       // ← NEW Day 3
import strategyRouter    from "./strategy";        // ← NEW Day 4
import academyRouter     from "./academy";         // ← NEW Day 4
import profileRouter     from "./profile";         // ← NEW Day 5
import copyTradingRouter from "./copyTrading";     // ← NEW Day 5

const router: ReturnType<typeof Router> = Router();

router.use("/auth",         authRouter);
router.use("/users",        usersRouter);
router.use("/trade",        tradeRouter);
router.use("/journal",      journalRouter);
router.use("/watchlist",    watchlistRouter);
router.use("/analytics",    analyticsRouter);
router.use("/owner",        ownerRouter);
router.use("/community",    communityRouter);      // ← NEW Day 3
router.use("/strategy",     strategyRouter);       // ← NEW Day 4
router.use("/academy",      academyRouter);        // ← NEW Day 4
router.use("/profile",      profileRouter);        // ← NEW Day 5
router.use("/copy-trading", copyTradingRouter);    // ← NEW Day 5

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status:    "ok",
      version:   "alpha-5.0",
      timestamp: new Date().toISOString(),
      modules:   ["auth","users","trade","journal","watchlist","analytics","owner","community","strategy","academy","profile","copy-trading"],
    },
  });
});

export default router;
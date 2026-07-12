import { Router } from "express";
import authRouter    from "./auth";
import usersRouter    from "./users";
import tradesRouter   from "./trades";
import journalRouter  from "./journal";
import ownerRouter    from "./owner";

const router = Router();

router.use("/auth",    authRouter);
router.use("/users",   usersRouter);
router.use("/trades",  tradesRouter);
router.use("/journal", journalRouter);
router.use("/owner",   ownerRouter);

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: { status: "ok", version: "alpha-1.1", timestamp: new Date().toISOString() },
  });
});

export default router;
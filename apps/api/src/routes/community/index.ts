/**
 * Community Router — root aggregation.
 * Mounted at /api/community in routes/index.ts.
 *
 * Sub-router mount strategy:
 *  - postsRouter  → /posts        (handles /posts/* paths)
 *  - commentsRouter → /comments   (handles /comments/* paths)
 *  - followRouter → /             (handles /follow/*, /followers, /following, /users/:handle/posts)
 */
import { Router } from "express";
import postsRouter    from "./posts";
import commentsRouter from "./comments";
import followRouter   from "./follow";

const router: ReturnType<typeof Router> = Router();

router.use("/posts",    postsRouter);
router.use("/comments", commentsRouter);
router.use("/",         followRouter);

export default router;
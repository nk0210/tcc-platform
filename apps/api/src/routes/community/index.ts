/**
 * Community Router — root aggregation.
 * Mounted at /api/community in routes/index.ts.
 *
 * Sub-router mount strategy:
 *  - postsRouter     → /posts        (handles /posts/* paths)
 *  - commentsRouter   → /comments     (handles /comments/* paths)
 *  - searchRouter      → /search
 *  - groupsRouter       → /groups
 *  - storiesRouter       → /stories
 *  - messagesRouter        → /messages
 *  - followRouter → /             (handles /follow/*, /followers, /following, /users/:handle/posts)
 *  - relationsRouter → /          (handles /block/*, /blocked, /mute/*, /muted)
 */
import { Router } from "express";
import postsRouter     from "./posts";
import commentsRouter  from "./comments";
import followRouter    from "./follow";
import searchRouter    from "./search";
import relationsRouter from "./relations";
import groupsRouter    from "./groups";
import storiesRouter   from "./stories";
import messagesRouter  from "./messages";

const router: ReturnType<typeof Router> = Router();

router.use("/posts",    postsRouter);
router.use("/comments", commentsRouter);
router.use("/search",   searchRouter);
router.use("/groups",   groupsRouter);
router.use("/stories",  storiesRouter);
router.use("/messages", messagesRouter);
router.use("/",         relationsRouter);
router.use("/",         followRouter);

export default router;

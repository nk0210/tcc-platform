/**
 * Story Routes
 * Mounted at: /community/stories
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, type AuthRequest } from "../../middleware/authenticate";
import { validate }  from "../../middleware/validate";
import { storyService, StoryNotFoundError, NotStoryAuthorError } from "../../server/services/storyService";
import { ok, created, notFound, forbidden, internalError } from "../../lib/response";

const router: ReturnType<typeof Router> = Router();

const CreateStorySchema = z.object({
  content:  z.string().max(500).default(""),
  imageUrl: z.string().url().max(500).optional().nullable(),
}).refine((v) => v.content.trim().length > 0 || !!v.imageUrl, {
  message: "A story needs either text or an image",
});

function handleStoryError(err: unknown, res: import("express").Response): boolean {
  if (err instanceof StoryNotFoundError)  { notFound(res, "Story not found"); return true; }
  if (err instanceof NotStoryAuthorError) { forbidden(res, "You don't own this story"); return true; }
  return false;
}

// ── GET /stories/feed ─ Active stories from me + who I follow, grouped ────

router.get("/feed", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const feed = await storyService.getStoryFeed(authReq.userId);
    ok(res, { groups: feed });
  } catch (err) {
    console.error("[community/stories GET /feed]", err);
    internalError(res);
  }
});

// ── GET /stories/mine ─ My own active stories ──────────────────────────────

router.get("/mine", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const items = await storyService.getMyStories(authReq.userId);
    ok(res, { items });
  } catch (err) {
    console.error("[community/stories GET /mine]", err);
    internalError(res);
  }
});

// ── POST /stories ─ Create a story ──────────────────────────────────────

router.post("/", authenticate, validate(CreateStorySchema), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const body    = req.body as z.infer<typeof CreateStorySchema>;
  try {
    const story = await storyService.createStory(authReq.userId, body);
    created(res, story, "Story posted");
  } catch (err) {
    console.error("[community/stories POST /]", err);
    internalError(res);
  }
});

// ── DELETE /stories/:storyId ─ Delete own story ───────────────────────────

router.delete("/:storyId", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    await storyService.deleteStory(req.params.storyId, authReq.userId);
    ok(res, { deleted: true }, "Story deleted");
  } catch (err) {
    if (handleStoryError(err, res)) return;
    console.error("[community/stories DELETE /:storyId]", err);
    internalError(res);
  }
});

// ── POST /stories/:storyId/view ─ Mark viewed ─────────────────────────────

router.post("/:storyId/view", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const result = await storyService.viewStory(req.params.storyId, authReq.userId);
    ok(res, result);
  } catch (err) {
    if (handleStoryError(err, res)) return;
    console.error("[community/stories POST /:storyId/view]", err);
    internalError(res);
  }
});

// ── GET /stories/:storyId/viewers ─ Who viewed my story (author only) ────

router.get("/:storyId/viewers", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const items = await storyService.getViewers(req.params.storyId, authReq.userId);
    ok(res, { items });
  } catch (err) {
    if (handleStoryError(err, res)) return;
    console.error("[community/stories GET /:storyId/viewers]", err);
    internalError(res);
  }
});

export default router;

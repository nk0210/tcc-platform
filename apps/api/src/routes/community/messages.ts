/**
 * Direct Message Routes
 * Mounted at: /community/messages
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, type AuthRequest } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import {
  directMessageService,
  UserNotFoundError, CannotMessageSelfError, BlockedError,
  ConversationNotFoundError, NotParticipantError,
} from "../../server/services/directMessageService";
import { ok, created, notFound, badRequest, forbidden, internalError } from "../../lib/response";

const router: ReturnType<typeof Router> = Router();

const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(30),
});

const StartConversationSchema = z.object({ handle: z.string().min(1).max(50) });
const SendMessageSchema = z.object({ content: z.string().min(1, "Message cannot be empty").max(2000) });

function handleDmError(err: unknown, res: import("express").Response): boolean {
  if (err instanceof UserNotFoundError)         { notFound(res, "User not found"); return true; }
  if (err instanceof ConversationNotFoundError) { notFound(res, "Conversation not found"); return true; }
  if (err instanceof CannotMessageSelfError)    { badRequest(res, "You cannot message yourself"); return true; }
  if (err instanceof BlockedError)              { forbidden(res, "You can't message this user"); return true; }
  if (err instanceof NotParticipantError)       { forbidden(res, "You're not part of this conversation"); return true; }
  return false;
}

// ── GET /messages ─ My conversations, most recent first ────────────────────

router.get("/", authenticate, validate(PaginationSchema, "query"), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const query   = req.query as unknown as z.infer<typeof PaginationSchema>;
  try {
    const result = await directMessageService.listConversations(authReq.userId, query.page, query.pageSize);
    ok(res, result);
  } catch (err) {
    console.error("[community/messages GET /]", err);
    internalError(res);
  }
});

// ── GET /messages/unread-count ──────────────────────────────────────────

router.get("/unread-count", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const count = await directMessageService.getTotalUnreadCount(authReq.userId);
    ok(res, { count });
  } catch (err) {
    console.error("[community/messages GET /unread-count]", err);
    internalError(res);
  }
});

// ── POST /messages/start ─ Get-or-create a conversation with @handle ─────

router.post("/start", authenticate, validate(StartConversationSchema), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const body    = req.body as z.infer<typeof StartConversationSchema>;
  try {
    const conversation = await directMessageService.startConversationByHandle(authReq.userId, body.handle);
    created(res, conversation, "Conversation ready");
  } catch (err) {
    if (handleDmError(err, res)) return;
    console.error("[community/messages POST /start]", err);
    internalError(res);
  }
});

// ── GET /messages/:conversationId ─ Messages in a conversation ───────────

router.get("/:conversationId", authenticate, validate(PaginationSchema, "query"), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const query   = req.query as unknown as z.infer<typeof PaginationSchema>;
  try {
    const result = await directMessageService.getMessages(req.params.conversationId, authReq.userId, query.page, query.pageSize);
    ok(res, result);
  } catch (err) {
    if (handleDmError(err, res)) return;
    console.error("[community/messages GET /:conversationId]", err);
    internalError(res);
  }
});

// ── POST /messages/:conversationId ─ Send a message ───────────────────────

router.post("/:conversationId", authenticate, validate(SendMessageSchema), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const body    = req.body as z.infer<typeof SendMessageSchema>;
  try {
    const message = await directMessageService.sendMessage(req.params.conversationId, authReq.userId, body.content);
    created(res, message, "Message sent");
  } catch (err) {
    if (handleDmError(err, res)) return;
    console.error("[community/messages POST /:conversationId]", err);
    internalError(res);
  }
});

export default router;

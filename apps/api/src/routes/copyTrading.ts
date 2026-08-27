/**
 * Copy Trading Routes
 * Mounted at: /copy-trading
 *
 * Covers: public master discovery, the master-trader application flow,
 *         follower copy-relationship management, copy trade history, and
 *         admin application/master moderation.
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../middleware/authenticate";
import { requirePermission }                    from "../middleware/requirePermission";
import { validate }                             from "../middleware/validate";
import { copyTradingService }                   from "../server/services/copyTradingService";
import { ok, created, notFound, badRequest, forbidden, conflict, internalError } from "../lib/response";

const router: ReturnType<typeof Router> = Router();

// ── Shared enums ──────────────────────────────────────────────────────────

const APPLICATION_STATUSES = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "MORE_INFO_REQUIRED", "SUSPENDED",
] as const;
const COPY_LOT_MODES = ["FIXED_LOT", "RISK_MULTIPLIER", "EQUITY_RATIO"] as const;

// ── Schemas ────────────────────────────────────────────────────────────────

function parseCsv(v?: string): string[] | undefined {
  if (!v) return undefined;
  const list = v.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const MastersFeedSchema = PaginationSchema.extend({
  marketsTraded:  z.string().optional(),
  strategiesUsed: z.string().optional(),
});

const AdminApplicationsSchema = PaginationSchema.extend({
  status: z.enum(APPLICATION_STATUSES).optional(),
});

const ApplicationUpdateSchema = z.object({
  marketsTraded:                     z.array(z.string().max(50)).max(20).optional(),
  strategiesUsed:                    z.array(z.string().max(50)).max(20).optional(),
  experienceSummary:                 z.string().max(3000).optional(),
  riskManagementSummary:              z.string().max(3000).optional(),
  reasonForApplying:                 z.string().max(3000).optional(),
  hasAcceptedRiskDisclosure:         z.boolean().optional(),
  hasAcceptedPerformanceTruthPolicy: z.boolean().optional(),
  hasAcceptedCopyTradingTerms:       z.boolean().optional(),
});

const RiskSettingsSchema = z.object({
  maxRiskPerTradePercent:  z.number().min(0).max(100).optional(),
  maxDailyLossPercent:     z.number().min(0).max(100).optional(),
  maxTotalDrawdownPercent: z.number().min(0).max(100).optional(),
  maxOpenCopiedTrades:     z.number().int().min(1).max(50).optional(),
  copyLotMode:             z.enum(COPY_LOT_MODES).optional(),
  fixedLotSize:            z.number().min(0.01).optional(),
  riskMultiplier:          z.number().min(0).optional(),
  maxSlippagePoints:       z.number().min(0).optional(),
  requireStopLoss:         z.boolean().optional(),
  newsFilterEnabled:       z.boolean().optional(),
});

const StartCopyingSchema = z.object({
  masterTraderId: z.string().min(1),
  riskSettings:   RiskSettingsSchema.optional(),
});

const StopSchema           = z.object({ stopReason: z.string().max(500).optional() });
const RejectSchema         = z.object({ reason: z.string().min(1).max(1000) });
const MoreInfoSchema       = z.object({ message: z.string().min(1).max(1000) });
const SuspendRemoveSchema  = z.object({ reason: z.string().max(1000).optional() });

function actorFrom(authReq: AuthRequest) {
  return { actorId: authReq.userId, actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" };
}

// ── GET /copy-trading/masters ─ List active masters ─────────────────────────

router.get(
  "/masters",
  optionalAuthenticate,
  validate(MastersFeedSchema, "query"),
  async (req, res) => {
    const query = req.query as unknown as z.infer<typeof MastersFeedSchema>;

    try {
      const feed = await copyTradingService.getAllMasters({
        page:           query.page,
        pageSize:       query.pageSize,
        marketsTraded:  parseCsv(query.marketsTraded),
        strategiesUsed: parseCsv(query.strategiesUsed),
      });
      ok(res, feed);
    } catch (err) {
      console.error("[copy-trading GET /masters]", err);
      internalError(res);
    }
  }
);

// ── GET /copy-trading/masters/:masterId ─ Get master profile ────────────────

router.get(
  "/masters/:masterId",
  optionalAuthenticate,
  async (req, res) => {
    try {
      ok(res, await copyTradingService.getMaster(req.params.masterId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "MASTER_NOT_FOUND") {
        notFound(res, "Master trader not found");
        return;
      }
      console.error("[copy-trading GET /masters/:masterId]", err);
      internalError(res);
    }
  }
);

// ── GET /copy-trading/masters/:masterId/followers ─ Master's followers ──────

router.get(
  "/masters/:masterId/followers",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await copyTradingService.getMasterFollowers(authReq.userId, req.params.masterId, query));
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "MASTER_NOT_FOUND")   { notFound(res, "Master trader not found");                       return; }
        if (err.message === "NOT_MASTER_OWNER")   { forbidden(res, "Only the master trader can view their followers"); return; }
      }
      console.error("[copy-trading GET /masters/:masterId/followers]", err);
      internalError(res);
    }
  }
);

// ── GET /copy-trading/application ─ Get my application ──────────────────────

router.get(
  "/application",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await copyTradingService.getMyApplication(authReq.userId));
    } catch (err) {
      console.error("[copy-trading GET /application]", err);
      internalError(res);
    }
  }
);

// ── POST /copy-trading/application ─ Create application ─────────────────────

router.post(
  "/application",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      created(res, await copyTradingService.createApplication(authReq.userId), "Application created");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "APPLICATION_ALREADY_EXISTS") {
        conflict(res, "You already have a master trader application");
        return;
      }
      console.error("[copy-trading POST /application]", err);
      internalError(res);
    }
  }
);

// ── PUT /copy-trading/application ─ Update application (DRAFT only) ─────────

router.put(
  "/application",
  authenticate,
  validate(ApplicationUpdateSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof ApplicationUpdateSchema>;

    try {
      ok(res, await copyTradingService.updateApplication(authReq.userId, body), "Application updated");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "APPLICATION_NOT_FOUND")    { notFound(res, "Application not found");                          return; }
        if (err.message === "APPLICATION_NOT_EDITABLE") { badRequest(res, "Only draft applications can be edited");        return; }
      }
      console.error("[copy-trading PUT /application]", err);
      internalError(res);
    }
  }
);

// ── POST /copy-trading/application/submit ─ Submit application ──────────────

router.post(
  "/application/submit",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await copyTradingService.submitApplication(authReq.userId), "Application submitted");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "APPLICATION_NOT_FOUND")    { notFound(res, "Application not found");                          return; }
        if (err.message === "APPLICATION_NOT_EDITABLE") { badRequest(res, "Only draft applications can be submitted");     return; }
        if (err.message === "APPLICATION_INCOMPLETE")   { badRequest(res, "Fill in all required fields and accept all policies before submitting"); return; }
      }
      console.error("[copy-trading POST /application/submit]", err);
      internalError(res);
    }
  }
);

// ── GET /copy-trading/relationships ─ My active copy relationships ──────────

router.get(
  "/relationships",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await copyTradingService.getMyRelationships(authReq.userId, query));
    } catch (err) {
      console.error("[copy-trading GET /relationships]", err);
      internalError(res);
    }
  }
);

// ── POST /copy-trading/relationships ─ Start copying a master ───────────────

router.post(
  "/relationships",
  authenticate,
  validate(StartCopyingSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof StartCopyingSchema>;

    try {
      const relationship = await copyTradingService.startCopying(authReq.userId, body.masterTraderId, body.riskSettings);
      created(res, relationship, "Now copying this master trader");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "MASTER_NOT_FOUND")    { notFound(res, "Master trader not found");                    return; }
        if (err.message === "MASTER_NOT_ACTIVE")   { badRequest(res, "This master trader is not currently active"); return; }
        if (err.message === "ALREADY_COPYING")     { conflict(res, "You are already copying this master trader");  return; }
      }
      console.error("[copy-trading POST /relationships]", err);
      internalError(res);
    }
  }
);

// ── PUT /copy-trading/relationships/:id/risk ─ Update risk settings ────────

router.put(
  "/relationships/:id/risk",
  authenticate,
  validate(RiskSettingsSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof RiskSettingsSchema>;

    try {
      ok(res, await copyTradingService.updateRiskSettings(authReq.userId, req.params.id, body), "Risk settings updated");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "RELATIONSHIP_NOT_FOUND")     { notFound(res, "Copy relationship not found");                     return; }
        if (err.message === "NOT_RELATIONSHIP_OWNER")      { forbidden(res, "You can only edit your own copy relationships"); return; }
      }
      console.error("[copy-trading PUT /relationships/:id/risk]", err);
      internalError(res);
    }
  }
);

// ── POST /copy-trading/relationships/:id/pause ─ Pause copying ──────────────

router.post(
  "/relationships/:id/pause",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await copyTradingService.pauseCopying(authReq.userId, req.params.id), "Copying paused");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "RELATIONSHIP_NOT_FOUND")    { notFound(res, "Copy relationship not found");                     return; }
        if (err.message === "NOT_RELATIONSHIP_OWNER")     { forbidden(res, "You can only pause your own copy relationships"); return; }
        if (err.message === "RELATIONSHIP_NOT_ACTIVE")    { badRequest(res, "This relationship is not currently active");    return; }
      }
      console.error("[copy-trading POST /relationships/:id/pause]", err);
      internalError(res);
    }
  }
);

// ── POST /copy-trading/relationships/:id/resume ─ Resume copying ────────────

router.post(
  "/relationships/:id/resume",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await copyTradingService.resumeCopying(authReq.userId, req.params.id), "Copying resumed");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "RELATIONSHIP_NOT_FOUND")    { notFound(res, "Copy relationship not found");                      return; }
        if (err.message === "NOT_RELATIONSHIP_OWNER")     { forbidden(res, "You can only resume your own copy relationships"); return; }
        if (err.message === "RELATIONSHIP_NOT_PAUSED")    { badRequest(res, "This relationship is not currently paused");     return; }
      }
      console.error("[copy-trading POST /relationships/:id/resume]", err);
      internalError(res);
    }
  }
);

// ── POST /copy-trading/relationships/:id/stop ─ Stop copying ────────────────

router.post(
  "/relationships/:id/stop",
  authenticate,
  validate(StopSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof StopSchema>;

    try {
      ok(res, await copyTradingService.stopCopying(authReq.userId, req.params.id, body.stopReason), "Copying stopped");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "RELATIONSHIP_NOT_FOUND")        { notFound(res, "Copy relationship not found");                    return; }
        if (err.message === "NOT_RELATIONSHIP_OWNER")         { forbidden(res, "You can only stop your own copy relationships"); return; }
        if (err.message === "RELATIONSHIP_ALREADY_STOPPED")   { badRequest(res, "This relationship is already stopped");        return; }
      }
      console.error("[copy-trading POST /relationships/:id/stop]", err);
      internalError(res);
    }
  }
);

// ── GET /copy-trading/history ─ Copy trade history ───────────────────────────

router.get(
  "/history",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await copyTradingService.getCopyHistory({ followerUserId: authReq.userId, page: query.page, pageSize: query.pageSize }));
    } catch (err) {
      console.error("[copy-trading GET /history]", err);
      internalError(res);
    }
  }
);

// ── Admin: applications ──────────────────────────────────────────────────

router.get(
  "/admin/applications",
  authenticate,
  requirePermission("copy_trading.application.review"),
  validate(AdminApplicationsSchema, "query"),
  async (req, res) => {
    const query = req.query as unknown as z.infer<typeof AdminApplicationsSchema>;

    try {
      ok(res, await copyTradingService.getAllApplications(query));
    } catch (err) {
      console.error("[copy-trading GET /admin/applications]", err);
      internalError(res);
    }
  }
);

router.post(
  "/admin/applications/:id/review",
  authenticate,
  requirePermission("copy_trading.application.review"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await copyTradingService.reviewApplication(req.params.id, actorFrom(authReq)), "Application marked under review");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "APPLICATION_NOT_FOUND")        { notFound(res, "Application not found");                       return; }
        if (err.message === "APPLICATION_INVALID_STATUS")   { badRequest(res, "Only submitted applications can be reviewed"); return; }
      }
      console.error("[copy-trading POST /admin/applications/:id/review]", err);
      internalError(res);
    }
  }
);

router.post(
  "/admin/applications/:id/approve",
  authenticate,
  requirePermission("copy_trading.application.approve"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      created(res, await copyTradingService.approveApplication(req.params.id, actorFrom(authReq)), "Application approved");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "APPLICATION_NOT_FOUND")        { notFound(res, "Application not found");                                    return; }
        if (err.message === "APPLICATION_INVALID_STATUS")   { badRequest(res, "Only submitted or under-review applications can be approved"); return; }
      }
      console.error("[copy-trading POST /admin/applications/:id/approve]", err);
      internalError(res);
    }
  }
);

router.post(
  "/admin/applications/:id/reject",
  authenticate,
  requirePermission("copy_trading.application.reject"),
  validate(RejectSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof RejectSchema>;

    try {
      ok(res, await copyTradingService.rejectApplication(req.params.id, actorFrom(authReq), body.reason), "Application rejected");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "APPLICATION_NOT_FOUND")        { notFound(res, "Application not found");                                    return; }
        if (err.message === "APPLICATION_INVALID_STATUS")   { badRequest(res, "Only submitted or under-review applications can be rejected"); return; }
      }
      console.error("[copy-trading POST /admin/applications/:id/reject]", err);
      internalError(res);
    }
  }
);

router.post(
  "/admin/applications/:id/more-info",
  authenticate,
  requirePermission("copy_trading.application.review"),
  validate(MoreInfoSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof MoreInfoSchema>;

    try {
      ok(res, await copyTradingService.requestMoreInfo(req.params.id, actorFrom(authReq), body.message), "More information requested");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "APPLICATION_NOT_FOUND")        { notFound(res, "Application not found");                                       return; }
        if (err.message === "APPLICATION_INVALID_STATUS")   { badRequest(res, "Only submitted or under-review applications can need more info"); return; }
      }
      console.error("[copy-trading POST /admin/applications/:id/more-info]", err);
      internalError(res);
    }
  }
);

// ── Admin: masters ────────────────────────────────────────────────────────

router.post(
  "/admin/masters/:masterId/suspend",
  authenticate,
  requirePermission("copy_trading.master.suspend"),
  validate(SuspendRemoveSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof SuspendRemoveSchema>;

    try {
      ok(res, await copyTradingService.suspendMaster(req.params.masterId, actorFrom(authReq), body.reason), "Master trader suspended");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "MASTER_NOT_FOUND") {
        notFound(res, "Master trader not found");
        return;
      }
      console.error("[copy-trading POST /admin/masters/:masterId/suspend]", err);
      internalError(res);
    }
  }
);

router.post(
  "/admin/masters/:masterId/remove",
  authenticate,
  requirePermission("copy_trading.master.remove"),
  validate(SuspendRemoveSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof SuspendRemoveSchema>;

    try {
      ok(res, await copyTradingService.removeMaster(req.params.masterId, actorFrom(authReq), body.reason), "Master trader removed");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "MASTER_NOT_FOUND") {
        notFound(res, "Master trader not found");
        return;
      }
      console.error("[copy-trading POST /admin/masters/:masterId/remove]", err);
      internalError(res);
    }
  }
);

export default router;

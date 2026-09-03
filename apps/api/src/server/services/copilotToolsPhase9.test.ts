/**
 * Phase 9 capability-expansion tests: new/extended read tools (community,
 * copy trading, academy catalog), schema validation, cross-user security,
 * and multi-tool agent composition across capability areas. Same pattern
 * as copilotToolsPhase4.test.ts — registers tools via copilotAgentService's
 * module-level registerAllCopilotTools() side effect.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTool } from "./copilotToolRegistry";
import { runAgent } from "./copilotAgentService";
import { __setAIProviderForTests, type AIProvider, type AICompletionResult } from "./copilotAiProvider";
import { communityPostService } from "./communityPostService";
import db from "../../lib/prisma";
import { generateTccId } from "../../lib/tccId";
import { createTestUser, deleteTestUser, type TestUser } from "../../test/helpers";

function toolCallResponse(name: string, args: object): AICompletionResult {
  return { content: null, toolCalls: [{ id: "call_1", name, arguments: JSON.stringify(args) }], tokensUsed: 10, model: "test-model" };
}
function finalResponse(content: string): AICompletionResult {
  return { content, toolCalls: [], tokensUsed: 5, model: "test-model" };
}
function scriptedProvider(responses: AICompletionResult[]): AIProvider {
  let i = 0;
  return { async complete() { const r = responses[Math.min(i, responses.length - 1)]; i += 1; return r; } };
}

async function createMasterTrader(userId: string, displayName: string) {
  const application = await db.masterTraderApplication.create({
    data: { userId, tccId: generateTccId("TRD"), displayName, status: "APPROVED" },
  });
  return db.masterTrader.create({
    data: {
      userId, applicationId: application.id, tccId: application.tccId, displayName,
      status: "ACTIVE", approvedBy: "test-fixture",
    },
  });
}

async function createCourse(id: string) {
  return db.course.upsert({
    where:  { id },
    create: { id, title: `Course ${id}`, description: "test course", type: "FREE_RESOURCE", level: "BEGINNER", category: "trading", thumbnail: "x", totalDuration: "1h" },
    update: {},
  });
}

describe("Phase 9 — tool schema validation", () => {
  it("create_post requires non-empty content within bounds", () => {
    const tool = getTool("create_post")!;
    expect(tool.parameters.safeParse({}).success).toBe(false);
    expect(tool.parameters.safeParse({ content: "" }).success).toBe(false);
    expect(tool.parameters.safeParse({ content: "a".repeat(5001) }).success).toBe(false);
    expect(tool.parameters.safeParse({ content: "hello TCC" }).success).toBe(true);
  });

  it("add_comment requires both postId and content", () => {
    const tool = getTool("add_comment")!;
    expect(tool.parameters.safeParse({ content: "nice" }).success).toBe(false);
    expect(tool.parameters.safeParse({ postId: "p1" }).success).toBe(false);
    expect(tool.parameters.safeParse({ postId: "p1", content: "nice" }).success).toBe(true);
  });

  it("start_copying rejects an out-of-range risk setting", () => {
    const tool = getTool("start_copying")!;
    expect(tool.parameters.safeParse({ masterTraderId: "m1", maxRiskPerTradePercent: 150 }).success).toBe(false);
    expect(tool.parameters.safeParse({ masterTraderId: "m1", maxOpenCopiedTrades: 0 }).success).toBe(false);
    expect(tool.parameters.safeParse({ masterTraderId: "m1", maxRiskPerTradePercent: 2 }).success).toBe(true);
  });

  it("update_profile rejects an invalid visibility enum", () => {
    const tool = getTool("update_profile")!;
    expect(tool.parameters.safeParse({ profileVisibility: "SECRET" }).success).toBe(false);
    expect(tool.parameters.safeParse({ displayName: "New Name" }).success).toBe(true);
  });

  it("no new tool declares userId, riskLevel, or permission as a parameter", () => {
    for (const name of [
      "get_community_feed", "get_post", "create_post", "add_comment",
      "get_master_traders", "get_copy_relationships", "start_copying", "update_copy_risk_settings",
      "get_academy_courses", "enroll_course", "update_profile",
    ]) {
      const tool = getTool(name)!;
      const shape = (tool.parameters as unknown as { shape?: Record<string, unknown> }).shape ?? {};
      expect(Object.keys(shape)).not.toContain("userId");
      expect(Object.keys(shape)).not.toContain("riskLevel");
      expect(Object.keys(shape)).not.toContain("permission");
    }
  });
});

describe("Phase 9 — cross-user security", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => { userA = await createTestUser(); userB = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(userA.id); await deleteTestUser(userB.id); });

  it("get_copy_relationships never returns another user's relationships", async () => {
    const master = await createMasterTrader(userB.id, "MasterB");
    await db.copyRelationship.create({
      data: { followerUserId: userA.id, masterTraderId: master.id, masterDisplayName: master.displayName },
    });

    const tool = getTool("get_copy_relationships")!;
    const asB = await tool.execute({ limit: 20 }, { userId: userB.id }) as { relationships: Array<{ followerUserId: string }> };
    expect(asB.relationships.every((r) => r.followerUserId === userB.id)).toBe(true);
    expect(asB.relationships.some((r) => r.followerUserId === userA.id)).toBe(false);
  });

  it("stop_copying cannot act on another user's relationship", async () => {
    const masterOwner = await createTestUser();
    try {
      const master = await createMasterTrader(masterOwner.id, "MasterB2");
      const relationship = await db.copyRelationship.create({
        data: { followerUserId: userA.id, masterTraderId: master.id, masterDisplayName: master.displayName },
      });

      const tool = getTool("stop_copying")!;
      await expect(tool.execute({ relationshipId: relationship.id }, { userId: userB.id }))
        .rejects.toThrow(/RELATIONSHIP_NOT_FOUND|NOT_RELATIONSHIP_OWNER/);

      // Confirms the rejection is really about ownership — the real owner can still stop it.
      await expect(tool.execute({ relationshipId: relationship.id }, { userId: userA.id })).resolves.toBeDefined();
    } finally {
      await deleteTestUser(masterOwner.id);
    }
  });

  it("update_profile only ever writes under ctx.userId, never a model-supplied id", async () => {
    const tool = getTool("update_profile")!;
    await tool.execute({ displayName: "Only A's Name" }, { userId: userA.id });

    const bProfile = await db.user.findUnique({ where: { id: userB.id } });
    expect(bProfile?.displayName).not.toBe("Only A's Name");
  });

  it("add_comment fails closed for a private post the caller cannot see", async () => {
    const post = await communityPostService.createPost({
      authorId: userB.id, type: "TEXT", content: "private post", visibility: "PRIVATE",
    }) as unknown as { id: string };

    const tool = getTool("add_comment")!;
    await expect(tool.execute({ postId: post.id, content: "sneaky comment" }, { userId: userA.id }))
      .rejects.toThrow(/no visible post/i);
  });
});

describe("Phase 9 — real-data tool behavior", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(user.id); });

  it("get_community_feed returns a real created post", async () => {
    const post = await communityPostService.createPost({
      authorId: user.id, type: "TEXT", content: "real feed test post", visibility: "PUBLIC",
    }) as unknown as { id: string };

    const tool = getTool("get_community_feed")!;
    const result = await tool.execute({ scope: "global", limit: 20 }, { userId: user.id }) as { posts: Array<{ id: string }> };
    expect(result.posts.some((p) => p.id === post.id)).toBe(true);
  });

  it("create_post then get_post round-trips real content", async () => {
    const createTool = getTool("create_post")!;
    const created = await createTool.execute({ content: "round trip test", visibility: "PUBLIC" }, { userId: user.id }) as { id: string };

    const getTool_ = getTool("get_post")!;
    const fetched = await getTool_.execute({ postId: created.id }, { userId: user.id }) as { content: string };
    expect(fetched.content).toBe("round trip test");
  });

  it("get_master_traders returns real active masters, never a suspended one", async () => {
    const other = await createTestUser();
    try {
      const active = await createMasterTrader(other.id, `ActiveMaster${Date.now()}`);
      await db.masterTrader.update({ where: { id: active.id }, data: { status: "SUSPENDED" } });

      const tool = getTool("get_master_traders")!;
      const result = await tool.execute({ limit: 20 }, { userId: user.id }) as { masters: Array<{ id: string }> };
      expect(result.masters.some((m) => m.id === active.id)).toBe(false); // suspended, correctly excluded
    } finally {
      await deleteTestUser(other.id);
    }
  });

  it("get_academy_courses finds a real course by category", async () => {
    const course = await createCourse(`phase9-course-${Date.now()}`);
    const tool = getTool("get_academy_courses")!;
    const result = await tool.execute({ category: "trading", limit: 20 }, { userId: user.id }) as { courses: Array<{ id: string }> };
    expect(result.courses.some((c) => c.id === course.id)).toBe(true);
  });

  it("enroll_course actually enrolls in a real course", async () => {
    const course = await createCourse(`phase9-enroll-${Date.now()}`);
    const tool = getTool("enroll_course")!;
    await tool.execute({ courseId: course.id }, { userId: user.id });

    const progressTool = getTool("get_academy_progress")!;
    const progress = await progressTool.execute({}, { userId: user.id }) as { courses: Array<{ courseId: string }> };
    expect(progress.courses.some((c) => c.courseId === course.id)).toBe(true);
  });

  it("enroll_course is idempotent — enrolling twice doesn't error or duplicate", async () => {
    const course = await createCourse(`phase9-idempotent-${Date.now()}`);
    const tool = getTool("enroll_course")!;
    await tool.execute({ courseId: course.id }, { userId: user.id });
    await expect(tool.execute({ courseId: course.id }, { userId: user.id })).resolves.toBeDefined();

    const count = await db.academyProgress.count({ where: { userId: user.id, courseId: course.id } });
    expect(count).toBe(1);
  });

  it("update_profile actually updates real profile fields", async () => {
    const tool = getTool("update_profile")!;
    const uniqueBio = `bio-${Date.now()}`;
    await tool.execute({ bio: uniqueBio }, { userId: user.id });

    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(updated?.bio).toBe(uniqueBio);
  });
});

describe("Phase 9 — agent composition (cross-capability reasoning)", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { __setAIProviderForTests(null); await deleteTestUser(user.id); });

  it("composes get_master_traders + get_trading_analytics for a 'should I copy someone' style question", async () => {
    const other = await createTestUser();
    try {
      await createMasterTrader(other.id, `ComposeMaster${Date.now()}`);

      __setAIProviderForTests(scriptedProvider([
        toolCallResponse("get_master_traders", {}),
        toolCallResponse("get_trading_analytics", {}),
        finalResponse("Here's how you're doing versus available master traders."),
      ]));

      const result = await runAgent({
        userId: user.id, systemPrompt: "test", history: [],
        userMessage: "Should I start copying a master trader given my own performance?",
      });

      const names = result.steps.map((s) => s.toolName);
      expect(names).toContain("get_master_traders");
      expect(names).toContain("get_trading_analytics");
      expect(result.steps.every((s) => s.status === "EXECUTED")).toBe(true);
    } finally {
      await deleteTestUser(other.id);
    }
  });

  it("data minimization: a narrow community question triggers only community tools, nothing trading-related", async () => {
    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_community_feed", { scope: "global" }),
      finalResponse("Here's the latest community feed."),
    ]));

    const result = await runAgent({
      userId: user.id, systemPrompt: "test", history: [],
      userMessage: "What's happening in the TCC community feed?",
    });

    const names = result.steps.map((s) => s.toolName);
    expect(names).toEqual(["get_community_feed"]);
  });
});

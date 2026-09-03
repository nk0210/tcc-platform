/**
 * Copilot Memory Tools — Phase 7
 *
 * These exist for the agent to use when the user's request isn't the clean,
 * explicit "remember that .../forget that ..." instruction copilotService.ts
 * already intercepts before the agent loop ever runs (see
 * copilotMemoryClassifier.detectExplicitMemoryCommand()). That deterministic
 * path covers unambiguous explicit commands directly; these tools cover
 * everything else memory-related that can come up in conversation:
 *   - the user asking what Copilot remembers about them (get_memories)
 *   - the model noticing something worth remembering on its own — an
 *     INFERENCE, not something the user stated outright (propose_memory)
 *   - a "forget" request the deterministic path couldn't resolve
 *     unambiguously (delete_memory)
 *
 * get_memories is LOW risk (read-only). propose_memory and delete_memory
 * are MEDIUM risk — same confirmation flow as every other data-modifying
 * tool (add_watchlist_item, etc.) — because unlike the explicit command
 * path, these represent the MODEL deciding to write, which always needs a
 * human's explicit go-ahead (Phase 7 spec, "Memory Proposal").
 */
import { z } from "zod";
import { getMemoriesForAgent, createProposedMemory, deleteMemory } from "../copilotMemoryService";
import { optionalNullable, nullableJsonSchema } from "./zodHelpers";
import type { ToolDefinition } from "../copilotToolRegistry";

const MEMORY_TYPES = ["PREFERENCE", "GOAL", "TRADING_PREFERENCE", "COPILOT_PREFERENCE", "EXPLICIT_FACT"] as const;

const GetMemoriesArgs = z.object({
  type: optionalNullable(z.enum(MEMORY_TYPES)),
});

const getMemories: ToolDefinition<z.infer<typeof GetMemoriesArgs>> = {
  name: "get_memories",
  description:
    "Get things this trader has previously asked Copilot to remember about them (preferences, goals, facts). " +
    "Use this before answering a question about what you know about the user, and before proposing a new " +
    "memory with propose_memory, so you don't suggest saving something already saved.",
  parameters: GetMemoriesArgs,
  jsonSchema: {
    type: "object",
    properties: {
      type: nullableJsonSchema({
        type: "string",
        enum: [...MEMORY_TYPES],
        description: "Optional: only return memories of this category.",
      }),
    },
    required: [],
    additionalProperties: false,
  },
  riskLevel: "LOW",
  capability: "memory",
  readOnly:  true,
  async execute(args, ctx) {
    const memories = await getMemoriesForAgent(ctx.userId, args.type, 20);
    return { memories: memories.map((m) => ({ id: m.id, type: m.type, content: m.content })) };
  },
};

const ProposeMemoryArgs = z.object({
  type:    z.enum(MEMORY_TYPES),
  content: z.string().min(3).max(300),
});

const proposeMemory: ToolDefinition<z.infer<typeof ProposeMemoryArgs>> = {
  name: "propose_memory",
  description:
    "Propose saving something you've INFERRED about this trader from the conversation — not something they " +
    "explicitly told you to remember (that's handled automatically). Only use this for a genuinely useful " +
    "preference, goal, or fact you noticed; never for a behavioral or psychological conclusion about the " +
    "trader (e.g. never propose something like \"is a high-risk trader\" or \"is emotionally unstable\"). " +
    "Requires the user's confirmation before anything is saved.",
  parameters: ProposeMemoryArgs,
  jsonSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: [...MEMORY_TYPES],
        description:
          "PREFERENCE (general), GOAL, TRADING_PREFERENCE, COPILOT_PREFERENCE (how Copilot should respond), or EXPLICIT_FACT.",
      },
      content: { type: "string", description: "The specific thing to remember, in a short, plain sentence." },
    },
    required: ["type", "content"],
    additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "memory",
  readOnly:  false,
  describeAction: (args) => `Remember that ${args.content}?`,
  describeResult: (result) =>
    (result as { rejected?: boolean; reason?: string }).rejected
      ? `I couldn't save that: ${(result as { reason: string }).reason}`
      : "Saved to memory.",
  async execute(args, ctx) {
    return createProposedMemory(ctx.userId, args.type, args.content);
  },
};

const DeleteMemoryArgs = z.object({
  memoryId: z.string().min(1).max(100),
});

const deleteMemoryTool: ToolDefinition<z.infer<typeof DeleteMemoryArgs>> = {
  name: "delete_memory",
  description:
    "Forget a previously saved memory by id. Call get_memories first to find the right id — never guess one. " +
    "Requires the user's confirmation before anything is deleted.",
  parameters: DeleteMemoryArgs,
  jsonSchema: {
    type: "object",
    properties: {
      memoryId: { type: "string", description: "The memory's id, from a prior get_memories call." },
    },
    required: ["memoryId"],
    additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "memory",
  readOnly:  false,
  describeAction: () => "Forget this saved memory?",
  describeResult: () => "Forgotten.",
  async execute(args, ctx) {
    await deleteMemory(args.memoryId, ctx.userId);
    return { deleted: true };
  },
};

export const memoryTools: ToolDefinition[] = [
  getMemories as ToolDefinition,
  proposeMemory as ToolDefinition,
  deleteMemoryTool as ToolDefinition,
];

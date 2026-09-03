/**
 * Copilot Notification Tools
 * Thin wrapper over the notification service — no new business logic.
 * Read-only: no mark-as-read/delete tool yet (Phase 4 scope is read
 * capability expansion; notification write actions are deferred).
 */
import { z } from "zod";
import { listNotifications } from "../../notifications/notificationService";
import type { ToolDefinition } from "../copilotToolRegistry";
import { optionalNullableDefault, nullableJsonSchema } from "./zodHelpers";

const GetNotificationsArgs = z.object({
  limit:      optionalNullableDefault(z.number().int().min(1).max(20), 10),
  unreadOnly: optionalNullableDefault(z.boolean(), false),
});

const getNotifications: ToolDefinition<z.infer<typeof GetNotificationsArgs>> = {
  name:        "get_notifications",
  description: "Get the authenticated user's recent TCC notifications (trades, community, marketplace, academy, etc.), most recent first. Set unreadOnly to true to see only unread ones.",
  parameters:  GetNotificationsArgs,
  jsonSchema: {
    type: "object",
    properties: {
      limit:      nullableJsonSchema({ type: "integer", minimum: 1, maximum: 20, description: "Max notifications to return. Defaults to 10." }),
      unreadOnly: nullableJsonSchema({ type: "boolean", description: "Only return unread notifications. Defaults to false." }),
    },
    additionalProperties: false,
  },
  riskLevel: "LOW",
  capability: "notifications",
  readOnly:  true,
  async execute(args, ctx) {
    const result = await listNotifications(ctx.userId, {
      page:       1,
      pageSize:   args.limit,
      unreadOnly: args.unreadOnly,
    });
    return {
      total: result.total,
      notifications: result.items.map((n) => ({
        id:        n.id,
        type:      n.type,
        priority:  n.priority,
        title:     n.title,
        message:   n.message,
        read:      n.read,
        createdAt: n.createdAt,
      })),
    };
  },
};

export const notificationTools: ToolDefinition[] = [getNotifications as ToolDefinition];

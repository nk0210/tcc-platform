/**
 * Copilot Profile Tools
 * Thin wrappers over profileService — no new business logic.
 */
import { z } from "zod";
import { profileService } from "../profileService";
import { optionalNullable, nullableJsonSchema } from "./zodHelpers";
import type { ToolDefinition } from "../copilotToolRegistry";

const GetUserProfileArgs = z.object({});

const getUserProfile: ToolDefinition<z.infer<typeof GetUserProfileArgs>> = {
  name:        "get_user_profile",
  description:
    "Get the authenticated user's own TCC profile. Returns two DIFFERENT identifiers — never treat them as " +
    "interchangeable or guess one from the other: `tccId` is the account's unique TCC ID (format like " +
    "\"TCC-GL-TRD-83401180\") — give this ONLY when asked for the \"TCC ID\" specifically. `handle` is the " +
    "user's @-style username/handle (e.g. \"nknk\") used for social features and copy-trading — give this when " +
    "asked for the \"username\", \"handle\", or what to share so others can find/follow them. Also returns " +
    "display name, bio, experience level, verification status, and trading identity (markets/symbols/strategies traded).",
  parameters:  GetUserProfileArgs,
  jsonSchema:  { type: "object", properties: {}, additionalProperties: false },
  riskLevel:   "LOW",
  capability:  "profile.own",
  readOnly:    true,
  async execute(_args, ctx) {
    const profile = await profileService.getOwnProfile(ctx.userId);
    return {
      tccId:           profile.tccId,
      handle:          profile.handle,
      displayName:     profile.displayName,
      bio:             profile.bio,
      experienceLevel: profile.experienceLevel,
      isVerified:      profile.isVerified,
      roles:           profile.roles,
      tradingIdentity: profile.tradingIdentity
        ? {
            marketsTraded:     profile.tradingIdentity.marketsTraded,
            symbolsTraded:     profile.tradingIdentity.symbolsTraded,
            strategiesUsed:    profile.tradingIdentity.strategiesUsed,
            preferredSessions: profile.tradingIdentity.preferredSessions,
          }
        : null,
      memberSince: profile.createdAt,
    };
  },
};

// Phase 9: only the fields a chat request would plausibly ask to change —
// deliberately narrower than ProfileUpdateSchema (no avatarUrl, a URL/
// upload concern, not a conversational one).
const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"] as const;
const VISIBILITIES = ["PUBLIC", "PRIVATE", "FOLLOWERS_ONLY"] as const;

const UpdateProfileArgs = z.object({
  displayName:         optionalNullable(z.string().min(1).max(50)),
  bio:                 optionalNullable(z.string().max(500)),
  location:            optionalNullable(z.string().max(100)),
  experienceLevel:     optionalNullable(z.enum(EXPERIENCE_LEVELS)),
  profileVisibility:   optionalNullable(z.enum(VISIBILITIES)),
  portfolioVisibility: optionalNullable(z.enum(VISIBILITIES)),
});

const EDITABLE_PROFILE_FIELDS = ["displayName", "bio", "location", "experienceLevel", "profileVisibility", "portfolioVisibility"] as const;

function pickProfileEdits(args: z.infer<typeof UpdateProfileArgs>) {
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (args[key] !== undefined) updates[key] = args[key];
  }
  return updates;
}

const updateProfile: ToolDefinition<z.infer<typeof UpdateProfileArgs>> = {
  name:        "update_profile",
  description: "Update the authenticated user's own TCC profile — display name, bio, location, experience level, or profile/portfolio visibility. Provide only the fields being changed. Requires the user's confirmation.",
  parameters:  UpdateProfileArgs,
  jsonSchema: {
    type: "object",
    properties: {
      displayName:         nullableJsonSchema({ type: "string", description: "Display name." }),
      bio:                 nullableJsonSchema({ type: "string", description: "Profile bio." }),
      location:            nullableJsonSchema({ type: "string", description: "Location." }),
      experienceLevel:     nullableJsonSchema({ type: "string", enum: [...EXPERIENCE_LEVELS], description: "Trading experience level." }),
      profileVisibility:   nullableJsonSchema({ type: "string", enum: [...VISIBILITIES], description: "Who can see the profile." }),
      portfolioVisibility: nullableJsonSchema({ type: "string", enum: [...VISIBILITIES], description: "Who can see portfolio/trading stats." }),
    },
    additionalProperties: false,
  },
  riskLevel:  "MEDIUM",
  capability: "profile.own",
  readOnly:   false,
  describeAction: (args) => {
    const fields = Object.keys(pickProfileEdits(args));
    return fields.length > 0 ? `Update your profile's ${fields.join(", ")}?` : "Update your profile?";
  },
  describeResult: () => "Updated your profile.",
  async execute(args, ctx) {
    const updates = pickProfileEdits(args);
    if (Object.keys(updates).length === 0) throw new Error("No fields were provided to update.");
    await profileService.updateProfile(ctx.userId, updates);
    return { updatedFields: Object.keys(updates) };
  },
};

export const profileTools: ToolDefinition[] = [
  getUserProfile as ToolDefinition,
  updateProfile as ToolDefinition,
];

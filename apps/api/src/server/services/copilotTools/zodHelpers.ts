/**
 * Shared helpers for optional tool-call arguments.
 *
 * Discovered during Phase 4 live verification: Groq (and tool-calling
 * models generally) will sometimes generate `null` for an omitted optional
 * argument instead of leaving the key out — e.g.
 * `{"from": null, "to": null}` for get_strategy_performance. Groq validates
 * the model's own generated arguments against the JSON Schema we gave it
 * BEFORE the completion ever reaches our code, and a plain `{type:
 * "string"}` schema rejects `null`, failing the entire request with a
 * generic-looking provider error. Every optional argument across every
 * Copilot tool needs to tolerate this.
 *
 * Fix, applied uniformly: widen the JSON Schema property to allow `null`
 * (nullableJsonSchema) AND widen the matching Zod field to accept `null`
 * on input while normalizing it away immediately (optionalNullable /
 * optionalNullableDefault) — so the resulting TypeScript type is exactly
 * what it was before (`T | undefined`, or `T` for a defaulted field) and
 * no execute() body anywhere needs to change.
 */
import type { z } from "zod";

/** Accepts undefined OR null, normalizes both to undefined. */
export function optionalNullable<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((v) => v ?? undefined);
}

/** Accepts undefined OR null, substitutes `fallback` for either — for a
 *  field that previously used `.optional().default(fallback)`. */
export function optionalNullableDefault<T extends z.ZodTypeAny, D>(schema: T, fallback: D) {
  return schema.nullish().transform((v) => v ?? fallback);
}

/** Widens a JSON Schema property's `type` to also accept "null" — and, if
 *  the property restricts values via `enum`, adds null there too (a `type`
 *  that allows null but an `enum` that doesn't is a contradiction that
 *  would still reject it). */
export function nullableJsonSchema<T extends { type: string | string[]; enum?: unknown[] }>(
  prop: T
): T & { type: string[] } {
  const type = Array.isArray(prop.type) ? prop.type : [prop.type];
  return {
    ...prop,
    type: [...type, "null"],
    ...(prop.enum ? { enum: [...prop.enum, null] } : {}),
  };
}

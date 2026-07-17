import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";
import { badRequest } from "../lib/response";

export function validate<T>(
  schema: ZodSchema<T>,
  source: "body" | "query" | "params" = "body"
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      badRequest(res, "Validation failed", flattenZodError(result.error));
      return;
    }

    // Replace the validated data on the request object
    (req as unknown as Record<string, unknown>)[source] = result.data;

    next();
  };
}

function flattenZodError(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  for (const issue of err.issues) {
    const key = issue.path.join(".") || "root";

    if (!out[key]) {
      out[key] = [];
    }

    out[key].push(issue.message);
  }

  return out;
}
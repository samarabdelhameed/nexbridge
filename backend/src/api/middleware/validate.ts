import { z } from "zod";
import type { Request, Response, NextFunction, RequestHandler } from "express";

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "invalid ethereum address");

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "invalid transaction hash");

export const directionSchema = z.enum(["L1_TO_L2", "L2_TO_L1"]);

export const statusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "RELEASING",
  "RELEASED",
  "FAILED",
]);

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

type ZodSchema = z.ZodTypeAny;

/**
 * Express middleware that validates req.params/query/body against zod object
 * schemas. On failure responds 400 with the validation issues.
 */
export function validate(schema: {
  params?: ZodSchema;
  query?: ZodSchema;
  body?: ZodSchema;
}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const issues: z.ZodIssue[] = [];

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) issues.push(...result.error.issues);
      else req.params = result.data as never;
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) issues.push(...result.error.issues);
      else req.query = result.data as never;
    }

    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) issues.push(...result.error.issues);
      else req.body = result.data;
    }

    if (issues.length > 0) {
      res.status(400).json({ error: "validation failed", issues });
      return;
    }
    next();
  };
}

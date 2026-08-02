import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? String(60 * 1000));
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX ?? "120");

/** Per-IP rate limiter applied to the public API. */
export const apiRateLimit: RequestHandler = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_REQUESTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

/** Stricter limiter for write-ish / subscription endpoints. */
export const strictRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

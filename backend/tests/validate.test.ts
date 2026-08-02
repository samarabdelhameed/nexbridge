import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate, addressSchema } from "../src/api/middleware/validate.js";
import type { Request, Response } from "express";

function run(params: Record<string, string>) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn();
  validate({ params: z.object({ address: addressSchema }).strict() })(
    { params } as unknown as Request,
    res,
    next,
  );
  return { res, next };
}

describe("validate middleware", () => {
  it("passes valid params through to next()", () => {
    const { next, res } = run({ address: "0x0000000000000000000000000000000000000000" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects an invalid address with 400 and does not call next()", () => {
    const { next, res } = run({ address: "nope" });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "validation failed" }));
  });
});

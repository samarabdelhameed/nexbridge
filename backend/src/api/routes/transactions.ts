import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { validate, addressSchema, txHashSchema, paginationSchema, directionSchema, statusSchema } from "../middleware/validate.js";
import { strictRateLimit } from "../middleware/rateLimit.js";

const router = Router();

/**
 * GET /api/transactions/:address
 * Full bridge history for a wallet, with optional direction/status filters
 * and pagination.
 */
router.get(
  "/transactions/:address",
  strictRateLimit,
  validate({
    params: z.object({ address: addressSchema }).strict(),
    query: paginationSchema.extend({
      direction: directionSchema.optional(),
      status: statusSchema.optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const address = (req.params as { address: string }).address.toLowerCase();
      const query = req.query as {
        limit?: number;
        offset?: number;
        direction?: string;
        status?: string;
      };

      const where = {
        userAddress: address,
        ...(query.direction ? { direction: query.direction } : {}),
        ...(query.status ? { status: query.status } : {}),
      };

      const [total, items] = await Promise.all([
        prisma.bridgeTransaction.count({ where }),
        prisma.bridgeTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: query.limit ?? 25,
          skip: query.offset ?? 0,
        }),
      ]);

      res.json({ total, offset: query.offset ?? 0, limit: query.limit ?? 25, items });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/transaction/:txHash
 * Status of a single transfer (looked up by its source-chain tx hash).
 */
router.get(
  "/transaction/:txHash",
  strictRateLimit,
  validate({ params: z.object({ txHash: txHashSchema }).strict() }),
  async (req, res, next) => {
    try {
      const { txHash } = req.params as { txHash: string };
      const tx = await prisma.bridgeTransaction.findUnique({
        where: { sourceTxHash: txHash.toLowerCase() },
      });
      if (!tx) return res.status(404).json({ error: "transaction not found" });
      res.json(tx);
    } catch (err) {
      next(err);
    }
  },
);

export default router;

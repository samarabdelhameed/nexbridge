import { Router } from "express";
import { prisma } from "../../db/client.js";
import { strictRateLimit } from "../middleware/rateLimit.js";

const router = Router();

/**
 * GET /api/stats
 * Total volume bridged, transaction count, per-direction and per-status
 * breakdowns.
 */
router.get("/stats", strictRateLimit, async (_req, res, next) => {
  try {
    const [total, l1ToL2, l2ToL1, perStatus, volume] = await Promise.all([
      prisma.bridgeTransaction.count(),
      prisma.bridgeTransaction.count({ where: { direction: "L1_TO_L2" } }),
      prisma.bridgeTransaction.count({ where: { direction: "L2_TO_L1" } }),
      prisma.bridgeTransaction.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.bridgeTransaction.aggregate({
        _sum: { amount: true },
      }),
    ]);

    res.json({
      totalTransactions: total,
      totalVolumeWei: volume._sum.amount?.toString() ?? "0",
      breakdown: {
        L1_TO_L2: l1ToL2,
        L2_TO_L1: l2ToL1,
      },
      byStatus: perStatus.reduce(
        (acc, row) => {
          acc[row.status] = row._count._all;
          return acc;
        },
        {} as Record<string, number>,
      ),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

import express from "express";
import { db } from "../db.js";

const router = express.Router();
const QUOTA_MIN = 30; // weekly quota target

const live = () => db.collection("sessions_live");
const arc  = () => db.collection("sessions_archive");

// Summary: live count, minutes today, minutes this week, quota %
router.get("/summary", async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const [liveCount, todayAgg, weekAgg] = await Promise.all([
    live().countDocuments(),
    arc().aggregate([
      { $match: { endedAt: { $gte: todayStart } } },
      { $group: { _id: null, minutes: { $sum: "$minutes" } } }
    ]).toArray(),
    arc().aggregate([
      { $match: { endedAt: { $gte: weekStart } } },
      { $group: { _id: null, minutes: { $sum: "$minutes" } } }
    ]).toArray(),
  ]);

  const todayMinutes = todayAgg[0]?.minutes ?? 0;
  const weekMinutes  = weekAgg[0]?.minutes ?? 0;

  // simple quota metric: % of members who hit 30m (requires member count if you want precise)
  // For now: compute average mins per unique user this week
  const perUser = await arc().aggregate([
    { $match: { endedAt: { $gte: weekStart } } },
    { $group: { _id: "$userId", minutes: { $sum: "$minutes" } } },
    { $group: { _id: null, hit: { $sum: { $cond: [{ $gte: ["$minutes", QUOTA_MIN] }, 1, 0] } }, total: { $sum: 1 } } }
  ]).toArray();

  const hit = perUser[0]?.hit ?? 0;
  const total = perUser[0]?.total ?? 0;
  const quotaPct = total ? Math.round((hit / total) * 100) : 0;

  res.json({
    liveCount,
    todayMinutes,
    weekMinutes,
    quotaPct,
    quotaTarget: QUOTA_MIN,
  });
});

// Recent sessions (last 20)
router.get("/recent", async (_req, res) => {
  const rows = await arc().find({})
    .sort({ endedAt: -1 })
    .limit(20)
    .toArray();
  res.json(rows);
});

// Leaderboard (this week, top 10)
router.get("/leaderboard", async (_req, res) => {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const rows = await arc().aggregate([
    { $match: { endedAt: { $gte: weekStart } } },
    { $group: { _id: "$userId", minutes: { $sum: "$minutes" } } },
    { $sort: { minutes: -1 } },
    { $limit: 10 }
  ]).toArray();

  res.json(rows.map(r => ({ userId: r._id, minutes: r.minutes })));
});

export default router;

// backend/routes/stats.js
import express from "express";
import { getDb } from "../db.js";

const router = express.Router();
const QUOTA_MIN = 30;

// always fetch db lazily
const live = () => getDb().collection("sessions_live");
const arc  = () => getDb().collection("sessions_archive");

// GET /stats/summary
router.get("/summary", async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const [liveCount, todayAgg, weekAgg] = await Promise.all([
    live().estimatedDocumentCount(),
    arc().aggregate([
      { $match: { endedAt: { $gte: todayStart } } },
      { $group: { _id: null, minutes: { $sum: "$minutes" } } }
    ]).toArray(),
    arc().aggregate([
      { $match: { endedAt: { $gte: weekStart } } },
      { $group: { _id: null, minutes: { $sum: "$minutes" } } }
    ]).toArray(),
  ]);

  const todayMinutes = Math.round(todayAgg[0]?.minutes ?? 0);
  const weekMinutes  = Math.round(weekAgg[0]?.minutes ?? 0);

  const perUser = await arc().aggregate([
    { $match: { endedAt: { $gte: weekStart } } },
    { $group: { _id: "$userId", minutes: { $sum: "$minutes" } } },
    { $group: { _id: null,
      hit: { $sum: { $cond: [{ $gte: ["$minutes", QUOTA_MIN] }, 1, 0] } },
      total: { $sum: 1 }
    } }
  ]).toArray();

  const hit = perUser[0]?.hit ?? 0;
  const total = perUser[0]?.total ?? 0;
  const quotaPct = total ? Math.round((hit / total) * 100) : 0;

  res.json({ liveCount, todayMinutes, weekMinutes, quotaPct, quotaTarget: QUOTA_MIN });
});

// GET /stats/recent
router.get("/recent", async (_req, res) => {
  const rows = await arc()
    .find({}, { projection: { _id: 0, userId: 1, minutes: 1, startedAt: 1, endedAt: 1, lastHeartbeat: 1 } })
    .sort({ endedAt: -1 })
    .limit(20)
    .toArray();
  res.json(rows);
});

// GET /stats/leaderboard
router.get("/leaderboard", async (_req, res) => {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const rows = await arc().aggregate([
    { $match: { endedAt: { $gte: weekStart } } },
    { $group: { _id: "$userId", minutes: { $sum: "$minutes" } } },
    { $sort: { minutes: -1 } },
    { $limit: 10 }
  ]).toArray();

  res.json(rows.map(r => ({ userId: r._id, minutes: Math.round(r.minutes) })));
});

export default router;

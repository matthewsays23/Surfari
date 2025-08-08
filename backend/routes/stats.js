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

function getWeekWindow(now = new Date(), weekStartsOn = "monday") {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const offset = weekStartsOn === "monday"
    ? (day === 0 ? 6 : day - 1)   // Mon=0..Sun=6
    : day;                        // Sun=0..Sat=6

  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  start.setHours(0,0,0,0);
  const end = new Date(start); // exclusive end
  end.setDate(start.getDate() + 7);
  return { start, end };
}

// sum “live” minutes for users currently online
async function liveMinutesMap(db) {
  const rows = await db.collection("sessions_live")
    .find({}, { projection: { userId: 1, startedAt: 1, lastHeartbeat: 1 } })
    .toArray();

  const now = Date.now();
  const m = new Map();
  for (const r of rows) {
    const startedAt = new Date(r.startedAt).getTime();
    const lastBeat = new Date(r.lastHeartbeat || r.startedAt).getTime();
    // be conservative and use the lesser “elapsed” from now vs last heartbeat
    const elapsedMs = Math.max(0, Math.min(now - startedAt, now - lastBeat));
    const mins = Math.round(elapsedMs / 60000);
    m.set(r.userId, (m.get(r.userId) || 0) + mins);
  }
  return m; // Map<userId, minutes>
}

import axios from "axios";
const QUOTAMIN = 30; // minutes target

// GET /stats/quota/summary
// -> { weekStart, weekEnd, requiredMinutes, metCount, totalUsers, quotaPct }
router.get("/quota/summary", async (_req, res) => {
  const db = getDb();
  const { start, end } = getWeekWindow(new Date(), "monday");

  const agg = await db.collection("sessions_archive").aggregate([
    { $match: { endedAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$userId", minutes: { $sum: "$minutes" } } },
  ]).toArray();

  // include live minutes
  const liveMap = await liveMinutesMap(db);
  const perUser = agg.map(r => ({ userId: r._id, minutes: r.minutes + (liveMap.get(r._id) || 0) }));
  // add users who are only live
  for (const [uid, mins] of liveMap) {
    if (!perUser.find(p => p.userId === uid)) perUser.push({ userId: uid, minutes: mins });
  }

  const totalUsers = perUser.length;
  const metCount = perUser.filter(p => p.minutes >= QUOTAMIN).length;
  const quotaPct = totalUsers ? Math.round((metCount / totalUsers) * 100) : 0;

  res.json({
    weekStart: start, weekEnd: end,
    requiredMinutes: QUOTAMIN,
    metCount, totalUsers, quotaPct
  });
});

// GET /stats/quota/list
// -> [{ userId, minutes, remaining, met, username, displayName, thumb }]
router.get("/quota/list", async (_req, res) => {
  const db = getDb();
  const { start, end } = getWeekWindow(new Date(), "monday");

  const agg = await db.collection("sessions_archive").aggregate([
    { $match: { endedAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$userId", minutes: { $sum: "$minutes" } } },
  ]).toArray();

  const liveMap = await liveMinutesMap(db);
  const perUser = new Map();
  for (const r of agg) perUser.set(r._id, r.minutes);
  for (const [uid, mins] of liveMap) perUser.set(uid, (perUser.get(uid) || 0) + mins);

  const list = Array.from(perUser.entries()).map(([userId, minutes]) => ({
    userId,
    minutes: Math.round(minutes),
    remaining: Math.max(0, QUOTAMIN - Math.round(minutes)),
    met: minutes >= QUOTAMIN
  }));

  // Enrich with username/displayName & thumbnails via Roblox (batched in parallel)
  // (We’ll keep it simple: do N requests; if you want, add your /roblox/users + /roblox/thumbs proxy)
  const enriched = await Promise.all(list.map(async (row) => {
    try {
      const user = await axios.get(`https://users.roblox.com/v1/users/${row.userId}`);
      const t = await axios.get("https://thumbnails.roblox.com/v1/users/avatar-headshot", {
        params: { userIds: row.userId, size: "100x100", format: "Png", isCircular: "true" },
      });
      const img = t.data?.data?.[0]?.imageUrl || "";
      return {
        ...row,
        username: user.data?.name || `User_${row.userId}`,
        displayName: user.data?.displayName || user.data?.name || `User_${row.userId}`,
        thumb: img
      };
    } catch {
      return {
        ...row,
        username: `User_${row.userId}`,
        displayName: `User_${row.userId}`,
        thumb: ""
      };
    }
  }));

  // Sort: unmet first (by remaining desc), then met (by minutes desc)
  enriched.sort((a, b) => {
    if (a.met !== b.met) return a.met ? 1 : -1;
    return a.met ? b.minutes - a.minutes : b.remaining - a.remaining;
  });

  res.json(enriched);
});

// GET /stats/quota/user/:userId
// -> { userId, minutes, remaining, met, weekStart, weekEnd }
router.get("/quota/user/:userId", async (req, res) => {
  const db = getDb();
  const userId = parseInt(req.params.userId, 10);
  if (!userId) return res.status(400).json({ error: "Invalid userId" });

  const { start, end } = getWeekWindow(new Date(), "monday");

  const agg = await db.collection("sessions_archive").aggregate([
    { $match: { userId, endedAt: { $gte: start, $lt: end } } },
    { $group: { _id: null, minutes: { $sum: "$minutes" } } },
  ]).toArray();

  const archived = Math.round(agg[0]?.minutes ?? 0);
  const liveMap = await liveMinutesMap(db);
  const total = archived + (liveMap.get(userId) || 0);

  res.json({
    userId,
    weekStart: start, weekEnd: end,
    minutes: total,
    remaining: Math.max(0, QUOTAMIN - total),
    met: total >= QUOTAMIN,
  });
});

// GET /stats/progress?limit=25&page=1&search=yo
// Returns paginated weekly minutes per user: { rows: [{ userId, minutes }], total, page, pages, limit }
router.get("/progress", async (req, res) => {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "25", 10)));
  const page  = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const search = (req.query.search || "").trim().toLowerCase();

  // Aggregate total minutes per user for this week
  const base = [
    { $match: { endedAt: { $gte: weekStart } } },
    { $group: { _id: "$userId", minutes: { $sum: "$minutes" } } },
  ];

  // We’ll page the aggregated results
  const [{ count: total } = { count: 0 }] = await arc().aggregate([
    ...base,
    { $count: "count" },
  ]).toArray();

  // Sort by minutes desc, then paginate
  const rows = await arc().aggregate([
    ...base,
    { $sort: { minutes: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { _id: 0, userId: "$._id", minutes: 1 } }
  ]).toArray();

  // Optional simple “search” by userId prefix (client can do name-based search after it fetches names)
  const filtered = search
    ? rows.filter(r => String(r.userId).startsWith(search))
    : rows;

  res.json({
    rows: filtered.map(r => ({ userId: r.userId ?? r._id, minutes: Math.round(r.minutes || 0) })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    limit,
    quotaTarget: QUOTA_MIN,
  });
});


export default router;

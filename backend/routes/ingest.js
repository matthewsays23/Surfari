import express from "express";
import { db } from "../db.js";

const router = express.Router();
const GAME_INGEST_KEY = process.env.GAME_INGEST_KEY;

function assertAuth(req, res) {
  const k = req.header("X-Game-Key");
  if (!k || k !== GAME_INGEST_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

const live = () => db.collection("sessions_live");
const arc  = () => db.collection("sessions_archive");

// START
router.post("/session/start", async (req, res) => {
  if (!assertAuth(req, res)) return;
  const { userId, serverId, placeId } = req.body || {};
  if (!userId || !serverId) return res.status(400).json({ error: "Missing userId/serverId" });

  const now = new Date();
  await live().updateOne(
    { userId, serverId },
    { $set: {
        userId, serverId, placeId: placeId ?? null,
        startedAt: now, lastHeartbeat: now, minutes: 0
      }
    },
    { upsert: true }
  );
  res.json({ ok: true });
});

// HEARTBEAT
router.post("/session/heartbeat", async (req, res) => {
  if (!assertAuth(req, res)) return;
  const { userId, serverId } = req.body || {};
  if (!userId || !serverId) return res.status(400).json({ error: "Missing userId/serverId" });

  const doc = await live().findOne({ userId, serverId });
  if (!doc) return res.status(404).json({ error: "session not found" });

  const now = new Date();
  // add delta minutes since last heartbeat (clamp to avoid big jumps)
  const deltaMin = Math.min(3, Math.max(0, (now - new Date(doc.lastHeartbeat)) / 60000));
  await live().updateOne(
    { _id: doc._id },
    { $set: { lastHeartbeat: now }, $inc: { minutes: deltaMin } }
  );

  res.json({ ok: true });
});

// END
router.post("/session/end", async (req, res) => {
  if (!assertAuth(req, res)) return;
  const { userId, serverId } = req.body || {};
  if (!userId || !serverId) return res.status(400).json({ error: "Missing userId/serverId" });

  const doc = await live().findOne({ userId, serverId });
  if (!doc) return res.json({ ok: true }); // already gone

  const endedAt = new Date();
  await arc().insertOne({
    userId: doc.userId,
    serverId: doc.serverId,
    placeId: doc.placeId ?? null,
    startedAt: doc.startedAt,
    endedAt,
    minutes: Math.round(doc.minutes),
  });
  await live().deleteOne({ _id: doc._id });

  res.json({ ok: true });
});

// CRON-SAFE: close stale sessions (no heartbeat for > 3 min)
router.post("/session/cleanup", async (req, res) => {
  if (!assertAuth(req, res)) return;
  const threshold = new Date(Date.now() - 3 * 60 * 1000);
  const cursor = live().find({ lastHeartbeat: { $lt: threshold } });

  let closed = 0;
  for await (const doc of cursor) {
    await arc().insertOne({
      userId: doc.userId,
      serverId: doc.serverId,
      placeId: doc.placeId ?? null,
      startedAt: doc.startedAt,
      endedAt: doc.lastHeartbeat,
      minutes: Math.round(doc.minutes),
      reason: "stale",
    });
    await live().deleteOne({ _id: doc._id });
    closed++;
  }
  res.json({ closed });
});

export default router;

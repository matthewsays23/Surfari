import express from "express";
import { getDb } from "../db.js";

const router = express.Router();
const db = getDb();
const live = () => db.collection("sessions_live");
const arc  = () => db.collection("sessions_archive");

const GAME_INGEST_KEY = process.env.GAME_INGEST_KEY;
const ok = (req, res) => {
  const k = req.header("X-Game-Key");
  if (!k || k !== GAME_INGEST_KEY) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
};

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/session/start", async (req, res) => {
  if (!ok(req, res)) return;
  const { userId, serverId, placeId } = req.body || {};
  if (!userId || !serverId) return res.status(400).json({ error: "Missing userId/serverId" });
  const now = new Date();
  await live().updateOne(
    { userId, serverId },
    { $set: { userId, serverId, placeId: placeId ?? null, startedAt: now, lastHeartbeat: now, minutes: 0 } },
    { upsert: true }
  );
  res.json({ ok: true });
});

router.post("/session/heartbeat", async (req, res) => {
  if (!ok(req, res)) return;
  const { userId, serverId } = req.body || {};
  if (!userId || !serverId) return res.status(400).json({ error: "Missing userId/serverId" });

  const doc = await live().findOne({ userId, serverId });
  if (!doc) return res.status(404).json({ error: "session not found" });

  const now = new Date();
  const deltaMin = Math.min(3, Math.max(0, (now - new Date(doc.lastHeartbeat)) / 60000));
  await live().updateOne({ _id: doc._id }, { $set: { lastHeartbeat: now }, $inc: { minutes: deltaMin } });
  res.json({ ok: true });
});

router.post("/session/end", async (req, res) => {
  if (!ok(req, res)) return;
  const { userId, serverId } = req.body || {};
  if (!userId || !serverId) return res.status(400).json({ error: "Missing userId/serverId" });

  const doc = await live().findOne({ userId, serverId });
  if (doc) {
    await arc().insertOne({
      userId: doc.userId, serverId: doc.serverId, placeId: doc.placeId ?? null,
      startedAt: doc.startedAt, endedAt: new Date(), minutes: Math.round(doc.minutes),
    });
    await live().deleteOne({ _id: doc._id });
  }
  res.json({ ok: true });
});

export default router;

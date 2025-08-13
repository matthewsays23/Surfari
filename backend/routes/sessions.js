// backend/routes/sessions.js
import express from "express";
import { getDb } from "../db.js";

const router = express.Router();
const EST_SLOTS = [0,3,6,9,12,15,18,21]; // 2-hour blocks

// Middleware: auth (admin check not required to claim; adjust if needed)
async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").split(" ")[1];
    if (!token) return res.status(401).json({ error: "Missing token" });
    const db = getDb();
    const s = await db.collection("sessions").findOne({ token }); // same collection you used for auth tokens
    if (!s?.userId) return res.status(403).json({ error: "Invalid token" });
    req.userId = s.userId;
    next();
  } catch (e) {
    res.status(500).json({ error: "Auth error" });
  }
}

// GET /sessions?weekStart=ISO
router.get("/", async (req, res) => {
  const db = getDb();
  const weekStart = new Date(req.query.weekStart || new Date());
  const ws = getWeekStart(weekStart);
  const we = new Date(ws); we.setDate(ws.getDate()+7);

  const rows = await db.collection("calendar_sessions")
    .find({ start: { $gte: ws, $lt: we } })
    .project({ _id: 0 })
    .toArray();

  res.json(rows);
});

// POST /sessions/seed (admin-only in real use)
// Creates sessions for the week (Mon..Sun x EST slots). Idempotent.
router.post("/seed", async (req, res) => {
  const db = getDb();
  const weekStart = getWeekStart(new Date(req.body.weekStart || new Date()));
  const bulk = [];
  for (let d=0; d<7; d++) {
    const day = new Date(weekStart); day.setDate(weekStart.getDate()+d);
    for (const h of EST_SLOTS) {
      const { startUTC, endUTC } = estSlotForDay(day, h);
      const id = `sess-${startUTC.toISOString()}`;
      bulk.push({
        updateOne: {
          filter: { id },
          update: {
            $setOnInsert: {
              id,
              start: startUTC,
              end: endUTC,
              title: "Training Session",
              serverTag: null,
              hostId: null,
              cohostId: null,
              trainerIds: []
            }
          },
          upsert: true
        }
      });
    }
  }
  if (bulk.length) await db.collection("calendar_sessions").bulkWrite(bulk, { ordered: false });
  res.json({ ok: true, created: true });
});

// POST /sessions/claim  { sessionId, role: "host"|"cohost"|"trainer", userId? }
router.post("/claim", auth, async (req, res) => {
  const db = getDb();
  const { sessionId, role, userId } = req.body;
  const uid = userId || req.userId;
  if (!sessionId || !role) return res.status(400).json({ error: "Missing fields" });

  const s = await db.collection("calendar_sessions").findOne({ id: sessionId });
  if (!s) return res.status(404).json({ error: "Session not found" });

  if (role === "host") {
    if (s.hostId && s.hostId !== uid) return res.status(409).json({ error: "Host taken" });
    await db.collection("calendar_sessions").updateOne({ id: sessionId }, { $set: { hostId: uid } });
  } else if (role === "cohost") {
    if (s.cohostId && s.cohostId !== uid) return res.status(409).json({ error: "Co-host taken" });
    await db.collection("calendar_sessions").updateOne({ id: sessionId }, { $set: { cohostId: uid } });
  } else if (role === "trainer") {
    await db.collection("calendar_sessions").updateOne(
      { id: sessionId },
      { $addToSet: { trainerIds: uid } }
    );
  } else {
    return res.status(400).json({ error: "Invalid role" });
  }
  res.json({ ok: true });
});

// POST /sessions/unclaim { sessionId, role, userId? }
router.post("/unclaim", auth, async (req, res) => {
  const db = getDb();
  const { sessionId, role, userId } = req.body;
  const uid = userId || req.userId;
  const s = await db.collection("calendar_sessions").findOne({ id: sessionId });
  if (!s) return res.status(404).json({ error: "Session not found" });

  if (role === "host" && s.hostId === uid) {
    await db.collection("calendar_sessions").updateOne({ id: sessionId }, { $set: { hostId: null } });
  } else if (role === "cohost" && s.cohostId === uid) {
    await db.collection("calendar_sessions").updateOne({ id: sessionId }, { $set: { cohostId: null } });
  } else if (role === "trainer") {
    await db.collection("calendar_sessions").updateOne({ id: sessionId }, { $pull: { trainerIds: uid } });
  } else {
    return res.status(400).json({ error: "Cannot unclaim" });
  }
  res.json({ ok: true });
});

/* —— helpers —— */
function getWeekStart(date){
  const d = new Date(date); const dow=d.getDay(); const diff=(dow===0?-6:1-dow);
  d.setDate(d.getDate()+diff); d.setHours(0,0,0,0); return d;
}
function estSlotForDay(localDay, estHour){
  const y=localDay.getFullYear(), m=localDay.getMonth(), d=localDay.getDate();
  const estLocal = new Date(`${y}-${m+1}-${d}T${String(estHour).padStart(2,"0")}:00:00`);
  const startUTC = new Date(estLocal.toLocaleString("en-US",{timeZone:"UTC"}));
  const endUTC = new Date(startUTC.getTime()+2*60*60*1000);
  return { startUTC, endUTC };
}

export default router;

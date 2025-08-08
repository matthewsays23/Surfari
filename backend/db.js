// backend/db.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

let client;
let db;
let ready;

export function getDb() {
  if (!db) throw new Error("DB not initialized yet. Call initDb() first.");
  return db;
}

export async function initDb() {
  if (ready) return ready; // prevent double init
  ready = (async () => {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("surfari");

    // indexes (safe to run every boot)
    await db.collection("sessions_live").createIndex({ userId: 1, serverId: 1 }, { unique: true });
    await db.collection("sessions_live").createIndex({ lastHeartbeat: 1 });
    await db.collection("sessions_archive").createIndex({ userId: 1, endedAt: -1 });

    return db;
  })();
  return ready;
}

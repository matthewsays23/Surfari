// db.js (recap)
import { MongoClient } from "mongodb";
const uri = process.env.MONGODB_URI;
let client, db, ready;

export function getDb() {
  if (!db) throw new Error("DB not initialized; call initDb() first.");
  return db;
}
export async function initDb() {
  if (ready) return ready;
  ready = (async () => {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("surfari");
    await db.collection("sessions_live").createIndex({ userId: 1, serverId: 1 }, { unique: true });
    await db.collection("sessions_live").createIndex({ lastHeartbeat: 1 });
    await db.collection("sessions_archive").createIndex({ userId: 1, endedAt: -1 });
    return db;
  })();
  return ready;
}

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

export const client = new MongoClient(uri);
await client.connect();
export const db = client.db("surfari");

await db.collection("sessions_live").createIndex({ userId: 1, serverId: 1 }, { unique: true });
await db.collection("sessions_live").createIndex({ lastHeartbeat: 1 });
await db.collection("sessions_archive").createIndex({ userId: 1, endedAt: -1 });

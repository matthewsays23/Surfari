import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

export const client = new MongoClient(uri);
await client.connect();
export const db = client.db("surfari");

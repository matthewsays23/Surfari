// Replace the in-memory Map with a MongoDB collection
import { MongoClient } from "mongodb";
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db("surfari");
const sessions = db.collection("sessions");

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import robloxRoutes from "./routes/roblox.js";


const app = express();

app.use(cors({
  origin: ["https://surfari.io"],
  credentials: true,
}));


// Mount your /auth routes here
const { default: authRoutes } = await import("./routes/auth.js");
app.use("/auth", authRoutes);

app.use("/roblox", robloxRoutes);

app.get("/", (req, res) => {
  res.json({ status: "Surfari backend running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

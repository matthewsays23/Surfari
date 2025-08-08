import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { initDb } from "./db.js";

import authRoutes from "./routes/auth.js";
import robloxRoutes from "./routes/roblox.js";
import ingestRoutes from "./routes/ingest.js";
import statsRoutes from "./routes/stats.js";

const app = express();

const ALLOW_ORIGINS = ["https://surfari.io", "http://localhost:5173"];
const corsOptions = {
  origin(origin, cb) { if (!origin) return cb(null, true); cb(null, ALLOW_ORIGINS.includes(origin)); },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Game-Key"],
  credentials: false,
};
app.use(cors(corsOptions));
app.use(express.json());

// ensure DB is ready before we mount routes that use it
await initDb();

app.use("/auth", authRoutes);
app.use("/roblox", robloxRoutes);
app.use("/ingest", ingestRoutes);   // <- POST endpoints from the Roblox server script
app.use("/stats", statsRoutes);     // <- dashboard queries

app.get("/", (_req, res) => res.json({ status: "Surfari backend running" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
